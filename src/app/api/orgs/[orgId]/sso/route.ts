import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { run, all, get } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserOrgRole, hasPermission } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/services/audit';

interface SsoRow {
  id: string;
  org_id: string;
  provider_type: string;
  client_id: string | null;
  metadata_url: string | null;
  enabled: number;
  config: string | null;
  created_at: string;
  updated_at: string;
}

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'org:manage_sso')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const providers = all<SsoRow>('SELECT * FROM sso_providers WHERE org_id = ?', orgId);
  return NextResponse.json({
    data: providers.map((p) => ({
      ...p,
      client_secret_enc: undefined,
      config: p.config ? JSON.parse(p.config) : null,
    })),
  });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'org:manage_sso')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { providerType, clientId, clientSecret, metadataUrl, config } = body;

  if (!providerType || !['saml', 'oidc'].includes(providerType)) {
    return NextResponse.json({ error: 'providerType must be saml or oidc' }, { status: 400 });
  }

  const id = randomUUID();
  run(
    `INSERT INTO sso_providers (id, org_id, provider_type, client_id, client_secret_enc, metadata_url, config)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id, orgId, providerType,
    clientId ?? null,
    clientSecret ?? null,
    metadataUrl ?? null,
    config ? JSON.stringify(config) : null
  );

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'sso.configure',
    resourceType: 'sso_provider',
    resourceId: id,
    details: { providerType },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ id, providerType, enabled: false }, { status: 201 });
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const orgId = params?.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const role = getUserOrgRole(auth.userId, orgId);
  if (!role || !hasPermission(role, 'org:manage_sso')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { providerId, enabled } = body;

  if (!providerId) return NextResponse.json({ error: 'providerId required' }, { status: 400 });

  const provider = get<SsoRow>('SELECT * FROM sso_providers WHERE id = ? AND org_id = ?', providerId, orgId);
  if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

  if (typeof enabled === 'boolean') {
    run(
      "UPDATE sso_providers SET enabled = ?, updated_at = datetime('now') WHERE id = ?",
      enabled ? 1 : 0, providerId
    );

    writeAuditLog({
      orgId,
      userId: auth.userId,
      action: enabled ? 'sso.enable' : 'sso.disable',
      resourceType: 'sso_provider',
      resourceId: providerId,
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });
  }

  const updated = get<SsoRow>('SELECT * FROM sso_providers WHERE id = ?', providerId);
  return NextResponse.json({
    ...updated,
    client_secret_enc: undefined,
    config: updated?.config ? JSON.parse(updated.config) : null,
  });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PATCH = withAuth(handlePatch);
