import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { run, all } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest) {
  const orgs = all<{ id: string; name: string; slug: string; plan: string; created_at: string }>(
    `SELECT o.id, o.name, o.slug, o.plan, o.created_at
     FROM organizations o
     JOIN org_members om ON om.org_id = o.id
     WHERE om.user_id = ?
     ORDER BY o.name`,
    auth.userId
  );

  return NextResponse.json({ data: orgs });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const { name, slug, plan } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  const orgId = randomUUID();

  try {
    run(
      `INSERT INTO organizations (id, name, slug, plan, owner_id) VALUES (?, ?, ?, ?, ?)`,
      orgId, name, slug, plan || 'free', auth.userId
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Organization slug already taken' }, { status: 409 });
    }
    throw err;
  }

  const memberId = randomUUID();
  run(
    `INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
    memberId, orgId, auth.userId
  );

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'org.create',
    resourceType: 'organization',
    resourceId: orgId,
    details: { name, slug },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ id: orgId, name, slug, plan: plan || 'free' }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
