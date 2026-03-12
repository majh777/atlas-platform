import { randomUUID } from 'node:crypto';
import { all, get, run } from '@/lib/db';
import { writeAuditLog } from './audit';

export type DataRoomClassification = 'internal' | 'confidential' | 'restricted' | 'external';
export type DataRoomStatus = 'draft' | 'active' | 'archived';
export type AccessRole = 'viewer' | 'editor' | 'owner' | 'question_only';
export type AccessSubjectType = 'user' | 'external_party';

export interface DataRoom {
  id: string;
  org_id: string;
  workspace_id: string | null;
  name: string;
  slug: string;
  classification: DataRoomClassification;
  status: DataRoomStatus;
  description: string | null;
  watermark_template: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRoomDocument {
  id: string;
  data_room_id: string;
  document_id: string | null;
  title: string;
  category: string;
  collection_name: string;
  source_url: string | null;
  evidence_links: string[];
  tags: string[];
  checksum: string | null;
  version_label: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessGrant {
  id: string;
  data_room_id: string;
  subject_type: AccessSubjectType;
  subject_id: string;
  role: AccessRole;
  scope_collections: string[];
  allow_download: number;
  allow_upload: number;
  require_watermark: number;
  expires_at: string | null;
  granted_by: string | null;
  created_at: string;
}

interface RawDataRoomDocument extends Omit<DataRoomDocument, 'evidence_links' | 'tags'> {
  evidence_links: string | null;
  tags: string | null;
}

interface RawAccessGrant extends Omit<AccessGrant, 'scope_collections'> {
  scope_collections: string;
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
}

function mapDocument(row: RawDataRoomDocument): DataRoomDocument {
  return {
    ...row,
    evidence_links: parseJsonArray(row.evidence_links),
    tags: parseJsonArray(row.tags),
  };
}

function mapGrant(row: RawAccessGrant): AccessGrant {
  return {
    ...row,
    scope_collections: parseJsonArray(row.scope_collections),
  };
}

export function createDataRoom(input: {
  orgId: string;
  workspaceId?: string;
  name: string;
  slug: string;
  classification?: DataRoomClassification;
  description?: string;
  watermarkTemplate?: string;
  createdBy?: string;
}): DataRoom {
  const id = randomUUID();
  const now = new Date().toISOString();

  run(
    `INSERT INTO data_rooms (id, org_id, workspace_id, name, slug, classification, description, watermark_template, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.name,
    input.slug,
    input.classification ?? 'confidential',
    input.description ?? null,
    input.watermarkTemplate ?? null,
    input.createdBy ?? null,
    now,
    now
  );

  const room = getDataRoom(id);
  if (!room) {
    throw new Error('Failed to create data room');
  }

  writeAuditLog({
    orgId: input.orgId,
    userId: input.createdBy,
    action: 'workspace.update',
    resourceType: 'data_room',
    resourceId: id,
    details: { event: 'data_room.created', slug: input.slug },
  });

  return room;
}

export function listDataRooms(filter: { orgId: string; status?: DataRoomStatus } ): DataRoom[] {
  const params: unknown[] = [filter.orgId];
  let sql = 'SELECT * FROM data_rooms WHERE org_id = ?';

  if (filter.status) {
    sql += ' AND status = ?';
    params.push(filter.status);
  }

  sql += ' ORDER BY updated_at DESC';
  return all<DataRoom>(sql, ...params);
}

export function getDataRoom(id: string): DataRoom | null {
  return get<DataRoom>('SELECT * FROM data_rooms WHERE id = ?', id) ?? null;
}

export function addDataRoomDocument(input: {
  dataRoomId: string;
  documentId?: string;
  title: string;
  category: string;
  collectionName: string;
  sourceUrl?: string;
  evidenceLinks?: string[];
  tags?: string[];
  checksum?: string;
  versionLabel?: string;
  uploadedBy?: string;
}): DataRoomDocument {
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO data_room_documents (id, data_room_id, document_id, title, category, collection_name, source_url, evidence_links, tags, checksum, version_label, uploaded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.dataRoomId,
    input.documentId ?? null,
    input.title,
    input.category,
    input.collectionName,
    input.sourceUrl ?? null,
    JSON.stringify(input.evidenceLinks ?? []),
    JSON.stringify(input.tags ?? []),
    input.checksum ?? null,
    input.versionLabel ?? null,
    input.uploadedBy ?? null,
    now,
    now
  );

  const row = get<RawDataRoomDocument>('SELECT * FROM data_room_documents WHERE id = ?', id);
  if (!row) throw new Error('Failed to create data room document');
  return mapDocument(row);
}

export function listDataRoomDocuments(dataRoomId: string, collectionName?: string): DataRoomDocument[] {
  const params: unknown[] = [dataRoomId];
  let sql = 'SELECT * FROM data_room_documents WHERE data_room_id = ?';
  if (collectionName) {
    sql += ' AND collection_name = ?';
    params.push(collectionName);
  }
  sql += ' ORDER BY category ASC, title ASC';
  return all<RawDataRoomDocument>(sql, ...params).map(mapDocument);
}

export function grantDataRoomAccess(input: {
  dataRoomId: string;
  subjectType: AccessSubjectType;
  subjectId: string;
  role: AccessRole;
  scopeCollections: string[];
  allowDownload?: boolean;
  allowUpload?: boolean;
  requireWatermark?: boolean;
  expiresAt?: string;
  grantedBy?: string;
}): AccessGrant {
  if (input.scopeCollections.length === 0) {
    throw new Error('scopeCollections must include at least one collection');
  }

  const id = randomUUID();
  run(
    `INSERT INTO data_room_access_grants (id, data_room_id, subject_type, subject_id, role, scope_collections, allow_download, allow_upload, require_watermark, expires_at, granted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(data_room_id, subject_type, subject_id)
     DO UPDATE SET role = excluded.role,
                   scope_collections = excluded.scope_collections,
                   allow_download = excluded.allow_download,
                   allow_upload = excluded.allow_upload,
                   require_watermark = excluded.require_watermark,
                   expires_at = excluded.expires_at,
                   granted_by = excluded.granted_by`,
    id,
    input.dataRoomId,
    input.subjectType,
    input.subjectId,
    input.role,
    JSON.stringify(input.scopeCollections),
    input.allowDownload ? 1 : 0,
    input.allowUpload ? 1 : 0,
    input.requireWatermark === false ? 0 : 1,
    input.expiresAt ?? null,
    input.grantedBy ?? null
  );

  const row = get<RawAccessGrant>(
    'SELECT * FROM data_room_access_grants WHERE data_room_id = ? AND subject_type = ? AND subject_id = ?',
    input.dataRoomId,
    input.subjectType,
    input.subjectId
  );
  if (!row) throw new Error('Failed to grant access');
  return mapGrant(row);
}

export function getAccessGrant(dataRoomId: string, subjectType: AccessSubjectType, subjectId: string): AccessGrant | null {
  const row = get<RawAccessGrant>(
    'SELECT * FROM data_room_access_grants WHERE data_room_id = ? AND subject_type = ? AND subject_id = ?',
    dataRoomId,
    subjectType,
    subjectId
  );
  return row ? mapGrant(row) : null;
}

export function listAccessibleDocuments(input: {
  dataRoomId: string;
  subjectType: AccessSubjectType;
  subjectId: string;
}): DataRoomDocument[] {
  const grant = getAccessGrant(input.dataRoomId, input.subjectType, input.subjectId);
  if (!grant) return [];

  const now = new Date();
  if (grant.expires_at && new Date(grant.expires_at) < now) {
    return [];
  }

  const documents = listDataRoomDocuments(input.dataRoomId);
  const allowed = new Set(grant.scope_collections);
  return documents.filter((doc) => allowed.has(doc.collection_name));
}

export function buildWatermark(input: {
  dataRoomId: string;
  subjectType: AccessSubjectType;
  subjectId: string;
  documentId: string;
}): { watermark: string; document: DataRoomDocument; grant: AccessGrant } {
  const document = get<RawDataRoomDocument>('SELECT * FROM data_room_documents WHERE id = ? AND data_room_id = ?', input.documentId, input.dataRoomId);
  if (!document) throw new Error('Document not found');

  const grant = getAccessGrant(input.dataRoomId, input.subjectType, input.subjectId);
  if (!grant) throw new Error('Access grant not found');
  if (!grant.scope_collections.includes(document.collection_name)) {
    throw new Error('Document outside grant scope');
  }

  const room = getDataRoom(input.dataRoomId);
  const template = room?.watermark_template ?? 'ATLAS CONFIDENTIAL · {subjectId} · {documentTitle} · {ts}';
  const watermark = template
    .replaceAll('{subjectId}', input.subjectId)
    .replaceAll('{documentTitle}', document.title)
    .replaceAll('{ts}', new Date().toISOString())
    .replaceAll('{roomName}', room?.name ?? 'Data Room');

  return {
    watermark,
    document: mapDocument(document),
    grant,
  };
}

export function getDataRoomSnapshot(dataRoomId: string) {
  const room = getDataRoom(dataRoomId);
  if (!room) return null;

  const documents = listDataRoomDocuments(dataRoomId);
  const grants = all<RawAccessGrant>('SELECT * FROM data_room_access_grants WHERE data_room_id = ? ORDER BY created_at DESC', dataRoomId).map(mapGrant);
  const collections = [...new Set(documents.map((doc) => doc.collection_name))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      count: documents.filter((doc) => doc.collection_name === name).length,
    }));

  return {
    room,
    collections,
    documents,
    grants,
  };
}
