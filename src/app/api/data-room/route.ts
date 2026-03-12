import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import {
  addDataRoomDocument,
  buildWatermark,
  createDataRoom,
  getDataRoomSnapshot,
  grantDataRoomAccess,
  listAccessibleDocuments,
  listDataRooms,
} from '@/lib/services/data-room';

async function handleGet(request: NextRequest, auth: AuthenticatedRequest) {
  const sp = new URL(request.url).searchParams;
  const dataRoomId = sp.get('dataRoomId');

  if (dataRoomId) {
    const snapshot = getDataRoomSnapshot(dataRoomId);
    if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(snapshot);
  }

  const orgId = sp.get('orgId') ?? auth.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  const result = listDataRooms({
    orgId,
    status: (sp.get('status') as 'draft' | 'active' | 'archived' | null) ?? undefined,
  });

  return NextResponse.json({ data: result });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const action = body.action ?? 'create';

  if (action === 'create') {
    if (!body.orgId || !body.name || !body.slug) {
      return NextResponse.json({ error: 'orgId, name, and slug are required' }, { status: 400 });
    }

    const room = createDataRoom({
      orgId: body.orgId,
      workspaceId: body.workspaceId,
      name: body.name,
      slug: body.slug,
      classification: body.classification,
      description: body.description,
      watermarkTemplate: body.watermarkTemplate,
      createdBy: auth.userId,
    });

    return NextResponse.json(room, { status: 201 });
  }

  if (action === 'add_document') {
    if (!body.dataRoomId || !body.title || !body.category || !body.collectionName) {
      return NextResponse.json({ error: 'dataRoomId, title, category, and collectionName are required' }, { status: 400 });
    }

    const document = addDataRoomDocument({
      dataRoomId: body.dataRoomId,
      documentId: body.documentId,
      title: body.title,
      category: body.category,
      collectionName: body.collectionName,
      sourceUrl: body.sourceUrl,
      evidenceLinks: body.evidenceLinks,
      tags: body.tags,
      checksum: body.checksum,
      versionLabel: body.versionLabel,
      uploadedBy: auth.userId,
    });

    return NextResponse.json(document, { status: 201 });
  }

  if (action === 'grant_access') {
    if (!body.dataRoomId || !body.subjectType || !body.subjectId || !body.role || !Array.isArray(body.scopeCollections)) {
      return NextResponse.json({ error: 'dataRoomId, subjectType, subjectId, role, and scopeCollections are required' }, { status: 400 });
    }

    const grant = grantDataRoomAccess({
      dataRoomId: body.dataRoomId,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      role: body.role,
      scopeCollections: body.scopeCollections,
      allowDownload: body.allowDownload,
      allowUpload: body.allowUpload,
      requireWatermark: body.requireWatermark,
      expiresAt: body.expiresAt,
      grantedBy: auth.userId,
    });

    return NextResponse.json(grant, { status: 201 });
  }

  if (action === 'accessible_documents') {
    if (!body.dataRoomId || !body.subjectType || !body.subjectId) {
      return NextResponse.json({ error: 'dataRoomId, subjectType, and subjectId are required' }, { status: 400 });
    }

    return NextResponse.json({
      data: listAccessibleDocuments({
        dataRoomId: body.dataRoomId,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
      }),
    });
  }

  if (action === 'watermark') {
    if (!body.dataRoomId || !body.subjectType || !body.subjectId || !body.documentId) {
      return NextResponse.json({ error: 'dataRoomId, subjectType, subjectId, and documentId are required' }, { status: 400 });
    }

    return NextResponse.json(buildWatermark({
      dataRoomId: body.dataRoomId,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      documentId: body.documentId,
    }));
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
