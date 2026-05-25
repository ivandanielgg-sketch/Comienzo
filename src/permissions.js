'use strict';

const MODULES = {
  projects: ['view', 'create', 'edit', 'delete', 'close'],
  closedProjects: ['view', 'delete'],
  reports: ['view', 'create', 'edit', 'delete', 'print'],
  reportsArchive: ['view', 'edit', 'delete', 'print'],
  vacations: ['view', 'create', 'edit', 'delete'],
  attendance: ['view', 'create', 'edit', 'delete', 'print', 'approve', 'reopen'],
  ecovisAccount: ['view', 'create', 'edit', 'cancel'],
  serviceQuoter: ['view', 'configure', 'importCosts'],
  users: ['view', 'create', 'edit', 'managePermissions'],
  backups: ['view', 'backup', 'import'],
  settings: ['view', 'edit'],
};

const DEFAULT_PERMISSIONS = {
  admin: buildFullPermissions(),
  user: {
    projects: ['view', 'create', 'edit'],
    closedProjects: ['view'],
    reports: ['view', 'create', 'edit', 'print'],
    reportsArchive: ['view', 'print'],
    vacations: [],
    attendance: [],
    ecovisAccount: [],
    serviceQuoter: [],
    users: [],
    backups: [],
    settings: ['view'],
  },
  tecnico: {
    projects: [],
    closedProjects: [],
    reports: ['view', 'create', 'edit', 'print'],
    reportsArchive: ['view', 'print'],
    vacations: [],
    attendance: [],
    ecovisAccount: [],
    serviceQuoter: [],
    users: [],
    backups: [],
    settings: [],
  },
};

function buildFullPermissions() {
  const perms = {};
  for (const [mod, actions] of Object.entries(MODULES)) {
    perms[mod] = [...actions];
  }
  return perms;
}

function getDefaultPermissionsForRole(role) {
  return DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.user;
}

function hasPermission(userPermissions, module, action) {
  if (!userPermissions || !userPermissions[module]) return false;
  return userPermissions[module].includes(action);
}

function loadUserPermissions(db, userId, role) {
  const row = db.prepare('SELECT permissions_json FROM user_permissions WHERE user_id = ?').get(userId);
  if (row && row.permissions_json) {
    try {
      return JSON.parse(row.permissions_json);
    } catch {
      return getDefaultPermissionsForRole(role);
    }
  }
  return getDefaultPermissionsForRole(role);
}

function saveUserPermissions(db, userId, permissions) {
  const json = JSON.stringify(permissions);
  const existing = db.prepare('SELECT id FROM user_permissions WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE user_permissions SET permissions_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(json, userId);
  } else {
    db.prepare('INSERT INTO user_permissions (user_id, permissions_json) VALUES (?, ?)').run(userId, json);
  }
}

module.exports = {
  MODULES,
  DEFAULT_PERMISSIONS,
  buildFullPermissions,
  getDefaultPermissionsForRole,
  hasPermission,
  loadUserPermissions,
  saveUserPermissions,
};
