import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { run, all, get } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, wsId } = params ?? {};
  if (!orgId || !wsId) return NextResponse.json({ error: 'orgId and wsId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const ws = get('SELECT id FROM workspaces WHERE id = ? AND org_id = ?', wsId, orgId);
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const portfolios = all('SELECT * FROM portfolios WHERE workspace_id = ? ORDER BY name', wsId);
  return NextResponse.json({ data: portfolios });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, wsId } = params ?? {};
  if (!orgId || !wsId) return NextResponse.json({ error: 'orgId and wsId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'portfolio:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, description } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  const portfolioId = randomUUID();

  try {
    run(
      `INSERT INTO portfolios (id, name, slug, workspace_id, description) VALUES (?, ?, ?, ?, ?)`,
      portfolioId, name, slug, wsId, description ?? null
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Portfolio slug already exists in this workspace' }, { status: 409 });
    }
    throw err;
  }

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'portfolio.create',
    resourceType: 'portfolio',
    resourceId: portfolioId,
    details: { name, slug, workspaceId: wsId },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ id: portfolioId, name, slug, workspaceId: wsId, description: description ?? null }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
