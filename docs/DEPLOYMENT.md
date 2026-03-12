# Atlas Deployment Guide

Complete guide for deploying Atlas to Vercel and other platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Vercel Deployment](#vercel-deployment)
- [Database Migration](#database-migration)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# Node.js 20+ (LTS recommended)
node --version  # v20.x or higher

# pnpm package manager
npm install -g pnpm
pnpm --version  # 8.x or higher

# Vercel CLI (optional, for CLI deployments)
npm install -g vercel
```

### Local Build Verification

Before deploying, verify the build works locally:

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run linter
pnpm lint

# Build for production
pnpm build
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing JWT tokens (32+ chars) | `your-production-jwt-secret-min-32-chars` |
| `REFRESH_SECRET` | Secret for refresh tokens (32+ chars) | `your-production-refresh-secret-min-32-chars` |
| `DATABASE_URL` | Database connection string | See database section |
| `NEXTAUTH_URL` | Canonical URL of your app | `https://atlas.example.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite file path (dev only) | `atlas.db` |
| `NODE_ENV` | Environment mode | `production` |
| `LOG_LEVEL` | Logging verbosity | `info` |

### Generating Secrets

```bash
# Generate cryptographically secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For REFRESH_SECRET
```

---

## Vercel Deployment

### Option 1: GitHub Integration (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-org/atlas.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Select the repository

3. **Configure Project**
   - Framework Preset: **Next.js**
   - Root Directory: `.` (leave as default)
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`

4. **Add Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables for Production environment
   - Optionally add different values for Preview/Development

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

### Option 2: Vercel CLI

```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Set environment variables
vercel env add JWT_SECRET production
vercel env add REFRESH_SECRET production
```

### Vercel Configuration

The project includes a `vercel.json` for optimal configuration:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Build Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Node.js Version | 20.x |
| Build Command | `pnpm build` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |

---

## Database Migration

### SQLite (Development/Staging)

For development and small-scale deployments, SQLite is included:

```bash
# The database is created automatically on first run
# Seed with demo data
pnpm seed
```

**Note:** SQLite on Vercel requires serverless-compatible setup. For production, use PostgreSQL.

### PostgreSQL (Production)

Atlas is designed for easy migration to PostgreSQL.

#### 1. Provision Database

**Vercel Postgres:**
```bash
# In Vercel dashboard
Project Settings → Storage → Create Database → Postgres
```

**External Provider:**
- Neon (serverless-native)
- Supabase
- AWS RDS
- Any PostgreSQL 14+ provider

#### 2. Schema Changes

The SQLite schema is PostgreSQL-ready with minor changes:

| SQLite | PostgreSQL |
|--------|------------|
| `TEXT` (UUID) | `uuid` |
| `TEXT` (timestamp) | `timestamptz` |
| `INTEGER` (boolean) | `boolean` |
| `TEXT` (JSON) | `jsonb` |
| `datetime('now')` | `NOW()` |

Migration script example:

```sql
-- Create users table (PostgreSQL)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  mfa_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
```

#### 3. Update Connection

```typescript
// Update src/lib/db/index.ts for PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

---

## Post-Deployment

### 1. Verify Deployment

```bash
# Check health endpoint
curl https://your-app.vercel.app/api/health

# Test authentication
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 2. Create Admin User

```bash
# Via API (if registration is open)
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "SecurePassword123!",
    "displayName": "Admin User"
  }'
```

Or use the seed script for demo data:

```bash
# Locally with DATABASE_URL pointing to production
pnpm seed
```

### 3. Configure Domain

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as shown
4. SSL is automatic

### 4. Set Up Monitoring

**Vercel Analytics:**
- Enable in Project Settings → Analytics

**Error Tracking:**
- Add Sentry or similar for error monitoring
- Configure in `next.config.ts`

---

## Environments

### Development

```bash
# .env.local
DATABASE_PATH=atlas.dev.db
JWT_SECRET=dev-jwt-secret-do-not-use-in-production
REFRESH_SECRET=dev-refresh-secret-do-not-use-in-production
NODE_ENV=development
```

### Preview (PR Deployments)

Vercel automatically creates preview deployments for PRs:
- Unique URL per deployment
- Uses preview environment variables
- Isolated from production

### Production

```bash
# Vercel Environment Variables (Production)
JWT_SECRET=<production-secret>
REFRESH_SECRET=<production-secret>
DATABASE_URL=postgres://...
NEXTAUTH_URL=https://atlas.example.com
NODE_ENV=production
```

---

## CI/CD Pipeline

### GitHub Actions

The project includes CI/CD workflows:

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

### Quality Gates

Before production deployment:

1. **Tests pass** - All unit and integration tests
2. **Lint passes** - No ESLint errors
3. **Build succeeds** - Next.js production build
4. **Security scan** - No critical vulnerabilities
5. **Type check** - TypeScript compilation

---

## Scaling

### Serverless Considerations

Atlas is optimized for serverless:

- **Connection pooling**: Use connection pooling for PostgreSQL
- **Cold starts**: Minimal dependencies for fast cold starts
- **Edge functions**: API routes run at edge by default

### Performance Tips

1. **Enable caching** for static assets
2. **Use ISR** for semi-dynamic pages
3. **Optimize images** with next/image
4. **Monitor function duration** in Vercel dashboard

---

## Troubleshooting

### Build Failures

**"Cannot find module"**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install
pnpm build
```

**TypeScript errors**
```bash
# Check types
pnpm tsc --noEmit
```

### Runtime Errors

**"Invalid token"**
- Verify JWT_SECRET matches between environments
- Check token expiration

**"Database connection failed"**
- Verify DATABASE_URL is correct
- Check SSL requirements
- Ensure IP allowlist includes Vercel IPs

### Environment Issues

**Variables not loading**
```bash
# Verify in Vercel dashboard
vercel env ls

# Pull env locally for testing
vercel env pull .env.local
```

### Performance Issues

**Slow API responses**
- Check function logs in Vercel dashboard
- Enable tracing to identify bottlenecks
- Consider caching frequently accessed data

---

## Rollback

### Instant Rollback

```bash
# Via CLI
vercel rollback

# Or in dashboard: Deployments → Select previous → Promote to Production
```

### Database Rollback

Keep database migrations separate:

```bash
# Before migration
pg_dump $DATABASE_URL > backup.sql

# Rollback if needed
psql $DATABASE_URL < backup.sql
```

---

## Security Hardening

### Production Checklist

- [ ] Use strong, unique secrets for JWT_SECRET and REFRESH_SECRET
- [ ] Enable MFA for admin accounts
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Enable audit logging
- [ ] Regular security scans
- [ ] Keep dependencies updated

### Headers Configuration

Add security headers in `next.config.ts`:

```typescript
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];
```

---

## Support

For deployment issues:

1. Check [Vercel Status](https://vercel-status.com)
2. Review deployment logs in Vercel dashboard
3. Search [Vercel Documentation](https://vercel.com/docs)
4. Contact your platform support team
