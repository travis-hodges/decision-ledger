import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  Download,
  FileCheck2,
  FileText,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import Papa from "papaparse";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AnalysisRun,
  Decision,
  Evidence,
  FrameDraft,
  MarketRecord,
} from "./model";
import { dateLabel, money, uid } from "./model";
import {
  createRun,
  evaluate,
  findFlip,
  fingerprint,
  marketStats,
  packageData,
  readiness,
} from "./engine";
import { seedDecisions } from "./seed";
import AnalysisPage from "./AnalysisPage";
import "./App.css";
import "./flat.css";

type Page =
  | "overview"
  | "analysis"
  | "workspace"
  | "market"
  | "evidence"
  | "people"
  | "package";
type WorkspaceTab = "frame" | "compare" | "challenge" | "history";
const key = "decision-ledger-v2";
const initial = (): Decision[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw
      ? (JSON.parse(raw) as Decision[]).map((d) => ({
          ...d,
          analyses: d.analyses ?? [],
        }))
      : seedDecisions;
  } catch {
    return seedDecisions;
  }
};
const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analysis", label: "Analysis", icon: BrainCircuit },
  { id: "workspace", label: "Decision workspace", icon: GitCompareArrows },
  { id: "market", label: "Market intelligence", icon: Activity },
  { id: "evidence", label: "Evidence library", icon: Database },
  { id: "people", label: "Contacts", icon: Users },
  { id: "package", label: "Decision package", icon: FileCheck2 },
];

