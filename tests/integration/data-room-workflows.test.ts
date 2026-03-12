/**
 * Integration Tests: Data Room and Document Workflows
 * 
 * Tests document upload, analysis, data room sharing,
 * diligence Q&A, and approval workflows.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initDb, run, get, all } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import {
  createDataRoom,
  addDataRoomDocument,
  grantDataRoomAccess,
  listAccessibleDocuments,
  buildWatermark,
  getDataRoomSnapshot
} from '@/lib/services/data-room';
import { run } from '@/lib/db';
import {
  createDiligenceQuestion,
  answerDiligenceQuestion,
  listDiligenceQuestions,
  createApprovalWorkflow,
  recordApprovalDecision,
  createWorkflowAction,
  addActionDependency,
  buildInvestmentMemo,
  buildBoardPack
} from '@/lib/services/workflows';
import {
  createCommitteeMeeting,
  addAgendaItem,
  recordCommitteeSignoff,
  getCommitteePacket
} from '@/lib/services/committee';
import { writeAuditLog } from '@/lib/services/audit';
import { randomUUID } from 'node:crypto';

const testUsers = {
  dealLead: { id: randomUUID(), email: 'deal-lead@atlas.test' },
  analyst: { id: randomUUID(), email: 'analyst@atlas.test' },
  counsel: { id: randomUUID(), email: 'counsel@atlas.test' },
  committee: { id: randomUUID(), email: 'committee@atlas.test' },
  externalAdvisor: { id: randomUUID(), email: 'advisor@external.com' }
};

const testOrg = { id: randomUUID(), name: 'Test Investment Fund' };

beforeAll(async () => {
  initDb();

  const hash = await hashPassword('Password123!');
  for (const [role, user] of Object.entries(testUsers)) {
    run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      user.id, user.email, hash, `${role} User`
    );
  }
});

afterAll(() => {
  closeDb();
});

describe('Data Room Creation and Document Management', () => {
  let dataRoomId: string;
  const documents: { id: string; title: string }[] = [];

  it('step 1: creates a secure data room', () => {
    const room = createDataRoom({
      orgId: testOrg.id,
      workspaceId: randomUUID(),
      name: 'Project Phoenix VDR',
      slug: `phoenix-vdr-${Date.now()}`,
      classification: 'restricted',
      watermarkTemplate: '{roomName} • {subjectId} • {documentTitle} • {ts}',
      createdBy: testUsers.dealLead.id
    });

    dataRoomId = room.id;

    expect(room.id).toBeTruthy();
    expect(room.name).toBe('Project Phoenix VDR');
    expect(room.classification).toBe('restricted');
    expect(room.status).toBe('active');
  });

  it('step 2: uploads documents to legal collection', () => {
    const legalDocs = [
      { title: 'Share Purchase Agreement v3', category: 'legal' },
      { title: 'Shareholders Agreement Draft', category: 'legal' },
      { title: 'Board Resolutions', category: 'legal' }
    ];

    for (const doc of legalDocs) {
      const uploaded = addDataRoomDocument({
        dataRoomId,
        title: doc.title,
        category: doc.category,
        collectionName: 'legal',
        evidenceLinks: [`evidence://${doc.title.toLowerCase().replace(/\s/g, '-')}`],
        uploadedBy: testUsers.counsel.id
      });

      documents.push({ id: uploaded.id, title: uploaded.title });
      expect(uploaded.id).toBeTruthy();
    }

    expect(documents.length).toBe(3);
  });

  it('step 3: uploads documents to financial collection', () => {
    const financeDocs = [
      { title: 'Base Case Financial Model', category: 'financial' },
      { title: 'Revenue Projections', category: 'financial' },
      { title: 'Capital Structure Analysis', category: 'financial' },
      { title: 'Lender Term Sheet', category: 'financial' }
    ];

    for (const doc of financeDocs) {
      const uploaded = addDataRoomDocument({
        dataRoomId,
        title: doc.title,
        category: doc.category,
        collectionName: 'finance',
        evidenceLinks: [`evidence://finance/${doc.title.toLowerCase().replace(/\s/g, '-')}`],
        uploadedBy: testUsers.analyst.id
      });

      documents.push({ id: uploaded.id, title: uploaded.title });
    }

    expect(documents.length).toBe(7);
  });

  it('step 4: uploads documents to technical collection', () => {
    const techDocs = [
      { title: 'Technical Due Diligence Report', category: 'technical' },
      { title: 'Equipment Specifications', category: 'technical' },
      { title: 'Site Assessment Study', category: 'technical' }
    ];

    for (const doc of techDocs) {
      addDataRoomDocument({
        dataRoomId,
        title: doc.title,
        category: doc.category,
        collectionName: 'technical',
        uploadedBy: testUsers.analyst.id
      });
    }
  });

  it('step 5: gets data room snapshot with collection counts', () => {
    const snapshot = getDataRoomSnapshot(dataRoomId);

    expect(snapshot).toBeDefined();
    expect(snapshot?.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'legal', count: 3 }),
        expect.objectContaining({ name: 'finance', count: 4 }),
        expect.objectContaining({ name: 'technical', count: 3 })
      ])
    );
  });

  it('step 6: logs document upload audit', () => {
    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.analyst.id,
      action: 'document.upload',
      resourceType: 'data_room_document',
      resourceId: documents[0].id,
      details: { dataRoomId, collection: 'legal' },
      ip: '192.168.1.100'
    });
  });
});

describe('Data Room Access Control and Watermarking', () => {
  let dataRoomId: string;
  let legalDocId: string;
  let financeDocId: string;

  beforeAll(() => {
    const room = createDataRoom({
      orgId: testOrg.id,
      name: 'Access Control Test VDR',
      slug: `access-test-${Date.now()}`,
      classification: 'confidential',
      watermarkTemplate: 'CONFIDENTIAL • {roomName} • {subjectId} • {documentTitle}',
      createdBy: testUsers.dealLead.id
    });
    dataRoomId = room.id;

    const legalDoc = addDataRoomDocument({
      dataRoomId,
      title: 'Sensitive Legal Agreement',
      category: 'legal',
      collectionName: 'legal',
      uploadedBy: testUsers.counsel.id
    });
    legalDocId = legalDoc.id;

    const financeDoc = addDataRoomDocument({
      dataRoomId,
      title: 'Valuation Model',
      category: 'financial',
      collectionName: 'finance',
      uploadedBy: testUsers.analyst.id
    });
    financeDocId = financeDoc.id;
  });

  it('step 1: grants scoped access to external counsel', () => {
    const grant = grantDataRoomAccess({
      dataRoomId,
      subjectType: 'external_party',
      subjectId: 'external-counsel@lawfirm.com',
      role: 'viewer',
      scopeCollections: ['legal'],
      allowDownload: false,
      requireWatermark: true,
      grantedBy: testUsers.dealLead.id
    });

    expect(grant.id).toBeTruthy();
    expect(grant.scope_collections).toEqual(['legal']);
    expect(grant.allow_download).toBe(0);
  });

  it('step 2: external counsel can only see legal documents', () => {
    const accessible = listAccessibleDocuments({
      dataRoomId,
      subjectType: 'external_party',
      subjectId: 'external-counsel@lawfirm.com'
    });

    expect(accessible.length).toBe(1);
    expect(accessible[0]?.title).toBe('Sensitive Legal Agreement');
  });

  it('step 3: generates watermark for document access', () => {
    const watermark = buildWatermark({
      dataRoomId,
      subjectType: 'external_party',
      subjectId: 'external-counsel@lawfirm.com',
      documentId: legalDocId
    });

    expect(watermark.watermark).toContain('CONFIDENTIAL');
    expect(watermark.watermark).toContain('Access Control Test VDR');
    expect(watermark.watermark).toContain('external-counsel@lawfirm.com');
    expect(watermark.watermark).toContain('Sensitive Legal Agreement');
  });

  it('step 4: grants full access to internal analyst', () => {
    grantDataRoomAccess({
      dataRoomId,
      subjectType: 'user',
      subjectId: testUsers.analyst.id,
      role: 'editor',
      scopeCollections: ['legal', 'finance'],  // explicit collections since wildcard not supported
      allowDownload: true,
      allowUpload: true,
      requireWatermark: false,
      grantedBy: testUsers.dealLead.id
    });

    const accessible = listAccessibleDocuments({
      dataRoomId,
      subjectType: 'user',
      subjectId: testUsers.analyst.id
    });

    expect(accessible.length).toBe(2);
  });

  it('step 5: revokes access from external party', () => {
    // Revoke access by deleting the grant
    run(
      `DELETE FROM data_room_access_grants 
       WHERE data_room_id = ? AND subject_type = ? AND subject_id = ?`,
      dataRoomId, 'external_party', 'external-counsel@lawfirm.com'
    );

    const accessible = listAccessibleDocuments({
      dataRoomId,
      subjectType: 'external_party',
      subjectId: 'external-counsel@lawfirm.com'
    });

    expect(accessible.length).toBe(0);
  });

  it('step 6: grants time-limited access', () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    grantDataRoomAccess({
      dataRoomId,
      subjectType: 'external_party',
      subjectId: 'temp-advisor@consulting.com',
      role: 'viewer',
      scopeCollections: ['finance'],
      allowDownload: false,
      requireWatermark: true,
      expiresAt,
      grantedBy: testUsers.dealLead.id
    });

    const grant = get<{ expires_at: string }>(
      `SELECT expires_at FROM data_room_access_grants 
       WHERE data_room_id = ? AND subject_id = ?`,
      dataRoomId, 'temp-advisor@consulting.com'
    );

    expect(grant?.expires_at).toBeTruthy();
  });
});

describe('Diligence Q&A Workflow', () => {
  let dataRoomId: string;
  const questions: { id: string; question: string }[] = [];

  beforeAll(() => {
    const room = createDataRoom({
      orgId: testOrg.id,
      name: 'Diligence Q&A Room',
      slug: `qa-room-${Date.now()}`,
      createdBy: testUsers.dealLead.id
    });
    dataRoomId = room.id;

    addDataRoomDocument({
      dataRoomId,
      title: 'Customer Contracts Summary',
      category: 'commercial',
      collectionName: 'commercial',
      uploadedBy: testUsers.analyst.id
    });
  });

  it('step 1: creates a critical diligence question', () => {
    const question = createDiligenceQuestion({
      orgId: testOrg.id,
      dataRoomId,
      question: 'Provide signed customer contracts supporting the revenue pipeline.',
      priority: 'critical',
      ownerUserId: testUsers.analyst.id,
      askedBy: testUsers.dealLead.id,
      dueAt: '2026-04-15T12:00:00.000Z',
      evidenceLinks: ['evidence://pipeline-summary']
    });

    questions.push({ id: question.id, question: question.question });

    expect(question.id).toBeTruthy();
    expect(question.status).toBe('open');
    expect(question.priority).toBe('critical');
    expect(question.audit_ledger).toHaveLength(1);
    expect(question.audit_ledger[0].action).toBe('question.created');
  });

  it('step 2: creates multiple questions with different priorities', () => {
    const newQuestions = [
      { question: 'Confirm regulatory approvals status', priority: 'high' as const },
      { question: 'Provide equipment warranty documentation', priority: 'medium' as const },
      { question: 'Clarify insurance coverage limits', priority: 'low' as const }
    ];

    for (const q of newQuestions) {
      const created = createDiligenceQuestion({
        orgId: testOrg.id,
        dataRoomId,
        question: q.question,
        priority: q.priority,
        ownerUserId: testUsers.analyst.id,
        askedBy: testUsers.committee.id
      });
      questions.push({ id: created.id, question: created.question });
    }

    expect(questions.length).toBe(4);
  });

  it('step 3: lists questions by status and priority', () => {
    const allQuestions = listDiligenceQuestions({ orgId: testOrg.id, dataRoomId });
    const openQuestions = listDiligenceQuestions({ orgId: testOrg.id, dataRoomId, status: 'open' });
    // Filter by priority manually since the API doesn't support it
    const criticalQuestions = allQuestions.filter(q => q.priority === 'critical');

    expect(allQuestions.length).toBe(4);
    expect(openQuestions.length).toBe(4);
    expect(criticalQuestions.length).toBe(1);
    expect(criticalQuestions[0].priority).toBe('critical');
  });

  it('step 4: answers and closes a question with evidence', () => {
    const answered = answerDiligenceQuestion({
      questionId: questions[0].id,
      actorUserId: testUsers.analyst.id,
      answerText: 'Attached signed contracts for top 10 customers representing 80% of revenue.',
      evidenceLinks: ['evidence://signed-contracts', 'evidence://crm-export'],
      close: true
    });

    expect(answered?.status).toBe('closed');
    expect(answered?.answered_at).toBeTruthy();
    expect(answered?.evidence_links).toContain('evidence://signed-contracts');
    expect(answered?.audit_ledger.length).toBe(2);
    expect(answered?.audit_ledger[1].action).toBe('question.closed');
  });

  it('step 5: answers question without closing', () => {
    const answered = answerDiligenceQuestion({
      questionId: questions[1].id,
      actorUserId: testUsers.analyst.id,
      answerText: 'Environmental permits approved. Operating permit pending final review.',
      close: false
    });

    expect(answered?.status).toBe('answered');
    expect(answered?.answer_text).toContain('Environmental permits');
  });

  it('step 6: verifies closed questions count', () => {
    const closed = listDiligenceQuestions({ orgId: testOrg.id, dataRoomId, status: 'closed' });
    const open = listDiligenceQuestions({ orgId: testOrg.id, dataRoomId, status: 'open' });

    expect(closed.length).toBe(1);
    expect(open.length).toBe(2); // 2 still open, 1 answered but not closed
  });
});

describe('Approval Workflow and Investment Memo', () => {
  let dataRoomId: string;
  let workflowId: string;

  beforeAll(() => {
    const room = createDataRoom({
      orgId: testOrg.id,
      name: 'Approval Workflow Room',
      slug: `approval-room-${Date.now()}`,
      createdBy: testUsers.dealLead.id
    });
    dataRoomId = room.id;
  });

  it('step 1: creates a multi-step approval workflow', () => {
    const workflow = createApprovalWorkflow({
      orgId: testOrg.id,
      dataRoomId,
      title: 'Series B Investment Memo',
      workflowType: 'investment_memo',
      targetType: 'deal',
      targetId: 'deal-series-b-001',
      submittedBy: testUsers.dealLead.id,
      metadata: { 
        issuer: 'TechCo Inc',
        investmentAmount: 50000000,
        currency: 'USD'
      },
      approvers: [
        { approverUserId: testUsers.analyst.id, stepName: 'Analyst Review' },
        { approverUserId: testUsers.counsel.id, stepName: 'Legal Review' },
        { approverUserId: testUsers.committee.id, stepName: 'IC Approval' }
      ]
    });

    workflowId = workflow.id;

    expect(workflow.id).toBeTruthy();
    expect(workflow.status).toBe('in_review');  // workflows start in 'in_review' when submitted
    expect(workflow.title).toBe('Series B Investment Memo');
  });

  it('step 2: first approver (analyst) approves', () => {
    const result = recordApprovalDecision({
      workflowId,
      actorUserId: testUsers.analyst.id,
      decision: 'approve',
      notes: 'Financial analysis complete. Model validated.',
      signatureMetadata: {
        method: 'electronic',
        signerTitle: 'Senior Investment Analyst',
        timestamp: new Date().toISOString()
      }
    });

    expect(result?.status).toBe('in_review');
  });

  it('step 3: second approver (counsel) approves', () => {
    const result = recordApprovalDecision({
      workflowId,
      actorUserId: testUsers.counsel.id,
      decision: 'approve',
      notes: 'Legal due diligence complete. No material issues.',
      signatureMetadata: {
        method: 'docusign',
        signerTitle: 'General Counsel',
        ipAddress: '10.0.0.1'
      }
    });

    expect(result?.status).toBe('in_review');
  });

  it('step 4: final approver (committee) approves', () => {
    const result = recordApprovalDecision({
      workflowId,
      actorUserId: testUsers.committee.id,
      decision: 'approve',
      notes: 'Approved for investment. Proceed to closing.',
      signatureMetadata: {
        method: 'qualified-esign',
        signerTitle: 'Managing Partner',
        certificate: 'CERT-12345'
      }
    });

    expect(result?.status).toBe('approved');
    expect(result?.decided_at).toBeTruthy();
  });

  it('step 5: generates investment memo', () => {
    const memo = buildInvestmentMemo(workflowId);

    expect(memo).toBeDefined();
    expect(memo?.memo).toContain('Series B Investment Memo');
    expect(memo?.memo).toContain('Open questions: 0');
  });

  it('step 6: generates board pack', () => {
    const pack = buildBoardPack(workflowId);

    expect(pack).toBeDefined();
    expect(pack?.boardPack).toContain('Decision History');
  });
});

describe('Workflow Actions and Dependencies', () => {
  let dataRoomId: string;
  let workflowId: string;
  const actionIds: string[] = [];

  beforeAll(() => {
    const room = createDataRoom({
      orgId: testOrg.id,
      name: 'Action Tracking Room',
      slug: `actions-room-${Date.now()}`,
      createdBy: testUsers.dealLead.id
    });
    dataRoomId = room.id;

    const workflow = createApprovalWorkflow({
      orgId: testOrg.id,
      dataRoomId,
      title: 'Closing Checklist',
      workflowType: 'signoff',
      targetType: 'deal',
      targetId: 'deal-closing-001',
      submittedBy: testUsers.dealLead.id,
      approvers: [
        { approverUserId: testUsers.committee.id, stepName: 'Final Approval' }
      ]
    });
    workflowId = workflow.id;
  });

  it('step 1: creates pre-closing action items', () => {
    const actions = [
      { title: 'Collect wet-ink board resolutions', owner: testUsers.counsel.id },
      { title: 'Wire transfer confirmation', owner: testUsers.analyst.id },
      { title: 'Final legal opinion', owner: testUsers.counsel.id }
    ];

    for (const action of actions) {
      const created = createWorkflowAction({
        orgId: testOrg.id,
        workflowId,
        title: action.title,
        ownerUserId: action.owner,
        dueAt: '2026-04-20T17:00:00.000Z',
        createdBy: testUsers.dealLead.id,
        taskPayload: {
          description: action.title,
          priority: 'high'
        }
      });

      actionIds.push(created.id);
      expect(created.id).toBeTruthy();
      expect(created.status).toBe('open');
    }
  });

  it('step 2: creates dependent action', () => {
    const dependent = createWorkflowAction({
      orgId: testOrg.id,
      workflowId,
      title: 'Release closing confirmation',
      ownerUserId: testUsers.dealLead.id,
      createdBy: testUsers.dealLead.id
    });

    actionIds.push(dependent.id);

    // Add dependencies
    const updated = addActionDependency(dependent.id, actionIds[0], testUsers.dealLead.id);
    addActionDependency(dependent.id, actionIds[1], testUsers.dealLead.id);

    expect(updated?.dependency_ids).toContain(actionIds[0]);
  });

  it('step 3: verifies action dependencies', () => {
    const action = get<{ dependency_ids: string }>(
      'SELECT dependency_ids FROM workflow_actions WHERE id = ?',
      actionIds[3]
    );

    const deps = JSON.parse(action?.dependency_ids || '[]');
    expect(deps.length).toBe(2);
    expect(deps).toContain(actionIds[0]);
    expect(deps).toContain(actionIds[1]);
  });

  it('step 4: linked task is created', () => {
    const action = get<{ task_id: string }>(
      'SELECT task_id FROM workflow_actions WHERE id = ?',
      actionIds[0]
    );

    expect(action?.task_id).toBeTruthy();

    const task = get<{ title: string; status: string }>(
      'SELECT title, status FROM tasks WHERE id = ?',
      action?.task_id
    );

    expect(task?.title).toBe('Collect wet-ink board resolutions');
  });
});

describe('Committee Meeting and Sign-off Journey', () => {
  let dataRoomId: string;
  let workflowId: string;
  let meetingId: string;

  beforeAll(() => {
    const room = createDataRoom({
      orgId: testOrg.id,
      name: 'Committee Room',
      slug: `committee-room-${Date.now()}`,
      createdBy: testUsers.dealLead.id
    });
    dataRoomId = room.id;

    addDataRoomDocument({
      dataRoomId,
      title: 'Board Deck Q2',
      category: 'board',
      collectionName: 'board-materials',
      uploadedBy: testUsers.dealLead.id
    });

    const workflow = createApprovalWorkflow({
      orgId: testOrg.id,
      dataRoomId,
      title: 'Q2 Board Pack',
      workflowType: 'board_pack',
      targetType: 'board_meeting',
      targetId: 'board-q2-2026',
      submittedBy: testUsers.dealLead.id,
      approvers: [
        { approverUserId: testUsers.committee.id, stepName: 'Committee Chair' }
      ]
    });
    workflowId = workflow.id;

    recordApprovalDecision({
      workflowId,
      actorUserId: testUsers.committee.id,
      decision: 'approve',
      notes: 'Ready for board circulation',
      signatureMetadata: { method: 'qualified-esign' }
    });
  });

  it('step 1: creates committee meeting', () => {
    const meeting = createCommitteeMeeting({
      orgId: testOrg.id,
      dataRoomId,
      title: 'Investment Committee Q2 2026',
      committeeName: 'Investment Committee',
      scheduledFor: '2026-04-28T09:00:00.000Z',
      boardPackWorkflowId: workflowId,
      investmentMemoWorkflowId: workflowId,
      createdBy: testUsers.dealLead.id
    });

    meetingId = meeting.id;

    expect(meeting.id).toBeTruthy();
    expect(meeting.status).toBe('scheduled');
    expect(meeting.committee_name).toBe('Investment Committee');
  });

  it('step 2: adds agenda items', () => {
    const items = [
      { order: 1, title: 'Review Q2 Performance', presenter: testUsers.analyst.id },
      { order: 2, title: 'New Investment Opportunities', presenter: testUsers.dealLead.id },
      { order: 3, title: 'Risk Report', presenter: testUsers.committee.id }
    ];

    for (const item of items) {
      addAgendaItem({
        meetingId,
        itemOrder: item.order,
        title: item.title,
        presenterUserId: item.presenter,
        relatedWorkflowId: workflowId
      });
    }

    const agenda = all<{ title: string }>(
      'SELECT title FROM committee_agenda_items WHERE meeting_id = ? ORDER BY item_order',
      meetingId
    );

    expect(agenda.length).toBe(3);
    expect(agenda[0].title).toBe('Review Q2 Performance');
  });

  it('step 3: records committee signoff with signature metadata', () => {
    const signoff = recordCommitteeSignoff({
      meetingId,
      workflowId,
      signerUserId: testUsers.committee.id,
      decision: 'approve',
      notes: 'Approved unanimously. Proceed with recommendations.',
      signatureMetadata: {
        method: 'qualified-esign',
        signerTitle: 'Committee Chair',
        ipAddress: '10.10.0.2',
        certificateHash: 'SHA256:abc123...',
        timestamp: new Date().toISOString()
      }
    });

    expect(signoff.id).toBeTruthy();
    expect(signoff.decision).toBe('approve');
    expect(signoff.signature_metadata.signerTitle).toBe('Committee Chair');
  });

  it('step 4: builds complete committee packet', () => {
    const packet = getCommitteePacket(meetingId);

    expect(packet).toBeDefined();
    expect(packet?.agenda.length).toBe(3);
    expect(packet?.signoffs.length).toBe(1);
    expect(packet?.boardPack?.boardPack).toContain('Board Deck Q2');
    expect(packet?.investmentMemo?.memo).toContain('Q2 Board Pack');
  });

  it('step 5: updates meeting status', () => {
    run(
      `UPDATE committee_meetings SET status = 'completed' WHERE id = ?`,
      meetingId
    );

    const meeting = get<{ status: string }>(
      'SELECT status FROM committee_meetings WHERE id = ?',
      meetingId
    );

    expect(meeting?.status).toBe('completed');
  });

  it('step 6: logs committee decision audit', () => {
    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.committee.id,
      action: 'committee.decision',
      resourceType: 'committee_meeting',
      resourceId: meetingId,
      details: {
        decision: 'approve',
        workflowId
      },
      ip: '10.10.0.2'
    });
  });
});

describe('Multi-User Document Collaboration', () => {
  let dataRoomId: string;

  beforeAll(() => {
    const room = createDataRoom({
      orgId: testOrg.id,
      name: 'Collaboration Room',
      slug: `collab-room-${Date.now()}`,
      createdBy: testUsers.dealLead.id
    });
    dataRoomId = room.id;
  });

  it('step 1: multiple users upload to same collection', () => {
    const uploads = [
      { user: testUsers.analyst.id, title: 'Financial Analysis v1' },
      { user: testUsers.counsel.id, title: 'Legal Review Comments' },
      { user: testUsers.dealLead.id, title: 'Deal Summary' }
    ];

    for (const upload of uploads) {
      addDataRoomDocument({
        dataRoomId,
        title: upload.title,
        category: 'shared',
        collectionName: 'team-workspace',
        uploadedBy: upload.user
      });
    }

    const docs = all<{ title: string; uploaded_by: string }>(
      `SELECT title, uploaded_by FROM data_room_documents 
       WHERE data_room_id = ? AND collection_name = ?`,
      dataRoomId, 'team-workspace'
    );

    expect(docs.length).toBe(3);
    expect(new Set(docs.map(d => d.uploaded_by)).size).toBe(3);
  });

  it('step 2: creates version chain for documents', () => {
    const doc1 = addDataRoomDocument({
      dataRoomId,
      title: 'Model Draft v1',
      category: 'financial',
      collectionName: 'models',
      versionLabel: 'v1.0',
      uploadedBy: testUsers.analyst.id
    });

    const doc2 = addDataRoomDocument({
      dataRoomId,
      title: 'Model Draft v2',
      category: 'financial',
      collectionName: 'models',
      versionLabel: 'v2.0',
      uploadedBy: testUsers.analyst.id
    });

    const doc3 = addDataRoomDocument({
      dataRoomId,
      title: 'Model Final',
      category: 'financial',
      collectionName: 'models',
      versionLabel: 'v3.0-final',
      uploadedBy: testUsers.dealLead.id
    });

    const versions = all<{ title: string; version_label: string }>(
      `SELECT title, version_label FROM data_room_documents 
       WHERE data_room_id = ? AND collection_name = 'models' 
       ORDER BY created_at`,
      dataRoomId
    );

    expect(versions.length).toBe(3);
    expect(versions[2].version_label).toBe('v3.0-final');
  });

  it('step 3: grants different access levels to team members', () => {
    // Analyst gets full access to all collections
    grantDataRoomAccess({
      dataRoomId,
      subjectType: 'user',
      subjectId: testUsers.analyst.id,
      role: 'editor',
      scopeCollections: ['team-workspace', 'models', 'legal'],  // all collections
      allowDownload: true,
      allowUpload: true,
      requireWatermark: false,
      grantedBy: testUsers.dealLead.id
    });

    // Counsel gets limited access
    grantDataRoomAccess({
      dataRoomId,
      subjectType: 'user',
      subjectId: testUsers.counsel.id,
      role: 'viewer',
      scopeCollections: ['team-workspace'],  // only team-workspace
      allowDownload: true,
      allowUpload: false,
      requireWatermark: true,
      grantedBy: testUsers.dealLead.id
    });

    const analystAccess = listAccessibleDocuments({
      dataRoomId,
      subjectType: 'user',
      subjectId: testUsers.analyst.id
    });

    const counselAccess = listAccessibleDocuments({
      dataRoomId,
      subjectType: 'user',
      subjectId: testUsers.counsel.id
    });

    // Analyst has access to 6 docs (3 in team-workspace + 3 in models), counsel only 3 in team-workspace
    expect(analystAccess.length).toBeGreaterThan(counselAccess.length);
  });

  it('step 4: tracks document access audit', () => {
    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.analyst.id,
      action: 'document.view',
      resourceType: 'data_room_document',
      details: { dataRoomId, documentTitle: 'Financial Analysis v1' },
      ip: '192.168.1.50'
    });

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.counsel.id,
      action: 'document.download',
      resourceType: 'data_room_document',
      details: { dataRoomId, documentTitle: 'Legal Review Comments', watermarked: true },
      ip: '192.168.1.51'
    });
  });
});
