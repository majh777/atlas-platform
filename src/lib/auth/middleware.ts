import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, type TokenPayload } from './jwt';
import { hashToken, getSession } from './session';
import { getUserOrgRole, hasPermission, type Permission, type OrgRole } from './rbac';
import { initDb } from '@/lib/db';
import { writeAuditLog, type AuditAction } from '@/lib/services/audit';

export interface AuthenticatedRequest {
  userId: string;
  email: string;
  orgId?: string;
  sessionId?: string;
  orgRole?: OrgRole;
}

type RouteHandler = (
  request: NextRequest,
  auth: AuthenticatedRequest,
  params?: Record<string, string>
) => Promise<NextResponse> | NextResponse;

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
}

export function withAuth(handler: RouteHandler): (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    initDb();

    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let payload: TokenPayload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const tokenHash = hashToken(token);
    const session = getSession(tokenHash);
    if (!session) {
      return NextResponse.json({ error: 'Session expired or revoked' }, { status: 401 });
    }

    const auth: AuthenticatedRequest = {
      userId: payload.userId,
      email: payload.email,
      orgId: payload.orgId,
      sessionId: payload.sessionId,
    };

    if (auth.orgId) {
      const role = getUserOrgRole(auth.userId, auth.orgId);
      if (role) auth.orgRole = role;
    }

    const params = context?.params ? await context.params : undefined;
    return handler(request, auth, params);
  };
}

export function withPermission(permission: Permission, handler: RouteHandler): (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return withAuth(async (request, auth, params) => {
    if (!auth.orgId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const role = auth.orgRole ?? getUserOrgRole(auth.userId, auth.orgId);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    if (!hasPermission(role, permission)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    return handler(request, { ...auth, orgRole: role }, params);
  });
}

export function withAudit(
  action: AuditAction,
  handler: RouteHandler,
  opts?: { resourceType?: string }
): RouteHandler {
  return async (request, auth, params) => {
    const response = await handler(request, auth, params);

    if (response.status >= 200 && response.status < 300) {
      writeAuditLog({
        orgId: auth.orgId,
        userId: auth.userId,
        action,
        resourceType: opts?.resourceType,
        resourceId: params?.id,
        ip: getClientIp(request),
      });
    }

    return response;
  };
}
