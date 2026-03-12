# Atlas

Atlas is a Next.js + TypeScript underwriting workspace for project-finance origination, diligence, bankability scoring, and lender-facing decision support.

## Architecture

```
Organization (multi-tenant)
  └─ Workspace (project grouping)
       └─ Portfolio (individual deal)
```

- **Runtime**: Next.js 16 App Router, React 19, TypeScript strict mode
- **Database**: SQLite (better-sqlite3) with WAL mode, PostgreSQL-ready schema (UUIDs, ISO timestamps, standard SQL)
- **Auth**: JWT (HS256) access tokens (15m) + refresh tokens (7d), bcrypt password hashing (12 rounds)
- **MFA**: TOTP via otpauth library, 10 hex recovery codes, enrollment + verification flow
- **Authorization**: RBAC (5 org roles, 3 workspace roles, 18 permissions) + ABAC (deny-first policy evaluation)
- **Sessions**: SHA-256 token hashing, list/revoke/revoke-all, automatic refresh rotation
- **SSO**: SAML/OIDC provider configuration surface (stub ready for IdP integration)
- **Audit**: Central audit log for all CRUD, auth, approval, and export actions
- **Events**: In-process event bus for notifications and side effects
- **Styling**: Tailwind CSS 4 with dark theme

## Live Modules

| Module | Path | Description |
|--------|------|-------------|
| **0 - Platform Foundations** | `/admin` | Multi-tenancy, auth, RBAC/ABAC, sessions, MFA, SSO, audit, notifications, tasks |
| **1 - Deal Radar** | `/deal-radar` | Origination command center, score-based triage, watchlists, committee packs |
| **3 - Document Intelligence** | `/documents` | Dossier ingestion, classification, entity extraction, evidence cards |
| **4 - Bankability Scoring** | `/bankability` | Underwriting domains, red-flag governance, readiness scorecards, scenarios |
| **5 - Financial Modelling** | `/financial-modeling` | Scenario libraries, stress tests, lender packs, comparison APIs |
| **7 - Execution Digital Twin** | `/execution` | Milestone control, project controls, contractor scorecards, field workflows, procurement tracker, integrated variance reporting |
| **8 - Asset Intelligence** | `/assets` | Telemetry ingestion, anomaly detection, predictive maintenance, compliance monitoring, efficiency, commercial analytics |
| **10 - Client / Investor / Operator Portals** | `/portals` | Executive cockpit, investor reporting portal, operator oversight, white-label delivery, exports, notifications |
| Evidence Workspace | `/evidence` | Evidence-card registry for diligence artefacts |

## Module 0: Platform Foundations & Secure Multi-Tenancy

### Auth API

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account, returns JWT pair |
| POST | `/api/auth/login` | Sign in (supports MFA token or recovery code) |
| POST | `/api/auth/refresh` | Rotate access + refresh tokens |
| POST | `/api/auth/logout` | Revoke current session |
| POST | `/api/auth/mfa/enroll` | Get TOTP secret + otpauth URI |
| POST | `/api/auth/mfa/verify` | Confirm TOTP, enable MFA, receive recovery codes |

### Session API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/auth/sessions` | List active sessions |
| DELETE | `/api/auth/sessions` | Revoke all other sessions |
| DELETE | `/api/auth/sessions/{id}` | Revoke specific session |

