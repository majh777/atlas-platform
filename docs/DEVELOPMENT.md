# Atlas Development Guide

Local development setup, testing, and contribution guidelines.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Contributing](#contributing)

---

## Getting Started

### Prerequisites

```bash
# Node.js 20+ (use nvm for version management)
nvm install 20
nvm use 20

# pnpm package manager
npm install -g pnpm

# Verify installations
node --version   # v20.x.x
pnpm --version   # 8.x.x
```

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/atlas.git
cd atlas

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Demo Data

Seed the database with demo data:

```bash
pnpm seed
```

This creates:
- 3 demo users (admin, analyst, viewer)
- 1 organization with 2 workspaces
- 2 portfolios with sample data

**Demo Credentials:**
| Email | Password | Role |
|-------|----------|------|
| `admin@atlas.dev` | `Atlas2026!` | org owner |
| `analyst@atlas.dev` | `Atlas2026!` | org member |
| `viewer@atlas.dev` | `Atlas2026!` | org viewer |

---

## Project Structure

```
atlas/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── orgs/          # Organization endpoints
│   │   │   └── ...
│   │   ├── admin/             # Admin dashboard pages
│   │   ├── dashboard/         # Main dashboard
│   │   └── [module]/          # Module-specific pages
│   │
│   ├── components/            # React components
│   │   ├── ui.tsx            # Shared UI primitives
│   │   ├── dashboard.tsx     # Dashboard component
│   │   └── [module]/         # Module-specific components
│   │
│   ├── lib/                   # Business logic
│   │   ├── auth/             # Authentication utilities
│   │   ├── db/               # Database access
│   │   ├── services/         # Shared services
│   │   ├── ai/               # AI copilot services
│   │   ├── assets/           # Asset intelligence
│   │   ├── bankability/      # Bankability scoring
│   │   ├── document-intelligence/
│   │   ├── esg/              # ESG & permitting
│   │   ├── execution/        # Execution digital twin
│   │   ├── finance/          # Financial modeling
│   │   ├── ops/              # DevSecOps services
│   │   └── portals/          # Portal services
│   │
│   └── types/                 # TypeScript type definitions
│
├── tests/                     # Test files
│   ├── auth.test.ts
│   ├── scoring.test.ts
│   └── integration/          # Integration tests
│
├── data/                      # Demo/seed data
├── docs/                      # Documentation
├── infra/                     # Infrastructure configs
├── observability/             # Monitoring dashboards
├── public/                    # Static assets
└── scripts/                   # Build/utility scripts
```

### Key Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.ts` | Next.js configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `vitest.config.ts` | Test configuration |
| `eslint.config.mjs` | Linting rules |

---

## Development Workflow

### Available Scripts

```bash
# Development
pnpm dev          # Start dev server with hot reload
pnpm build        # Production build
pnpm start        # Run production build locally

# Testing
pnpm test         # Run all tests
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Run with coverage report

# Code Quality
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix auto-fixable issues
pnpm typecheck    # Run TypeScript checks

# Database
pnpm seed         # Seed demo data
```

### Development Server

```bash
# Standard development
pnpm dev

# With specific port
PORT=3001 pnpm dev

# With debug logging
DEBUG=atlas:* pnpm dev
```

### Environment Variables

Create `.env.local` for local development:

```bash
# .env.local (git-ignored)
DATABASE_PATH=atlas.dev.db
JWT_SECRET=dev-jwt-secret-do-not-use-in-production
REFRESH_SECRET=dev-refresh-secret-do-not-use-in-production
NODE_ENV=development
```

### Hot Reload

Next.js provides automatic hot reload for:
- React components
- API routes
- CSS changes

Database schema changes require manual reload.

### Database Reset

```bash
# Delete and recreate database
rm atlas.db atlas.dev.db
pnpm dev  # Creates fresh database
pnpm seed # Re-seed demo data
```

---

## Testing

### Test Framework

Atlas uses [Vitest](https://vitest.dev/) for testing:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test tests/auth.test.ts

# Run tests matching pattern
pnpm test -t "JWT"

# Watch mode
pnpm test -- --watch

# With coverage
pnpm test -- --coverage
```

### Test Categories

#### Unit Tests
```typescript
// tests/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { calculateOverallScore } from '@/lib/bankability/engine';

describe('Bankability Scoring', () => {
  it('calculates weighted domain scores', () => {
    const scores = [
      { domain: 'technical', weightedScore: 80, rawAverage: 78, ... },
      // ...
    ];
    const context = { scoringModel: { domainWeights: { ... } } };
    
    const result = calculateOverallScore(scores, context);
    expect(result).toBeCloseTo(75.5, 1);
  });
});
```

#### Integration Tests
```typescript
// tests/integration/user-journeys.test.ts
describe('User Journey: Login to Dashboard', () => {
  it('completes full authentication flow', async () => {
    // Register user
    const registerRes = await fetch('/api/auth/register', { ... });
    expect(registerRes.ok).toBe(true);
    
    // Login
    const loginRes = await fetch('/api/auth/login', { ... });
    const { accessToken } = await loginRes.json();
    
    // Access protected route
    const dashboardRes = await fetch('/api/dashboards', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(dashboardRes.ok).toBe(true);
  });
});
```

#### Security Tests
```typescript
// tests/security-adversarial.test.ts
describe('Security: Adversarial Inputs', () => {
  it('blocks SQL injection attempts', async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: "'; DROP TABLE users; --",
        password: 'test'
      })
    });
    expect(res.status).toBe(400);
  });
  
  it('sanitizes XSS in AI responses', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = sanitizeText(maliciousInput);
    expect(sanitized).not.toContain('<script>');
  });
});
```

### Test Database

Tests use an isolated database:

```typescript
// tests/setup-db.ts
import { initDb, closeDb } from '@/lib/db';

