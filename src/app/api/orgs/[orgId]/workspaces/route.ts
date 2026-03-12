import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { run, all } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const workspaces = all(
    `SELECT * FROM workspaces WHERE org_id = ? ORDER BY name`,
    orgId
  );

  return NextResponse.json({ data: workspaces });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'ws:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, description } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  const wsId = randomUUID();

  try {
    run(
      `INSERT INTO workspaces (id, name, slug, org_id, description) VALUES (?, ?, ?, ?, ?)`,
      wsId, name, slug, orgId, description ?? null
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Workspace slug already exists in this org' }, { status: 409 });
    }
    throw err;
  }

  const memberId = randomUUID();
  run(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'admin')`,
    memberId, wsId, auth.userId
  );

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'workspace.create',
    resourceType: 'workspace',
    resourceId: wsId,
    details: { name, slug },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ id: wsId, name, slug, orgId, description: description ?? null }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
