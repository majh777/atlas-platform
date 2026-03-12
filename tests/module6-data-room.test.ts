import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initDb, run } from '@/lib/db';
import {
  addDataRoomDocument,
  buildWatermark,
  createDataRoom,
  getDataRoomSnapshot,
  grantDataRoomAccess,
  listAccessibleDocuments,
} from '@/lib/services/data-room';
import {
  addActionDependency,
  buildBoardPack,
  buildInvestmentMemo,
  createApprovalWorkflow,
  createDiligenceQuestion,
  createWorkflowAction,
  getActionTask,
  listDiligenceQuestions,
  recordApprovalDecision,
  answerDiligenceQuestion,
} from '@/lib/services/workflows';
import {
  addAgendaItem,
  createCommitteeMeeting,
  getCommitteePacket,
  recordCommitteeSignoff,
} from '@/lib/services/committee';

beforeAll(() => {
  initDb();

  for (const user of [
    ['u-owner', 'owner@test.dev', 'Owner'],
    ['u-analyst', 'analyst@test.dev', 'Analyst'],
    ['u-counsel', 'counsel@test.dev', 'Counsel'],
    ['u-committee', 'committee@test.dev', 'Committee'],
  ]) {
    run(
      'INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      user[0],
      user[1],
      'hash',
      user[2]
    );
  }
});

afterAll(() => {
  closeDb();
});

