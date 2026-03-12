import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import {
  addAgendaItem,
  createCommitteeMeeting,
  getCommitteePacket,
  recordCommitteeSignoff,
} from '@/lib/services/committee';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const meetingId = sp.get('meetingId');
  if (!meetingId) return NextResponse.json({ error: 'meetingId is required' }, { status: 400 });

  const packet = getCommitteePacket(meetingId);
  if (!packet) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(packet);
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const action = body.action;

  if (action === 'create_meeting') {
    if (!body.orgId || !body.title || !body.committeeName) {
      return NextResponse.json({ error: 'orgId, title, and committeeName are required' }, { status: 400 });
    }

    const meeting = createCommitteeMeeting({
      orgId: body.orgId,
      dataRoomId: body.dataRoomId,
      title: body.title,
      committeeName: body.committeeName,
      scheduledFor: body.scheduledFor,
      location: body.location,
      agendaSummary: body.agendaSummary,
      boardPackWorkflowId: body.boardPackWorkflowId,
      investmentMemoWorkflowId: body.investmentMemoWorkflowId,
      createdBy: auth.userId,
    });

    return NextResponse.json(meeting, { status: 201 });
  }

  if (action === 'add_agenda_item') {
    if (!body.meetingId || !body.title || typeof body.itemOrder !== 'number') {
      return NextResponse.json({ error: 'meetingId, title, and numeric itemOrder are required' }, { status: 400 });
    }

    const item = addAgendaItem({
      meetingId: body.meetingId,
      title: body.title,
      itemOrder: body.itemOrder,
      presenterUserId: body.presenterUserId,
      relatedWorkflowId: body.relatedWorkflowId,
      notes: body.notes,
    });

    return NextResponse.json(item, { status: 201 });
  }

  if (action === 'signoff') {
    if (!body.meetingId || !body.decision || !body.signatureMetadata) {
      return NextResponse.json({ error: 'meetingId, decision, and signatureMetadata are required' }, { status: 400 });
    }

    const signoff = recordCommitteeSignoff({
      meetingId: body.meetingId,
      workflowId: body.workflowId,
      signerUserId: auth.userId,
      decision: body.decision,
      notes: body.notes,
      signatureMetadata: body.signatureMetadata,
    });

    return NextResponse.json(signoff, { status: 201 });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
