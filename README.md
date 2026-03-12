# Atlas

Atlas is a Next.js + TypeScript underwriting workspace for project-finance origination, diligence, bankability scoring, and lender-facing decision support.

## Live modules

- `/deal-radar` — origination command center, score-based triage, watchlists, relationship notes, and committee-pack generation
- `/documents` — dossier ingestion, classification, entity extraction, review workflows
- `/evidence` — evidence-card registry for diligence artefacts
- `/bankability` — **Module 4** bankability scoring and risk engineering
- `/financial-modeling` — scenario modelling, capital stack optimisation, stress testing, lender-pack previews

## Module 3: Project Dossier Ingestion and Document Intelligence

The dossier-intelligence surface includes:

- bulk upload, email-forwarded intake, and connector-based imports
- automated document classification, OCR text handling, metadata extraction, and version lineage
- entity extraction for assets, permits, locations, counterparties, and key dates
- chunking and knowledge-graph population for downstream retrieval
- searchable evidence cards with line-level citations back to source chunks
- red-flag detection and data-completeness checks for diligence gaps
- AI-generated summaries with explicit human review controls
- storage lifecycle controls for hot / warm / archive handling

### APIs

- `GET /api/documents` — list processed documents with filters for source, review status, and search query
- `POST /api/documents` — ingest new dossier items or update review / retention actions
- `GET /api/evidence-cards` — retrieve evidence cards by query and risk level
- `POST /api/evidence-cards` — server-side evidence retrieval for a supplied query payload

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
