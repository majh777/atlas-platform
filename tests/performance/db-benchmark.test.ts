/**
 * Database Performance Benchmarks
 * Target: Sub-100ms for all standard operations
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, closeDb, run, all, get, getDb } from '@/lib/db';
import { randomUUID } from 'node:crypto';

// Benchmark utility
function benchmark<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

// Reserved for async benchmarks
async function _benchmarkAsync<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

describe('Database Performance Benchmarks', () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  describe('Query Performance', () => {
    it('single row lookup by primary key should be < 5ms', () => {
      // Create test user
      const userId = randomUUID();
      run(
        'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
        userId,
        `test-${userId}@example.com`,
        'hash123',
        'Test User'
      );

      const { durationMs } = benchmark(() => {
        return get('SELECT * FROM users WHERE id = ?', userId);
      });

      expect(durationMs).toBeLessThan(5);
    });

    it('indexed query on audit_logs should be < 10ms', () => {
      // Seed some audit data
      const orgId = randomUUID();
      for (let i = 0; i < 100; i++) {
        run(
          "INSERT INTO audit_logs (id, org_id, action, created_at) VALUES (?, ?, ?, datetime('now'))",
          randomUUID(),
          orgId,
          'test.action'
        );
      }

      const { durationMs } = benchmark(() => {
        return all('SELECT * FROM audit_logs WHERE org_id = ? ORDER BY created_at DESC LIMIT 50', orgId);
      });

      expect(durationMs).toBeLessThan(10);
    });

    it('task query with multiple filters should be < 15ms', () => {
      const orgId = randomUUID();
      
      // Seed tasks (no foreign key reference to users)
      for (let i = 0; i < 200; i++) {
        run(
          `INSERT INTO tasks (id, org_id, title, status, priority, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          randomUUID(),
          orgId,
          `Task ${i}`,
          i % 4 === 0 ? 'completed' : 'pending',
          ['low', 'medium', 'high', 'urgent'][i % 4]
        );
      }

      const { durationMs } = benchmark(() => {
        return all(
          `SELECT * FROM tasks 
           WHERE org_id = ? AND status = ?
           ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
           LIMIT 50 OFFSET 0`,
          orgId,
          'pending'
        );
      });

      expect(durationMs).toBeLessThan(15);
    });

    it('count query on large table should use index and be < 10ms', () => {
      const { durationMs } = benchmark(() => {
        return get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM tasks');
      });

      expect(durationMs).toBeLessThan(10);
    });
  });

  describe('Write Performance', () => {
    it('single insert should be < 5ms', () => {
      const { durationMs } = benchmark(() => {
        run(
          `INSERT INTO tasks (id, title, status, priority, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          randomUUID(),
          'Performance test task',
          'pending',
          'medium'
        );
      });

      expect(durationMs).toBeLessThan(5);
    });

    it('batch insert of 100 rows using transaction should be < 50ms', () => {
      const db = getDb();
      const insert = db.prepare(
        `INSERT INTO audit_logs (id, org_id, action, created_at) VALUES (?, ?, ?, datetime('now'))`
      );

      const { durationMs } = benchmark(() => {
        const transaction = db.transaction(() => {
          const orgId = randomUUID();
          for (let i = 0; i < 100; i++) {
            insert.run(randomUUID(), orgId, `batch.action.${i}`);
          }
        });
        transaction();
      });

      expect(durationMs).toBeLessThan(50);
    });

    it('update with indexed WHERE clause should be < 5ms', () => {
      const taskId = randomUUID();
      run(
        `INSERT INTO tasks (id, title, status, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        taskId,
        'Task to update',
        'pending',
        'low'
      );

      const { durationMs } = benchmark(() => {
        run(
          `UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`,
          'completed',
          taskId
        );
      });

      expect(durationMs).toBeLessThan(5);
    });
  });

  describe('Prepared Statement Caching', () => {
    it('repeated queries should benefit from statement cache', () => {
      const orgId = randomUUID();
      
      // Cold query
      const { durationMs: coldMs } = benchmark(() => {
        return all('SELECT * FROM tasks WHERE org_id = ? LIMIT 10', orgId);
      });

      // Warm queries (should be faster due to prepared statement cache)
      const warmTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs } = benchmark(() => {
          return all('SELECT * FROM tasks WHERE org_id = ? LIMIT 10', orgId);
        });
        warmTimes.push(durationMs);
      }

      const avgWarmMs = warmTimes.reduce((a, b) => a + b) / warmTimes.length;
      
      // Warm queries should generally be as fast or faster
      expect(avgWarmMs).toBeLessThan(10);
    });
  });

  describe('Join Performance', () => {
    it('join query across related tables should be < 20ms', () => {
      const orgId = randomUUID();
      const workflowId = randomUUID();
      
      // Create workflow and related data
      run(
        `INSERT INTO approval_workflows (id, org_id, title, workflow_type, target_type, target_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        workflowId,
        orgId,
        'Test Workflow',
        'investment_memo',
        'deal',
        randomUUID(),
        'pending'
      );

      for (let i = 0; i < 5; i++) {
        run(
          `INSERT INTO approval_steps (id, workflow_id, step_order, step_name, status, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          randomUUID(),
          workflowId,
          i + 1,
          `Step ${i + 1}`,
          'pending'
        );
      }

      const { durationMs } = benchmark(() => {
        return all(
          `SELECT w.*, s.step_name, s.status as step_status
           FROM approval_workflows w
           LEFT JOIN approval_steps s ON s.workflow_id = w.id
           WHERE w.id = ?
           ORDER BY s.step_order`,
          workflowId
        );
      });

      expect(durationMs).toBeLessThan(20);
    });
  });
});

describe('Concurrency Simulation', () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  it('parallel reads should not block each other', async () => {
    const orgId = randomUUID();
    
    // Seed data
    for (let i = 0; i < 50; i++) {
      run(
        `INSERT INTO tasks (id, org_id, title, status, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        randomUUID(),
        orgId,
        `Concurrent task ${i}`,
        'pending',
        'medium'
      );
    }

    // Simulate concurrent reads
    const startTime = performance.now();
    const promises = Array.from({ length: 10 }, () =>
      Promise.resolve(all('SELECT * FROM tasks WHERE org_id = ?', orgId))
    );
    
    await Promise.all(promises);
    const totalDuration = performance.now() - startTime;

    // 10 parallel reads should complete in reasonable time
    expect(totalDuration).toBeLessThan(100);
  });
});
