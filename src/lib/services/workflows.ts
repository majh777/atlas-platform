import { randomUUID } from 'node:crypto';
import { all, get, run } from '@/lib/db';
import { writeAuditLog } from './audit';
import { createTask, getTask, type Task } from './tasks';
import { getDataRoomSnapshot } from './data-room';

export type DiligenceStatus = 'open' | 'answered' | 'closed' | 'overdue';
export type DiligencePriority = 'low' | 'medium' | 'high' | 'critical';
export type WorkflowType = 'investment_memo' | 'board_pack' | 'committee_approval' | 'signoff';
export type WorkflowStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'cancelled';

export interface DiligenceQuestion {
  id: string;
  org_id: string;
  data_room_id: string | null;
  document_id: string | null;
  question: string;
  status: DiligenceStatus;
  priority: DiligencePriority;
  owner_user_id: string | null;
  asked_by: string | null;
  due_at: string | null;
  answered_at: string | null;
  answer_text: string | null;
  evidence_links: string[];
  audit_ledger: WorkflowLedgerEntry[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowLedgerEntry {
  at: string;
  actorUserId: string | null;
  action: string;
  details?: Record<string, unknown>;
}

export interface ApprovalWorkflow {
  id: string;
  org_id: string;
  data_room_id: string | null;
  title: string;
  workflow_type: WorkflowType;
  target_type: string;
  target_id: string;
  status: WorkflowStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decision_summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep {
  id: string;
  workflow_id: string;
  step_order: number;
  approver_user_id: string | null;
  step_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  decided_at: string | null;
  notes: string | null;
  signature_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ApprovalDecision {
  id: string;
  workflow_id: string;
  step_id: string | null;
  actor_user_id: string | null;
  decision: 'submit' | 'approve' | 'reject' | 'comment';
  notes: string | null;
  signature_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WorkflowAction {
  id: string;
  org_id: string;
  workflow_id: string | null;
  meeting_id: string | null;
  task_id: string | null;
  title: string;
  owner_user_id: string | null;
  status: 'open' | 'in_progress' | 'blocked' | 'done';
  due_at: string | null;
  dependency_ids: string[];
  log_entries: WorkflowLedgerEntry[];
  created_at: string;
  updated_at: string;
}

interface RawQuestion extends Omit<DiligenceQuestion, 'evidence_links' | 'audit_ledger'> {
  evidence_links: string | null;
  audit_ledger: string;
}

interface RawWorkflow extends Omit<ApprovalWorkflow, 'metadata'> {
  metadata: string | null;
}

interface RawStep extends Omit<ApprovalStep, 'signature_metadata'> {
  signature_metadata: string | null;
}

interface RawDecision extends Omit<ApprovalDecision, 'signature_metadata'> {
  signature_metadata: string | null;
}

interface RawAction extends Omit<WorkflowAction, 'dependency_ids' | 'log_entries'> {
  dependency_ids: string;
  log_entries: string;
}

function parseJsonObject<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  return JSON.parse(value) as T;
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function mapQuestion(row: RawQuestion): DiligenceQuestion {
  return {
    ...row,
    evidence_links: parseJsonArray<string>(row.evidence_links),
    audit_ledger: parseJsonArray<WorkflowLedgerEntry>(row.audit_ledger),
  };
}

function mapWorkflow(row: RawWorkflow): ApprovalWorkflow {
  return {
    ...row,
    metadata: parseJsonObject<Record<string, unknown>>(row.metadata),
  };
}

function mapStep(row: RawStep): ApprovalStep {
  return {
    ...row,
    signature_metadata: parseJsonObject<Record<string, unknown>>(row.signature_metadata),
  };
}

function mapDecision(row: RawDecision): ApprovalDecision {
  return {
    ...row,
    signature_metadata: parseJsonObject<Record<string, unknown>>(row.signature_metadata),
  };
}

function mapAction(row: RawAction): WorkflowAction {
  return {
    ...row,
    dependency_ids: parseJsonArray<string>(row.dependency_ids),
    log_entries: parseJsonArray<WorkflowLedgerEntry>(row.log_entries),
  };
}

function appendLedger(entries: WorkflowLedgerEntry[], next: WorkflowLedgerEntry): WorkflowLedgerEntry[] {
  return [...entries, next];
}

export function createDiligenceQuestion(input: {
  orgId: string;
  dataRoomId?: string;
  documentId?: string;
  question: string;
  priority?: DiligencePriority;
  ownerUserId?: string;
  askedBy?: string;
  dueAt?: string;
  evidenceLinks?: string[];
}): DiligenceQuestion {
  const id = randomUUID();
  const now = new Date().toISOString();
  const ledger: WorkflowLedgerEntry[] = [
    {
      at: now,
      actorUserId: input.askedBy ?? null,
      action: 'question.created',
      details: { priority: input.priority ?? 'medium' },
    },
  ];

  run(
    `INSERT INTO diligence_questions (id, org_id, data_room_id, document_id, question, status, priority, owner_user_id, asked_by, due_at, evidence_links, audit_ledger, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.dataRoomId ?? null,
    input.documentId ?? null,
    input.question,
    'open',
    input.priority ?? 'medium',
    input.ownerUserId ?? null,
    input.askedBy ?? null,
    input.dueAt ?? null,
    JSON.stringify(input.evidenceLinks ?? []),
    JSON.stringify(ledger),
    now,
    now
  );

  const question = getDiligenceQuestion(id);
  if (!question) throw new Error('Failed to create diligence question');

  writeAuditLog({
    orgId: input.orgId,
    userId: input.askedBy,
    action: 'task.create',
    resourceType: 'diligence_question',
    resourceId: id,
    details: { event: 'diligence.question.created', ownerUserId: input.ownerUserId ?? null },
  });

  return question;
}

export function answerDiligenceQuestion(input: {
  questionId: string;
  actorUserId?: string;
  answerText: string;
  evidenceLinks?: string[];
  close?: boolean;
}): DiligenceQuestion | null {
  const existing = get<RawQuestion>('SELECT * FROM diligence_questions WHERE id = ?', input.questionId);
  if (!existing) return null;

  const ledger = appendLedger(parseJsonArray<WorkflowLedgerEntry>(existing.audit_ledger), {
    at: new Date().toISOString(),
    actorUserId: input.actorUserId ?? null,
    action: input.close ? 'question.closed' : 'question.answered',
    details: { evidenceLinks: input.evidenceLinks ?? [] },
  });

  const status: DiligenceStatus = input.close ? 'closed' : 'answered';
  run(
    `UPDATE diligence_questions
       SET status = ?,
           answer_text = ?,
           answered_at = ?,
           evidence_links = ?,
           audit_ledger = ?,
           updated_at = ?
     WHERE id = ?`,
    status,
    input.answerText,
    new Date().toISOString(),
    JSON.stringify(input.evidenceLinks ?? []),
    JSON.stringify(ledger),
    new Date().toISOString(),
    input.questionId
  );

  return getDiligenceQuestion(input.questionId);
}

export function listDiligenceQuestions(filter: { orgId: string; dataRoomId?: string; ownerUserId?: string; status?: DiligenceStatus }): DiligenceQuestion[] {
  const conditions = ['org_id = ?'];
  const params: unknown[] = [filter.orgId];

  if (filter.dataRoomId) {
    conditions.push('data_room_id = ?');
    params.push(filter.dataRoomId);
  }
  if (filter.ownerUserId) {
    conditions.push('owner_user_id = ?');
    params.push(filter.ownerUserId);
  }
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }

  return all<RawQuestion>(
    `SELECT * FROM diligence_questions WHERE ${conditions.join(' AND ')} ORDER BY due_at IS NULL, due_at ASC, created_at DESC`,
    ...params
  ).map(mapQuestion);
}

export function getDiligenceQuestion(questionId: string): DiligenceQuestion | null {
  const row = get<RawQuestion>('SELECT * FROM diligence_questions WHERE id = ?', questionId);
  return row ? mapQuestion(row) : null;
}

export function createApprovalWorkflow(input: {
  orgId: string;
  dataRoomId?: string;
  title: string;
  workflowType: WorkflowType;
  targetType: string;
  targetId: string;
  submittedBy?: string;
  metadata?: Record<string, unknown>;
  approvers: Array<{ approverUserId?: string; stepName: string }>;
}): ApprovalWorkflow {
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO approval_workflows (id, org_id, data_room_id, title, workflow_type, target_type, target_id, status, submitted_by, submitted_at, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.dataRoomId ?? null,
    input.title,
    input.workflowType,
    input.targetType,
    input.targetId,
    'in_review',
    input.submittedBy ?? null,
    now,
    JSON.stringify(input.metadata ?? {}),
    now,
    now
  );

  input.approvers.forEach((step, index) => {
    run(
      `INSERT INTO approval_steps (id, workflow_id, step_order, approver_user_id, step_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      id,
      index + 1,
      step.approverUserId ?? null,
      step.stepName,
      'pending',
      now
    );
  });

  run(
    `INSERT INTO approval_decisions (id, workflow_id, actor_user_id, decision, notes, signature_metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    id,
    input.submittedBy ?? null,
    'submit',
    'Workflow submitted',
    JSON.stringify({ source: 'workflow.create' }),
    now
  );

  const workflow = getApprovalWorkflow(id);
  if (!workflow) throw new Error('Failed to create approval workflow');
  return workflow;
}

export function getApprovalWorkflow(workflowId: string): ApprovalWorkflow | null {
  const row = get<RawWorkflow>('SELECT * FROM approval_workflows WHERE id = ?', workflowId);
  return row ? mapWorkflow(row) : null;
}

export function listApprovalSteps(workflowId: string): ApprovalStep[] {
  return all<RawStep>('SELECT * FROM approval_steps WHERE workflow_id = ? ORDER BY step_order ASC', workflowId).map(mapStep);
}

export function listApprovalDecisions(workflowId: string): ApprovalDecision[] {
  return all<RawDecision>('SELECT * FROM approval_decisions WHERE workflow_id = ? ORDER BY created_at ASC', workflowId).map(mapDecision);
}

export function recordApprovalDecision(input: {
  workflowId: string;
  actorUserId?: string;
  decision: 'approve' | 'reject' | 'comment';
  notes?: string;
  signatureMetadata?: Record<string, unknown>;
}): ApprovalWorkflow | null {
  const workflow = getApprovalWorkflow(input.workflowId);
  if (!workflow) return null;

  const steps = listApprovalSteps(input.workflowId);
  const pendingStep = steps.find((step) => step.status === 'pending');
  const now = new Date().toISOString();

  if (pendingStep && (input.decision === 'approve' || input.decision === 'reject')) {
    run(
      `UPDATE approval_steps SET status = ?, decided_at = ?, notes = ?, signature_metadata = ? WHERE id = ?`,
      input.decision === 'approve' ? 'approved' : 'rejected',
      now,
      input.notes ?? null,
      JSON.stringify(input.signatureMetadata ?? {}),
      pendingStep.id
    );
  }

  run(
    `INSERT INTO approval_decisions (id, workflow_id, step_id, actor_user_id, decision, notes, signature_metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    input.workflowId,
    pendingStep?.id ?? null,
    input.actorUserId ?? null,
    input.decision,
    input.notes ?? null,
    JSON.stringify(input.signatureMetadata ?? {}),
    now
  );

  const updatedSteps = listApprovalSteps(input.workflowId);
  const rejected = updatedSteps.some((step) => step.status === 'rejected');
  const approved = updatedSteps.length > 0 && updatedSteps.every((step) => step.status === 'approved');

  let nextStatus: WorkflowStatus = 'in_review';
  let decidedAt: string | null = null;
  if (rejected) {
    nextStatus = 'rejected';
    decidedAt = now;
  } else if (approved) {
    nextStatus = 'approved';
    decidedAt = now;
  }

  run(
    `UPDATE approval_workflows SET status = ?, decided_at = ?, decision_summary = ?, updated_at = ? WHERE id = ?`,
    nextStatus,
    decidedAt,
    input.notes ?? workflow.decision_summary,
    now,
    input.workflowId
  );

  writeAuditLog({
    orgId: workflow.org_id,
    userId: input.actorUserId,
    action: input.decision === 'reject' ? 'approval.reject' : 'approval.approve',
    resourceType: 'approval_workflow',
    resourceId: input.workflowId,
    details: { stepId: pendingStep?.id ?? null },
  });

  return getApprovalWorkflow(input.workflowId);
}

export function createWorkflowAction(input: {
  orgId: string;
  workflowId?: string;
  meetingId?: string;
  title: string;
  ownerUserId?: string;
  dueAt?: string;
  dependencyIds?: string[];
  createdBy?: string;
  taskPayload?: { workspaceId?: string; priority?: Task['priority']; description?: string };
}): WorkflowAction {
  const id = randomUUID();
  const now = new Date().toISOString();
  let taskId: string | null = null;

  if (input.taskPayload) {
    const task = createTask({
      orgId: input.orgId,
      workspaceId: input.taskPayload.workspaceId,
      title: input.title,
      description: input.taskPayload.description,
      priority: input.taskPayload.priority,
      assignedTo: input.ownerUserId,
      createdBy: input.createdBy,
      dueDate: input.dueAt,
    });
    taskId = task.id;
  }

  const logEntries: WorkflowLedgerEntry[] = [
    {
      at: now,
      actorUserId: input.createdBy ?? null,
      action: 'action.created',
      details: { dependencyCount: input.dependencyIds?.length ?? 0, taskId },
    },
  ];

  run(
    `INSERT INTO workflow_actions (id, org_id, workflow_id, meeting_id, task_id, title, owner_user_id, status, due_at, dependency_ids, log_entries, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workflowId ?? null,
    input.meetingId ?? null,
    taskId,
    input.title,
    input.ownerUserId ?? null,
    'open',
    input.dueAt ?? null,
    JSON.stringify(input.dependencyIds ?? []),
    JSON.stringify(logEntries),
    now,
    now
  );

  const action = getWorkflowAction(id);
  if (!action) throw new Error('Failed to create workflow action');
  return action;
}

export function addActionDependency(actionId: string, dependencyId: string, actorUserId?: string): WorkflowAction | null {
  const action = get<RawAction>('SELECT * FROM workflow_actions WHERE id = ?', actionId);
  if (!action) return null;

  const dependencyIds = Array.from(new Set([...parseJsonArray<string>(action.dependency_ids), dependencyId]));
  const logEntries = appendLedger(parseJsonArray<WorkflowLedgerEntry>(action.log_entries), {
    at: new Date().toISOString(),
    actorUserId: actorUserId ?? null,
    action: 'dependency.added',
    details: { dependencyId },
  });

  run(
    'UPDATE workflow_actions SET dependency_ids = ?, log_entries = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(dependencyIds),
    JSON.stringify(logEntries),
    new Date().toISOString(),
    actionId
  );

  return getWorkflowAction(actionId);
}

export function logWorkflowAction(actionId: string, input: { actorUserId?: string; action: string; details?: Record<string, unknown>; status?: WorkflowAction['status'] }): WorkflowAction | null {
  const existing = get<RawAction>('SELECT * FROM workflow_actions WHERE id = ?', actionId);
  if (!existing) return null;

  const logEntries = appendLedger(parseJsonArray<WorkflowLedgerEntry>(existing.log_entries), {
    at: new Date().toISOString(),
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    details: input.details,
  });

  run(
    'UPDATE workflow_actions SET log_entries = ?, status = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(logEntries),
    input.status ?? existing.status,
    new Date().toISOString(),
    actionId
  );

  return getWorkflowAction(actionId);
}

export function getWorkflowAction(actionId: string): WorkflowAction | null {
  const row = get<RawAction>('SELECT * FROM workflow_actions WHERE id = ?', actionId);
  return row ? mapAction(row) : null;
}

export function listWorkflowActions(filter: { orgId: string; workflowId?: string; meetingId?: string; ownerUserId?: string }): WorkflowAction[] {
  const conditions = ['org_id = ?'];
  const params: unknown[] = [filter.orgId];
  if (filter.workflowId) {
    conditions.push('workflow_id = ?');
    params.push(filter.workflowId);
  }
  if (filter.meetingId) {
    conditions.push('meeting_id = ?');
    params.push(filter.meetingId);
  }
  if (filter.ownerUserId) {
    conditions.push('owner_user_id = ?');
    params.push(filter.ownerUserId);
  }
  return all<RawAction>(`SELECT * FROM workflow_actions WHERE ${conditions.join(' AND ')} ORDER BY due_at IS NULL, due_at ASC`, ...params).map(mapAction);
}

export function buildInvestmentMemo(workflowId: string): { workflow: ApprovalWorkflow; memo: string } | null {
  const workflow = getApprovalWorkflow(workflowId);
  if (!workflow) return null;

  const snapshot = workflow.data_room_id ? getDataRoomSnapshot(workflow.data_room_id) : null;
  const questions = listDiligenceQuestions({ orgId: workflow.org_id, dataRoomId: workflow.data_room_id ?? undefined });
  const steps = listApprovalSteps(workflowId);

  const memo = [
    `# Investment Memo: ${workflow.title}`,
    '',
    `Status: ${workflow.status}`,
    `Target: ${workflow.target_type} / ${workflow.target_id}`,
    `Data room: ${snapshot?.room.name ?? 'N/A'}`,
    '',
    '## Diligence Summary',
    `- Open questions: ${questions.filter((q) => q.status === 'open').length}`,
    `- Answered questions: ${questions.filter((q) => q.status === 'answered' || q.status === 'closed').length}`,
    `- Collections: ${snapshot?.collections.map((c) => `${c.name} (${c.count})`).join(', ') || 'None'}`,
    '',
    '## Approval Chain',
    ...steps.map((step) => `- Step ${step.step_order}: ${step.step_name} — ${step.status}`),
    '',
    '## Key Risks',
    ...questions.filter((q) => q.priority === 'high' || q.priority === 'critical').map((q) => `- ${q.question}`),
  ].join('\n');

  return { workflow, memo };
}

export function buildBoardPack(workflowId: string): { workflow: ApprovalWorkflow; boardPack: string } | null {
  const workflow = getApprovalWorkflow(workflowId);
  if (!workflow) return null;
  const snapshot = workflow.data_room_id ? getDataRoomSnapshot(workflow.data_room_id) : null;
  const actions = listWorkflowActions({ orgId: workflow.org_id, workflowId });
  const decisions = listApprovalDecisions(workflowId);

  const boardPack = [
    `# Board Pack: ${workflow.title}`,
    '',
    '## Materials',
    ...(snapshot?.documents.map((doc) => `- ${doc.collection_name}: ${doc.title}`) ?? ['- No documents attached']),
    '',
    '## Decision History',
    ...decisions.map((decision) => `- ${decision.created_at}: ${decision.decision} (${decision.actor_user_id ?? 'system'})`),
    '',
    '## Action Register',
    ...actions.map((action) => `- ${action.title} [${action.status}] depends on ${action.dependency_ids.join(', ') || 'none'}`),
  ].join('\n');

  return { workflow, boardPack };
}

export function getWorkflowSnapshot(workflowId: string) {
  const workflow = getApprovalWorkflow(workflowId);
  if (!workflow) return null;
  return {
    workflow,
    steps: listApprovalSteps(workflowId),
    decisions: listApprovalDecisions(workflowId),
    actions: listWorkflowActions({ orgId: workflow.org_id, workflowId }),
  };
}

export function getActionTask(actionId: string): Task | null {
  const action = getWorkflowAction(actionId);
  if (!action?.task_id) return null;
  return getTask(action.task_id);
}
