import { get } from '@/lib/db';

// ============================================================
// Permission types
// ============================================================

export type Permission =
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:manage_members'
  | 'org:manage_billing'
  | 'org:manage_sso'
  | 'ws:create'
  | 'ws:read'
  | 'ws:update'
  | 'ws:delete'
  | 'ws:manage_members'
  | 'portfolio:create'
  | 'portfolio:read'
  | 'portfolio:update'
  | 'portfolio:delete'
  | 'audit:read'
  | 'audit:export'
  | 'admin:all';

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
export type WorkspaceRole = 'admin' | 'editor' | 'viewer';

// ============================================================
// Organization role permissions
// ============================================================

const ALL_PERMISSIONS: Permission[] = [
  'org:read', 'org:update', 'org:delete',
  'org:manage_members', 'org:manage_billing', 'org:manage_sso',
  'ws:create', 'ws:read', 'ws:update', 'ws:delete', 'ws:manage_members',
  'portfolio:create', 'portfolio:read', 'portfolio:update', 'portfolio:delete',
  'audit:read', 'audit:export', 'admin:all',
];

export const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: ALL_PERMISSIONS,

  admin: [
    'org:read', 'org:update',
    'org:manage_members', 'org:manage_sso',
    'ws:create', 'ws:read', 'ws:update', 'ws:delete', 'ws:manage_members',
    'portfolio:create', 'portfolio:read', 'portfolio:update', 'portfolio:delete',
    'audit:read', 'audit:export',
  ],

  member: [
    'org:read',
    'ws:create', 'ws:read', 'ws:update',
    'portfolio:create', 'portfolio:read', 'portfolio:update',
    'audit:read',
  ],

  viewer: [
    'org:read',
    'ws:read',
    'portfolio:read',
    'audit:read',
  ],

  billing: [
    'org:read',
    'org:manage_billing',
  ],
};

// ============================================================
// Workspace role permissions
// ============================================================

export type WorkspacePermission =
  | 'ws:read'
  | 'ws:update'
  | 'ws:delete'
  | 'ws:manage_members'
  | 'portfolio:create'
  | 'portfolio:read'
  | 'portfolio:update'
  | 'portfolio:delete';

export const WS_ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermission[]> = {
  admin: [
    'ws:read', 'ws:update', 'ws:delete', 'ws:manage_members',
    'portfolio:create', 'portfolio:read', 'portfolio:update', 'portfolio:delete',
  ],

  editor: [
    'ws:read', 'ws:update',
    'portfolio:create', 'portfolio:read', 'portfolio:update',
  ],

  viewer: [
    'ws:read',
    'portfolio:read',
  ],
};

// ============================================================
// Permission checks
// ============================================================

/**
 * Checks whether an organization role grants the specified permission.
 */
export function hasPermission(role: OrgRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Checks whether a workspace role grants the specified permission.
 */
export function hasWorkspacePermission(wsRole: WorkspaceRole, permission: WorkspacePermission): boolean {
  const permissions = WS_ROLE_PERMISSIONS[wsRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

// ============================================================
// Database lookups
// ============================================================

/**
 * Returns the user's role within an organization, or null if not a member.
 */
export function getUserOrgRole(userId: string, orgId: string): OrgRole | null {
  const row = get<{ role: OrgRole }>(
    `SELECT role FROM org_members WHERE user_id = ? AND org_id = ?`,
    userId, orgId
  );
  return row?.role ?? null;
}

/**
 * Returns the user's role within a workspace, or null if not a member.
 */
export function getUserWorkspaceRole(userId: string, workspaceId: string): WorkspaceRole | null {
  const row = get<{ role: WorkspaceRole }>(
    `SELECT role FROM workspace_members WHERE user_id = ? AND workspace_id = ?`,
    userId, workspaceId
  );
  return row?.role ?? null;
}
