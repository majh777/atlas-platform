import { all } from '@/lib/db';

// ============================================================
// Types
// ============================================================

export interface AbacUser {
  id: string;
  email: string;
  orgRole?: string;
  wsRole?: string;
  [key: string]: unknown;
}

export interface AbacResource {
  type: string;
  id?: string;
  orgId?: string;
  workspaceId?: string;
  [key: string]: unknown;
}

export interface AbacEnvironment {
  ip?: string;
  time?: string;
  [key: string]: unknown;
}

export interface EvalContext {
  user: AbacUser;
  resource: AbacResource;
  action: string;
  environment: AbacEnvironment;
}

interface AbacPolicyRow {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  resource_type: string | null;
  conditions: string | null;
  actions: string | null;
  effect: 'allow' | 'deny';
  priority: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface AbacResult {
  allowed: boolean;
  matchedPolicy?: string;
}

// ============================================================
// Condition evaluation
// ============================================================

/**
 * Evaluates a flat conditions object against the context.
 * Each key is a dot-path (e.g., "user.orgRole") and value is the expected value.
 * All conditions must match (AND logic).
 */
function matchesConditions(
  conditions: Record<string, unknown>,
  context: EvalContext
): boolean {
  for (const [path, expected] of Object.entries(conditions)) {
    const actual = resolvePath(context, path);
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves a dot-separated path against an object.
 */
function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ============================================================
// Policy evaluation
// ============================================================

/**
 * Evaluates all enabled ABAC policies for an organization against the given context.
 *
 * Evaluation order:
 * 1. If any matching DENY policy exists, access is denied.
 * 2. If any matching ALLOW policy exists, access is allowed.
 * 3. Default: deny.
 */
export function evaluateAbacPolicies(orgId: string, context: EvalContext): AbacResult {
  const rows = all<AbacPolicyRow>(
    `SELECT * FROM abac_policies
     WHERE (org_id = ? OR org_id IS NULL) AND enabled = 1
     ORDER BY priority DESC`,
    orgId
  );

  let allowMatch: string | undefined;

  for (const row of rows) {
    // Check resource type filter
    if (row.resource_type && row.resource_type !== context.resource.type) {
      continue;
    }

    // Check action filter
    if (row.actions) {
      const actions: string[] = JSON.parse(row.actions);
      if (actions.length > 0 && !actions.includes(context.action)) {
        continue;
      }
    }

    // Check conditions
    if (row.conditions) {
      const conditions: Record<string, unknown> = JSON.parse(row.conditions);
      if (!matchesConditions(conditions, context)) {
        continue;
      }
    }

    // Policy matches
    if (row.effect === 'deny') {
      return { allowed: false, matchedPolicy: row.id };
    }

    if (row.effect === 'allow' && !allowMatch) {
      allowMatch = row.id;
    }
  }

  if (allowMatch) {
    return { allowed: true, matchedPolicy: allowMatch };
  }

  return { allowed: false };
}
