export type Criterion = {
  id: string;
  name: string;
  weight: number;
  unit: string;
};
export type Option = {
  id: string;
  name: string;
  description: string;
  scores: Record<string, number>;
  unitPrice: number;
  leadDays: number;
  evidenceIds: string[];
};
export type Evidence = {
  id: string;
  title: string;
  source: string;
  url: string;
  date: string;
  type: string;
  verified: boolean;
  notes: string;
};
export type MarketRecord = {
  id: string;
  vendor: string;
  vehicle: string;
  year: number;
  unitPrice: number;
  quantity: number;
  source: string;
  url: string;
  verified: boolean;
};
export type Contact = {
  id: string;
  role: string;
  name: string;
  organization: string;
  source: string;
  url: string;
  status: "Unverified" | "Verified" | "Review needed";
  notes: string;
};
export type Assumption = {
  id: string;
  text: string;
  confidence: "Low" | "Medium" | "High";
  owner: string;
};
export type Risk = {
  id: string;
  text: string;
  severity: "Low" | "Medium" | "High";
  mitigation: string;
};
export type BiasCheck = {
  id: string;
  text: string;
  status: "Open" | "Reviewed";
  note: string;
};
export type Run = {
  id: string;
  at: string;
  winner: string | null;
  scores: Record<string, number>;
  note: string;
  fingerprint: string;
  snapshot: string;
};
export type AnalysisRun = {
  id: string;
  at: string;
  prompt: string;
  output: string;
  model: string;
  inputFingerprint: string;
  publicWeb: boolean;
  tools: string[];
};
export type Decision = {
  id: string;
  title: string;
  kind: "Trade study" | "Decision program";
  question: string;
  owner: string;
  phase: string;
  dueDate: string;
  objective: string;
  budgetCeiling: number;
  maxLeadDays: number;
  criteria: Criterion[];
  options: Option[];
  evidence: Evidence[];
  market: MarketRecord[];
  contacts: Contact[];
  assumptions: Assumption[];
  risks: Risk[];
  biasChecks: BiasCheck[];
  runs: Run[];
  analyses: AnalysisRun[];
  updatedAt: string;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
export const dateLabel = (iso: string) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : "Not set";
