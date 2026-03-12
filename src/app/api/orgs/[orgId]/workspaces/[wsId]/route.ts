import { NextRequest, NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission } from '@/lib/auth/rbac';
import { getUserWorkspaceRole, hasWorkspacePermission } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, wsId } = params ?? {};
  if (!orgId || !wsId) return NextResponse.json({ error: 'orgId and wsId required' }, { status: 400 });

  const orgRole = getUserOrgRole(auth.userId, orgId);
  if (!orgRole) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const ws = get('SELECT * FROM workspaces WHERE id = ? AND org_id = ?', wsId, orgId);
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  return NextResponse.json(ws);
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, wsId } = params ?? {};
  if (!orgId || !wsId) return NextResponse.json({ error: 'orgId and wsId required' }, { status: 400 });

  const wsRole = getUserWorkspaceRole(auth.userId, wsId);
  const orgRole = getUserOrgRole(auth.userId, orgId);

  const canUpdate = (wsRole && hasWorkspacePermission(wsRole, 'ws:update')) ||
                    (orgRole && hasPermission(orgRole, 'ws:update'));

  if (!canUpdate) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const body = await request.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.settings !== undefined) { fields.push('settings = ?'); values.push(JSON.stringify(body.settings)); }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  fields.push("updated_at = datetime('now')");
  values.push(wsId, orgId);

  run(`UPDATE workspaces SET ${fields.join(', ')} WHERE id = ? AND org_id = ?`, ...values);

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'workspace.update',
    resourceType: 'workspace',
    resourceId: wsId,
    details: body,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  const updated = get('SELECT * FROM workspaces WHERE id = ?', wsId);
  return NextResponse.json(updated);
}

async function handleDelete(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const { orgId, wsId } = params ?? {};
  if (!orgId || !wsId) return NextResponse.json({ error: 'orgId and wsId required' }, { status: 400 });

  const orgRole = getUserOrgRole(auth.userId, orgId);
  if (!orgRole || !hasPermission(orgRole, 'ws:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'workspace.delete',
    resourceType: 'workspace',
    resourceId: wsId,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  run('DELETE FROM workspaces WHERE id = ? AND org_id = ?', wsId, orgId);

  return NextResponse.json({ success: true });
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
