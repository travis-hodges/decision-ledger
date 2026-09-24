# Phase I plan

The [Army topic](https://armysbir.army.mil/topics/agentic-ai-schema-driven-decision-management/) calls for schema-driven decisions, governed agentic assistance, reproducible evaluation and sensitivity, and two demonstrations: a point trade and a longer-running decision program. This plan distinguishes working prototype features from work required for a defensible Phase I submission.

| Topic outcome                             | Current implementation                                            | Phase I work                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| First-class decision objects              | Typed model and published JSON Schema                             | Add versioned requirements, stakeholders, metrics, provenance edges, and schema migration        |
| Structured elicitation and workflow plans | Human entry path and generated workflow checklist                 | Model-assisted elicitation into schema-validated draft objects; reviewer acceptance before write |
| Reproducible evaluation                   | Deterministic weighted score, gates, input snapshot               | Independent reference cases, unit/normalization policy, traceable criterion rationale            |
| Sensitivity and what-flips                | Nearest single-weight flip                                        | Multi-factor ranges, price/lead sensitivity, visual scenario comparison                          |
| Risks, assumptions, bias                  | Explicit records and readiness checks                             | Owner, evidence, resolution status, and longitudinal change tracking                             |
| Agentic analysis                          | Streaming reasoning model, calculation tool, opt-in public search | Tool permission policy, citation verification, evaluation set, cost/latency logs                 |
| Two demonstrations                        | Product supports both study types                                 | Run two authorized, source-backed cases with named reviewers and measured outcomes               |

## Demonstration design

**Point trade:** An unclassified engineering choice with at least three real or carefully anonymized options, official requirements, source-backed performance measurements, costs, constraints, and a reviewable decision rationale. Compare the operator's baseline process against the product for time, missing-source detection, and repeatability.

**Decision program:** A longer-running choice revisited after a new source or changed requirement. Show provenance, a stale evaluation, a new run, the changed leader or unchanged result, and the exact reason. Measure update time and whether a reviewer can reproduce the prior result.

For both: predefine acceptance criteria, retain the source corpus, record human corrections to AI analysis, and evaluate unsupported claims. Do not populate a demo with fictional award prices or present simulated records as historical facts.

## Proposal work outside code

Confirm the active DSIP instructions and deadline, applicant eligibility, SBIR versus STTR path, teaming, budget, transition plan, data rights, and any restrictions on use of AI in proposal preparation. Those details are not established by this repository. Prepare a concise technical volume with architecture, measurable milestones, two demonstration datasets, reviewer letters or access, and a credible Army transition hypothesis.
