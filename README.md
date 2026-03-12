# Atlas

Atlas is a Next.js + TypeScript underwriting workspace for project-finance origination, diligence, bankability scoring, and lender-facing decision support.

## Live modules

- `/deal-radar` — origination command center, score-based triage, watchlists, relationship notes, and committee-pack generation
- `/documents` — dossier ingestion, classification, entity extraction, review workflows
- `/evidence` — evidence-card registry for diligence artefacts
- `/bankability` — **Module 4** bankability scoring and risk engineering
- `/financial-modeling` — scenario modelling, capital stack optimisation, stress testing, lender-pack previews

## Module 4: Bankability Scoring and Risk Engineering

The bankability surface includes:

- configurable scoring domains: technical, commercial, financial, regulatory, ESG, execution
- weighted criteria with evidence mapping
- red-flag rules and mitigation registers
- scenario logic for base / downside / upside cases
- readiness scorecards by project, workstream, and counterparty
- committee-grade narratives with evidence links
- issue-to-action workflows with owners and due dates
- archetype benchmarking and lender-pack export

### APIs

- `GET /api/bankability/scores` — returns the evaluation payload
- `GET /api/bankability/scores?mode=downside` — returns a scenario-specific evaluation
- `GET /api/bankability/scores?format=pack` — returns the board / lender pack payload
- `GET /api/risk` — returns the risk dashboard and mitigation register

## Development

```bash
pnpm dev
```

Open <http://localhost:3000>.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
```

Current test coverage includes the bankability engine, scoring layer, deal-radar store, financial modelling services, and document-intelligence workflows.
