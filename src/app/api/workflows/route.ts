import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import {
  addActionDependency,
  answerDiligenceQuestion,
  buildBoardPack,
  buildInvestmentMemo,
  createApprovalWorkflow,
  createDiligenceQuestion,
  createWorkflowAction,
  getWorkflowSnapshot,
  listDiligenceQuestions,
  logWorkflowAction,
  recordApprovalDecision,
} from '@/lib/services/workflows';

async function handleGet(request: NextRequest, auth: AuthenticatedRequest) {
  const sp = new URL(request.url).searchParams;
  const workflowId = sp.get('workflowId');

  if (workflowId) {
    const snapshot = getWorkflowSnapshot(workflowId);
    if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(snapshot);
  }

  const orgId = sp.get('orgId') ?? auth.orgId;
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  return NextResponse.json({
    questions: listDiligenceQuestions({
      orgId,
      dataRoomId: sp.get('dataRoomId') ?? undefined,
      ownerUserId: sp.get('ownerUserId') ?? undefined,
      status: (sp.get('status') as 'open' | 'answered' | 'closed' | 'overdue' | null) ?? undefined,
    }),
  });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const action = body.action;

  if (action === 'create_question') {
    if (!body.orgId || !body.question) {
      return NextResponse.json({ error: 'orgId and question are required' }, { status: 400 });
    }

    const question = createDiligenceQuestion({
      orgId: body.orgId,
      dataRoomId: body.dataRoomId,
      documentId: body.documentId,
      question: body.question,
      priority: body.priority,
      ownerUserId: body.ownerUserId,
      askedBy: auth.userId,
      dueAt: body.dueAt,
      evidenceLinks: body.evidenceLinks,
    });
    return NextResponse.json(question, { status: 201 });
  }

  if (action === 'answer_question') {
    if (!body.questionId || !body.answerText) {
      return NextResponse.json({ error: 'questionId and answerText are required' }, { status: 400 });
    }

    const question = answerDiligenceQuestion({
      questionId: body.questionId,
      actorUserId: auth.userId,
      answerText: body.answerText,
      evidenceLinks: body.evidenceLinks,
      close: body.close,
    });
    if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(question);
  }

  if (action === 'create_workflow') {
    if (!body.orgId || !body.title || !body.workflowType || !body.targetType || !body.targetId || !Array.isArray(body.approvers)) {
      return NextResponse.json({ error: 'orgId, title, workflowType, targetType, targetId, and approvers are required' }, { status: 400 });
    }

    const workflow = createApprovalWorkflow({
      orgId: body.orgId,
      dataRoomId: body.dataRoomId,
      title: body.title,
      workflowType: body.workflowType,
      targetType: body.targetType,
      targetId: body.targetId,
      submittedBy: auth.userId,
      metadata: body.metadata,
      approvers: body.approvers,
    });
    return NextResponse.json(workflow, { status: 201 });
  }

  if (action === 'record_decision') {
    if (!body.workflowId || !body.decision) {
      return NextResponse.json({ error: 'workflowId and decision are required' }, { status: 400 });
    }

    const workflow = recordApprovalDecision({
      workflowId: body.workflowId,
      actorUserId: auth.userId,
      decision: body.decision,
      notes: body.notes,
      signatureMetadata: body.signatureMetadata,
    });
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(workflow);
  }

  if (action === 'create_action') {
    if (!body.orgId || !body.title) {
      return NextResponse.json({ error: 'orgId and title are required' }, { status: 400 });
    }

    const workflowAction = createWorkflowAction({
      orgId: body.orgId,
      workflowId: body.workflowId,
      meetingId: body.meetingId,
      title: body.title,
      ownerUserId: body.ownerUserId,
      dueAt: body.dueAt,
      dependencyIds: body.dependencyIds,
      createdBy: auth.userId,
      taskPayload: body.taskPayload,
    });
    return NextResponse.json(workflowAction, { status: 201 });
  }

  if (action === 'add_dependency') {
    if (!body.actionId || !body.dependencyId) {
      return NextResponse.json({ error: 'actionId and dependencyId are required' }, { status: 400 });
    }

    const workflowAction = addActionDependency(body.actionId, body.dependencyId, auth.userId);
    if (!workflowAction) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(workflowAction);
  }

  if (action === 'log_action') {
    if (!body.actionId || !body.logAction) {
      return NextResponse.json({ error: 'actionId and logAction are required' }, { status: 400 });
    }

    const workflowAction = logWorkflowAction(body.actionId, {
      actorUserId: auth.userId,
      action: body.logAction,
      details: body.details,
      status: body.status,
    });
    if (!workflowAction) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(workflowAction);
  }

  if (action === 'build_memo') {
    if (!body.workflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    const memo = buildInvestmentMemo(body.workflowId);
    if (!memo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(memo);
  }

  if (action === 'build_board_pack') {
    if (!body.workflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    const boardPack = buildBoardPack(body.workflowId);
    if (!boardPack) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(boardPack);
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
