import { NextRequest, NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/services/audit';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const org = get<OrgRow>('SELECT * FROM organizations WHERE id = ?', orgId);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...org,
    settings: org.settings ? JSON.parse(org.settings) : null,
    userRole: role,
  });
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'org:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.plan !== undefined) { fields.push('plan = ?'); values.push(body.plan); }
  if (body.settings !== undefined) { fields.push('settings = ?'); values.push(JSON.stringify(body.settings)); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now')");
  values.push(orgId);

  run(`UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`, ...values);

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'org.update',
    resourceType: 'organization',
    resourceId: orgId,
    details: body,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  const updated = get<OrgRow>('SELECT * FROM organizations WHERE id = ?', orgId);
  return NextResponse.json(updated);
}

async function handleDelete(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'org:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'org.delete',
    resourceType: 'organization',
    resourceId: orgId,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  run('DELETE FROM organizations WHERE id = ?', orgId);

  return NextResponse.json({ success: true });
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
