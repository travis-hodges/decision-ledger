import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
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
  Link2,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
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
import type { AnalysisRun, Decision, Evidence, MarketRecord } from "./model";
import { dateLabel, money, uid } from "./model";
import {
  createRun,
  evaluate,
  findFlip,
  fingerprint,
  marketStats,
  packageData,
  readiness,
  workflowPlan,
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
  { id: "people", label: "People & integrity", icon: Users },
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
  const [showGuide, setShowGuide] = useState(true);
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
  const [allowPublicWeb, setAllowPublicWeb] = useState(false);
  const [apiHealth, setApiHealth] = useState<{
    configured: boolean;
    model: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const decision = decisions.find((d) => d.id === activeId) ?? decisions[0];
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
  const plan = useMemo(() => workflowPlan(decision), [decision]);
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
    }
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
            <small>INTELLIGENCE WORKSPACE</small>
          </div>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
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
          <div className="topic-card">
            <span className="topic-pill">ARMY SBIR / STTR</span>
            <strong>Decision as a program</strong>
            <p>Schema driven, auditable studies and acquisition decisions.</p>
            <a
              href="https://armysbir.army.mil/topics/agentic-ai-schema-driven-decision-management/"
              target="_blank"
              rel="noreferrer"
            >
              View topic <ArrowUpRight size={13} />
            </a>
          </div>
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
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <b>
              {page === "overview"
                ? "Overview"
                : nav.find((n) => n.id === page)?.label}
            </b>
          </div>
          <div className="top-actions">
            <div className="search">
              <Search size={16} />
              <input
                aria-label="Search decisions"
                placeholder="Search decisions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="new-button" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New decision
            </button>
          </div>
        </header>
        <main className="content">
          {page === "overview" && (
            <>
              <div className="ops-header">
                <div>
                  <div className="eyebrow">WORKSPACE / OVERVIEW</div>
                  <h1>Decision operations</h1>
                  <p>
                    Intake, source review, evaluation, and release in one place.
                  </p>
                </div>
                <div className="ops-header-actions">
                  <button
                    className="outline-button"
                    onClick={() => setPage("evidence")}
                  >
                    <Database size={15} /> Sources
                  </button>
                  <button
                    className="dark-button"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus size={15} /> New decision
                  </button>
                </div>
              </div>
              <div className="ops-layout">
                <section className="panel ops-current">
                  <div className="ops-panel-top">
                    <span className="eyebrow">ACTIVE DECISION</span>
                    <span className="status-pill gray">
                      {decision.runs.length
                        ? stale
                          ? "REVIEW CHANGES"
                          : "EVALUATED"
                        : "DRAFT"}
                    </span>
                  </div>
                  <h2>{decision.title}</h2>
                  <p className="ops-question">
                    {decision.question ||
                      "No decision question has been entered."}
                  </p>
                  <div className="ops-divider" />
                  <div className="ops-next">
                    <span>NEXT ACTION</span>
                    <strong>
                      {plan.find((step) => !step.done)?.title ??
                        "Review package"}
                    </strong>
                    <p>
                      {plan.find((step) => !step.done)?.detail ??
                        "Review the decision record before release."}
                    </p>
                  </div>
                  <div className="ops-buttons">
                    <button
                      className="dark-button"
                      onClick={() => setPage("analysis")}
                    >
                      <BrainCircuit size={15} /> Analyze request
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => {
                        setPage("workspace");
                        setTab("frame");
                      }}
                    >
                      Open model <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="ops-facts">
                    <div>
                      <strong>{decision.evidence.length}</strong>
                      <span>SOURCES</span>
                    </div>
                    <div>
                      <strong>{decision.market.length}</strong>
                      <span>PRICE RECORDS</span>
                    </div>
                    <div>
                      <strong>{decision.options.length}</strong>
                      <span>OPTIONS</span>
                    </div>
                    <div>
                      <strong>{decision.runs.length}</strong>
                      <span>RUNS</span>
                    </div>
                  </div>
                </section>
                <div className="stack">
                  <section className="panel ops-process">
                    <div className="eyebrow">PROCESS</div>
                    <h2>Decision path</h2>
                    {plan.map((step, i) => (
                      <button
                        className="ops-step"
                        key={step.title}
                        onClick={() => {
                          if (i === 0) {
                            setPage("workspace");
                            setTab("frame");
                          } else if (i === 1) setPage("evidence");
                          else if (i === 2) {
                            setPage("workspace");
                            setTab("compare");
                          } else if (i === 3) {
                            setPage("workspace");
                            setTab("challenge");
                          } else setPage("package");
                        }}
                      >
                        <span className={step.done ? "done" : ""}>
                          {step.done ? (
                            <Check size={13} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>
                        <div>
                          <strong>{step.title}</strong>
                          <small>{step.detail}</small>
                        </div>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </section>
                  <section className="panel ops-topic">
                    <div className="eyebrow">SOURCE / ARMY SBIR-STTR</div>
                    <strong>
                      Agentic AI, schema-driven decision management
                    </strong>
                    <p>
                      Phase I asks for formal decision objects, governed AI,
                      reproducible evaluation, sensitivity, and two
                      demonstrations.
                    </p>
                    <div className="topic-ids">
                      <span>
                        SBIR <b>ARM26BX06-NV012</b>
                      </span>
                      <span>
                        STTR <b>ARM26TX06-NV003</b>
                      </span>
                    </div>
                    <a
                      href="https://armysbir.army.mil/topics/agentic-ai-schema-driven-decision-management/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official topic <ArrowUpRight size={14} />
                    </a>
                  </section>
                </div>
              </div>
              <div className="section-head">
                <div>
                  <div className="eyebrow">ALL DECISIONS</div>
                  <h2>Workspaces</h2>
                </div>
                <span className="muted">
                  {
                    decisions.filter((d) =>
                      d.title.toLowerCase().includes(query.toLowerCase()),
                    ).length
                  }{" "}
                  total
                </span>
              </div>
              <div className="ops-table">
                <div className="ops-table-head">
                  <span>DECISION</span>
                  <span>TYPE</span>
                  <span>STATUS</span>
                  <span>OPEN ISSUES</span>
                  <span></span>
                </div>
                {decisions
                  .filter((d) =>
                    d.title.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((d) => {
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
                        <span>{r.total - r.passed} checks</span>
                        <ArrowRight size={16} />
                      </button>
                    );
                  })}
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
                  <p>
                    {page === "workspace"
                      ? "Define the model before evaluating alternatives."
                      : page === "analysis"
                        ? "Reason over the request and the records you have actually added."
                        : page === "market"
                          ? "Import comparable records, then inspect price history and scope."
                          : page === "evidence"
                            ? "Add source records, verify them, and link them to options."
                            : page === "people"
                              ? "Record official roles and complete source-based integrity checks."
                              : "Review the basis, open issues, and export a decision record."}
                  </p>
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
              <div className="context-line">
                <span className="live-indicator" /> Local prototype ·
                unclassified only <i /> {decision.evidence.length} source
                records <i /> {decision.market.length} price records <i />{" "}
                {decision.runs.length} evaluation runs
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
                    <div className="two-col">
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
                      <div className="stack">
                        <Guidance
                          plan={plan}
                          open={showGuide}
                          toggle={() => setShowGuide(!showGuide)}
                        />
                        <section className="panel">
                          <PanelHead
                            eyebrow="DESIGN PRINCIPLE"
                            title="Human judgment stays visible"
                            subtitle="Analysis and model scores remain reviewable. A person verifies evidence, resolves risks, and signs the package."
                          />
                          <div className="principle-list">
                            <div>
                              <ShieldCheck size={18} />
                              <span>Explicit constraints and criteria</span>
                            </div>
                            <div>
                              <Link2 size={18} />
                              <span>Traceable source records</span>
                            </div>
                            <div>
                              <RefreshCw size={18} />
                              <span>Refreshable evaluation snapshots</span>
                            </div>
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
                <div className="two-col evidence-layout">
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
                            <div className="bar">
                              <div
                                style={{
                                  width: `${Math.min(100, o.evidenceIds.length * 40)}%`,
                                }}
                              />
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
                    <section className="panel">
                      <PanelHead
                        eyebrow="RULE OF EVIDENCE"
                        title="A source is not a conclusion"
                        subtitle="The reviewer should validate its scope, date, and relevance before marking it verified."
                      />
                      <p className="body-copy">
                        In later phases, connectors can ingest digital
                        engineering artifacts and public acquisition records.
                        The prototype keeps every imported item in a review
                        queue.
                      </p>
                    </section>
                  </div>
                </div>
              )}

              {page === "people" && (
                <div className="two-col">
                  <section className="panel">
                    <div className="panel-title-row">
                      <PanelHead
                        eyebrow="TEAM MAP"
                        title="Roles & contacts"
                        subtitle="Use official sources. Avoid informal personal research in acquisition decisions."
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
                  </section>
                  <div className="stack">
                    <section className="panel">
                      <PanelHead
                        eyebrow="INTEGRITY WORKFLOW"
                        title="Responsible due diligence"
                        subtitle="Track organization and vendor checks through authoritative records."
                      />
                      <div className="integrity-list">
                        <a
                          href="https://sam.gov/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ShieldCheck size={19} />
                          <div>
                            <strong>SAM.gov entity & exclusions</strong>
                            <span>
                              Verify registration and exclusion status at the
                              source.
                            </span>
                          </div>
                          <ArrowUpRight size={16} />
                        </a>
                        <a
                          href="https://www.usaspending.gov/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <BookOpen size={19} />
                          <div>
                            <strong>USAspending awards</strong>
                            <span>
                              Review federal award history and recipient
                              context.
                            </span>
                          </div>
                          <ArrowUpRight size={16} />
                        </a>
                        <a
                          href="https://www.fpds.gov/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Database size={19} />
                          <div>
                            <strong>FPDS contract data</strong>
                            <span>
                              Check award records and contract details.
                            </span>
                          </div>
                          <ArrowUpRight size={16} />
                        </a>
                      </div>
                      <div className="market-warning">
                        <CircleAlert size={17} />
                        <span>
                          These links open official systems. The prototype does
                          not run an automated background check or claim a
                          person is cleared.
                        </span>
                      </div>
                    </section>
                    <section className="panel">
                      <PanelHead
                        eyebrow="SOLICITATION CHANNEL"
                        title="Official question path"
                        subtitle="The Army topic lists the SBIR/STTR Help Desk for program questions."
                      />
                      <a
                        className="official-contact"
                        href="mailto:usarmy.sbirsttr@army.mil"
                      >
                        usarmy.sbirsttr@army.mil <ArrowUpRight size={15} />
                      </a>
                      <p className="microcopy">
                        Use the solicitation and DSIP instructions for
                        topic-specific communications.
                      </p>
                    </section>
                  </div>
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
                        subtitle="An export includes the complete schema and reproducible run history."
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
                      <div className="package-subhead">Open issues</div>
                      <ul className="issues">
                        {ready.checks
                          .filter((c) => !c.pass)
                          .map((c) => (
                            <li key={c.label}>
                              <CircleAlert size={15} />
                              {c.label}
                            </li>
                          ))}
                        {ready.passed === ready.total && (
                          <li>
                            <CheckCircle2 size={15} />
                            All automated readiness checks passed. Human
                            sign-off is still required.
                          </li>
                        )}
                      </ul>
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
                    <section className="panel">
                      <PanelHead
                        eyebrow="HUMAN CONTROL"
                        title="Sign-off remains with the team"
                        subtitle="This model organizes evidence and exposes uncertainty. It does not approve a procurement action."
                      />
                      <p className="body-copy">
                        The signed record should capture a named decision
                        authority, date, rationale, and any accepted residual
                        risks in the governing system.
                      </p>
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
function Guidance({
  plan,
  open,
  toggle,
}: {
  plan: ReturnType<typeof workflowPlan>;
  open: boolean;
  toggle: () => void;
}) {
  return (
    <section className="panel guidance-panel">
      <button className="guidance-title" onClick={toggle}>
        <div>
          <div className="eyebrow">GUIDED WORKFLOW</div>
          <h2>Next best steps</h2>
        </div>
        <ChevronDown size={18} className={open ? "" : "rotate"} />
      </button>
      {open && (
        <div className="guide-steps">
          {plan.map((step, i) => (
            <div className="guide-step" key={step.title}>
              <span
                className={step.done ? "guide-circle done" : "guide-circle"}
              >
                {step.done ? <Check size={13} /> : i + 1}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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
