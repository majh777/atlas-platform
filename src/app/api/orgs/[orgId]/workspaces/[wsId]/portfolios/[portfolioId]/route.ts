import { NextRequest, NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, portfolioId } = params ?? {};
  if (!orgId || !portfolioId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'portfolio:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const portfolio = get('SELECT * FROM portfolios WHERE id = ?', portfolioId);
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(portfolio);
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, portfolioId } = params ?? {};
  if (!orgId || !portfolioId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'portfolio:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.settings !== undefined) { fields.push('settings = ?'); values.push(JSON.stringify(body.settings)); }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  fields.push("updated_at = datetime('now')");
  values.push(portfolioId);

  run(`UPDATE portfolios SET ${fields.join(', ')} WHERE id = ?`, ...values);

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'portfolio.update',
    resourceType: 'portfolio',
    resourceId: portfolioId,
    details: body,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  const updated = get('SELECT * FROM portfolios WHERE id = ?', portfolioId);
  return NextResponse.json(updated);
}

async function handleDelete(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, portfolioId } = params ?? {};
  if (!orgId || !portfolioId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'portfolio:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'portfolio.delete',
    resourceType: 'portfolio',
    resourceId: portfolioId,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  run('DELETE FROM portfolios WHERE id = ?', portfolioId);
  return NextResponse.json({ success: true });
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
