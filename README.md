# Decision Ledger

An auditable decision workspace for engineering and acquisition teams. Built as an early prototype for the [Army SBIR/STTR topic on agentic AI and schema-driven decision management](https://armysbir.army.mil/topics/agentic-ai-schema-driven-decision-management/).

The product starts with a decision question. Operators add options, criteria, source records, historical prices, assumptions, risks, and official contacts; run a deterministic comparison; inspect what changes the leader; and export the complete record. A separate analysis page streams reasoning-model analysis over the entered record. Empty fields remain empty. The app ships with no invented bids, prices, vendors, or people.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
cp .env.example .env
# Put your own OPENAI_API_KEY in .env to enable live analysis.
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`. The local API listens on `127.0.0.1:8787`. The key stays on the API side; do not put it in a `VITE_` variable. Without a key, decision modeling and deterministic evaluation still work and the analysis page explains why model analysis is unavailable.

```bash
npm run build
npm run lint
npm test
```

## Current scope

- **Decision model:** first-class typed objects and a [JSON Schema](schema/decision.schema.json) for a trade study or a decision program.
- **Comparison:** weighted scoring, hard price and lead-time gates, a nearest single-weight flip, and a saved input snapshot for every evaluation.
- **Evidence and market context:** source records with reviewer-set verification status, CSV price import, raw price trend, and median of reviewed comparables. Price differences are prompts for review, not normalized estimates.
- **Analysis:** server-side OpenAI Responses API with high reasoning effort, streamed output, code interpreter, and opt-in public web search. The model is instructed to distinguish supplied facts from inference and cite source IDs. AI output is advisory and is saved with the input fingerprint.
- **Package:** readiness checks and JSON export of the complete decision record and evaluation history. Human approval remains outside the prototype.

The prototype stores decisions in the browser's `localStorage` and has no access control, organization database, or accredited environment. Use **unclassified, nonsensitive evaluation data only**. The local analysis API transmits the selected decision context to the configured model provider. See [architecture](docs/architecture.md) and the [Phase I plan](docs/phase-i-plan.md).

## Project direction

The [inputs list](docs/inputs-needed.md) identifies what is needed to turn this prototype into a credible solicitation response and two source-backed demonstrations. The current implementation is a working start, not a claim that every Phase I requirement is complete.

MIT licensed. See [LICENSE](LICENSE).
