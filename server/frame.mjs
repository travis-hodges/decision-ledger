import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";

export const frameSchema = JSON.parse(
  readFileSync(
    new URL("../schema/frame-draft.schema.json", import.meta.url),
    "utf8",
  ),
);
const validate = new Ajv2020().compile(frameSchema);

export function validateGroundedFrame(draft, request) {
  if (!validate(draft)) return false;
  if (draft.question.length > 500 || draft.objective.length > 500) return false;
  if (
    [
      draft.options,
      draft.constraints,
      draft.suggestedCriteria,
      draft.openQuestions,
    ].some((items) => items.length > 12)
  )
    return false;
  return [...draft.options, ...draft.constraints].every(
    (item) =>
      item.excerpt.trim() &&
      item.excerpt.length <= 500 &&
      request.includes(item.excerpt),
  );
}
