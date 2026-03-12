import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { run, all, get } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission, type OrgRole } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/services/audit';
import { createNotification } from '@/lib/services/notifications';

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email: string;
  display_name: string;
}

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const members = all<MemberRow>(
    `SELECT om.id, om.user_id, om.role, om.joined_at, u.email, u.display_name
     FROM org_members om JOIN users u ON u.id = om.user_id
     WHERE om.org_id = ? ORDER BY om.joined_at`,
    orgId
  );

  return NextResponse.json({ data: members });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const callerRole = getUserOrgRole(auth.userId, orgId);
  if (!callerRole || !hasPermission(callerRole, 'org:manage_members')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { userId, role } = body;

  if (!userId || !role) {
    return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
  }

  const validRoles: OrgRole[] = ['admin', 'member', 'viewer', 'billing'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const existing = get<{ id: string }>('SELECT id FROM org_members WHERE org_id = ? AND user_id = ?', orgId, userId);
  if (existing) {
    return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
  }

  const memberId = randomUUID();
  run(
    `INSERT INTO org_members (id, org_id, user_id, role, invited_by) VALUES (?, ?, ?, ?, ?)`,
    memberId, orgId, userId, role, auth.userId
  );

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'org.member_add',
    resourceType: 'org_member',
    resourceId: memberId,
    details: { targetUserId: userId, role },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  createNotification({
    userId,
    orgId,
    type: 'org_invite',
    title: 'You have been added to an organization',
    body: `You now have the "${role}" role.`,
    link: '/admin',
  });

  return NextResponse.json({ id: memberId, userId, role }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