describe('Module 6 data room and diligence workflows', () => {
  it('enforces scoped external access and watermarking', () => {
    const room = createDataRoom({
      orgId: 'org-dr',
      workspaceId: 'ws-dr',
      name: 'Project Atlas VDR',
      slug: 'project-atlas-vdr',
      classification: 'restricted',
      watermarkTemplate: 'ROOM {roomName} · {subjectId} · {documentTitle} · {ts}',
      createdBy: 'u-owner',
    });

    const legalDoc = addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Share Purchase Agreement',
      category: 'legal',
      collectionName: 'legal',
      evidenceLinks: ['evidence://spa-v3'],
      uploadedBy: 'u-owner',
    });

    addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Revenue Cohort Model',
      category: 'financial',
      collectionName: 'finance',
      evidenceLinks: ['evidence://finance-model'],
      uploadedBy: 'u-owner',
    });

    grantDataRoomAccess({
      dataRoomId: room.id,
      subjectType: 'external_party',
      subjectId: 'counsel@firm.example',
      role: 'viewer',
      scopeCollections: ['legal'],
      allowDownload: false,
      requireWatermark: true,
      grantedBy: 'u-owner',
    });

    const accessible = listAccessibleDocuments({
      dataRoomId: room.id,
      subjectType: 'external_party',
      subjectId: 'counsel@firm.example',
    });

    expect(accessible).toHaveLength(1);
    expect(accessible[0]?.title).toBe('Share Purchase Agreement');

    const watermark = buildWatermark({
      dataRoomId: room.id,
      subjectType: 'external_party',
      subjectId: 'counsel@firm.example',
      documentId: legalDoc.id,
    });

    expect(watermark.watermark).toContain('Project Atlas VDR');
    expect(watermark.watermark).toContain('counsel@firm.example');
    expect(watermark.watermark).toContain('Share Purchase Agreement');

    const snapshot = getDataRoomSnapshot(room.id);
    expect(snapshot?.collections).toEqual(
      expect.arrayContaining([
        { name: 'legal', count: 1 },
        { name: 'finance', count: 1 },
      ])
    );
  });

  it('maintains an audit-ready Q&A ledger and approval chain', () => {
    const room = createDataRoom({ orgId: 'org-wf', name: 'IC Room', slug: 'ic-room', createdBy: 'u-owner' });

    const question = createDiligenceQuestion({
      orgId: 'org-wf',
      dataRoomId: room.id,
      question: 'Provide signed customer contracts supporting pipeline conversion.',
      priority: 'critical',
      ownerUserId: 'u-analyst',
      askedBy: 'u-owner',
      dueAt: '2026-03-20T12:00:00.000Z',
      evidenceLinks: ['evidence://pipeline-summary'],
    });

    const answered = answerDiligenceQuestion({
      questionId: question.id,
      actorUserId: 'u-analyst',
      answerText: 'Attached signed contracts for top 10 accounts.',
      evidenceLinks: ['evidence://signed-contracts', 'evidence://crm-export'],
      close: true,
    });

    expect(answered?.status).toBe('closed');
    expect(answered?.audit_ledger).toHaveLength(2);
    expect(answered?.audit_ledger[1]?.action).toBe('question.closed');

    const workflow = createApprovalWorkflow({
      orgId: 'org-wf',
      dataRoomId: room.id,
      title: 'Series B investment memo',
      workflowType: 'investment_memo',
      targetType: 'deal',
      targetId: 'deal-series-b',
      submittedBy: 'u-owner',
      metadata: { issuer: 'Atlas PortCo' },
      approvers: [
        { approverUserId: 'u-analyst', stepName: 'Analyst sign-off' },
        { approverUserId: 'u-counsel', stepName: 'Legal sign-off' },
      ],
    });

    const afterFirst = recordApprovalDecision({
      workflowId: workflow.id,
      actorUserId: 'u-analyst',
      decision: 'approve',
      notes: 'Financial diligence complete.',
      signatureMetadata: { method: 'docusign', signerTitle: 'VP Investments' },
    });
    expect(afterFirst?.status).toBe('in_review');

    const afterSecond = recordApprovalDecision({
      workflowId: workflow.id,
      actorUserId: 'u-counsel',
      decision: 'approve',
      notes: 'Legal diligence complete.',
      signatureMetadata: { method: 'docusign', signerTitle: 'General Counsel' },
    });
    expect(afterSecond?.status).toBe('approved');

    const action = createWorkflowAction({
      orgId: 'org-wf',
      workflowId: workflow.id,
      title: 'Collect wet-ink board resolutions',
      ownerUserId: 'u-owner',
      dueAt: '2026-03-24T10:00:00.000Z',
      createdBy: 'u-owner',
      taskPayload: { description: 'Needed before closing', priority: 'high' },
    });

    const dependent = createWorkflowAction({
      orgId: 'org-wf',
      workflowId: workflow.id,
      title: 'Release closing checklist',
      ownerUserId: 'u-committee',
      createdBy: 'u-owner',
    });

    const updated = addActionDependency(dependent.id, action.id, 'u-owner');
    expect(updated?.dependency_ids).toEqual([action.id]);

    const linkedTask = getActionTask(action.id);
    expect(linkedTask?.title).toBe('Collect wet-ink board resolutions');

    const memo = buildInvestmentMemo(workflow.id);
    const boardPack = buildBoardPack(workflow.id);
    expect(memo?.memo).toContain('Series B investment memo');
    expect(memo?.memo).toContain('Open questions: 0');
    expect(boardPack?.boardPack).toContain('Decision History');
    expect(boardPack?.boardPack).toContain('Release closing checklist');

    const questions = listDiligenceQuestions({ orgId: 'org-wf', dataRoomId: room.id });
    expect(questions).toHaveLength(1);
    expect(questions[0]?.evidence_links).toContain('evidence://signed-contracts');
  });

  it('builds committee packets with agendas, sign-offs, and signature metadata', () => {
    const room = createDataRoom({ orgId: 'org-committee', name: 'Board Dataroom', slug: 'board-dataroom', createdBy: 'u-owner' });
    addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Board deck Q1',
      category: 'board',
      collectionName: 'board-materials',
      uploadedBy: 'u-owner',
    });

    const workflow = createApprovalWorkflow({
      orgId: 'org-committee',
      dataRoomId: room.id,
      title: 'Q1 board pack',
      workflowType: 'board_pack',
      targetType: 'board_meeting',
      targetId: 'board-q1',
      submittedBy: 'u-owner',
      approvers: [{ approverUserId: 'u-committee', stepName: 'Committee chair approval' }],
    });

    recordApprovalDecision({
      workflowId: workflow.id,
      actorUserId: 'u-committee',
      decision: 'approve',
      notes: 'Ready for board circulation.',
      signatureMetadata: { method: 'qualified-esign', ipAddress: '10.10.0.2' },
    });

    const meeting = createCommitteeMeeting({
      orgId: 'org-committee',
      dataRoomId: room.id,
      title: 'Investment Committee March',
      committeeName: 'Investment Committee',
      scheduledFor: '2026-03-28T09:00:00.000Z',
      boardPackWorkflowId: workflow.id,
      investmentMemoWorkflowId: workflow.id,
      createdBy: 'u-owner',
    });

    addAgendaItem({
      meetingId: meeting.id,
      itemOrder: 1,
      title: 'Review Q1 board pack',
      presenterUserId: 'u-owner',
      relatedWorkflowId: workflow.id,
    });

    const signoff = recordCommitteeSignoff({
      meetingId: meeting.id,
      workflowId: workflow.id,
      signerUserId: 'u-committee',
      decision: 'approve',
      notes: 'Approved unanimously.',
      signatureMetadata: {
        method: 'qualified-esign',
        signerTitle: 'Chair',
        ipAddress: '10.10.0.2',
        hash: 'abc123',
      },
    });

    expect(signoff.signature_metadata.signerTitle).toBe('Chair');

    const packet = getCommitteePacket(meeting.id);
    expect(packet?.agenda).toHaveLength(1);
    expect(packet?.signoffs).toHaveLength(1);
    expect(packet?.boardPack?.boardPack).toContain('Board deck Q1');
    expect(packet?.investmentMemo?.memo).toContain('Q1 board pack');
  });
});
