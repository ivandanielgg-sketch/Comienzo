(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SessionDrafts = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
  var STORAGE_PREFIX = 'cp:draft:v1:';
  var FORM_TYPES = ['project_edit', 'payment_new', 'cost_new'];
  var SENSITIVE_KEY_RE = /password|token|secret|cookie|sess|authorization|api[_-]?key/i;

  function isFormType(formType) {
    return FORM_TYPES.indexOf(formType) !== -1;
  }

  function storageKey(userId, projectId, formType) {
    return STORAGE_PREFIX + String(userId) + ':' + String(projectId) + ':' + String(formType);
  }

  function sanitizeValue(value) {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (typeof value === 'object') return sanitizeDraftPayload(value);
    return value;
  }

  function sanitizeDraftPayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    var clean = {};
    Object.keys(payload).forEach(function (key) {
      if (SENSITIVE_KEY_RE.test(key)) return;
      clean[key] = sanitizeValue(payload[key]);
    });
    return clean;
  }

  function isExpired(entry, nowMs) {
    if (!entry || !entry.savedAt) return true;
    var savedAt = Date.parse(entry.savedAt);
    if (!Number.isFinite(savedAt)) return true;
    return (nowMs || Date.now()) - savedAt > DRAFT_TTL_MS;
  }

  function createDraftEntry({ userId, projectId, formType, payload, nowMs }) {
    if (!userId || projectId == null || projectId === '' || !isFormType(formType)) {
      return null;
    }
    return {
      version: 1,
      userId: Number(userId),
      projectId: Number(projectId),
      formType: formType,
      savedAt: new Date(nowMs || Date.now()).toISOString(),
      expiresInMs: DRAFT_TTL_MS,
      payload: sanitizeDraftPayload(payload || {}),
    };
  }

  function saveDraft(storage, options) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    var entry = createDraftEntry(options);
    if (!entry) return false;
    if (!entry.payload || Object.keys(entry.payload).length === 0) {
      removeDraft(storage, entry.userId, entry.projectId, entry.formType);
      return false;
    }
    storage.setItem(storageKey(entry.userId, entry.projectId, entry.formType), JSON.stringify(entry));
    return true;
  }

  function readDraft(storage, userId, projectId, formType, nowMs) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    var raw = storage.getItem(storageKey(userId, projectId, formType));
    if (!raw) return null;
    try {
      var entry = JSON.parse(raw);
      if (!entry || Number(entry.userId) !== Number(userId)) {
        removeDraft(storage, userId, projectId, formType);
        return null;
      }
      if (isExpired(entry, nowMs)) {
        removeDraft(storage, userId, projectId, formType);
        return null;
      }
      entry.payload = sanitizeDraftPayload(entry.payload || {});
      return entry;
    } catch (_err) {
      removeDraft(storage, userId, projectId, formType);
      return null;
    }
  }

  function removeDraft(storage, userId, projectId, formType) {
    if (!storage || typeof storage.removeItem !== 'function') return;
    storage.removeItem(storageKey(userId, projectId, formType));
  }

  function listDraftsForUser(storage, userId, nowMs) {
    if (!storage) return [];
    var drafts = [];
    var prefix = STORAGE_PREFIX + String(userId) + ':';
    for (var i = 0; i < storage.length; i += 1) {
      var key = storage.key(i);
      if (!key || key.indexOf(prefix) !== 0) continue;
      try {
        var entry = JSON.parse(storage.getItem(key));
        if (!entry || Number(entry.userId) !== Number(userId)) {
          storage.removeItem(key);
          continue;
        }
        if (isExpired(entry, nowMs)) {
          storage.removeItem(key);
          continue;
        }
        entry.payload = sanitizeDraftPayload(entry.payload || {});
        drafts.push(entry);
      } catch (_err) {
        storage.removeItem(key);
      }
    }
    return drafts.sort(function (a, b) {
      return String(b.savedAt || '').localeCompare(String(a.savedAt || ''));
    });
  }

  function clearDraftsForUser(storage, userId) {
    if (!storage) return;
    var prefix = STORAGE_PREFIX + String(userId) + ':';
    var keys = [];
    for (var i = 0; i < storage.length; i += 1) {
      var key = storage.key(i);
      if (key && key.indexOf(prefix) === 0) keys.push(key);
    }
    keys.forEach(function (key) { storage.removeItem(key); });
  }

  function clearForeignDrafts(storage, currentUserId) {
    if (!storage) return;
    var keys = [];
    for (var i = 0; i < storage.length; i += 1) {
      var key = storage.key(i);
      if (!key || key.indexOf(STORAGE_PREFIX) !== 0) continue;
      var parts = key.slice(STORAGE_PREFIX.length).split(':');
      var ownerId = parts[0];
      if (String(ownerId) !== String(currentUserId)) keys.push(key);
    }
    keys.forEach(function (key) { storage.removeItem(key); });
  }

  function draftHasContent(payload) {
    if (!payload || typeof payload !== 'object') return false;
    return Object.keys(payload).some(function (key) {
      var value = payload[key];
      if (value == null) return false;
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'number') return Math.abs(value) > 0.000001;
      if (typeof value === 'boolean') return true;
      return true;
    });
  }

  return {
    DRAFT_TTL_MS: DRAFT_TTL_MS,
    FORM_TYPES: FORM_TYPES,
    storageKey: storageKey,
    sanitizeDraftPayload: sanitizeDraftPayload,
    isExpired: isExpired,
    createDraftEntry: createDraftEntry,
    saveDraft: saveDraft,
    readDraft: readDraft,
    removeDraft: removeDraft,
    listDraftsForUser: listDraftsForUser,
    clearDraftsForUser: clearDraftsForUser,
    clearForeignDrafts: clearForeignDrafts,
    draftHasContent: draftHasContent,
  };
});