beforeAll(() => {
  process.env.DATABASE_PATH = ':memory:';
  initDb();
});

afterAll(() => {
  closeDb();
});
```

### Coverage Requirements

| Category | Minimum |
|----------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

---

## Code Style

### TypeScript Guidelines

```typescript
// Use explicit types for function parameters and returns
function processDocument(doc: DocumentRecord): ProcessedDocument {
  // ...
}

// Use interfaces for object shapes
interface UserInput {
  email: string;
  password: string;
  displayName?: string;  // Optional fields
}

// Use type for unions and primitives
type Status = 'pending' | 'active' | 'completed';
type UserId = string;
```

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Dashboard.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Types | camelCase | `types.ts` |
| Tests | *.test.ts | `auth.test.ts` |
| Routes | kebab-case folder | `api/auth/login/route.ts` |

### Import Order

```typescript
// 1. Node.js built-ins
import { randomUUID } from 'node:crypto';

// 2. External packages
import { NextResponse } from 'next/server';

// 3. Internal aliases (@/)
import { getDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

// 4. Relative imports
import { formatDate } from './utils';
```

### Component Structure

```typescript
// src/components/example/dashboard.tsx

// Imports
import { useState } from 'react';
import { Card } from '@/components/ui';

// Types
interface DashboardProps {
  title: string;
  data: DataItem[];
}

// Component
export function Dashboard({ title, data }: DashboardProps) {
  // State
  const [selected, setSelected] = useState<string | null>(null);
  
  // Handlers
  const handleSelect = (id: string) => {
    setSelected(id);
  };
  
  // Render
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {data.map(item => (
        <Card key={item.id} onClick={() => handleSelect(item.id)}>
          {item.name}
        </Card>
      ))}
    </div>
  );
}
```

### ESLint Configuration

```javascript
// eslint.config.mjs
export default [
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'prefer-const': 'error',
      'no-console': 'warn',
    }
  }
];
```

---

## Contributing

### Branch Strategy

```
main          # Production-ready code
├── develop   # Integration branch
├── feature/* # New features
├── fix/*     # Bug fixes
└── docs/*    # Documentation updates
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(<scope>): <description>

# Examples
feat(auth): add MFA recovery codes
fix(scoring): correct weighted average calculation
docs(api): document bankability endpoints
test(finance): add scenario comparison tests
refactor(db): optimize query performance
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`

### Pull Request Process

1. **Create branch** from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Make changes** with tests

3. **Verify quality**
   ```bash
   pnpm lint
   pnpm test
   pnpm build
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat(module): add feature"
   git push origin feature/my-feature
   ```

5. **Create PR** to `develop`
   - Fill out PR template
   - Link related issues
   - Request review

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Types are correct
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Self-reviewed changes

### Code Review Guidelines

**Reviewer:**
- Check for security issues
- Verify test coverage
- Assess code clarity
- Test edge cases

**Author:**
- Respond to all comments
- Update code or explain reasoning
- Request re-review after changes

---

## Debugging

### VS Code Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

### Logging

```typescript
// Use console with prefixes for filtering
console.log('[AUTH]', 'User logged in:', userId);
console.error('[DB]', 'Query failed:', error);

// In production, use structured logging
import { logger } from '@/lib/logger';
logger.info({ module: 'auth', event: 'login', userId });
```

### Database Inspection

```bash
# SQLite CLI
sqlite3 atlas.dev.db

# Common queries
.tables
.schema users
SELECT * FROM users LIMIT 5;
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

---

## Performance

### Profiling

```bash
# Build with profiling
NEXT_ANALYZE=true pnpm build

# Profile API routes
pnpm dev -- --experimental-debug-memory-usage
```

### Optimization Tips

1. **Lazy loading** for heavy components
2. **Memoization** for expensive calculations
3. **Database indexes** for frequent queries
4. **Connection pooling** for PostgreSQL

---

## Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vitest Guide](https://vitest.dev/guide/)

### Internal Docs
- [API Reference](./API.md)
- [Module Guide](./MODULES.md)
- [Security Model](./SECURITY.md)
- [Deployment](./DEPLOYMENT.md)
