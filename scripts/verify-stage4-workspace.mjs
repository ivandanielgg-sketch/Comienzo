#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appJs = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const workspaceJs = fs.readFileSync(path.join(root, 'public/project-workspace.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

const checks = [
  [/id="project-workspace"/, indexHtml, 'workspace shell'],
  [/id="projects-workspace-mode-toggle"/, indexHtml, 'feature flag toggle'],
  [/data-ws-tab="historial"/, indexHtml, 'historial tab'],
  [/id="project-form-block"/, indexHtml, 'single project form block'],
  [/ProjectWorkspace/, workspaceJs, 'workspace helper module'],
  [/label: 'FACTURADO \(MXN\)'/, appJs, 'FACTURADO column'],
  [/key: 'created_at', label: 'Creacion'/, appJs, 'created_at column'],
  [/function openProjectWorkspace/, appJs, 'open workspace'],
  [/confirmLeaveProjectWorkspace/, appJs, 'dirty leave'],
  [/saveProjectsListPosition/, appJs, 'list scroll snapshot'],
  [/app\.get\('\/api\/projects\/:id\/historial'/, serverJs, 'historial route'],
  [/requirePermission\('projects', 'view'\)/, serverJs, 'historial permission present'],
  [/buildProjectHistorial/, serverJs, 'historial builder wired'],
  [/settlement-preview/, serverJs, 'stage3 preview intact'],
  [/settle-invoice/, serverJs, 'stage3 settle intact'],
  // C1 / M1 / M2 anchors
  [/formDirty[\s\S]{0,80}fillProjectForm/, appJs, 'C1 dirty guard applyProjectListUpdate'],
  [/!isProjectFormDirty\(\)[\s\S]{0,80}fillProjectForm/, appJs, 'C1 dirty guard loadProjects'],
  [/projectDrawerOpen\s*\|\|\s*state\.projectWorkspaceOpen[\s\S]{0,120}renderDetail/, appJs, 'M2 workspace renderDetail'],
  [/function beginHistorialLoad/, appJs, 'M1 historial begin load'],
  [/isHistorialLoadCurrent/, appJs, 'M1 historial token check'],
  [/unchangedSinceSubmit/, appJs, 'C1 save race guard'],
  [/canAccess\('projects', 'create'\)/, appJs, 'M3 create gate'],
  [/SETTLEMENT_PAYMENT_NOTES/, fs.readFileSync(path.join(root, 'src/projectHistorial.js'), 'utf8'), 'M4 settlement notes'],
];

let failed = 0;
for (const [re, source, label] of checks) {
  if (!re.test(source)) {
    console.error('FAIL', label);
    failed += 1;
  } else {
    console.log('OK', label);
  }
}

// Ensure single instances of critical form ids in HTML.
for (const id of ['project-form', 'payment-form', 'cost-form', 'payments-list', 'costs-list']) {
  const count = (indexHtml.match(new RegExp(`id="${id}"`, 'g')) || []).length;
  if (count !== 1) {
    console.error('FAIL unique id', id, 'count=', count);
    failed += 1;
  } else {
    console.log('OK unique id', id);
  }
}

if (failed) {
  console.error(`verify-stage4-workspace failed: ${failed}`);
  process.exit(1);
}
console.log('verify-stage4-workspace OK');
