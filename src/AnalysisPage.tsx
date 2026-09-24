import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CircleAlert,
  Code2,
  Database,
  Globe2,
  ListChecks,
  Radio,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Decision, FrameDraft } from "./model";
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
  structure: () => void;
  frameDraft:
    (FrameDraft & { decisionId: string; inputFingerprint: string }) | null;
  framePhase: "idle" | "working" | "done" | "error";
  frameError: string;
  frameCurrent: boolean;
  applyFrame: () => void;
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
  structure,
  frameDraft,
  framePhase,
  frameError,
  frameCurrent,
  applyFrame,
  openEvidence,
}: Props) {
  const latest = decision.analyses?.[0];
  const shown = phase === "streaming" ? output : output || latest?.output || "";
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
          <div className="frame-entry">
            <div>
              <strong>Need a starting frame?</strong>
              <span>
                Extract the question and stated constraints for review.
              </span>
            </div>
            <button
              className="outline-button"
              disabled={framePhase === "working" || !health?.configured}
              onClick={structure}
            >
              <ListChecks size={15} />{" "}
              {framePhase === "working" ? "Structuring…" : "Structure request"}
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
        {(frameDraft || framePhase === "error" || framePhase === "working") && (
          <section className="panel frame-review">
            <div className="analysis-topline">
              <div className="eyebrow">02 / FRAME DRAFT</div>
              <span className="model-state">
                <span />
                {framePhase === "working"
                  ? "Structuring"
                  : frameCurrent
                    ? "Review required"
                    : "Inputs changed"}
              </span>
            </div>
            {framePhase === "error" && (
              <div className="analysis-error">
                <CircleAlert size={17} />
                {frameError}
              </div>
            )}
            {framePhase === "working" && (
              <p className="frame-muted">
                Extracting stated facts and open questions from the request.
              </p>
            )}
            {frameDraft && (
              <>
                <p className="frame-muted">
                  Proposed wording. Nothing is added to the decision until you
                  apply it.
                </p>
                <div className="frame-fields">
                  <div>
                    <span>DECISION QUESTION</span>
                    <strong>{frameDraft.question || "Not identified"}</strong>
                  </div>
                  <div>
                    <span>OBJECTIVE</span>
                    <strong>{frameDraft.objective || "Not identified"}</strong>
                  </div>
                </div>
                <div className="frame-columns">
                  <div>
                    <span className="eyebrow">STATED OPTIONS</span>
                    {frameDraft.options.length ? (
                      frameDraft.options.map((item, i) => (
                        <div className="frame-item" key={`${item.name}-${i}`}>
                          <strong>{item.name}</strong>
                          <small>“{item.excerpt}”</small>
                        </div>
                      ))
                    ) : (
                      <p>None stated.</p>
                    )}
                  </div>
                  <div>
                    <span className="eyebrow">STATED CONSTRAINTS</span>
                    {frameDraft.constraints.length ? (
                      frameDraft.constraints.map((item, i) => (
                        <div
                          className="frame-item"
                          key={`${item.statement}-${i}`}
                        >
                          <strong>{item.statement}</strong>
                          <small>“{item.excerpt}”</small>
                        </div>
                      ))
                    ) : (
                      <p>None stated.</p>
                    )}
                  </div>
                </div>
                {frameDraft.suggestedCriteria.length > 0 && (
                  <div className="frame-list">
                    <span className="eyebrow">CRITERIA TO CONSIDER</span>
                    <p>
                      {frameDraft.suggestedCriteria
                        .map((c) => c.name)
                        .join(" · ")}
                    </p>
                  </div>
                )}
                {frameDraft.openQuestions.length > 0 && (
                  <div className="frame-list">
                    <span className="eyebrow">OPEN QUESTIONS</span>
                    <ul>
                      {frameDraft.openQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="frame-apply">
                  <span>
                    Only the question and objective will be copied. Add options,
                    criteria, and source records in the workspace.
                  </span>
                  <button
                    className="dark-button"
                    disabled={!frameCurrent}
                    onClick={applyFrame}
                  >
                    Apply question & objective <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        <section className="panel analysis-output">
          <div className="analysis-topline">
            <div className="eyebrow">03 / ANALYSIS</div>
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
              <span>Draft changes require your review.</span>
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
