# Atlas API Reference

Complete API documentation for the Atlas underwriting platform.

## Table of Contents

- [Authentication](#authentication)
- [Module 0: Platform Foundations](#module-0-platform-foundations)
- [Module 1: Deal Radar](#module-1-deal-radar)
- [Module 3: Document Intelligence](#module-3-document-intelligence)
- [Module 4: Bankability Scoring](#module-4-bankability-scoring)
- [Module 5: Financial Modeling](#module-5-financial-modeling)
- [Module 6: Data Room](#module-6-data-room)
- [Module 7: Execution Digital Twin](#module-7-execution-digital-twin)
- [Module 8: Asset Intelligence](#module-8-asset-intelligence)
- [Module 9: ESG & Permitting](#module-9-esg--permitting)
- [Module 10: Portals](#module-10-portals)
- [Module 11: AI Copilots](#module-11-ai-copilots)
- [Module 12: DevSecOps](#module-12-devsecops)

---

## Authentication

All protected endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### POST `/api/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "expiresAt": 1234567890
}
```

### POST `/api/auth/login`

Sign in with email and password. Supports MFA.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "mfaToken": "123456",        // Optional: TOTP code
  "recoveryCode": "abc123def" // Optional: Recovery code
}
```

**Response:**
```json
{
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "expiresAt": 1234567890,
  "mfaRequired": false
}
```

### POST `/api/auth/refresh`

Rotate access and refresh tokens.

**Request Body:**
```json
{
  "refreshToken": "jwt..."
}
```

**Response:**
```json
{
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "expiresAt": 1234567890
}
```

### POST `/api/auth/logout`

Revoke the current session.

**Headers:** `Authorization: Bearer <token>`

**Response:** `204 No Content`

### POST `/api/auth/mfa/enroll`

Initiate MFA enrollment (requires authentication).

**Response:**
```json
{
  "secret": "BASE32SECRET",
  "otpauthUri": "otpauth://totp/Atlas:user@example.com?secret=...",
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

### POST `/api/auth/mfa/verify`

Complete MFA enrollment.

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "recoveryCodes": ["abc123", "def456", ...]
}
```

---

## Session Management

### GET `/api/auth/sessions`

List all active sessions for the current user.

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-01T00:00:00Z",
      "current": true
    }
  ]
}
```

### DELETE `/api/auth/sessions`

Revoke all other sessions (keep current).

**Response:** `204 No Content`

### DELETE `/api/auth/sessions/{id}`

Revoke a specific session.

**Response:** `204 No Content`

---

## Module 0: Platform Foundations

### Organizations

#### GET `/api/orgs`

List organizations the user belongs to.

**Response:**
```json
{
  "organizations": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "plan": "professional",
      "role": "admin"
    }
  ]
}
```

#### POST `/api/orgs`

Create a new organization.

**Request Body:**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "plan": "professional"
}
```

#### GET `/api/orgs/{orgId}`

Get organization details.

#### PATCH `/api/orgs/{orgId}`

Update organization settings.

#### DELETE `/api/orgs/{orgId}`

Delete an organization (owner only).

### Members

#### GET `/api/orgs/{orgId}/members`

List organization members.

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "userId": "uuid",
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "admin",
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST `/api/orgs/{orgId}/members`

Add a member to the organization.

**Request Body:**
```json
{
  "userId": "uuid",
  "role": "member"
}
```

### Workspaces

#### GET `/api/orgs/{orgId}/workspaces`

List workspaces in an organization.

#### POST `/api/orgs/{orgId}/workspaces`

Create a new workspace.

**Request Body:**
```json
{
  "name": "Project Alpha",
  "slug": "project-alpha",
  "description": "Solar farm development"
}
```

#### GET `/api/orgs/{orgId}/workspaces/{wsId}`

Get workspace details.

#### PATCH `/api/orgs/{orgId}/workspaces/{wsId}`

Update workspace settings.

#### DELETE `/api/orgs/{orgId}/workspaces/{wsId}`

Delete a workspace.

### Portfolios

#### GET `/api/orgs/{orgId}/workspaces/{wsId}/portfolios`

List portfolios in a workspace.

#### POST `/api/orgs/{orgId}/workspaces/{wsId}/portfolios`

Create a new portfolio.

#### GET `/api/orgs/{orgId}/workspaces/{wsId}/portfolios/{portfolioId}`

Get portfolio details.

#### PATCH `/api/orgs/{orgId}/workspaces/{wsId}/portfolios/{portfolioId}`

Update portfolio settings.

#### DELETE `/api/orgs/{orgId}/workspaces/{wsId}/portfolios/{portfolioId}`

Delete a portfolio.

### SSO Configuration

#### GET `/api/orgs/{orgId}/sso`

Get SSO provider configuration.

#### POST `/api/orgs/{orgId}/sso`

Configure SSO provider (SAML/OIDC).

**Request Body:**
```json
{
  "providerType": "saml",
  "metadataUrl": "https://idp.example.com/metadata",
  "enabled": true
}
```

#### PATCH `/api/orgs/{orgId}/sso`

Update SSO configuration.

### Audit Logs

#### GET `/api/orgs/{orgId}/audit`

Query audit logs.

**Query Parameters:**
- `userId` - Filter by user
- `action` - Filter by action type
- `resourceType` - Filter by resource type
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "action": "portfolio:create",
      "resourceType": "portfolio",
      "resourceId": "uuid",
      "details": {},
      "ipAddress": "192.168.1.1",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100
}
```

### Tasks

#### GET `/api/tasks`

List tasks with filters.

**Query Parameters:**
- `orgId` - Filter by organization
- `workspaceId` - Filter by workspace
- `assignedTo` - Filter by assignee
- `status` - pending | in_progress | completed | cancelled
- `priority` - low | medium | high | urgent

#### POST `/api/tasks`

Create a new task.

**Request Body:**
```json
{
  "orgId": "uuid",
  "workspaceId": "uuid",
  "title": "Review financial model",
  "description": "Check assumptions for Q3",
  "priority": "high",
  "assignedTo": "uuid",
  "dueDate": "2024-03-01"
}
```

#### GET `/api/tasks/{id}`

Get task details.

#### PATCH `/api/tasks/{id}`

Update a task.

### Notifications

#### GET `/api/notifications`

List notifications for the current user.

#### PATCH `/api/notifications`

Mark notifications as read.

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2"],
  "markAllRead": false
}
```

---

## Module 1: Deal Radar

### GET `/api/opportunities`

List investment opportunities.

**Query Parameters:**
- `status` - Filter by pipeline status
- `sector` - Filter by sector
- `stage` - Filter by project stage
- `minScore` - Minimum bankability score

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Solar Farm Alpha",
      "sector": "renewable_energy",
      "stage": "development",
      "geography": "US-TX",
      "debtAskUsdM": 150,
      "score": 78.5,
      "status": "active",
      "sponsor": "GreenCo Industries"
    }
  ],
  "total": 25
}
```

### POST `/api/opportunities`

Create a new opportunity.

### GET `/api/opportunities/{id}`

Get opportunity details with full scoring breakdown.

### PATCH `/api/opportunities/{id}`

Update opportunity data.

### GET `/api/committee`

Get committee pack for investment review.

---

## Module 3: Document Intelligence

### GET `/api/documents`

List documents with intelligence metadata.

**Query Parameters:**
- `query` - Search in content
- `source` - Filter by source (upload, email, connector)
- `status` - Filter by review status

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "name": "Technical Report v2.pdf",
      "category": "technical",
      "source": "upload",
      "review": {
        "status": "approved",
        "reviewer": "analyst@company.com",
        "reviewedAt": "2024-01-15T10:00:00Z"
      },
      "entities": [
        { "type": "location", "value": "Houston, TX" },
        { "type": "date", "value": "2024-06-01" }
      ],
      "redFlags": [],
      "summary": "Technical feasibility study for solar installation..."
    }
  ]
}
```

### POST `/api/documents`

Ingest new documents.

**Request Body:**
```json
{
  "documents": [
    {
      "name": "Document.pdf",
      "content": "base64...",
      "source": "upload",
      "category": "legal"
    }
  ]
}
```

### GET `/api/evidence-cards`

List evidence cards extracted from documents.

**Response:**
```json
{
  "evidenceCards": [
    {
      "id": "uuid",
      "title": "Technical Capacity Confirmed",
      "statement": "Plant capacity verified at 150MW",
      "riskLevel": "low",
      "documentIds": ["uuid1", "uuid2"],
      "tags": ["technical", "capacity"],
      "citations": [
        {
          "excerpt": "The facility has confirmed capacity of 150MW...",
          "lineRange": [42, 45],
          "documentName": "Technical Report.pdf"
        }
      ]
    }
  ]
}
```

---

## Module 4: Bankability Scoring

### GET `/api/bankability/scores`

Get bankability evaluation for an opportunity.

**Query Parameters:**
- `opportunityId` - Target opportunity
- `scenario` - base | downside | upside

**Response:**
```json
{
  "overallScore": 78.5,
  "domainScores": [
    {
      "domain": "technical",
      "weightedScore": 82.3,
      "rawAverage": 80.1,
      "evidenceCoverage": 85.0,
      "flagged": false,
      "narrative": "TECHNICAL is bankable at 82.3/100 with 85.0 evidence coverage."
    }
  ],
  "redFlags": [
    {
      "id": "rf-001",
      "label": "Missing environmental permit",
      "domain": "regulatory",
      "severity": "high",
      "mitigation": "Obtain permit before financial close"
    }
  ],
  "readiness": [
    {
      "targetId": "lender-readiness",
      "label": "Lender Documentation",
      "score": 72.5,
      "status": "progressing"
    }
  ],
  "scenarios": [
    {
      "mode": "base",
      "overallScore": 78.5,
      "deltaVsBase": 0
    },
    {
      "mode": "downside",
      "overallScore": 65.2,
      "deltaVsBase": -13.3
    }
  ],
  "committeeNarrative": {
    "headline": "Project Alpha: conditionally bankable",
    "tone": "conditional",
    "summary": "Model indicates 78.5/100 overall...",
    "strengths": ["TECHNICAL is comparatively strong at 82.3"],
    "watchouts": ["REGULATORY is below target at 58.2"]
  }
}
```

---

## Module 5: Financial Modeling

### GET `/api/scenarios`

List financial scenarios.

### POST `/api/scenarios`

Create a new financial scenario.

**Request Body:**
```json
{
  "id": "scenario-001",
  "name": "Base Case Q3 2024",
  "targetDebtAmount": 150000000,
  "targetEquityAmount": 50000000,
  "targetLeaseAmount": 0,
  "tenorYears": 15,
  "fundingStructure": "project_finance",
  "assumptionsVersion": "v2024-q3",
  "capexTemplateId": "solar-utility-scale",
  "opexTemplateId": "solar-operations-standard",
  "revenueTemplateId": "ppa-merchant-hybrid",
  "covenantDefinition": {
    "minDscr": 1.35,
    "maxLeverage": 6.0,
    "minIcRatio": 2.0
  },
  "approvals": []
}
```

**Response:**
```json
{
  "input": { ... },
  "assumptions": {
    "version": "v2024-q3",
    "interestRate": 0.065,
    "inflationRate": 0.025,
    "exitMultiple": 8.0
  },
  "metrics": {
    "revenue": 25000000,
    "ebitda": 18500000,
    "ebitdaMargin": 0.74,
    "totalCapex": 200000000,
    "totalOpex": 6500000,
    "debtService": 14000000,
    "dscr": 1.32,
    "leverageRatio": 8.1,
    "interestCoverage": 1.9,
    "projectIrr": 0.125,
    "equityMultiple": 2.1,
    "fundingReadinessScore": 68.5
  },
  "covenantBreaches": ["DSCR below 1.35"],
  "sensitivity": [
    {
      "shock": "Downside pricing",
      "metrics": { ... },
      "covenantBreaches": ["DSCR below 1.35", "Leverage above 6.0x"]
    }
  ],
  "lenderPack": {
    "highlights": ["Funding structure: project_finance", "Base DSCR: 1.32x"],
    "checklist": ["Historical operating data uploaded", "..."],
    "approvalHistory": []
  },
  "audit": {
    "fingerprint": "sha256...",
    "generatedAt": "scenario-001",
    "steps": ["Loaded template library", "..."]
  }
}
```

### GET `/api/scenarios/compare`

Compare two scenarios.

**Query Parameters:**
- `baseId` - Base scenario ID
- `candidateId` - Candidate scenario ID

---

## Module 6: Data Room

### GET `/api/data-room`

Get data room snapshot.

**Query Parameters:**
- `dataRoomId` - Target data room

**Response:**
```json
{
  "room": {
    "id": "uuid",
    "name": "Project Alpha VDR",
    "slug": "project-alpha-vdr",
    "classification": "confidential",
    "status": "active"
  },
  "collections": [
    { "name": "Technical", "count": 12 },
    { "name": "Financial", "count": 8 }
  ],
  "documents": [...],
  "grants": [...]
}
```

### POST `/api/data-room`

Create data room or add documents.

---

## Module 7: Execution Digital Twin

### GET `/api/execution`

Get execution twin overview.

**Response:**
```json
{
  "twin": {
    "id": "uuid",
    "projectName": "Solar Farm Alpha",
    "budget": {
      "approved": 200000000,
      "committed": 185000000,
      "spent": 120000000,
      "forecast": 198000000,
      "contingency": 15000000
    },
    "schedule": {
      "plannedStart": "2024-01-01",
      "plannedEnd": "2025-12-31",
      "forecastEnd": "2026-02-15",
      "percentComplete": 45.2
    }
  },
  "milestones": [...],
  "issues": [...],
  "changeOrders": [...]
}
```

### GET `/api/milestones`

List project milestones.

### POST `/api/milestones`

Create a milestone.

### GET `/api/issues`

List execution issues (RFIs, punch list, NCRs).

### POST `/api/issues`

Create an issue.

---

## Module 8: Asset Intelligence

### GET `/api/assets`

List assets with analytics.

**Response:**
```json
{
  "assets": [
    {
      "id": "uuid",
      "name": "Inverter Bank A",
      "assetClass": "inverter",
      "status": "operational",
      "analytics": {
        "utilizationPct": 87.5,
        "maintenanceRisk": 0.23,
        "telemetryStatus": "nominal",
        "anomalyCount": 0
      }
    }
  ]
}
```

### POST `/api/telemetry`

Ingest telemetry data.

**Request Body:**
```json
{
  "connectorId": "can-bus-001",
  "timestamp": "2024-01-15T10:30:00Z",
  "readings": [
    { "metric": "utilization", "value": 87.5, "unit": "%" },
    { "metric": "temperature", "value": 45.2, "unit": "C" }
  ]
}
```

### GET `/api/maintenance`

Get predictive maintenance queue.

---

## Module 9: ESG & Permitting

### GET `/api/permits`

List permits with expiry tracking.

**Query Parameters:**
- `status` - active | expiring | expired
- `riskLevel` - low | medium | high | critical

**Response:**
```json
{
  "data": [...],
  "total": 15,
  "summary": {
    "expiring": 3,
    "expired": 1,
    "highRisk": 2
  }
}
```

### POST `/api/permits`

Create a permit or obligation.

### GET `/api/esg`

Get ESG dashboard.

**Response:**
```json
{
  "obligations": { "data": [...], "summary": {...} },
  "communityCases": { "data": [...], "summary": {...} },
  "reportPacks": { "data": [...] },
  "metrics": { "data": [...], "summary": {...} },
  "alerts": {
    "overdueActions": 2,
    "overdueObligations": 1,
    "sensitiveCases": 0
  }
}
```

### POST `/api/esg`

Create ESG entity (obligation, case, action, report pack, metric).

### GET `/api/incidents`

List ESG incidents.

### POST `/api/incidents`

Create an incident.

---

## Module 10: Portals

### GET `/api/portals`

List available portals based on user role.

### GET `/api/dashboards`

Get role-aware dashboard bundles.

### GET `/api/reports`

List or generate reports.

### POST `/api/reports`

Create scheduled report or generate artifact.

---

## Module 11: AI Copilots

### POST `/api/ai/search`

Semantic search across Atlas knowledge base.

**Request Body:**
```json
{
  "query": "permit risk exposure",
  "orgId": "uuid",
  "limit": 5,
  "reviewerMode": "review_required"
}
```

**Response:**
```json
{
  "query": "permit risk exposure",
  "answer": "Evidence-grounded answer for 'permit risk exposure': [1]...",
  "results": [...],
  "citations": [...],
  "guardrails": {
    "reviewerMode": "review_required",
    "violations": [],
    "redactions": [],
    "approved": true
  }
}
```

### POST `/api/ai/narrative`

Generate committee narrative.

**Request Body:**
```json
{
  "query": "investment thesis summary",
  "templateType": "ic_memo",
  "title": "Project Alpha IC Memo"
}
```

### POST `/api/ai/diligence`

Run diligence copilot.

### GET `/api/ai/assistants`

Get workflow assistant recommendations.

---

## Module 12: DevSecOps

### GET `/api/releases`

List releases.

### POST `/api/releases`

Create a release.

### GET `/api/deploy`

List deployments.

### POST `/api/deploy`

Create a deployment plan.

### PATCH `/api/deploy`

Update deployment status.

### GET `/api/runbooks`

List operational runbooks.

### POST `/api/runbooks`

Create a runbook.

### GET `/api/incidents?domain=enterprise`

List enterprise/ops incidents.

### POST `/api/incidents?domain=enterprise`

Create an ops incident.

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |

---

## Rate Limiting

API requests are rate limited:

- **Standard tier**: 100 requests/minute
- **Professional tier**: 500 requests/minute  
- **Enterprise tier**: Unlimited

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```
