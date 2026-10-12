(function projectWorkspaceModule(global) {
  'use strict';

  var STORAGE_KEY = 'cp:projects-ui-mode:v1';
  var MODE_WORKSPACE = 'workspace';
  var MODE_LEGACY = 'legacy';

  function readStoredMode() {
    try {
      var value = global.sessionStorage && global.sessionStorage.getItem(STORAGE_KEY);
      if (value === MODE_LEGACY) return MODE_LEGACY;
    } catch (_err) {
      /* ignore */
    }
    return MODE_WORKSPACE;
  }

  function writeStoredMode(mode) {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(STORAGE_KEY, mode);
      }
    } catch (_err) {
      /* ignore */
    }
  }

  function isWorkspaceMode() {
    return readStoredMode() === MODE_WORKSPACE;
  }

  function setWorkspaceMode(enabled) {
    writeStoredMode(enabled ? MODE_WORKSPACE : MODE_LEGACY);
  }

  function moveNode(node, host) {
    if (!node || !host) return;
    if (node.parentElement === host) return;
    host.appendChild(node);
  }

  function applyHosts(mode) {
    var formBlock = document.getElementById('project-form-block');
    var paymentsSection = document.getElementById('payments-section');
    var costsSection = document.getElementById('costs-section');
    var reportsSection = document.getElementById('detail-reports-section');

    var legacyFormHost = document.getElementById('project-form-legacy-host');
    var workspaceFormHost = document.getElementById('project-form-workspace-host');
    var paymentsLegacyHost = document.getElementById('payments-drawer-host');
    var paymentsWorkspaceHost = document.getElementById('payments-workspace-host');
    var costsLegacyHost = document.getElementById('costs-drawer-host');
    var costsWorkspaceHost = document.getElementById('costs-workspace-host');
    var reportsLegacyHost = document.getElementById('reports-drawer-host');
    var reportsWorkspaceHost = document.getElementById('reports-workspace-host');

    if (mode === MODE_WORKSPACE) {
      moveNode(formBlock, workspaceFormHost);
      moveNode(paymentsSection, paymentsWorkspaceHost);
      moveNode(costsSection, costsWorkspaceHost);
      moveNode(reportsSection, reportsWorkspaceHost);
    } else {
      moveNode(formBlock, legacyFormHost);
      moveNode(paymentsSection, paymentsLegacyHost);
      moveNode(costsSection, costsLegacyHost);
      moveNode(reportsSection, reportsLegacyHost);
    }
  }

  function applyDocumentMode(mode, workspaceOpen) {
    var body = document.body;
    if (!body) return;
    body.classList.toggle('projects-ui-workspace', mode === MODE_WORKSPACE);
    body.classList.toggle('projects-ui-legacy', mode === MODE_LEGACY);
    body.classList.toggle('projects-workspace-open', mode === MODE_WORKSPACE && Boolean(workspaceOpen));

    var listLevel = document.getElementById('projects-list-level');
    var workspace = document.getElementById('project-workspace');
    var drawer = document.getElementById('project-detail-drawer');
    var toggle = document.getElementById('projects-workspace-mode-toggle');

    if (toggle) toggle.checked = mode === MODE_WORKSPACE;

    if (listLevel) {
      listLevel.classList.toggle('hidden', mode === MODE_WORKSPACE && Boolean(workspaceOpen));
    }
    if (workspace) {
      var showWs = mode === MODE_WORKSPACE && Boolean(workspaceOpen);
      workspace.classList.toggle('hidden', !showWs);
      workspace.setAttribute('aria-hidden', showWs ? 'false' : 'true');
    }
    if (drawer && mode === MODE_WORKSPACE) {
      drawer.classList.add('hidden');
      drawer.setAttribute('aria-hidden', 'true');
    }

    applyHosts(mode);
  }

  function serializeForm(form) {
    if (!form) return '';
    var data = new FormData(form);
    var parts = [];
    data.forEach(function each(value, key) {
      parts.push(key + '=' + String(value));
    });
    // Include unchecked checkboxes relevant to project billing.
    ['purchase_order_not_applicable', 'invoice_date_na', 'credit_days_na'].forEach(function box(name) {
      var el = form.elements[name];
      if (el && el.type === 'checkbox') {
        parts.push(name + '=' + (el.checked ? '1' : '0'));
      }
    });
    parts.sort();
    return parts.join('&');
  }

  global.ProjectWorkspace = {
    STORAGE_KEY: STORAGE_KEY,
    MODE_WORKSPACE: MODE_WORKSPACE,
    MODE_LEGACY: MODE_LEGACY,
    isWorkspaceMode: isWorkspaceMode,
    setWorkspaceMode: setWorkspaceMode,
    applyDocumentMode: applyDocumentMode,
    applyHosts: applyHosts,
    serializeForm: serializeForm,
  };
})(typeof window !== 'undefined' ? window : globalThis);
