import type { Decision, Run } from "./model";

export function inputSnapshot(decision: Decision): string {
  return JSON.stringify({
    question: decision.question,
    objective: decision.objective,
    budgetCeiling: decision.budgetCeiling,
    maxLeadDays: decision.maxLeadDays,
    criteria: decision.criteria,
    options: decision.options,
    evidence: decision.evidence,
    market: decision.market,
    assumptions: decision.assumptions,
    risks: decision.risks,
    biasChecks: decision.biasChecks,
  });
}

export function fingerprint(decision: Decision): string {
  const data = inputSnapshot(decision);
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function evaluate(decision: Decision, weights?: Record<string, number>) {
  const criteria = decision.criteria;
  const modelValid =
    decision.options.length >= 2 &&
    criteria.length > 0 &&
    criteria.reduce((sum, c) => sum + c.weight, 0) === 100 &&
    decision.options.every((o) =>
      criteria.every(
        (c) =>
          Number.isFinite(o.scores[c.id]) &&
          o.scores[c.id] >= 0 &&
          o.scores[c.id] <= 100,
      ),
    );
  const weightTotal =
    criteria.reduce(
      (sum, c) => sum + Math.max(0, weights?.[c.id] ?? c.weight),
      0,
    ) || 1;
  const results = decision.options
    .map((option) => {
      const score = criteria.reduce(
        (sum, c) =>
          sum +
          (Math.max(0, weights?.[c.id] ?? c.weight) / weightTotal) *
            Math.max(0, Math.min(100, option.scores[c.id] ?? 0)),
        0,
      );
      const failures = [
        ...(decision.budgetCeiling > 0 &&
        option.unitPrice > decision.budgetCeiling
          ? [
              `Price exceeds ceiling by ${Math.round((option.unitPrice / decision.budgetCeiling - 1) * 100)}%`,
            ]
          : []),
        ...(decision.maxLeadDays > 0 && option.leadDays > decision.maxLeadDays
          ? [
              `Lead time exceeds limit by ${option.leadDays - decision.maxLeadDays} days`,
            ]
          : []),
      ];
      return {
        option,
        score: Math.round(score * 10) / 10,
        eligible: failures.length === 0,
        failures,
      };
    })
    .sort(
      (a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score,
    );
  const winner = modelValid
    ? (results.find((r) => r.eligible)?.option ?? null)
    : null;
  return { results, winner, modelValid };
}

export function readiness(decision: Decision) {
  const checks = [
    {
      label: "Decision question defined",
      pass: Boolean(decision.question.trim()),
    },
    { label: "At least two options", pass: decision.options.length >= 2 },
    {
      label: "Criteria total 100%",
      pass:
        decision.criteria.length > 0 &&
        decision.criteria.reduce((s, c) => s + c.weight, 0) === 100,
    },
    {
      label: "Every option scored",
      pass:
        decision.options.length >= 2 &&
        decision.criteria.length > 0 &&
        decision.options.every((o) =>
          decision.criteria.every(
            (c) =>
              Number.isFinite(o.scores[c.id]) &&
              o.scores[c.id] >= 0 &&
              o.scores[c.id] <= 100,
          ),
        ),
    },
    {
      label: "Evidence linked to every option",
      pass:
        decision.options.length > 0 &&
        decision.options.every((o) =>
          o.evidenceIds.some((id) =>
            decision.evidence.some((e) => e.id === id),
          ),
        ),
    },
    {
      label: "All evidence verified",
      pass:
        decision.evidence.length > 0 &&
        decision.evidence.every((e) => e.verified),
    },
    {
      label: "Assumptions owned",
      pass:
        decision.assumptions.length > 0 &&
        decision.assumptions.every((a) => a.owner.trim()),
    },
    {
      label: "Risks recorded and mitigated",
      pass:
        decision.risks.length > 0 &&
        decision.risks
          .filter((r) => r.severity === "High")
          .every((r) => r.mitigation.trim()),
    },
    {
      label: "Bias checks reviewed",
      pass:
        decision.biasChecks.length > 0 &&
        decision.biasChecks.every((b) => b.status === "Reviewed"),
    },
    {
      label: "Current evaluation run",
      pass:
        decision.runs.length > 0 &&
        decision.runs[0].fingerprint === fingerprint(decision),
    },
  ];
  return {
    checks,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
  };
}

export function createRun(decision: Decision, note = "Evaluation run"): Run {
  const { results, winner } = evaluate(decision);
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    winner: winner?.id ?? null,
    scores: Object.fromEntries(results.map((r) => [r.option.id, r.score])),
    note,
    fingerprint: fingerprint(decision),
    snapshot: inputSnapshot(decision),
  };
}

export function findFlip(decision: Decision) {
  const base = evaluate(decision).winner;
  if (!base || decision.criteria.length < 2) return null;
  const candidates: {
    criterion: Decision["criteria"][number];
    weight: number;
    winner: Decision["options"][number];
    distance: number;
  }[] = [];
  for (const criterion of decision.criteria) {
    for (let weight = 0; weight <= 100; weight++) {
      const otherTotal =
        decision.criteria
          .filter((c) => c.id !== criterion.id)
          .reduce((s, c) => s + c.weight, 0) || 1;
      const weights = Object.fromEntries(
        decision.criteria.map((c) => [
          c.id,
          c.id === criterion.id
            ? weight
            : ((100 - weight) * c.weight) / otherTotal,
        ]),
      );
      const winner = evaluate(decision, weights).winner;
      if (winner && winner.id !== base.id)
        candidates.push({
          criterion,
          weight,
          winner,
          distance: Math.abs(weight - criterion.weight),
        });
    }
  }
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.criterion.name.localeCompare(b.criterion.name),
  );
  return candidates[0] ?? null;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function marketStats(records: Decision["market"]) {
  const prices = records
    .map((r) => r.unitPrice)
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    median: median(prices),
    low: prices.length ? Math.min(...prices) : null,
    high: prices.length ? Math.max(...prices) : null,
    count: prices.length,
  };
}

