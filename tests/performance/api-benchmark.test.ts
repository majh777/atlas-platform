/**
 * API Response Time Benchmarks
 * Target: Sub-100ms API responses
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, closeDb, run } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { createTask, queryTasks, updateTask } from '@/lib/services/tasks';
import { queryAuditLogs, writeAuditLog } from '@/lib/services/audit';
import { 
  createDataRoom, 
  listDataRooms, 
  addDataRoomDocument,
  listDataRoomDocuments,
  getDataRoomSnapshot 
} from '@/lib/services/data-room';
import { 
  createDiligenceQuestion,
  createApprovalWorkflow,
  listDiligenceQuestions,
  recordApprovalDecision
} from '@/lib/services/workflows';

function benchmark<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

describe('Service Layer Performance', () => {
  const testOrgId = randomUUID();
  const testUserId = randomUUID();
  const testWorkspaceId = randomUUID();

  beforeAll(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDb();

    // Create test user
    run(
      'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      testUserId,
      'perf-test@example.com',
      'hash',
      'Perf Tester'
    );

    // Seed substantial data for realistic benchmarks
    for (let i = 0; i < 500; i++) {
      run(
        `INSERT INTO tasks (id, org_id, workspace_id, assigned_to, title, status, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${i} minutes'), datetime('now'))`,
        randomUUID(),
        testOrgId,
        testWorkspaceId,
        testUserId,
        `Seeded Task ${i}`,
        ['pending', 'in_progress', 'completed', 'cancelled'][i % 4],
        ['low', 'medium', 'high', 'urgent'][i % 4]
      );
    }
  });

  afterAll(() => {
    closeDb();
  });

  describe('Task Service', () => {
    it('createTask should be < 15ms', () => {
      const { durationMs, result } = benchmark(() =>
        createTask({
          orgId: testOrgId,
          workspaceId: testWorkspaceId,
          title: 'Benchmark task',
          description: 'Created for performance testing',
          assignedTo: testUserId,
          createdBy: testUserId,
          priority: 'high',
        })
      );

      expect(result.id).toBeDefined();
      expect(durationMs).toBeLessThan(15);
    });

    it('queryTasks with filters should be < 25ms', () => {
      const { durationMs, result } = benchmark(() =>
        queryTasks({
          orgId: testOrgId,
          workspaceId: testWorkspaceId,
          status: 'pending',
          limit: 50,
          offset: 0,
        })
      );

      expect(result.data.length).toBeLessThanOrEqual(50);
      expect(durationMs).toBeLessThan(25);
    });

    it('queryTasks with pagination should be < 30ms', () => {
      const { durationMs } = benchmark(() =>
        queryTasks({
          orgId: testOrgId,
          limit: 20,
          offset: 100,
        })
      );

      expect(durationMs).toBeLessThan(30);
    });

    it('updateTask should be < 10ms', () => {
      const task = createTask({
        orgId: testOrgId,
        title: 'Task to update',
        createdBy: testUserId,
      });

      const { durationMs, result } = benchmark(() =>
        updateTask(task.id, { status: 'completed' })
      );

      expect(result?.status).toBe('completed');
      expect(durationMs).toBeLessThan(10);
    });
  });

  describe('Audit Log Service', () => {
    beforeAll(() => {
      // Seed audit logs
      for (let i = 0; i < 1000; i++) {
        run(
          `INSERT INTO audit_logs (id, org_id, user_id, action, created_at)
           VALUES (?, ?, ?, ?, datetime('now', '-${i} seconds'))`,
          randomUUID(),
          testOrgId,
          testUserId,
          ['user.login', 'task.create', 'task.update', 'export.generate'][i % 4]
        );
      }
    });

    it('writeAuditLog should be < 10ms', () => {
      const { durationMs } = benchmark(() =>
        writeAuditLog({
          orgId: testOrgId,
          userId: testUserId,
          action: 'task.create',
          resourceType: 'task',
          resourceId: randomUUID(),
          details: { source: 'benchmark' },
        })
      );

      expect(durationMs).toBeLessThan(10);
    });

    it('queryAuditLogs on 1000+ records should be < 50ms', () => {
      const { durationMs, result } = benchmark(() =>
        queryAuditLogs({
          orgId: testOrgId,
          limit: 100,
          offset: 0,
        })
      );

      expect(result.data.length).toBeLessThanOrEqual(100);
      expect(durationMs).toBeLessThan(50);
    });

    it('queryAuditLogs with date filter should use index, < 30ms', () => {
      const { durationMs } = benchmark(() =>
        queryAuditLogs({
          orgId: testOrgId,
          from: new Date(Date.now() - 3600000).toISOString(),
          limit: 50,
        })
      );

      expect(durationMs).toBeLessThan(30);
    });
  });

  describe('Data Room Service', () => {
    let testDataRoomId: string;

    beforeAll(() => {
      const room = createDataRoom({
        orgId: testOrgId,
        workspaceId: testWorkspaceId,
        name: 'Benchmark Data Room',
        slug: 'benchmark-room',
        createdBy: testUserId,
      });
      testDataRoomId = room.id;

      // Seed documents
      const collections = ['financials', 'legal', 'technical', 'environmental'];
      for (let i = 0; i < 200; i++) {
        addDataRoomDocument({
          dataRoomId: testDataRoomId,
          title: `Document ${i}`,
          category: 'report',
          collectionName: collections[i % collections.length],
          uploadedBy: testUserId,
          tags: ['benchmark', `batch-${Math.floor(i / 50)}`],
        });
      }
    });

    it('createDataRoom should be < 20ms', () => {
      const { durationMs, result } = benchmark(() =>
        createDataRoom({
          orgId: testOrgId,
          name: 'New Room',
          slug: `room-${randomUUID().slice(0, 8)}`,
          createdBy: testUserId,
        })
      );

      expect(result.id).toBeDefined();
      expect(durationMs).toBeLessThan(20);
    });

    it('listDataRooms should be < 15ms', () => {
      const { durationMs } = benchmark(() =>
        listDataRooms({ orgId: testOrgId })
      );

      expect(durationMs).toBeLessThan(15);
    });

    it('listDataRoomDocuments (200 docs) should be < 25ms', () => {
      const { durationMs, result } = benchmark(() =>
        listDataRoomDocuments(testDataRoomId)
      );

      expect(result.length).toBe(200);
      expect(durationMs).toBeLessThan(25);
    });

    it('listDataRoomDocuments by collection should be < 15ms', () => {
      const { durationMs } = benchmark(() =>
        listDataRoomDocuments(testDataRoomId, 'financials')
      );

      expect(durationMs).toBeLessThan(15);
    });

    it('getDataRoomSnapshot should be < 50ms', () => {
      const { durationMs, result } = benchmark(() =>
        getDataRoomSnapshot(testDataRoomId)
      );

      expect(result).not.toBeNull();
      expect(result!.documents.length).toBe(200);
      expect(durationMs).toBeLessThan(50);
    });
  });

  describe('Workflow Service', () => {
    let testDataRoomId: string;

    beforeAll(() => {
      const room = createDataRoom({
        orgId: testOrgId,
        name: 'Workflow Test Room',
        slug: `workflow-room-${randomUUID().slice(0, 8)}`,
        createdBy: testUserId,
      });
      testDataRoomId = room.id;

      // Seed diligence questions
      for (let i = 0; i < 100; i++) {
        createDiligenceQuestion({
          orgId: testOrgId,
          dataRoomId: testDataRoomId,
          question: `Question ${i}?`,
          priority: ['low', 'medium', 'high', 'critical'][i % 4] as 'low' | 'medium' | 'high' | 'critical',
          ownerUserId: testUserId,
          askedBy: testUserId,
        });
      }
    });

    it('createDiligenceQuestion should be < 15ms', () => {
      const { durationMs } = benchmark(() =>
        createDiligenceQuestion({
          orgId: testOrgId,
          dataRoomId: testDataRoomId,
          question: 'Benchmark question?',
          priority: 'high',
          ownerUserId: testUserId,
        })
      );

      expect(durationMs).toBeLessThan(15);
    });

    it('listDiligenceQuestions should be < 30ms', () => {
      const { durationMs, result } = benchmark(() =>
        listDiligenceQuestions({ orgId: testOrgId, dataRoomId: testDataRoomId })
      );

      expect(result.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(30);
    });

    it('createApprovalWorkflow with 3 steps should be < 25ms', () => {
      const { durationMs, result } = benchmark(() =>
        createApprovalWorkflow({
          orgId: testOrgId,
          dataRoomId: testDataRoomId,
          title: 'Benchmark Approval',
          workflowType: 'investment_memo',
          targetType: 'deal',
          targetId: randomUUID(),
          submittedBy: testUserId,
          approvers: [
            { stepName: 'Legal Review', approverUserId: testUserId },
            { stepName: 'Finance Review', approverUserId: testUserId },
            { stepName: 'Final Approval', approverUserId: testUserId },
          ],
        })
      );

      expect(result.id).toBeDefined();
      expect(durationMs).toBeLessThan(25);
    });

    it('recordApprovalDecision should be < 20ms', () => {
      const workflow = createApprovalWorkflow({
        orgId: testOrgId,
        title: 'Quick Approval',
        workflowType: 'signoff',
        targetType: 'document',
        targetId: randomUUID(),
        approvers: [{ stepName: 'Sign off' }],
      });

      const { durationMs, result } = benchmark(() =>
        recordApprovalDecision({
          workflowId: workflow.id,
          actorUserId: testUserId,
          decision: 'approve',
          notes: 'Approved via benchmark',
        })
      );

      expect(result?.status).toBe('approved');
      expect(durationMs).toBeLessThan(20);
    });
  });
});

describe('Large Dataset Performance', () => {
  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    initDb();

    // Seed very large dataset
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const insertTask = db.prepare(
      `INSERT INTO tasks (id, org_id, title, status, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    );

    const orgId = 'large-dataset-org';
    
    const seedTransaction = db.transaction(() => {
      for (let i = 0; i < 5000; i++) {
        insertTask.run(
          randomUUID(),
          orgId,
          `Large dataset task ${i}`,
          ['pending', 'in_progress', 'completed'][i % 3],
          ['low', 'medium', 'high'][i % 3]
        );
      }
    });

    seedTransaction();
  });

  afterAll(() => {
    closeDb();
  });

  it('should handle 5000 record query with pagination < 100ms', () => {
    const { durationMs, result } = benchmark(() =>
      queryTasks({
        orgId: 'large-dataset-org',
        limit: 100,
        offset: 2500,
      })
    );

    expect(result.data.length).toBeLessThanOrEqual(100);
    expect(result.total).toBe(5000);
    expect(durationMs).toBeLessThan(100);
  });

  it('should handle count on 5000 records < 50ms', () => {
    const { durationMs, result } = benchmark(() =>
      queryTasks({
        orgId: 'large-dataset-org',
        limit: 1,
      })
    );

    expect(result.total).toBe(5000);
    expect(durationMs).toBeLessThan(50);
  });
});