function App() {
  const [decisions, setDecisions] = useState<Decision[]>(initial);
  const [activeId, setActiveId] = useState(decisions[0]?.id ?? "");
  const [page, setPage] = useState<Page>("overview");
  const [tab, setTab] = useState<WorkspaceTab>("frame");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [scenarioWeight, setScenarioWeight] = useState<Record<string, number>>(
    {},
  );
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [analysisText, setAnalysisText] = useState("");
  const [analysisPhase, setAnalysisPhase] = useState<
    "idle" | "streaming" | "done" | "error"
  >("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisTools, setAnalysisTools] = useState<string[]>([]);
  const [frameDraft, setFrameDraft] = useState<
    (FrameDraft & { decisionId: string; inputFingerprint: string }) | null
  >(null);
  const [framePhase, setFramePhase] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [frameError, setFrameError] = useState("");
  const [allowPublicWeb, setAllowPublicWeb] = useState(false);
  const [apiHealth, setApiHealth] = useState<{
    configured: boolean;
    model: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const decision = decisions.find((d) => d.id === activeId) ?? decisions[0];
  const matchingDecisions = decisions.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase()),
  );
  const evaluation = useMemo(
    () => evaluate(decision, scenarioWeight),
    [decision, scenarioWeight],
  );
  const baseEvaluation = useMemo(() => evaluate(decision), [decision]);
  const ready = useMemo(() => readiness(decision), [decision]);
  const flip = useMemo(() => findFlip(decision), [decision]);
  const stats = useMemo(
    () => marketStats(decision.market.filter((record) => record.verified)),
    [decision],
  );
  const latestRun = decision.runs[0];
  const stale = !latestRun || latestRun.fingerprint !== fingerprint(decision);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setApiHealth)
      .catch(() => setApiHealth(null));
  }, []);

  function commit(next: Decision[]) {
    setDecisions(next);
    localStorage.setItem(key, JSON.stringify(next));
  }
  function update(fn: (d: Decision) => Decision) {
    const target = decision.id;
    setDecisions((previous) => {
      const next = previous.map((d) =>
        d.id === target ? { ...fn(d), updatedAt: new Date().toISOString() } : d,
      );
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }
  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }
  function run() {
    if (!evaluate(decision).modelValid) {
      toast(
        "Complete two options, criteria, weights, and scores before running.",
      );
      return;
    }
    update((d) => ({
      ...d,
      runs: [
        createRun(
          d,
          d.kind === "Decision program" ? "Evidence refresh" : "Evaluation run",
        ),
        ...d.runs,
      ],
    }));
    toast("Reproducible evaluation saved.");
  }
  function download() {
    const blob = new Blob([JSON.stringify(packageData(decision), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${decision.id}-decision-package.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Decision package exported.");
  }
  function addDecision(title: string, kind: Decision["kind"]) {
    const next: Decision = {
      id: uid(),
      title: title.trim(),
      kind,
      question: "",
      objective: "",
      owner: "",
      phase: "Intake",
      dueDate: "",
      budgetCeiling: 0,
      maxLeadDays: 0,
      criteria: [],
      options: [],
      evidence: [],
      market: [],
      contacts: [],
      assumptions: [],
      risks: [],
      biasChecks: [],
      runs: [],
      analyses: [],
      updatedAt: new Date().toISOString(),
    };
    commit([next, ...decisions]);
    setActiveId(next.id);
    setPage("workspace");
    setTab("frame");
    setShowCreate(false);
    setScenarioWeight({});
  }
  function loadDecision(id: string) {
    setActiveId(id);
    setScenarioWeight({});
    setPage("workspace");
    setTab("frame");
  }
  function resetDemo() {
    if (
      !window.confirm(
        "Clear local decisions and start with an empty workspace?",
      )
    )
      return;
    localStorage.removeItem(key);
    commit(seedDecisions);
    setActiveId(seedDecisions[0].id);
    setPage("overview");
    toast("Local workspace cleared.");
  }
  function openCsv(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const valid = result.data
          .map(
            (r) =>
              ({
                id: uid(),
                vendor: (r.vendor ?? r.Vendor ?? "").trim(),
                vehicle: (
                  r.description ??
                  r.Description ??
                  r.vehicle ??
                  ""
                ).trim(),
                year: Number(r.year ?? r.Year),
                unitPrice: Number(r.unit_price ?? r.unitPrice ?? r.price),
                quantity: Number(r.quantity ?? r.Quantity),
                source: (r.source ?? r.Source ?? file.name).trim(),
                url: (r.url ?? r.URL ?? "").trim(),
                verified: false,
              }) as MarketRecord,
          )
          .filter(
            (r) =>
              r.vendor &&
              r.year >= 1900 &&
              r.year <= 2100 &&
              r.unitPrice > 0 &&
              r.quantity >= 0,
          );
        if (!valid.length) {
          toast("No valid rows. Required: vendor, year, unit_price, quantity.");
          return;
        }
        update((d) => ({ ...d, market: [...d.market, ...valid] }));
        toast(
          `Imported ${valid.length} record${valid.length === 1 ? "" : "s"} for review.`,
        );
      },
      error: () => toast("Could not read CSV."),
    });
  }

  async function runAnalysis() {
    const prompt = analysisPrompt.trim() || decision.question.trim();
    if (!prompt) {
      toast("Enter a decision request or define the decision question first.");
      return;
    }
    if (!apiHealth?.configured) {
      toast("Configure OPENAI_API_KEY on the local API server.");
      return;
    }
    const analyzedDecision = decision;
    const inputFingerprint = fingerprint(analyzedDecision);
    setAnalysisText("");
    setAnalysisError("");
    setAnalysisTools([]);
    setAnalysisPhase("streaming");
    let output = "";
    let completed = false;
    const usedTools: string[] = [];
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          decision: analyzedDecision,
          publicWeb: allowPublicWeb,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || `Analysis failed (${response.status}).`);
      }
      if (!response.body)
        throw new Error("Streaming is unavailable in this browser.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const event = block
            .split("\n")
            .find((line) => line.startsWith("event: "))
            ?.slice(7);
          const dataLine = block
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!event || !dataLine) continue;
          const data = JSON.parse(dataLine.slice(6));
          if (event === "delta") {
            output += String(data.text || "");
            setAnalysisText(output);
          }
          if (event === "tool") {
            usedTools.push(String(data.tool));
            setAnalysisTools([...usedTools]);
          }
          if (event === "error")
            throw new Error(String(data.error || "Analysis failed."));
          if (event === "done") completed = true;
        }
      }
      if (!completed)
        throw new Error("The analysis stream ended before completion.");
      const record: AnalysisRun = {
        id: uid(),
        at: new Date().toISOString(),
        prompt,
        output,
        model: apiHealth.model,
        inputFingerprint,
        publicWeb: allowPublicWeb,
        tools: usedTools,
      };
      update((d) => ({ ...d, analyses: [record, ...(d.analyses ?? [])] }));
      setAnalysisPhase("done");
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Analysis failed.",
      );
      setAnalysisPhase("error");
    } finally {
      setAllowPublicWeb(false);
    }
  }

  async function structureRequest() {
    const prompt = analysisPrompt.trim() || decision.question.trim();
    if (!prompt) {
      toast("Enter a decision request first.");
      return;
    }
    if (!apiHealth?.configured) {
      toast("Configure OPENAI_API_KEY on the local API server.");
      return;
    }
    const decisionId = decision.id;
    const inputFingerprint = fingerprint(decision);
    setFrameDraft(null);
    setFrameError("");
    setFramePhase("working");
    try {
      const response = await fetch("/api/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || `Could not structure request (${response.status}).`,
        );
      setFrameDraft({
        ...(body.draft as FrameDraft),
        decisionId,
        inputFingerprint,
      });
      setFramePhase("done");
    } catch (error) {
      setFrameError(
        error instanceof Error ? error.message : "Could not structure request.",
      );
      setFramePhase("error");
    }
  }

  function applyFrame() {
    if (
      !frameDraft ||
      frameDraft.decisionId !== decision.id ||
      frameDraft.inputFingerprint !== fingerprint(decision)
    ) {
      toast(
        "Decision inputs changed. Structure the request again before applying it.",
      );
      return;
    }
    update((d) => ({
      ...d,
      question: frameDraft.question,
      objective: frameDraft.objective,
    }));
    setFrameDraft(null);
    setPage("workspace");
    setTab("frame");
    toast("Draft question and objective added. Review and complete the model.");
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <GitCompareArrows size={20} strokeWidth={2.4} />
          </div>
          <div>
            <strong>
              DECISION<span>LEDGER</span>
            </strong>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => {
                setPage(item.id);
                setMobileNav(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "package" && ready.passed < ready.total && (
                <i className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="reset-link" onClick={resetDemo}>
            <RefreshCw size={14} /> Clear local data
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open menu"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={20} />
          </button>
          <div className="top-actions">
            {page === "overview" && (
              <div className="search">
                <Search size={16} />
                <input
                  aria-label="Search decisions"
                  placeholder="Search decisions..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
            <button className="new-button" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New decision
            </button>
          </div>
        </header>
        <main className="content">
          {page === "overview" && (
            <>
              <div className="section-head overview-head">
                <div>
                  <h1>Decisions</h1>
                </div>
                <span className="muted">{matchingDecisions.length} total</span>
              </div>
              <div className="ops-table">
                <div className="ops-table-head">
                  <span>DECISION</span>
                  <span>TYPE</span>
                  <span>STATUS</span>
                  <span>READINESS</span>
                  <span></span>
                </div>
                {matchingDecisions.map((d) => {
                  const r = readiness(d);
                  const current =
                    d.runs.length && d.runs[0].fingerprint === fingerprint(d);
                  return (
                    <button
                      className="ops-table-row"
                      key={d.id}
                      onClick={() => loadDecision(d.id)}
                    >
                      <strong>{d.title}</strong>
                      <span>{d.kind}</span>
                      <span>
                        {d.runs.length
                          ? current
                            ? "Evaluated"
                            : "Inputs changed"
                          : "Draft"}
                      </span>
                      <span>
                        {r.passed}/{r.total} passed
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  );
                })}
                {matchingDecisions.length === 0 && (
                  <div className="ops-empty">No matching decisions.</div>
                )}
              </div>
            </>
          )}

          {page !== "overview" && (
            <>
              <div className="detail-header">
                <div>
                  <div className="eyebrow">
                    {decision.kind.toUpperCase()}{" "}
                    <span className="eyebrow-line" />{" "}
                    {decision.phase.toUpperCase()}
                  </div>
                  <h1>
                    {page === "workspace"
                      ? "Decision workspace"
                      : nav.find((n) => n.id === page)?.label}
                  </h1>
                </div>
                <div className="decision-select-wrap">
                  <span>ACTIVE DECISION</span>
                  <select
                    aria-label="Active decision"
                    value={decision.id}
                    onChange={(e) => {
                      setActiveId(e.target.value);
                      setScenarioWeight({});
                      setAnalysisText("");
                    }}
                  >
                    <option value={decision.id}>{decision.title}</option>
                    {decisions
                      .filter((d) => d.id !== decision.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                  </select>
                  <ChevronDown size={15} />
                </div>
              </div>
              {page === "workspace" && (
                <>
                  <div className="tabs">
                    {(
                      [
                        ["frame", "Frame the decision"],
                        ["compare", "Compare options"],
                        ["challenge", "Challenge & govern"],
                        ["history", "Run history"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        className={tab === id ? "selected" : ""}
                        key={id}
                        onClick={() => setTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {tab === "frame" && (
                    <div className="frame-layout">
                      <div className="stack">
                        <section className="panel">
                          <PanelHead
                            eyebrow="01 / PURPOSE"
                            title="Decision brief"
                            subtitle="A short, specific question keeps evaluation anchored."
                          />
                          <div className="form-grid">
                            <Field label="Decision title">
                              <input
                                value={decision.title}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    title: e.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Accountable owner">
                              <input
                                placeholder="Team or individual"
                                value={decision.owner}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    owner: e.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Decision question" wide>
                              <textarea
                                rows={3}
                                value={decision.question}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    question: e.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Objective" wide>
                              <textarea
                                rows={2}
                                value={decision.objective}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    objective: e.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Decision date">
                              <input
                                type="date"
                                value={decision.dueDate}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    dueDate: e.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Phase">
                              <input
                                value={decision.phase}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    phase: e.target.value,
                                  }))
                                }
                              />
                            </Field>
                          </div>
                        </section>
                        <section className="panel">
                          <PanelHead
                            eyebrow="02 / BOUNDARIES"
                            title="Hard constraints"
                            subtitle="Options outside these limits cannot be recommended."
                          />
                          <div className="form-grid">
                            <Field label="Maximum unit price (USD)">
                              <input
                                type="number"
                                min="0"
                                value={decision.budgetCeiling || ""}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    budgetCeiling: Number(e.target.value),
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Maximum lead time (days)">
                              <input
                                type="number"
                                min="0"
                                value={decision.maxLeadDays || ""}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    maxLeadDays: Number(e.target.value),
                                  }))
                                }
                              />
                            </Field>
                          </div>
                        </section>
                        <section className="panel">
                          <div className="panel-title-row">
                            <PanelHead
                              eyebrow="03 / VALUES"
                              title="Evaluation criteria"
                              subtitle="Weights should add to 100%. Scores use a common 0–100 scale."
                            />
                            <button
                              className="small-button"
                              onClick={() =>
                                update((d) => ({
                                  ...d,
                                  criteria: [
                                    ...d.criteria,
                                    {
                                      id: uid(),
                                      name: "New criterion",
                                      weight: 0,
                                      unit: "Score / 100",
                                    },
                                  ],
                                }))
                              }
                            >
                              <Plus size={14} /> Add
                            </button>
                          </div>
                          <div className="criterion-list">
                            {decision.criteria.map((c) => (
                              <div className="criterion-row" key={c.id}>
                                <input
                                  aria-label="Criterion name"
                                  value={c.name}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      criteria: d.criteria.map((x) =>
                                        x.id === c.id
                                          ? { ...x, name: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <div className="weight-input">
                                  <input
                                    aria-label={`${c.name} weight`}
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={c.weight}
                                    onChange={(e) =>
                                      update((d) => ({
                                        ...d,
                                        criteria: d.criteria.map((x) =>
                                          x.id === c.id
                                            ? {
                                                ...x,
                                                weight: Number(e.target.value),
                                              }
                                            : x,
                                        ),
                                      }))
                                    }
                                  />
                                  <span>%</span>
                                </div>
                                <button
                                  className="icon-btn danger"
                                  aria-label={`Remove ${c.name}`}
                                  onClick={() =>
                                    update((d) => ({
                                      ...d,
                                      criteria: d.criteria.filter(
                                        (x) => x.id !== c.id,
                                      ),
                                      options: d.options.map((o) => ({
                                        ...o,
                                        scores: Object.fromEntries(
                                          Object.entries(o.scores).filter(
                                            ([k]) => k !== c.id,
                                          ),
                                        ),
                                      })),
                                    }))
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div
                            className={`weight-total ${decision.criteria.reduce((s, c) => s + c.weight, 0) === 100 ? "good" : "bad"}`}
                          >
                            Total weight{" "}
                            <strong>
                              {decision.criteria.reduce(
                                (s, c) => s + c.weight,
                                0,
                              )}
                              %
                            </strong>
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                  {tab === "compare" && (
                    <div className="two-col compare-layout">
                      <div className="stack">
                        <section className="panel">
                          <div className="panel-title-row">
                            <PanelHead
                              eyebrow="OPTIONS"
                              title="Alternatives"
                              subtitle="Edit inputs, attach evidence, then run the model."
                            />
                            <button
                              className="small-button"
                              onClick={() =>
                                update((d) => ({
                                  ...d,
                                  options: [
                                    ...d.options,
                                    {
                                      id: uid(),
                                      name: "New option",
                                      description: "",
                                      scores: {},
                                      unitPrice: 0,
                                      leadDays: 0,
                                      evidenceIds: [],
                                    },
                                  ],
                                }))
                              }
                            >
                              <Plus size={14} /> Add option
                            </button>
                          </div>
                          {decision.options.length === 0 && (
                            <Empty text="Add at least two options to compare." />
                          )}
                          {decision.options.map((o) => (
                            <div className="option-edit" key={o.id}>
                              <div className="option-edit-top">
                                <input
                                  className="option-name"
                                  aria-label="Option name"
                                  value={o.name}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      options: d.options.map((x) =>
                                        x.id === o.id
                                          ? { ...x, name: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  className="icon-btn danger"
                                  aria-label={`Remove ${o.name}`}
                                  onClick={() =>
                                    update((d) => ({
                                      ...d,
                                      options: d.options.filter(
                                        (x) => x.id !== o.id,
                                      ),
                                    }))
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                              <input
                                className="option-desc"
                                aria-label={`${o.name} description`}
                                placeholder="What makes this path distinct?"
                                value={o.description}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    options: d.options.map((x) =>
                                      x.id === o.id
                                        ? { ...x, description: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                              <div className="option-values">
                                <Field label="Unit price">
                                  <input
                                    type="number"
                                    min="0"
                                    value={o.unitPrice || ""}
                                    onChange={(e) =>
                                      update((d) => ({
                                        ...d,
                                        options: d.options.map((x) =>
                                          x.id === o.id
                                            ? {
                                                ...x,
                                                unitPrice: Number(
                                                  e.target.value,
                                                ),
                                              }
                                            : x,
                                        ),
                                      }))
                                    }
                                  />
                                </Field>
                                <Field label="Lead time · days">
                                  <input
                                    type="number"
                                    min="0"
                                    value={o.leadDays || ""}
                                    onChange={(e) =>
                                      update((d) => ({
                                        ...d,
                                        options: d.options.map((x) =>
                                          x.id === o.id
                                            ? {
                                                ...x,
                                                leadDays: Number(
                                                  e.target.value,
                                                ),
                                              }
                                            : x,
                                        ),
                                      }))
                                    }
                                  />
                                </Field>
                              </div>
                              <div className="score-grid">
                                {decision.criteria.map((c) => (
                                  <Field key={c.id} label={`${c.name} · 0–100`}>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={o.scores[c.id] ?? ""}
                                      onChange={(e) =>
                                        update((d) => ({
                                          ...d,
                                          options: d.options.map((x) =>
                                            x.id === o.id
                                              ? {
                                                  ...x,
                                                  scores: {
                                                    ...x.scores,
                                                    [c.id]: Number(
                                                      e.target.value,
                                                    ),
                                                  },
                                                }
                                              : x,
                                          ),
                                        }))
                                      }
                                    />
                                  </Field>
                                ))}
                              </div>
                              <Field label="Linked evidence">
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value)
                                      update((d) => ({
                                        ...d,
                                        options: d.options.map((x) =>
                                          x.id === o.id
                                            ? {
                                                ...x,
                                                evidenceIds: [
                                                  ...new Set([
                                                    ...x.evidenceIds,
                                                    e.target.value,
                                                  ]),
                                                ],
                                              }
                                            : x,
                                        ),
                                      }));
                                  }}
                                >
                                  <option value="">Attach a source...</option>
                                  {decision.evidence
                                    .filter(
                                      (e) => !o.evidenceIds.includes(e.id),
                                    )
                                    .map((e) => (
                                      <option key={e.id} value={e.id}>
                                        {e.title}
                                      </option>
                                    ))}
                                </select>
                              </Field>
                              <div className="chip-row">
                                {o.evidenceIds.map((id) => {
                                  const e = decision.evidence.find(
                                    (x) => x.id === id,
                                  );
                                  return (
                                    e && (
                                      <button
                                        className="source-chip"
                                        key={id}
                                        title="Remove link"
                                        onClick={() =>
                                          update((d) => ({
                                            ...d,
                                            options: d.options.map((x) =>
                                              x.id === o.id
                                                ? {
                                                    ...x,
                                                    evidenceIds:
                                                      x.evidenceIds.filter(
                                                        (y) => y !== id,
                                                      ),
                                                  }
                                                : x,
                                            ),
                                          }))
                                        }
                                      >
                                        {e.title} <X size={12} />
                                      </button>
                                    )
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </section>
                      </div>
                      <div className="stack">
                        <section className="panel result-panel">
                          <div className="panel-title-row">
                            <PanelHead
                              eyebrow="DETERMINISTIC MODEL"
                              title="Evaluation result"
                              subtitle="Weighted scores with hard constraint checks."
                            />
                            <span
                              className={`status-pill ${stale ? "amber" : "green"}`}
                            >
                              {stale ? "Needs refresh" : "Current"}
                            </span>
                          </div>
                          {baseEvaluation.winner ? (
                            <>
                              <div className="winner-box">
                                <span>LEADING ELIGIBLE OPTION</span>
                                <strong>{baseEvaluation.winner.name}</strong>
                                <p>
                                  Highest weighted score among options meeting
                                  the stated constraints.
                                </p>
                              </div>
                              <div className="ranking">
                                {baseEvaluation.results.map((r, i) => (
                                  <div
                                    className="ranking-row"
                                    key={r.option.id}
                                  >
                                    <span className="ranking-index">
                                      {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <div className="ranking-main">
                                      <strong>{r.option.name}</strong>
                                      <small>
                                        {r.eligible
                                          ? "Eligible"
                                          : r.failures.join(" · ")}
                                      </small>
                                      <div className="bar">
                                        <div style={{ width: `${r.score}%` }} />
                                      </div>
                                    </div>
                                    <b>{r.score.toFixed(1)}</b>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <Empty text="Add feasible options to see a result." />
                          )}
                          <button className="dark-button full" onClick={run}>
                            <RefreshCw size={16} />{" "}
                            {decision.kind === "Decision program"
                              ? "Run refresh cycle"
                              : "Run evaluation"}
                          </button>
                          <p className="microcopy">
                            Runs store the inputs, result, time, and model
                            fingerprint for later comparison.
                          </p>
                        </section>
                        <section className="panel">
                          <PanelHead
                            eyebrow="SENSITIVITY"
                            title="What flips the decision?"
                            subtitle="The first single criterion weight shift that changes the eligible leader."
                          />
                          {flip ? (
                            <div className="flip-callout">
                              <SlidersHorizontal size={19} />
                              <p>
                                If <strong>{flip.criterion.name}</strong> is
                                weighted at <strong>{flip.weight}%</strong>,{" "}
                                <strong>{flip.winner.name}</strong> leads.
                              </p>
                            </div>
                          ) : (
                            <div className="flip-callout subdued">
                              <CheckCircle2 size={19} />
                              <p>
                                {baseEvaluation.modelValid
                                  ? "No single criterion weight shift changes the current eligible leader."
                                  : "Complete the model to test sensitivity."}
                              </p>
                            </div>
                          )}
                        </section>
                        <section className="panel">
                          <div className="panel-title-row">
                            <PanelHead
                              eyebrow="SCENARIO LAB"
                              title="Test the weights"
                              subtitle="Preview a scenario without changing the saved model."
                            />
                            <button
                              className="small-button"
                              onClick={() => setScenarioWeight({})}
                            >
                              Reset
                            </button>
                          </div>
                          <div className="scenario-list">
                            {decision.criteria.map((c) => (
                              <label key={c.id}>
                                <span>{c.name}</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={scenarioWeight[c.id] ?? c.weight}
                                  onChange={(e) =>
                                    setScenarioWeight({
                                      ...scenarioWeight,
                                      [c.id]: Number(e.target.value),
                                    })
                                  }
                                />
                                <b>{scenarioWeight[c.id] ?? c.weight}</b>
                              </label>
                            ))}
                          </div>
                          <div className="scenario-result">
                            <span>SCENARIO LEADER</span>
                            <strong>
                              {evaluation.winner?.name ?? "No eligible option"}
                            </strong>
                            <small>
                              Weights are normalized for this preview.
                            </small>
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                  {tab === "challenge" && (
                    <div className="two-col">
                      <div className="stack">
                        <EditableList
                          title="Assumptions"
                          eyebrow="FIRST CLASS OBJECTS"
                          subtitle="Low-confidence assumptions should trigger a refresh when evidence changes."
                          addLabel="Add assumption"
                          onAdd={() =>
                            update((d) => ({
                              ...d,
                              assumptions: [
                                ...d.assumptions,
                                {
                                  id: uid(),
                                  text: "",
                                  confidence: "Medium",
                                  owner: "",
                                },
                              ],
                            }))
                          }
                        >
                          {decision.assumptions.map((a) => (
                            <div className="list-edit" key={a.id}>
                              <textarea
                                placeholder="State the assumption"
                                value={a.text}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    assumptions: d.assumptions.map((x) =>
                                      x.id === a.id
                                        ? { ...x, text: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                              <div className="inline-fields">
                                <select
                                  value={a.confidence}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      assumptions: d.assumptions.map((x) =>
                                        x.id === a.id
                                          ? {
                                              ...x,
                                              confidence: e.target
                                                .value as typeof a.confidence,
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                >
                                  <option>Low</option>
                                  <option>Medium</option>
                                  <option>High</option>
                                </select>
                                <input
                                  placeholder="Owner"
                                  value={a.owner}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      assumptions: d.assumptions.map((x) =>
                                        x.id === a.id
                                          ? { ...x, owner: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  className="icon-btn danger"
                                  aria-label="Remove assumption"
                                  onClick={() =>
                                    update((d) => ({
                                      ...d,
                                      assumptions: d.assumptions.filter(
                                        (x) => x.id !== a.id,
                                      ),
                                    }))
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </EditableList>
                        <EditableList
                          title="Risks"
                          eyebrow="EXPLICIT CHALLENGES"
                          subtitle="A high-severity risk requires a mitigation before sign-off."
                          addLabel="Add risk"
                          onAdd={() =>
                            update((d) => ({
                              ...d,
                              risks: [
                                ...d.risks,
                                {
                                  id: uid(),
                                  text: "",
                                  severity: "Medium",
                                  mitigation: "",
                                },
                              ],
                            }))
                          }
                        >
                          {decision.risks.map((r) => (
                            <div className="list-edit" key={r.id}>
                              <textarea
                                placeholder="Describe the risk"
                                value={r.text}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    risks: d.risks.map((x) =>
                                      x.id === r.id
                                        ? { ...x, text: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                              <div className="inline-fields">
                                <select
                                  value={r.severity}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      risks: d.risks.map((x) =>
                                        x.id === r.id
                                          ? {
                                              ...x,
                                              severity: e.target
                                                .value as typeof r.severity,
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                >
                                  <option>Low</option>
                                  <option>Medium</option>
                                  <option>High</option>
                                </select>
                                <input
                                  placeholder="Mitigation"
                                  value={r.mitigation}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      risks: d.risks.map((x) =>
                                        x.id === r.id
                                          ? { ...x, mitigation: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  className="icon-btn danger"
                                  aria-label="Remove risk"
                                  onClick={() =>
                                    update((d) => ({
                                      ...d,
                                      risks: d.risks.filter(
                                        (x) => x.id !== r.id,
                                      ),
                                    }))
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </EditableList>
                      </div>
                      <div className="stack">
                        <EditableList
                          title="Bias checks"
                          eyebrow="GOVERNANCE"
                          subtitle="Ask whether evidence or scoring systematically favors a path."
                          addLabel="Add check"
                          onAdd={() =>
                            update((d) => ({
                              ...d,
                              biasChecks: [
                                ...d.biasChecks,
                                {
                                  id: uid(),
                                  text: "",
                                  status: "Open",
                                  note: "",
                                },
                              ],
                            }))
                          }
                        >
                          {decision.biasChecks.map((b) => (
                            <div className="list-edit" key={b.id}>
                              <textarea
                                placeholder="State the check"
                                value={b.text}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    biasChecks: d.biasChecks.map((x) =>
                                      x.id === b.id
                                        ? { ...x, text: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                              <div className="inline-fields">
                                <select
                                  value={b.status}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      biasChecks: d.biasChecks.map((x) =>
                                        x.id === b.id
                                          ? {
                                              ...x,
                                              status: e.target
                                                .value as typeof b.status,
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                >
                                  <option>Open</option>
                                  <option>Reviewed</option>
                                </select>
                                <input
                                  placeholder="Review note"
                                  value={b.note}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      biasChecks: d.biasChecks.map((x) =>
                                        x.id === b.id
                                          ? { ...x, note: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  className="icon-btn danger"
                                  aria-label="Remove bias check"
                                  onClick={() =>
                                    update((d) => ({
                                      ...d,
                                      biasChecks: d.biasChecks.filter(
                                        (x) => x.id !== b.id,
                                      ),
                                    }))
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </EditableList>
                        <section className="panel">
                          <PanelHead
                            eyebrow="SIGN-OFF GATE"
                            title="Readiness checks"
                            subtitle="Unresolved items stay visible in the final package."
                          />
                          <div className="check-list">
                            {ready.checks.map((c) => (
                              <div key={c.label}>
                                <span
                                  className={
                                    c.pass ? "check pass" : "check fail"
                                  }
                                >
                                  {c.pass ? (
                                    <Check size={12} />
                                  ) : (
                                    <CircleAlert size={12} />
                                  )}
                                </span>
                                <span>{c.label}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                  {tab === "history" && (
                    <div className="two-col">
                      <section className="panel">
                        <div className="panel-title-row">
                          <PanelHead
                            eyebrow="AUDIT TRAIL"
                            title="Evaluation runs"
                            subtitle="Each run captures the result and fingerprint of its inputs."
                          />
                          <button className="small-button" onClick={run}>
                            <RefreshCw size={14} /> New run
                          </button>
                        </div>
                        {decision.runs.length ? (
                          <div className="run-list">
                            {decision.runs.map((r, i) => (
                              <div key={r.id} className="run-item">
                                <div className="run-icon">
                                  <History size={18} />
                                </div>
                                <div>
                                  <strong>{r.note}</strong>
                                  <p>
                                    {dateLabel(r.at)} ·{" "}
                                    {new Date(r.at).toLocaleTimeString(
                                      "en-US",
                                      { hour: "numeric", minute: "2-digit" },
                                    )}
                                  </p>
                                  <small>
                                    Winner:{" "}
                                    {decision.options.find(
                                      (o) => o.id === r.winner,
                                    )?.name ?? "No eligible option"}{" "}
                                    · Fingerprint {r.fingerprint}
                                  </small>
                                </div>
                                <span
                                  className={`status-pill ${i === 0 && !stale ? "green" : "gray"}`}
                                >
                                  {i === 0 && !stale ? "Current" : "Snapshot"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty text="No evaluation runs yet." />
                        )}
                      </section>
                      <section className="panel">
                        <PanelHead
                          eyebrow="REFRESH LOGIC"
                          title="A decision that stays current"
                          subtitle="Changes to the model or evidence make the latest run stale."
                        />
                        <div className="refresh-diagram">
                          <div>Evidence changes</div>
                          <ArrowRight size={18} />
                          <div>Review assumptions</div>
                          <ArrowRight size={18} />
                          <div>Run again</div>
                        </div>
                        <p className="body-copy">
                          For a long-horizon program, repeat this cycle at each
                          gate. Previous runs remain available for an audit of
                          how the recommendation evolved.
                        </p>
                      </section>
                    </div>
                  )}
                </>
              )}

              {page === "analysis" && (
                <AnalysisPage
                  decision={decision}
                  prompt={analysisPrompt}
                  setPrompt={setAnalysisPrompt}
                  output={analysisText}
                  setOutput={setAnalysisText}
                  phase={analysisPhase}
                  error={analysisError}
                  tools={analysisTools}
                  publicWeb={allowPublicWeb}
                  setPublicWeb={setAllowPublicWeb}
                  health={apiHealth}
                  run={runAnalysis}
                  structure={structureRequest}
                  frameDraft={frameDraft}
                  framePhase={framePhase}
                  frameError={frameError}
                  frameCurrent={Boolean(
                    frameDraft &&
                    frameDraft.decisionId === decision.id &&
                    frameDraft.inputFingerprint === fingerprint(decision),
                  )}
                  applyFrame={applyFrame}
                  openEvidence={() => setPage("evidence")}
                />
              )}

              {page === "market" && (
                <div className="market-page">
                  {decision.market.length > 0 && (
                    <div className="market-stats">
                      <Stat
                        label="HISTORICAL MEDIAN"
                        value={stats.median ? money(stats.median) : "—"}
                        detail={`${stats.count} comparable records`}
                        icon={Activity}
                      />
                      <Stat
                        label="LOWEST OBSERVED"
                        value={stats.low ? money(stats.low) : "—"}
                        detail="Unadjusted unit price"
                        icon={ArrowDownRight}
                      />
                      <Stat
                        label="HIGHEST OBSERVED"
                        value={stats.high ? money(stats.high) : "—"}
                        detail="Unadjusted unit price"
                        icon={ArrowUpRight}
                      />
                    </div>
                  )}
                  <div className="two-col">
                    <section className="panel market-chart">
                      <div className="panel-title-row">
                        <PanelHead
                          eyebrow="HISTORICAL CONTEXT"
                          title="Price over time"
                          subtitle="Raw recorded unit prices. Review scope, quantity, year, and source before comparison."
                        />
                        <button
                          className="small-button"
                          onClick={() => fileRef.current?.click()}
                        >
                          <Upload size={14} /> Import CSV
                        </button>
                      </div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) openCsv(f);
                          e.target.value = "";
                        }}
                      />
                      <div className="chart-wrap">
                        {stats.count ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={decision.market
                                .filter((r) => r.verified)
                                .sort((a, b) => a.year - b.year)}
                              margin={{
                                top: 15,
                                right: 15,
                                left: 0,
                                bottom: 0,
                              }}
                            >
                              <XAxis
                                dataKey="year"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#7d8787", fontSize: 12 }}
                              />
                              <YAxis
                                tickFormatter={(v) =>
                                  Number(v) >= 1000
                                    ? `$${Math.round(Number(v) / 1000)}k`
                                    : money(Number(v))
                                }
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#7d8787", fontSize: 12 }}
                                width={58}
                              />
                              <Tooltip
                                formatter={(v) => money(Number(v))}
                                labelFormatter={(v) => `Year ${v}`}
                              />
                              <Line
                                type="monotone"
                                dataKey="unitPrice"
                                stroke="#c8793d"
                                strokeWidth={3}
                                dot={{ r: 4, fill: "#c8793d" }}
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <Empty text="Verify price records to see a trend." />
                        )}
                      </div>
                      <div className="csv-hint">
                        CSV columns:{" "}
                        <code>
                          vendor, description, year, unit_price, quantity,
                          source, url
                        </code>
                      </div>
                    </section>
                    <section className="panel">
                      <PanelHead
                        eyebrow="CURRENT OPTIONS"
                        title="Quote comparison"
                        subtitle="Difference from the historical median is a prompt for review, not an inflation-adjusted estimate."
                      />
                      <div className="quote-list">
                        {decision.options.map((o) => {
                          const delta = stats.median
                            ? Math.round((o.unitPrice / stats.median - 1) * 100)
                            : null;
                          return (
                            <div key={o.id} className="quote-row">
                              <div>
                                <strong>{o.name}</strong>
                                <small>
                                  {o.leadDays} day lead · {o.evidenceIds.length}{" "}
                                  linked sources
                                </small>
                              </div>
                              <div>
                                <strong>{money(o.unitPrice)}</strong>
                                <small
                                  className={
                                    delta === null
                                      ? ""
                                      : delta > 0
                                        ? "warning-text"
                                        : "success-text"
                                  }
                                >
                                  {delta === null
                                    ? "No baseline"
                                    : `${delta > 0 ? "+" : ""}${delta}% vs median`}
                                </small>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="market-warning">
                        <CircleAlert size={17} />
                        <span>
                          Normalize configuration, quantity, contract year, and
                          included services before treating records as
                          comparable.
                        </span>
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-title-row">
                      <PanelHead
                        eyebrow="SOURCE RECORDS"
                        title="Comparable awards & quotes"
                        subtitle="Imported records are unverified until a reviewer checks the primary source."
                      />
                      <button
                        className="small-button"
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            market: [
                              ...d.market,
                              {
                                id: uid(),
                                vendor: "",
                                vehicle: "",
                                year: new Date().getFullYear(),
                                unitPrice: 0,
                                quantity: 0,
                                source: "",
                                url: "",
                                verified: false,
                              },
                            ],
                          }))
                        }
                      >
                        <Plus size={14} /> Add record
                      </button>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Supplier / description</th>
                            <th>Year</th>
                            <th>Unit price</th>
                            <th>Qty</th>
                            <th>Source</th>
                            <th>Review</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {decision.market.map((m) => (
                            <tr key={m.id}>
                              <td>
                                <input
                                  aria-label="Supplier"
                                  placeholder="Supplier"
                                  value={m.vendor}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? { ...x, vendor: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <input
                                  className="sub-input"
                                  aria-label="Description"
                                  placeholder="Comparable item"
                                  value={m.vehicle}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? { ...x, vehicle: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="number-cell"
                                  type="number"
                                  aria-label="Year"
                                  value={m.year}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? {
                                              ...x,
                                              year: Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="number-cell"
                                  type="number"
                                  aria-label="Unit price"
                                  value={m.unitPrice}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? {
                                              ...x,
                                              unitPrice: Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="number-cell"
                                  type="number"
                                  aria-label="Quantity"
                                  value={m.quantity}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? {
                                              ...x,
                                              quantity: Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  aria-label="Source"
                                  placeholder="Source name"
                                  value={m.source}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? { ...x, source: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <input
                                  className="sub-input"
                                  aria-label="Source URL"
                                  placeholder="https://..."
                                  value={m.url}
                                  onChange={(e) =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? { ...x, url: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  className={`verify-btn ${m.verified ? "verified" : ""}`}
                                  onClick={() =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.map((x) =>
                                        x.id === m.id
                                          ? { ...x, verified: !x.verified }
                                          : x,
                                      ),
                                    }))
                                  }
                                >
                                  {m.verified ? (
                                    <>
                                      <Check size={13} /> Verified
                                    </>
                                  ) : (
                                    "Mark verified"
                                  )}
                                </button>
                              </td>
                              <td>
                                <button
                                  className="icon-btn danger"
                                  aria-label="Remove market record"
                                  onClick={() =>
                                    update((d) => ({
                                      ...d,
                                      market: d.market.filter(
                                        (x) => x.id !== m.id,
                                      ),
                                    }))
                                  }
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {page === "evidence" && (
                <div
                  className={
                    decision.options.length
                      ? "two-col evidence-layout"
                      : "evidence-only"
                  }
                >
                  <section className="panel">
                    <div className="panel-title-row">
                      <PanelHead
                        eyebrow="PROVENANCE"
                        title="Evidence records"
                        subtitle="Capture origin, date, link, and review state for each input."
                      />
                      <button
                        className="small-button"
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            evidence: [
                              ...d.evidence,
                              {
                                id: uid(),
                                title: "",
                                source: "",
                                url: "",
                                date: new Date().toISOString().slice(0, 10),
                                type: "Document",
                                verified: false,
                                notes: "",
                              },
                            ],
                          }))
                        }
                      >
                        <Plus size={14} /> Add evidence
                      </button>
                    </div>
                    <div className="evidence-list">
                      {decision.evidence.map((e) => (
                        <EvidenceCard
                          key={e.id}
                          evidence={e}
                          linked={decision.options
                            .filter((o) => o.evidenceIds.includes(e.id))
                            .map((o) => o.name)}
                          change={(patch) =>
                            update((d) => ({
                              ...d,
                              evidence: d.evidence.map((x) =>
                                x.id === e.id ? { ...x, ...patch } : x,
                              ),
                            }))
                          }
                          remove={() =>
                            update((d) => ({
                              ...d,
                              evidence: d.evidence.filter((x) => x.id !== e.id),
                              options: d.options.map((o) => ({
                                ...o,
                                evidenceIds: o.evidenceIds.filter(
                                  (id) => id !== e.id,
                                ),
                              })),
                            }))
                          }
                        />
                      ))}
                    </div>
                    {!decision.evidence.length && (
                      <Empty text="Add a source record, then link it to an option in Compare." />
                    )}
                  </section>
                  {decision.options.length > 0 && (
                    <div className="stack">
                      <section className="panel">
                        <PanelHead
                          eyebrow="EVIDENCE COVERAGE"
                          title="Option traceability"
                          subtitle="Source links make evaluation claims inspectable."
                        />
                        <div className="coverage-list">
                          {decision.options.map((o) => (
                            <div key={o.id}>
                              <div>
                                <strong>{o.name}</strong>
                                <span>
                                  {o.evidenceIds.length} source
                                  {o.evidenceIds.length === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          className="outline-button full"
                          onClick={() => {
                            setPage("workspace");
                            setTab("compare");
                          }}
                        >
                          Link evidence to options <ArrowRight size={15} />
                        </button>
                      </section>
                    </div>
                  )}
                </div>
              )}

              {page === "people" && (
                <div className="people-layout">
                  <section className="panel">
                    <div className="panel-title-row">
                      <PanelHead
                        eyebrow="TEAM MAP"
                        title="Contact records"
                        subtitle="Role, organization, and official source for each contact."
                      />
                      <button
                        className="small-button"
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            contacts: [
                              ...d.contacts,
                              {
                                id: uid(),
                                role: "",
                                name: "",
                                organization: "",
                                source: "",
                                url: "",
                                status: "Unverified",
                                notes: "",
                              },
                            ],
                          }))
                        }
                      >
                        <Plus size={14} /> Add contact
                      </button>
                    </div>
                    <div className="contact-list">
                      {decision.contacts.map((c) => (
                        <div className="contact-card" key={c.id}>
                          <div className="contact-avatar">
                            {c.role.slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <div className="contact-form">
                            <div className="inline-fields">
                              <input
                                aria-label="Role"
                                placeholder="Role"
                                value={c.role}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    contacts: d.contacts.map((x) =>
                                      x.id === c.id
                                        ? { ...x, role: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                              <input
                                aria-label="Name"
                                placeholder="Name, if officially listed"
                                value={c.name}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    contacts: d.contacts.map((x) =>
                                      x.id === c.id
                                        ? { ...x, name: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="inline-fields">
                              <input
                                aria-label="Organization"
                                placeholder="Organization"
                                value={c.organization}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    contacts: d.contacts.map((x) =>
                                      x.id === c.id
                                        ? { ...x, organization: e.target.value }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                              <select
                                aria-label="Verification status"
                                value={c.status}
                                onChange={(e) =>
                                  update((d) => ({
                                    ...d,
                                    contacts: d.contacts.map((x) =>
                                      x.id === c.id
                                        ? {
                                            ...x,
                                            status: e.target
                                              .value as typeof c.status,
                                          }
                                        : x,
                                    ),
                                  }))
                                }
                              >
                                <option>Unverified</option>
                                <option>Verified</option>
                                <option>Review needed</option>
                              </select>
                            </div>
                            <input
                              aria-label="Official source"
                              placeholder="Official source name"
                              value={c.source}
                              onChange={(e) =>
                                update((d) => ({
                                  ...d,
                                  contacts: d.contacts.map((x) =>
                                    x.id === c.id
                                      ? { ...x, source: e.target.value }
                                      : x,
                                  ),
                                }))
                              }
                            />
                            <input
                              aria-label="Official source URL"
                              placeholder="Official source URL"
                              value={c.url}
                              onChange={(e) =>
                                update((d) => ({
                                  ...d,
                                  contacts: d.contacts.map((x) =>
                                    x.id === c.id
                                      ? { ...x, url: e.target.value }
                                      : x,
                                  ),
                                }))
                              }
                            />
                            <textarea
                              aria-label="Contact notes"
                              placeholder="Notes or permitted outreach channel"
                              rows={2}
                              value={c.notes}
                              onChange={(e) =>
                                update((d) => ({
                                  ...d,
                                  contacts: d.contacts.map((x) =>
                                    x.id === c.id
                                      ? { ...x, notes: e.target.value }
                                      : x,
                                  ),
                                }))
                              }
                            />
                          </div>
                          <button
                            className="icon-btn danger"
                            aria-label="Remove contact"
                            onClick={() =>
                              update((d) => ({
                                ...d,
                                contacts: d.contacts.filter(
                                  (x) => x.id !== c.id,
                                ),
                              }))
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {decision.contacts.length === 0 && (
                      <Empty text="No contacts recorded." />
                    )}
                  </section>
                </div>
              )}

              {page === "package" && (
                <div className="package-grid">
                  <div className="stack">
                    <section className="panel package-hero">
                      <div className="eyebrow">DECISION PACKAGE / DRAFT</div>
                      <h2>{decision.title}</h2>
                      <p>{decision.question || "Decision question pending."}</p>
                      <div className="package-meta">
                        <span>
                          <b>Owner</b>
                          {decision.owner || "Unassigned"}
                        </span>
                        <span>
                          <b>Decision date</b>
                          {dateLabel(decision.dueDate)}
                        </span>
                        <span>
                          <b>Latest run</b>
                          {latestRun ? dateLabel(latestRun.at) : "Not run"}
                        </span>
                      </div>
                    </section>
                    <section className="panel">
                      <PanelHead
                        eyebrow="RECOMMENDATION"
                        title={
                          baseEvaluation.winner?.name ?? "No eligible option"
                        }
                        subtitle={
                          baseEvaluation.winner
                            ? "Model leader pending human review and sign-off."
                            : "Define eligible options before forming a recommendation."
                        }
                      />
                      <div className="package-score-list">
                        {baseEvaluation.results.map((r) => (
                          <div key={r.option.id}>
                            <strong>{r.option.name}</strong>
                            <span>
                              {r.eligible ? r.score.toFixed(1) : "Excluded"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {flip && (
                        <div className="flip-callout">
                          <SlidersHorizontal size={18} />
                          <p>
                            Recommendation changes to{" "}
                            <strong>{flip.winner.name}</strong> if{" "}
                            <strong>{flip.criterion.name}</strong> reaches{" "}
                            <strong>{flip.weight}%</strong>.
                          </p>
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <PanelHead
                        eyebrow="DECISION BASIS"
                        title="Evidence and context"
                        subtitle="Records included in this decision."
                      />
                      <div className="package-facts">
                        <div>
                          <strong>{decision.evidence.length}</strong>
                          <span>Evidence records</span>
                        </div>
                        <div>
                          <strong>{decision.market.length}</strong>
                          <span>Market comparables</span>
                        </div>
                        <div>
                          <strong>{decision.assumptions.length}</strong>
                          <span>Assumptions</span>
                        </div>
                        <div>
                          <strong>{decision.risks.length}</strong>
                          <span>Risks</span>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="stack">
                    <section className="panel readiness-panel">
                      <div className="eyebrow">PACKAGE READINESS</div>
                      <div className="big-progress">
                        <strong>
                          {ready.passed}
                          <span>/{ready.total}</span>
                        </strong>
                        <div
                          className="progress-ring"
                          style={
                            {
                              "--progress": `${(ready.passed / ready.total) * 100}%`,
                            } as React.CSSProperties
                          }
                        >
                          <CheckCircle2 size={24} />
                        </div>
                      </div>
                      <p>
                        Checks passed. Resolve open items before sending for
                        signature.
                      </p>
                      <div className="check-list">
                        {ready.checks.map((c) => (
                          <div key={c.label}>
                            <span
                              className={c.pass ? "check pass" : "check fail"}
                            >
                              {c.pass ? (
                                <Check size={12} />
                              ) : (
                                <CircleAlert size={12} />
                              )}
                            </span>
                            <span>{c.label}</span>
                          </div>
                        ))}
                      </div>
                      <button className="dark-button full" onClick={download}>
                        <Download size={16} /> Export JSON package
                      </button>
                      <button
                        className="outline-button full"
                        onClick={() => window.print()}
                      >
                        <FileText size={16} /> Print summary
                      </button>
                    </section>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {showCreate && (
        <CreateModal close={() => setShowCreate(false)} create={addDecision} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function PanelHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="panel-head">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <CircleAlert size={20} />
      <span>{text}</span>
    </div>
  );
}
function EditableList({
  eyebrow,
  title,
  subtitle,
  addLabel,
  onAdd,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-title-row">
        <PanelHead eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <button className="small-button" onClick={onAdd}>
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
      <div className="editable-list">{children}</div>
    </section>
  );
}
function EvidenceCard({
  evidence: e,
  linked,
  change,
  remove,
}: {
  evidence: Evidence;
  linked: string[];
  change: (patch: Partial<Evidence>) => void;
  remove: () => void;
}) {
  return (
    <div className="evidence-card">
      <div className="evidence-head">
        <div className="evidence-icon">
          <FileText size={18} />
        </div>
        <input
          aria-label="Evidence title"
          placeholder="Evidence title"
          value={e.title}
          onChange={(x) => change({ title: x.target.value })}
        />
        <button
          className="icon-btn danger"
          aria-label="Remove evidence"
          onClick={remove}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="evidence-fields">
        <Field label="Source">
          <input
            value={e.source}
            placeholder="Originating record"
            onChange={(x) => change({ source: x.target.value })}
          />
        </Field>
        <Field label="Record date">
          <input
            type="date"
            value={e.date}
            onChange={(x) => change({ date: x.target.value })}
          />
        </Field>
        <Field label="Type">
          <input
            value={e.type}
            onChange={(x) => change({ type: x.target.value })}
          />
        </Field>
        <Field label="Source URL">
          <input
            value={e.url}
            placeholder="https://..."
            onChange={(x) => change({ url: x.target.value })}
          />
        </Field>
      </div>
      <textarea
        aria-label="Evidence notes"
        rows={2}
        value={e.notes}
        placeholder="Scope, limitations, or reviewer notes"
        onChange={(x) => change({ notes: x.target.value })}
      />
      <div className="evidence-footer">
        <span>
          Linked to: {linked.length ? linked.join(", ") : "No option yet"}
        </span>
        <button
          className={`verify-btn ${e.verified ? "verified" : ""}`}
          onClick={() => change({ verified: !e.verified })}
        >
          {e.verified ? (
            <>
              <Check size={13} /> Verified
            </>
          ) : (
            "Mark verified"
          )}
        </button>
      </div>
    </div>
  );
}
function CreateModal({
  close,
  create,
}: {
  close: () => void;
  create: (title: string, kind: Decision["kind"]) => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Decision["kind"]>("Trade study");
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create(title, kind);
        }}
      >
        <button
          type="button"
          className="icon-btn modal-close"
          aria-label="Close"
          onClick={close}
        >
          <X size={19} />
        </button>
        <div className="eyebrow">NEW DECISION</div>
        <h2>Start with the question.</h2>
        <p>
          Choose a point study or a program that will be refreshed as evidence
          changes.
        </p>
        <Field label="Decision title">
          <input
            autoFocus
            required
            placeholder="e.g. Vehicle power architecture"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="kind-select">
          <button
            type="button"
            className={kind === "Trade study" ? "chosen" : ""}
            onClick={() => setKind("Trade study")}
          >
            <GitCompareArrows size={20} />
            <strong>Trade study</strong>
            <span>One decision episode</span>
          </button>
          <button
            type="button"
            className={kind === "Decision program" ? "chosen" : ""}
            onClick={() => setKind("Decision program")}
          >
            <RefreshCw size={20} />
            <strong>Decision program</strong>
            <span>Multiple refresh cycles</span>
          </button>
        </div>
        <button className="dark-button full" type="submit">
          Create workspace <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}

export default App;
