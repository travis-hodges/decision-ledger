import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { frameSchema, validateGroundedFrame } from "./frame.mjs";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));

const model = process.env.OPENAI_MODEL || "gpt-6-astra";
const port = Number(process.env.PORT || 8787);
const decisionSchema = JSON.parse(
  readFileSync(
    new URL("../schema/decision.schema.json", import.meta.url),
    "utf8",
  ),
);
const validateDecision = new Ajv2020().compile(decisionSchema);
app.get("/api/health", (_req, res) =>
  res.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    model,
    tools: ["calculation", "public web search"],
  }),
);

app.post("/api/frame", async (req, res) => {
  if (!process.env.OPENAI_API_KEY)
    return res
      .status(503)
      .json({ error: "OPENAI_API_KEY is not configured on the server." });
  const { prompt } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 16000)
    return res
      .status(400)
      .json({ error: "Provide a decision request under 16,000 characters." });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      reasoning: { effort: "high" },
      instructions:
        "Structure only the user's request into a draft decision frame. Do not invent options, constraints, prices, requirements, or facts. For each extracted option or constraint, copy an exact excerpt from the request. If none are stated, return an empty array. Question and objective may be concise draft phrasing; suggested criteria are proposals, never facts. Put ambiguity and missing information in openQuestions. Do not use outside knowledge.",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "decision_frame",
          schema: Object.fromEntries(
            Object.entries(frameSchema).filter(
              ([key]) => key !== "$schema" && key !== "title",
            ),
          ),
          strict: true,
        },
      },
      store: false,
      max_output_tokens: 5000,
    });
    if (response.status !== "completed" || !response.output_text)
      return res
        .status(502)
        .json({ error: "The model did not complete a decision frame." });
    const draft = JSON.parse(response.output_text);
    if (!validateGroundedFrame(draft, prompt))
      return res.status(502).json({
        error:
          "The draft did not pass source grounding checks. Try a more explicit request.",
      });
    res.json({ draft, model, responseId: response.id });
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not structure the request.",
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  if (!process.env.OPENAI_API_KEY)
    return res
      .status(503)
      .json({ error: "OPENAI_API_KEY is not configured on the server." });
  const { prompt, decision, publicWeb } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 16000)
    return res
      .status(400)
      .json({ error: "Provide a decision request under 16,000 characters." });
  if (!decision || typeof decision !== "object" || Array.isArray(decision))
    return res.status(400).json({ error: "Decision context is required." });
  if (!validateDecision(decision))
    return res
      .status(400)
      .json({ error: "Decision context does not match the published schema." });

  const sourceRecords = Array.isArray(decision.evidence)
    ? decision.evidence.slice(0, 30).map((e) => ({
        id: String(e.id || ""),
        title: String(e.title || "").slice(0, 200),
        source: String(e.source || "").slice(0, 200),
        url: String(e.url || "").slice(0, 500),
        date: String(e.date || ""),
        verified: Boolean(e.verified),
        notes: String(e.notes || "").slice(0, 3000),
      }))
    : [];
  const marketRecords = Array.isArray(decision.market)
    ? decision.market.slice(0, 100).map((m) => ({
        vendor: String(m.vendor || ""),
        description: String(m.vehicle || ""),
        year: Number(m.year) || null,
        unitPrice: Number(m.unitPrice) || null,
        quantity: Number(m.quantity) || null,
        source: String(m.source || ""),
        url: String(m.url || ""),
        verified: Boolean(m.verified),
      }))
    : [];
  const modelContext = {
    title: String(decision.title || "").slice(0, 200),
    question: String(decision.question || "").slice(0, 2000),
    objective: String(decision.objective || "").slice(0, 2000),
    criteria: Array.isArray(decision.criteria)
      ? decision.criteria.slice(0, 30)
      : [],
    options: Array.isArray(decision.options)
      ? decision.options.slice(0, 30)
      : [],
    assumptions: Array.isArray(decision.assumptions)
      ? decision.assumptions.slice(0, 30)
      : [],
    risks: Array.isArray(decision.risks) ? decision.risks.slice(0, 30) : [],
    biasChecks: Array.isArray(decision.biasChecks)
      ? decision.biasChecks.slice(0, 30)
      : [],
    budgetCeiling: Number(decision.budgetCeiling) || null,
    maxLeadDays: Number(decision.maxLeadDays) || null,
    evidence: sourceRecords,
    market: marketRecords,
  };
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const emit = (type, data) => {
    if (!res.writableEnded)
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const instructions = `You are an acquisition and engineering decision analyst. Analyze only the user's supplied decision context and source records. The user may ask you to frame a new decision from a messy request. Do not invent bids, prices, suppliers, people, requirements, test results, or source material. Distinguish fact, inference, and a proposed next step. Cite user-provided evidence by its exact [source:id] after each supported claim. If a source is unverified, say so. If public web search is enabled, cite live source URLs. If evidence is insufficient, say what is missing; do not force a recommendation. Use the python tool for nontrivial quantitative calculations, showing assumptions and units. Organize the answer into: Decision frame; Evidence-backed analysis; Historical price or bid context (only if supplied); Sensitivity and risks; Missing information; Recommended next actions. Do not claim to approve a procurement decision. Do not expose hidden reasoning or chain of thought.`;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const tools = [
      { type: "code_interpreter", container: { type: "auto" } },
      ...(publicWeb === true ? [{ type: "web_search" }] : []),
    ];
    emit("status", {
      phase: "analyzing",
      model,
      tools: tools.map((t) => t.type),
    });
    const stream = await client.responses.create(
      {
        model,
        reasoning: { effort: "high" },
        instructions,
        input: JSON.stringify({ request: prompt, decision: modelContext }),
        tools,
        stream: true,
        store: false,
        max_output_tokens: 7000,
      },
      { signal: controller.signal },
    );
    for await (const event of stream) {
      if (event.type === "response.output_text.delta")
        emit("delta", { text: event.delta });
      else if (
        event.type === "response.output_item.added" &&
        ["web_search_call", "code_interpreter_call"].includes(event.item?.type)
      )
        emit("tool", { tool: event.item.type });
      else if (event.type === "response.completed")
        emit("done", {
          id: event.response.id,
          usage: event.response.usage ?? null,
        });
      else if (event.type === "response.failed")
        emit("error", {
          error: event.response.error?.message || "Analysis failed.",
        });
      else if (event.type === "error")
        emit("error", { error: event.message || "Analysis failed." });
    }
  } catch (error) {
    if (!controller.signal.aborted)
      emit("error", {
        error: error instanceof Error ? error.message : "Analysis failed.",
      });
  } finally {
    res.end();
  }
});

app.listen(port, "127.0.0.1", () =>
  console.log(`Decision Ledger API ready on http://127.0.0.1:${port}`),
);
