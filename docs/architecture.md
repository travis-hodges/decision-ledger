# Architecture and operator path

## Operator path

1. Start a **trade study** for a point decision or a **decision program** for a decision that is revisited as evidence changes.
2. State the question, objective, owner, constraints, options, and weighted criteria.
3. Add primary source records and link them to options. Review source provenance before marking a record verified.
4. Import or enter historical price records. Review item scope, quantity, contract year, and included services before comparison.
5. Use **Analysis** to ask a focused question about the entered record. Public web search requires a separate opt-in for each request. Treat generated analysis as a draft for review.
6. Run the deterministic comparison. Inspect exclusions, criterion scores, the nearest weight flip, assumptions, risks, and bias checks.
7. Export the JSON decision package with the model, source records, and reproducible run snapshots. A human decision authority signs in the governing system.

## Current components

| Component                                        | Responsibility                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| React UI                                         | Decision entry, source review, analysis, comparison, package export |
| `src/model.ts` and `schema/decision.schema.json` | Typed first-class decision records and portable contract            |
| `src/engine.ts`                                  | Deterministic scoring, gates, sensitivity, readiness, snapshots     |
| Browser `localStorage`                           | Local prototype persistence                                         |
| `server/index.mjs`                               | Local, server-side model call and SSE streaming                     |
| OpenAI Responses API                             | Advisory analysis, calculation tool, optional public search         |

The model does not calculate the official decision score. The deterministic engine owns scoring and creates a snapshot of each evaluation's inputs. Subsequent edits make an older run stale. The AI receives bounded selected fields and source records; it is instructed to cite source IDs, label uncertainty, and avoid fabricating facts. These instructions reduce risk but do not guarantee correctness. A reviewer must verify citations and conclusions.

## Boundaries before operational use

This is an unclassified, single-browser prototype. There is no login, role separation, centralized audit log, persistent database, approved data boundary, or authority to operate. Do not enter sensitive procurement, personnel, export-controlled, or classified material. A production path needs server-side schema validation, durable versioned storage, identity and permissions, access logging, citation verification, evaluation fixtures, and deployment in an approved environment. Public web search must be governed by data policy.

The current JSON Schema covers the operator record and run history. Phase I work should evolve it into versioned requirements, stakeholder, decision, option, metric, evidence, constraint, and traceability objects, with explicit provenance and change relationships.
