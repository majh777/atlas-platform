import { randomUUID } from 'node:crypto';
import { all, get, run } from '@/lib/db';
import { buildBoardPack, buildInvestmentMemo, getWorkflowSnapshot } from './workflows';

export interface CommitteeMeeting {
  id: string;
  org_id: string;
  data_room_id: string | null;
  title: string;
  committee_name: string;
  scheduled_for: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  location: string | null;
  agenda_summary: string | null;
  board_pack_workflow_id: string | null;
  investment_memo_workflow_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaItem {
  id: string;
  meeting_id: string;
  item_order: number;
  title: string;
  presenter_user_id: string | null;
  related_workflow_id: string | null;
  status: 'planned' | 'presented' | 'deferred' | 'approved' | 'rejected';
  notes: string | null;
  decision_summary: string | null;
  created_at: string;
}

export interface CommitteeSignoff {
  id: string;
  meeting_id: string;
  workflow_id: string | null;
  signer_user_id: string | null;
  decision: 'approve' | 'reject' | 'abstain';
  notes: string | null;
  signature_metadata: Record<string, unknown>;
  created_at: string;
}

interface RawCommitteeSignoff extends Omit<CommitteeSignoff, 'signature_metadata'> {
  signature_metadata: string;
}

function mapSignoff(row: RawCommitteeSignoff): CommitteeSignoff {
  return {
    ...row,
    signature_metadata: JSON.parse(row.signature_metadata) as Record<string, unknown>,
  };
}

export function createCommitteeMeeting(input: {
  orgId: string;
  dataRoomId?: string;
  title: string;
  committeeName: string;
  scheduledFor?: string;
  location?: string;
  agendaSummary?: string;
  boardPackWorkflowId?: string;
  investmentMemoWorkflowId?: string;
  createdBy?: string;
}): CommitteeMeeting {
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO committee_meetings (id, org_id, data_room_id, title, committee_name, scheduled_for, status, location, agenda_summary, board_pack_workflow_id, investment_memo_workflow_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.dataRoomId ?? null,
    input.title,
    input.committeeName,
    input.scheduledFor ?? null,
    'scheduled',
    input.location ?? null,
    input.agendaSummary ?? null,
    input.boardPackWorkflowId ?? null,
    input.investmentMemoWorkflowId ?? null,
    input.createdBy ?? null,
    now,
    now
  );

  const meeting = getCommitteeMeeting(id);
  if (!meeting) throw new Error('Failed to create committee meeting');
  return meeting;
}

export function addAgendaItem(input: {
  meetingId: string;
  title: string;
  itemOrder: number;
  presenterUserId?: string;
  relatedWorkflowId?: string;
  notes?: string;
}): AgendaItem {
  const id = randomUUID();
  run(
    `INSERT INTO committee_agenda_items (id, meeting_id, item_order, title, presenter_user_id, related_workflow_id, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.meetingId,
    input.itemOrder,
    input.title,
    input.presenterUserId ?? null,
    input.relatedWorkflowId ?? null,
    'planned',
    input.notes ?? null
  );

  const item = get<AgendaItem>('SELECT * FROM committee_agenda_items WHERE id = ?', id);
  if (!item) throw new Error('Failed to create agenda item');
  return item;
}

export function recordCommitteeSignoff(input: {
  meetingId: string;
  workflowId?: string;
  signerUserId?: string;
  decision: 'approve' | 'reject' | 'abstain';
  notes?: string;
  signatureMetadata: Record<string, unknown>;
}): CommitteeSignoff {
  const id = randomUUID();
  run(
    `INSERT INTO committee_signoffs (id, meeting_id, workflow_id, signer_user_id, decision, notes, signature_metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.meetingId,
    input.workflowId ?? null,
    input.signerUserId ?? null,
    input.decision,
    input.notes ?? null,
    JSON.stringify(input.signatureMetadata),
    new Date().toISOString()
  );

  const signoff = get<RawCommitteeSignoff>('SELECT * FROM committee_signoffs WHERE id = ?', id);
  if (!signoff) throw new Error('Failed to create signoff');
  return mapSignoff(signoff);
}

export function listAgendaItems(meetingId: string): AgendaItem[] {
  return all<AgendaItem>('SELECT * FROM committee_agenda_items WHERE meeting_id = ? ORDER BY item_order ASC', meetingId);
}

export function listCommitteeSignoffs(meetingId: string): CommitteeSignoff[] {
  return all<RawCommitteeSignoff>('SELECT * FROM committee_signoffs WHERE meeting_id = ? ORDER BY created_at ASC', meetingId).map(mapSignoff);
}

export function getCommitteeMeeting(meetingId: string): CommitteeMeeting | null {
  return get<CommitteeMeeting>('SELECT * FROM committee_meetings WHERE id = ?', meetingId) ?? null;
}

export function getCommitteePacket(meetingId: string) {
  const meeting = getCommitteeMeeting(meetingId);
  if (!meeting) return null;

  const agenda = listAgendaItems(meetingId);
  const signoffs = listCommitteeSignoffs(meetingId);
  const boardPack = meeting.board_pack_workflow_id ? buildBoardPack(meeting.board_pack_workflow_id) : null;
  const investmentMemo = meeting.investment_memo_workflow_id ? buildInvestmentMemo(meeting.investment_memo_workflow_id) : null;
  const boardWorkflowSnapshot = meeting.board_pack_workflow_id ? getWorkflowSnapshot(meeting.board_pack_workflow_id) : null;

  return {
    meeting,
    agenda,
    signoffs,
    boardPack,
    investmentMemo,
    boardWorkflowSnapshot,
  };
}