export function workflowPlan(decision: Decision) {
  const steps = [
    {
      title: "Frame the decision",
      detail:
        "Confirm objective, question, options, constraints, and accountable owner.",
      done: Boolean(
        decision.question && decision.objective && decision.options.length >= 2,
      ),
    },
    {
      title: "Ground the evidence",
      detail:
        "Link source records to each option; verify dates, units, and provenance.",
      done:
        decision.options.length > 0 &&
        decision.evidence.length > 0 &&
        decision.options.every((o) => o.evidenceIds.length > 0) &&
        decision.evidence.every((e) => e.verified),
    },
    {
      title: "Compare alternatives",
      detail:
        "Run the weighted model; inspect hard constraint failures and sensitivity.",
      done:
        decision.runs.length > 0 &&
        decision.runs[0].fingerprint === fingerprint(decision),
    },
    {
      title: "Challenge the result",
      detail:
        "Review assumptions, high risks, bias checks, and historical price context.",
      done:
        decision.biasChecks.length > 0 &&
        decision.biasChecks.every((b) => b.status === "Reviewed") &&
        decision.risks.every((r) => r.severity !== "High" || r.mitigation),
    },
    {
      title: "Release the package",
      detail: "Export a reproducible snapshot for a human signatory.",
      done: false,
    },
  ];
  return steps;
}

export function packageData(decision: Decision) {
  return {
    format: "Decision Ledger Package v0.1",
    generatedAt: new Date().toISOString(),
    decision,
    evaluation: evaluate(decision),
    readiness: readiness(decision),
    sensitivity: findFlip(decision),
    marketSummary: marketStats(decision.market.filter((r) => r.verified)),
    workflow: workflowPlan(decision),
    disclosure:
      "Local prototype. Review source provenance, model assumptions, and AI analysis before operational use.",
  };
}
