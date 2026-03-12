import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission } from '@/lib/auth/rbac';
import { queryAuditLogs } from '@/lib/services/audit';

async function handleGet(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'audit:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;

  const result = queryAuditLogs({
    orgId,
    userId: sp.get('userId') ?? undefined,
    action: sp.get('action') ?? undefined,
    resourceType: sp.get('resourceType') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    limit: sp.has('limit') ? Number(sp.get('limit')) : undefined,
    offset: sp.has('offset') ? Number(sp.get('offset')) : undefined,
  });

  return NextResponse.json(result);
}

export const GET = withAuth(handleGet);