### Organization / Workspace / Portfolio API

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/orgs` | List / create organizations |
| GET/PATCH/DELETE | `/api/orgs/{orgId}` | Get / update / delete org |
| GET/POST | `/api/orgs/{orgId}/members` | List / add members |
| GET/POST | `/api/orgs/{orgId}/workspaces` | List / create workspaces |
| GET/PATCH/DELETE | `/api/orgs/{orgId}/workspaces/{wsId}` | Workspace CRUD |
| GET/POST | `/api/orgs/{orgId}/workspaces/{wsId}/portfolios` | List / create portfolios |
| GET/PATCH/DELETE | `/api/orgs/{orgId}/workspaces/{wsId}/portfolios/{id}` | Portfolio CRUD |

### SSO, Audit, Notifications, Tasks API

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST/PATCH | `/api/orgs/{orgId}/sso` | SSO provider CRUD + enable/disable |
| GET | `/api/orgs/{orgId}/audit` | Query audit logs (filters: userId, action, resourceType, from, to) |
| GET/PATCH | `/api/notifications` | List / mark-read notifications |
| GET/POST | `/api/tasks` | List / create tasks |
| GET/PATCH | `/api/tasks/{id}` | Get / update task |
| GET/POST | `/api/portals` | List role-based portals / create scheduled report configuration |
| GET | `/api/dashboards` | Resolve role-aware dashboard bundles with caching |
| GET/POST | `/api/reports` | List schedules or generate report artifacts / export payloads |

### RBAC Roles & Permissions

**Organization Roles**: owner, admin, member, viewer, billing

| Permission | Owner | Admin | Member | Viewer | Billing |
|-----------|-------|-------|--------|--------|---------|
| org:read | x | x | x | x | x |
| org:update | x | x | | | |
| org:delete | x | | | | |
| org:manage_members | x | x | | | |
| org:manage_billing | x | | | | x |
| org:manage_sso | x | x | | | |
| ws:create | x | x | x | | |
| ws:read | x | x | x | x | |
| ws:update | x | x | x | | |
| ws:delete | x | x | | | |
| portfolio:create | x | x | x | | |
| portfolio:read | x | x | x | x | |
| portfolio:update | x | x | x | | |
| portfolio:delete | x | x | | | |
| audit:read | x | x | x | x | |
| audit:export | x | x | | | |

**Workspace Roles**: admin, editor, viewer

### ABAC Policies

Attribute-based policies stored per-org with deny-first evaluation. Conditions use dot-path matching (e.g., `user.orgRole`, `resource.type`).

## Development

```bash
pnpm install
pnpm dev          # Start dev server at http://localhost:3000
pnpm seed         # Populate demo data (3 users, 1 org, 2 workspaces, 2 portfolios)
```

### Demo Credentials

All demo accounts use password `Atlas2026!`:
- `admin@atlas.dev` — org owner
- `analyst@atlas.dev` — org member
- `viewer@atlas.dev` — org viewer

## Verification

```bash
pnpm lint         # ESLint
pnpm test         # Vitest (auth, RBAC, ABAC, sessions, services, scoring, finance, documents)
pnpm build        # Next.js production build
```

## Migration Notes (SQLite → PostgreSQL)

The schema is designed for easy migration:
- All IDs are TEXT UUIDs (maps to `uuid` in PostgreSQL)
- Timestamps use ISO 8601 strings (change to `timestamptz`)
- `datetime('now')` → `NOW()`
- `INTEGER` booleans → `BOOLEAN`
- JSON columns stored as TEXT → native `JSONB`
- WAL pragma → PostgreSQL default MVCC
- `UNIQUE` constraints and indexes are standard SQL

## Module 3: Document Intelligence

- Bulk upload, email-forwarded intake, connector-based imports
- Automated classification, OCR, metadata extraction, version lineage
- Entity extraction for assets, permits, locations, counterparties, dates
- Chunking and knowledge-graph population
- Evidence cards with line-level citations
- Red-flag detection and data-completeness checks
- AI-generated summaries with human review controls

## Module 4: Bankability Scoring and Risk Engineering

- Configurable scoring domains: technical, commercial, financial, regulatory, ESG, execution
- Weighted criteria with evidence mapping
- Red-flag rules and mitigation registers
- Scenario logic for base/downside/upside cases
- Readiness scorecards by project, workstream, counterparty
- Committee-grade narratives with evidence links

## Module 8: Asset Intelligence, Telemetry and Predictive Maintenance

- `/api/assets` for asset registry reads and snapshot analytics
- `/api/telemetry` for connector ingestion and time-series signal capture
- `/api/maintenance` for predictive maintenance queue management
- Connector framework covering CAN bus, SCADA, ERP, and manual telemetry feeds
- Deterministic anomaly detection, predictive maintenance risk scoring, and alert orchestration
- Monitoring for utilization, fuel burn, energy draw, throughput, inspection readiness, and revenue performance

## Module 7: Execution Digital Twin & Project Controls

- Digital twin domain model for execution work packages
- Milestone and schedule management with critical-path visibility
- Budget, forecast, commitments, estimate-at-completion, and contingency control
- Contractor performance scorecards and change-order workflow engine
- Field issue, RFI, and punch-list workflows including mobile-friendly issue logging
- Procurement tracker for long-lead equipment and on-site readiness monitoring
- Integrated reporting layer for cost/schedule/procurement/issue variance analysis
- APIs: `/api/execution`, `/api/milestones`, `/api/issues`
