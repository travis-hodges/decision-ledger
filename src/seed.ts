import type { Decision } from "./model";

// A blank workspace is intentional. Operational facts enter only through a user or a cited source.
export const seedDecisions: Decision[] = [
  {
    id: "new-decision",
    title: "Untitled decision",
    kind: "Trade study",
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
  },
];
