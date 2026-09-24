import { describe, expect, it } from "vitest";
import { validateGroundedFrame } from "./frame.mjs";

const draft = {
  question: "Which system should we select?",
  objective: "Select a system for evaluation.",
  options: [{ name: "System A", excerpt: "System A" }],
  constraints: [{ statement: "Deliver in 30 days", excerpt: "within 30 days" }],
  suggestedCriteria: [
    { name: "Delivery", why: "The request includes a delivery constraint." },
  ],
  openQuestions: ["What is the budget?"],
};

describe("grounded intake draft", () => {
  it("accepts extracted items only when their quoted text appears in the request", () => {
    expect(
      validateGroundedFrame(
        draft,
        "Compare System A and deliver within 30 days.",
      ),
    ).toBe(true);
    expect(validateGroundedFrame(draft, "Compare System A.")).toBe(false);
  });
  it("rejects extra unreviewed fields", () => {
    expect(
      validateGroundedFrame(
        { ...draft, inventedPrice: 100 },
        "Compare System A and deliver within 30 days.",
      ),
    ).toBe(false);
  });
});
