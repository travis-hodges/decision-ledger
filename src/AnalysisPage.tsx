import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CircleAlert,
  Code2,
  Database,
  Globe2,
  Radio,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Decision } from "./model";
import { dateLabel } from "./model";
import { fingerprint } from "./engine";

type Props = {
  decision: Decision;
  prompt: string;
  setPrompt: (value: string) => void;
  output: string;
  setOutput: (value: string) => void;
  phase: "idle" | "streaming" | "done" | "error";
  error: string;
  tools: string[];
  publicWeb: boolean;
  setPublicWeb: (value: boolean) => void;
  health: { configured: boolean; model: string } | null;
  run: () => void;
  openEvidence: () => void;
};

export default function AnalysisPage({
  decision,
  prompt,
  setPrompt,
  output,
  setOutput,
  phase,
  error,
  tools,
  publicWeb,
  setPublicWeb,
  health,
  run,
  openEvidence,
}: Props) {
  const latest = decision.analyses?.[0];
  const shown = output || latest?.output || "";
  const current = latest && latest.inputFingerprint === fingerprint(decision);
  return (
    <div className="analysis-layout">
      <div className="analysis-main">
        <section className="panel analysis-input">
          <div className="analysis-topline">
            <div className="eyebrow">01 / REQUEST</div>
            <span
              className={`model-state ${health?.configured ? "online" : ""}`}
            >
              <span />
              {health?.configured
                ? `${health.model} available`
                : "Model not configured"}
            </span>
          </div>
          <h2>What decision needs work?</h2>
          <p>
            Paste the request or describe the question. The analyst will use
            this workspace’s records and identify what it cannot support.
          </p>
          <textarea
            aria-label="Decision request for analysis"
            rows={6}
            placeholder="Describe the decision, alternatives, constraints, and what you need to know. No facts will be supplied unless you add them or enable public search."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="analysis-input-footer">
            <div className="tool-switches">
              <span className="tool-chip always">
                <Code2 size={14} /> Calculation tool
              </span>
              <label className={`tool-chip ${publicWeb ? "enabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={publicWeb}
                  onChange={(e) => setPublicWeb(e.target.checked)}
                />
                <Globe2 size={14} /> Public web search
              </label>
            </div>
            <button
              className="dark-button"
              disabled={phase === "streaming" || !health?.configured}
              onClick={run}
            >
              <Radio size={15} />
              {phase === "streaming" ? "Analyzing…" : "Run analysis"}{" "}
              <ArrowRight size={15} />
            </button>
          </div>
          {!health?.configured && (
            <div className="config-note">
              <CircleAlert size={15} /> Set <code>OPENAI_API_KEY</code> in the
              local API environment to enable live reasoning. The key stays on
              the server.
            </div>
          )}
          <p className="data-note">
            Running analysis sends this request and the active decision’s
            records to the configured OpenAI API. Add only content approved for
            that service.
          </p>
        </section>
        <section className="panel analysis-output">
          <div className="analysis-topline">
            <div className="eyebrow">02 / ANALYSIS</div>
            <span
              className={`model-state ${phase === "streaming" ? "online" : ""}`}
            >
              <span />
              {phase === "streaming"
                ? "Streaming"
                : shown
                  ? current
                    ? "Current inputs"
                    : "Inputs changed"
                  : "Awaiting request"}
            </span>
          </div>
          {phase === "error" && (
            <div className="analysis-error">
              <CircleAlert size={17} />
              {error}
            </div>
          )}
          {tools.length > 0 && (
            <div className="tool-events">
              {tools.map((tool, i) => (
                <span key={`${tool}-${i}`}>
                  {tool === "web_search_call"
                    ? "Public search used"
                    : "Calculation tool used"}
                </span>
              ))}
            </div>
          )}
          {shown ? (
            <div className="analysis-render">
              <ReactMarkdown>{shown}</ReactMarkdown>
              {phase === "streaming" && <span className="stream-cursor" />}
            </div>
          ) : (
            <div className="analysis-empty">
              <BrainCircuit size={35} />
              <strong>Analysis appears here.</strong>
              <p>
                It will separate evidence from inference, cite available
                sources, and list the questions that still need an answer.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="analysis-rail">
        <section className="panel">
          <div className="eyebrow">INPUTS IN SCOPE</div>
          <h2>Grounded in this workspace</h2>
          <div className="input-counts">
            <div>
              <strong>{decision.evidence.length}</strong>
              <span>Evidence records</span>
            </div>
            <div>
              <strong>{decision.market.length}</strong>
              <span>Price records</span>
            </div>
            <div>
              <strong>{decision.options.length}</strong>
              <span>Options</span>
            </div>
          </div>
          {decision.evidence.length ? (
            <div className="analysis-sources">
              {decision.evidence.map((e) => (
                <div key={e.id}>
                  <Database size={14} />
                  <div>
                    <strong>{e.title || "Untitled source"}</strong>
                    <small>
                      [source:{e.id}] ·{" "}
                      {e.verified ? "Verified by user" : "Unverified"}
                    </small>
                  </div>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${e.title}`}
                    >
                      <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="source-empty">
              No source records yet. Analysis can frame the request, but cannot
              substantiate acquisition claims.
            </div>
          )}
          <button className="outline-button full" onClick={openEvidence}>
            Manage evidence <ArrowRight size={14} />
          </button>
        </section>
        <section className="panel">
          <div className="eyebrow">CONTROL</div>
          <h2>Operator review</h2>
          <div className="control-list">
            <div>
              <ShieldCheck size={17} />
              <span>Analysis never edits the model.</span>
            </div>
            <div>
              <ShieldCheck size={17} />
              <span>Source citations stay visible.</span>
            </div>
            <div>
              <ShieldCheck size={17} />
              <span>Only a person releases the package.</span>
            </div>
          </div>
        </section>
        {decision.analyses?.length > 0 && (
          <section className="panel">
            <div className="eyebrow">PREVIOUS ANALYSES</div>
            <div className="analysis-history">
              {decision.analyses.map((a) => (
                <button key={a.id} onClick={() => setOutput(a.output)}>
                  <strong>{dateLabel(a.at)}</strong>
                  <span>
                    {a.model} · {a.publicWeb ? "Web enabled" : "Workspace only"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
