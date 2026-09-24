import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import {
  createRun,
  evaluate,
  findFlip,
  fingerprint,
  marketStats,
  readiness,
} from "./engine";
import type { Decision } from "./model";
import schema from "../schema/decision.schema.json";

const fixture = (): Decision => ({
  id: "test",
  title: "Test decision",
  kind: "Trade study",
  question: "Which option?",
  objective: "Select one",
  owner: "Test team",
  phase: "Evaluation",
  dueDate: "",
  budgetCeiling: 100,
  maxLeadDays: 30,
  criteria: [
    { id: "performance", name: "Performance", weight: 60, unit: "Score / 100" },
    { id: "support", name: "Support", weight: 40, unit: "Score / 100" },
  ],
  options: [
    {
      id: "a",
      name: "Option A",
      description: "",
      scores: { performance: 90, support: 60 },
      unitPrice: 90,
      leadDays: 20,
      evidenceIds: ["e1"],
    },
    {
      id: "b",
      name: "Option B",
      description: "",
      scores: { performance: 70, support: 95 },
      unitPrice: 95,
      leadDays: 25,
      evidenceIds: ["e1"],
    },
    {
      id: "c",
      name: "Option C",
      description: "",
      scores: { performance: 100, support: 100 },
      unitPrice: 120,
      leadDays: 40,
      evidenceIds: ["e1"],
    },
  ],
  evidence: [
    {
      id: "e1",
      title: "Test record",
      source: "Fixture",
      url: "",
      date: "",
      type: "Test",
      verified: false,
      notes: "",
    },
  ],
  market: [],
  contacts: [],
  assumptions: [
    { id: "a1", text: "Assumption", confidence: "Medium", owner: "Team" },
  ],
  risks: [],
  biasChecks: [{ id: "b1", text: "Check", status: "Open", note: "" }],
  runs: [],
  analyses: [],
  updatedAt: "",
});

describe("decision evaluation", () => {
  it("ranks eligible options and excludes hard constraint failures", () => {
    const result = evaluate(fixture());
    expect(result.winner?.name).toBe("Option B");
    expect(
      result.results.find((r) => r.option.id === "c")?.failures,
    ).toHaveLength(2);
  });
  it("finds a criterion weight that changes the eligible leader", () => {
    const decision = fixture();
    const flip = findFlip(decision);
    expect(flip).not.toBeNull();
    expect(flip!.winner.id).not.toBe(evaluate(decision).winner?.id);
  });
  it("captures inputs and marks a changed record stale", () => {
    const decision = fixture();
    const run = createRun(decision);
    expect(JSON.parse(run.snapshot).evidence).toHaveLength(1);
    expect(run.fingerprint).toBe(fingerprint(decision));
    expect(readiness({ ...decision, runs: [run] }).checks.at(-1)?.pass).toBe(
      true,
    );
    decision.evidence[0].verified = true;
    expect(readiness({ ...decision, runs: [run] }).checks.at(-1)?.pass).toBe(
      false,
    );
  });
  it("does not recommend a winner for an incomplete model", () => {
    const decision = fixture();
    decision.criteria = [];
    expect(evaluate(decision).winner).toBeNull();
    expect(
      readiness(decision).checks.find((c) => c.label === "Criteria total 100%")
        ?.pass,
    ).toBe(false);
  });
  it("uses median for historical prices", () => {
    expect(
      marketStats([
        {
          id: "1",
          vendor: "",
          vehicle: "",
          year: 2024,
          unitPrice: 10,
          quantity: 1,
          source: "",
          url: "",
          verified: false,
        },
        {
          id: "2",
          vendor: "",
          vehicle: "",
          year: 2025,
          unitPrice: 20,
          quantity: 1,
          source: "",
          url: "",
          verified: false,
        },
      ]).median,
    ).toBe(15);
    expect(marketStats([]).median).toBeNull();
  });
  it("keeps drafts and evaluated decisions inside the published schema", () => {
    const validate = new Ajv2020().compile(schema);
    const decision = fixture();
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
    decision.runs = [createRun(decision)];
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });
});
