const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('modal overlay allows vertical scroll', () => {
  assert.match(styles, /\.modal-overlay\s*\{[^}]*overflow-y:\s*auto/s);
  assert.doesNotMatch(styles, /\.modal-overlay\s*\{[^}]*align-items:\s*center/s);
});

test('mobile inputs use 16px font and 44px touch targets', () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*font-size:\s*16px[\s\S]*min-height:\s*44px/);
});

test('report and attendance forms marked for mobile', () => {
  assert.match(indexHtml, /id="report-form"[^>]*class="[^"]*mobile-form/);
  assert.match(indexHtml, /id="attendance-new-form"[^>]*class="[^"]*mobile-form/);
});

test('focus scroll-into-view helper is registered', () => {
  assert.match(appJs, /initMobileFormScrollIntoView/);
  assert.match(appJs, /scrollIntoView\(\{ block: 'center'/);
});
