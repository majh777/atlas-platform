import './setup-db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { initDb, run } from '@/lib/db';
import { ingestDocuments } from '@/lib/document-intelligence/service';
import { createDataRoom, addDataRoomDocument } from '@/lib/services/data-room';
import { createDiligenceQuestion, createWorkflowAction } from '@/lib/services/workflows';
import { createTask } from '@/lib/services/tasks';
import { generateNarrative, getPromptRegistry, runDiligenceCopilot, semanticSearch, workflowAssistant } from '@/lib/ai/service';

const DOC_PATH = path.join(process.cwd(), 'data', 'document-intelligence.json');
const AI_PATH = path.join(process.cwd(), 'data', 'ai-copilot.json');

beforeAll(() => {
  initDb();
  run(`INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`, 'user-ai', 'user-ai@test.dev', 'hash', 'AI User');
  run(`INSERT OR IGNORE INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)`, 'org-ai', 'Atlas AI Org', 'atlas-ai-org', 'user-ai');
  run(`INSERT OR IGNORE INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, ?)`, 'member-ai', 'org-ai', 'user-ai', 'owner');
});

beforeEach(async () => {
  await fs.rm(DOC_PATH, { force: true });
  await fs.rm(AI_PATH, { force: true });
});

describe('Atlas AI copilots', () => {
  it('returns evidence-grounded semantic search results with citations', async () => {
    await ingestDocuments([
      {
        name: 'Mbalam permit pack',
        source: 'bulk_upload',
        text: [
          'Mining Permit PERMIT-CM-2026-014 for Project Mbalam North',
          'Issued in Cameroon on 2026-01-14 by Mining Authority',
          'Expiry review pending approval and annex B is missing',
          'Counterparty: Panthera Mining Ltd',
        ].join('\n'),
      },
    ]);

    const response = await semanticSearch({ query: 'permit annex missing Cameroon', reviewerMode: 'evidence_only' });
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.answer).toContain('Evidence-grounded answer');
  });

  it('builds narrative outputs with prompt registry versioning and citations', async () => {
    await ingestDocuments([
      {
        name: 'IC memo inputs',
        source: 'bulk_upload',
        text: [
          'Project Kivu copper expansion remains on schedule.',
          'Board approval is pending final environmental annex delivery.',
          'Offtake counterparty requests revised shipping milestones.',
        ].join('\n'),
      },
    ]);

    const response = await generateNarrative({ query: 'board approval annex shipping milestones', templateType: 'board_pack' });
    expect(response.templateId).toBe('ai-narrative-board-pack');
    expect(response.templateVersion).toBe(1);
    expect(response.sections.length).toBe(3);
    expect(response.citations.length).toBeGreaterThan(0);
    expect(getPromptRegistry('narrative')).toHaveLength(3);
  });

  it('spots diligence issues and missing-data prompts from evidence', async () => {
    await ingestDocuments([
      {
        name: 'Diligence package',
        source: 'bulk_upload',
        text: [
          'License LIC-7788 for Project Lobé South',
          'Draft only execution package; pending approval by ministry',
          'Missing annex C and ownership schedule to be provided',
        ].join('\n'),
      },
    ]);

    const response = await runDiligenceCopilot({ query: 'license missing annex approval' });
    expect(response.issues.length).toBeGreaterThan(0);
    expect(response.missingDataPrompts.length).toBeGreaterThan(0);
    expect(response.summary).toContain('Diligence co-pilot');
  });

  it('recommends workflow actions, reminders, analytics, and evaluations', async () => {
    createDataRoom({ orgId: 'org-ai', name: 'AI Room', slug: 'ai-room', createdBy: 'user-ai' });
    const room = createDataRoom({ orgId: 'org-ai', name: 'Review Room', slug: 'review-room', createdBy: 'user-ai' });
    addDataRoomDocument({ dataRoomId: room.id, title: 'Water permit', category: 'permit', collectionName: 'Permits', uploadedBy: 'user-ai' });
    createDiligenceQuestion({ orgId: 'org-ai', question: 'Provide the missing annex package', priority: 'high', askedBy: 'user-ai' });
    createWorkflowAction({ orgId: 'org-ai', title: 'Finalize board pack', createdBy: 'user-ai', ownerUserId: 'user-ai', dueAt: '2026-03-20T00:00:00.000Z' });
    createTask({ orgId: 'org-ai', title: 'Close permit gap', createdBy: 'user-ai', assignedTo: 'user-ai', priority: 'urgent' });

    await semanticSearch({ query: 'permit gap', orgId: 'org-ai' });
    const response = await workflowAssistant({ orgId: 'org-ai', includeEvaluations: true });

    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.analytics.totalCalls).toBeGreaterThan(0);
    expect(response.evaluations?.results.length).toBeGreaterThan(0);
  });
});
