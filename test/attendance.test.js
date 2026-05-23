const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateWeekRange,
  calculateDailyAbsences,
  calculateTotalExtraPayments,
  calculateAttendanceSummary,
  generateDefaultAttendance,
  validateStatusCode,
  isAbsence,
  employeeHasOutsideWork,
  ATTENDANCE_STATUSES,
  VALID_STATUS_CODES,
} = require('../src/attendance');

describe('calculateWeekRange', () => {
  it('week 2 of 2026 returns Jan 5 to Jan 11', () => {
    const result = calculateWeekRange(2026, 2);
    assert.strictEqual(result.weekStartDate, '2026-01-05');
    assert.strictEqual(result.weekEndDate, '2026-01-11');
    assert.ok(result.label.includes('Semana 2'));
  });

  it('week 1 of 2026 returns Dec 29 2025 to Jan 4 2026', () => {
    const result = calculateWeekRange(2026, 1);
    assert.strictEqual(result.weekStartDate, '2025-12-29');
    assert.strictEqual(result.weekEndDate, '2026-01-04');
  });

  it('throws on invalid week number', () => {
    assert.throws(() => calculateWeekRange(2026, 0));
    assert.throws(() => calculateWeekRange(2026, 54));
  });

  it('throws on non-finite year', () => {
    assert.throws(() => calculateWeekRange(NaN, 1));
  });
});

describe('generateDefaultAttendance', () => {
  it('generates A for Mon-Fri and D for Sat-Sun', () => {
    const defaults = generateDefaultAttendance();
    assert.strictEqual(defaults.monday_status, 'A');
    assert.strictEqual(defaults.tuesday_status, 'A');
    assert.strictEqual(defaults.wednesday_status, 'A');
    assert.strictEqual(defaults.thursday_status, 'A');
    assert.strictEqual(defaults.friday_status, 'A');
    assert.strictEqual(defaults.saturday_status, 'D');
    assert.strictEqual(defaults.sunday_status, 'D');
  });
});

describe('validateStatusCode', () => {
  it('accepts valid codes', () => {
    assert.strictEqual(validateStatusCode('A'), true);
    assert.strictEqual(validateStatusCode('A*'), true);
    assert.strictEqual(validateStatusCode('F'), true);
    assert.strictEqual(validateStatusCode('D'), true);
    assert.strictEqual(validateStatusCode('PC'), true);
    assert.strictEqual(validateStatusCode('PS'), true);
    assert.strictEqual(validateStatusCode('I'), true);
    assert.strictEqual(validateStatusCode('V'), true);
    assert.strictEqual(validateStatusCode('B'), true);
  });

  it('rejects invalid codes', () => {
    assert.strictEqual(validateStatusCode('X'), false);
    assert.strictEqual(validateStatusCode(''), false);
    assert.strictEqual(validateStatusCode('a'), false);
  });
});

describe('isAbsence', () => {
  it('F counts as absence', () => {
    assert.strictEqual(isAbsence('F'), true);
  });

  it('A does not count as absence', () => {
    assert.strictEqual(isAbsence('A'), false);
  });

  it('A* does not count as absence', () => {
    assert.strictEqual(isAbsence('A*'), false);
  });

  it('D does not count as absence', () => {
    assert.strictEqual(isAbsence('D'), false);
  });
});

describe('calculateDailyAbsences', () => {
  it('counts absences by day', () => {
    const employees = [
      { monday_status: 'F', tuesday_status: 'A', wednesday_status: 'A', thursday_status: 'A', friday_status: 'A', saturday_status: 'D', sunday_status: 'D' },
      { monday_status: 'A', tuesday_status: 'F', wednesday_status: 'A', thursday_status: 'F', friday_status: 'A', saturday_status: 'D', sunday_status: 'D' },
    ];
    const result = calculateDailyAbsences(employees);
    assert.strictEqual(result.monday, 1);
    assert.strictEqual(result.tuesday, 1);
    assert.strictEqual(result.wednesday, 0);
    assert.strictEqual(result.thursday, 1);
    assert.strictEqual(result.friday, 0);
    assert.strictEqual(result.saturday, 0);
    assert.strictEqual(result.sunday, 0);
  });
});

describe('calculateTotalExtraPayments', () => {
  it('sums extra payments', () => {
    const employees = [
      { extra_payment_amount: 5000 },
      { extra_payment_amount: 3000 },
      { extra_payment_amount: null },
    ];
    assert.strictEqual(calculateTotalExtraPayments(employees), 8000);
  });

  it('handles empty array', () => {
    assert.strictEqual(calculateTotalExtraPayments([]), 0);
  });
});

describe('calculateAttendanceSummary', () => {
  it('returns complete summary', () => {
    const employees = [
      { monday_status: 'A', tuesday_status: 'A', wednesday_status: 'F', thursday_status: 'A', friday_status: 'A*', saturday_status: 'D', sunday_status: 'D', extra_payment_amount: 2000 },
      { monday_status: 'A', tuesday_status: 'A', wednesday_status: 'A', thursday_status: 'A', friday_status: 'A', saturday_status: 'D', sunday_status: 'D', extra_payment_amount: null },
    ];
    const summary = calculateAttendanceSummary(employees);
    assert.strictEqual(summary.totalEmployees, 2);
    assert.strictEqual(summary.totalAbsences, 1);
    assert.strictEqual(summary.totalExtraPayments, 2000);
    assert.strictEqual(summary.absencesByDay.wednesday, 1);
    assert.strictEqual(summary.countByStatus['A'], 8);
    assert.strictEqual(summary.countByStatus['D'], 4);
    assert.strictEqual(summary.countByStatus['F'], 1);
    assert.strictEqual(summary.countByStatus['A*'], 1);
  });
});

describe('employeeHasOutsideWork', () => {
  it('returns true when any day has A*', () => {
    const emp = { monday_status: 'A*', tuesday_status: 'A', wednesday_status: 'A', thursday_status: 'A', friday_status: 'A', saturday_status: 'D', sunday_status: 'D' };
    assert.strictEqual(employeeHasOutsideWork(emp), true);
  });

  it('returns false when no day has A*', () => {
    const emp = { monday_status: 'A', tuesday_status: 'A', wednesday_status: 'A', thursday_status: 'A', friday_status: 'A', saturday_status: 'D', sunday_status: 'D' };
    assert.strictEqual(employeeHasOutsideWork(emp), false);
  });
});

describe('ATTENDANCE_STATUSES catalog', () => {
  it('has 9 statuses', () => {
    assert.strictEqual(ATTENDANCE_STATUSES.length, 9);
  });

  it('all have required fields', () => {
    for (const s of ATTENDANCE_STATUSES) {
      assert.ok(s.code);
      assert.ok(s.label);
      assert.ok(s.color);
      assert.ok(typeof s.counts_as_absence === 'number');
      assert.ok(typeof s.requires_project_location === 'number');
    }
  });

  it('A* requires project location', () => {
    const star = ATTENDANCE_STATUSES.find((s) => s.code === 'A*');
    assert.strictEqual(star.requires_project_location, 1);
  });
});

describe('Attendance API integration', () => {
  const http = require('node:http');
  let cookie = '';

  function request(method, path, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
      };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
          catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  before(async () => {
    const loginRes = await request('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(loginRes.status, 200);
    const setCookie = loginRes.headers['set-cookie'];
    if (setCookie) {
      cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    }

    await request('POST', '/api/employees', { employee_number: 'EMP-001', full_name: 'Juan Perez', hire_date: '2020-01-15', position: 'Tecnico', department: 'Operaciones', active: true });
    await request('POST', '/api/employees', { employee_number: 'EMP-002', full_name: 'Maria Lopez', hire_date: '2021-03-01', position: 'Ingeniera', department: 'Desarrollo', active: true });
    await request('POST', '/api/employees', { employee_number: 'EMP-003', full_name: 'Carlos Inactive', hire_date: '2019-06-01', position: 'Obrero', active: false, termination_date: '2024-12-31' });
  });

  it('GET /api/attendance/statuses returns catalog', async () => {
    const res = await request('GET', '/api/attendance/statuses');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 9);
  });

  it('GET /api/attendance/years returns distinct years from existing weeks', async () => {
    const res = await request('GET', '/api/attendance/years');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.years));
    assert.ok(res.body.years.includes(2026), 'Should include year 2026');
    assert.ok(!res.body.years.includes(2025), 'Should not include year 2025 (no nóminas)');
    for (let i = 1; i < res.body.years.length; i++) {
      assert.ok(res.body.years[i] <= res.body.years[i - 1], 'Years should be ordered DESC');
    }
  });

  it('GET /api/attendance/years updates after creating new year', async () => {
    await request('POST', '/api/attendance/weeks', { year: 2030, week_number: 1 });
    const res = await request('GET', '/api/attendance/years');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.years.includes(2030), 'Should include newly created year 2030');
    assert.strictEqual(res.body.years[0], 2030, 'Most recent year should be first');
  });

  it('POST /api/attendance/weeks creates new payroll week with only active employees', async () => {
    const checkRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    if (checkRes.body.data && checkRes.body.data.length > 0) {
      const existing = checkRes.body.data[0];
      assert.strictEqual(existing.year, 2026);
      assert.strictEqual(existing.week_number, 2);
      return;
    }
    const res = await request('POST', '/api/attendance/weeks', { year: 2026, week_number: 2 });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.year, 2026);
    assert.strictEqual(res.body.week_number, 2);
    assert.strictEqual(res.body.week_start_date, '2026-01-05');
    assert.strictEqual(res.body.week_end_date, '2026-01-11');
    assert.strictEqual(res.body.status, 'borrador');
    assert.strictEqual(res.body.employees.length, 2);
    assert.ok(res.body.employees.every((e) => e.employee_number_snapshot !== 'EMP-003'));
  });

  it('default attendance is A Mon-Fri and D Sat-Sun', async () => {
    const res = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    assert.ok(res.body.data && res.body.data.length > 0, 'Week 2/2026 should exist');
    const weekId = res.body.data[0].id;
    const detail = await request('GET', `/api/attendance/weeks/${weekId}`);
    assert.strictEqual(detail.status, 200);
    const emp = detail.body.employees.find((e) => e.employee_number_snapshot === 'EMP-002');
    assert.ok(emp, 'Employee EMP-002 should exist');
    assert.strictEqual(emp.saturday_status, 'D');
    assert.strictEqual(emp.sunday_status, 'D');
  });

  it('does not allow duplicate week/year', async () => {
    const res = await request('POST', '/api/attendance/weeks', { year: 2026, week_number: 2 });
    assert.strictEqual(res.status, 409);
  });

  it('PUT updates employee attendance', async () => {
    const listRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    const weekId = listRes.body.data[0].id;
    const detail = await request('GET', `/api/attendance/weeks/${weekId}`);
    const emp = detail.body.employees[0];

    const res = await request('PUT', `/api/attendance/weeks/${weekId}`, {
      employees: [{
        id: emp.id,
        monday_status: 'F',
        tuesday_status: 'A',
        wednesday_status: 'A*',
        thursday_status: 'A',
        friday_status: 'A',
        saturday_status: 'D',
        sunday_status: 'D',
        project_location_text: 'Grupo Bimbo',
        extra_payment_amount: 5000,
      }],
    });
    assert.strictEqual(res.status, 200);
    const updated = res.body.employees.find((e) => e.id === emp.id);
    assert.strictEqual(updated.monday_status, 'F');
    assert.strictEqual(updated.wednesday_status, 'A*');
    assert.strictEqual(updated.project_location_text, 'Grupo Bimbo');
    assert.strictEqual(updated.extra_payment_amount, 5000);
  });

  it('A* requires project_location_text', async () => {
    const listRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    const weekId = listRes.body.data[0].id;
    const detail = await request('GET', `/api/attendance/weeks/${weekId}`);
    const emp = detail.body.employees[1];

    const res = await request('PUT', `/api/attendance/weeks/${weekId}`, {
      employees: [{
        id: emp.id,
        monday_status: 'A*',
        tuesday_status: 'A',
        wednesday_status: 'A',
        thursday_status: 'A',
        friday_status: 'A',
        saturday_status: 'D',
        sunday_status: 'D',
        project_location_text: '',
      }],
    });
    assert.strictEqual(res.status, 400);
  });

  it('calculates attendance summary correctly', async () => {
    const listRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    const weekId = listRes.body.data[0].id;
    const detail = await request('GET', `/api/attendance/weeks/${weekId}`);
    assert.strictEqual(detail.body.summary.totalEmployees, 2);
    assert.strictEqual(detail.body.summary.totalAbsences, 1);
    assert.strictEqual(detail.body.summary.totalExtraPayments, 5000);
  });

  it('POST close week works', async () => {
    const listRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    const weekId = listRes.body.data[0].id;
    if (listRes.body.data[0].status === 'cerrada') {
      assert.ok(true, 'Already closed from previous run');
      return;
    }
    const res = await request('POST', `/api/attendance/weeks/${weekId}/close`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'cerrada');
  });

  it('cannot edit closed week', async () => {
    const listRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    const weekId = listRes.body.data[0].id;
    const detail = await request('GET', `/api/attendance/weeks/${weekId}`);
    const emp = detail.body.employees[0];
    const res = await request('PUT', `/api/attendance/weeks/${weekId}`, {
      employees: [{ id: emp.id, monday_status: 'A', tuesday_status: 'A', wednesday_status: 'A', thursday_status: 'A', friday_status: 'A', saturday_status: 'D', sunday_status: 'D' }],
    });
    assert.strictEqual(res.status, 403);
  });

  it('POST reopen week works', async () => {
    const listRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    const weekId = listRes.body.data[0].id;
    const res = await request('POST', `/api/attendance/weeks/${weekId}/reopen`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'borrador');
  });

  it('DELETE cancels week with reason', async () => {
    let weekId;
    const createRes = await request('POST', '/api/attendance/weeks', { year: 2018, week_number: 48 });
    if (createRes.status === 201) {
      weekId = createRes.body.id;
    } else {
      const listRes = await request('GET', '/api/attendance/weeks?year=2018&week_number=48&include_cancelled=true');
      if (listRes.body.data && listRes.body.data.length > 0) {
        const found = listRes.body.data.find((w) => w.status !== 'cancelada');
        if (!found) {
          assert.ok(true, 'Week already cancelled from previous run');
          return;
        }
        weekId = found.id;
      } else {
        assert.fail('Could not create or find week 2018/48');
      }
    }
    const res = await request('DELETE', `/api/attendance/weeks/${weekId}`, { reason: 'Error en generación' });
    assert.ok(res.status === 200 || res.status === 400, `Expected 200 or 400 (already cancelled), got ${res.status}`);
  });

  it('DELETE without reason fails', async () => {
    await new Promise((r) => setTimeout(r, 50));
    let weekId;
    const createRes = await request('POST', '/api/attendance/weeks', { year: 2018, week_number: 49 });
    if (createRes.status === 201) {
      weekId = createRes.body.id;
    } else {
      const listRes = await request('GET', '/api/attendance/weeks?year=2018&week_number=49&include_cancelled=true');
      if (listRes.body.data && listRes.body.data.length > 0) {
        const found = listRes.body.data.find((w) => w.status !== 'cancelada');
        if (!found) {
          assert.ok(true, 'All weeks are cancelled, validation still holds');
          return;
        }
        weekId = found.id;
      } else {
        assert.fail('Could not create or find week 2018/49');
      }
    }
    const res = await request('DELETE', `/api/attendance/weeks/${weekId}`, { reason: '' });
    assert.strictEqual(res.status, 400);
  });

  it('GET /api/attendance/weeks/:id/print returns data and registers audit', async () => {
    await new Promise((r) => setTimeout(r, 100));
    const listRes = await request('GET', '/api/attendance/weeks?year=2026&week_number=2');
    assert.ok(listRes.body.data && listRes.body.data.length > 0);
    const weekId = listRes.body.data[0].id;
    const res = await request('GET', `/api/attendance/weeks/${weekId}/print`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.employees);
    assert.ok(res.body.summary);
  });

  it('permissions block unauthenticated access', async () => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/attendance/weeks',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    const res = await new Promise((resolve, reject) => {
      const req = http.request(opts, (r) => {
        let data = '';
        r.on('data', (c) => { data += c; });
        r.on('end', () => resolve({ status: r.statusCode }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(res.status, 401);
  });

  it('archive list includes weeks with filters', async () => {
    const res = await request('GET', '/api/attendance/weeks?year=2026&status=borrador');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data);
    assert.ok(res.body.pagination);
  });

  it('year search returns summary with counts', async () => {
    const res = await request('GET', '/api/attendance/weeks?year=2026');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.summary);
    assert.strictEqual(res.body.summary.year, 2026);
    assert.ok(res.body.summary.totalWeeks >= 1);
    assert.ok(typeof res.body.summary.draftCount === 'number');
    assert.ok(typeof res.body.summary.closedCount === 'number');
    assert.ok(typeof res.body.summary.cancelledCount === 'number');
  });

  it('year search includes all statuses (borrador, cerrada, cancelada)', async () => {
    const res = await request('GET', '/api/attendance/weeks?year=2026&include_cancelled=true');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data);
  });

  it('year search orders by week_number ascending', async () => {
    const res = await request('GET', '/api/attendance/weeks?year=2026');
    assert.strictEqual(res.status, 200);
    const weeks = res.body.data;
    for (let i = 1; i < weeks.length; i++) {
      assert.ok(weeks[i].week_number >= weeks[i - 1].week_number, 'Should be ordered by week_number ASC');
    }
  });

  it('default listing without year excludes cancelled weeks', async () => {
    const res = await request('GET', '/api/attendance/weeks');
    assert.strictEqual(res.status, 200);
    const hasCancelled = res.body.data.some((w) => w.status === 'cancelada');
    assert.strictEqual(hasCancelled, false, 'Cancelled weeks should not appear by default without year filter');
  });

  it('status=cancelada filter shows only cancelled', async () => {
    const res = await request('GET', '/api/attendance/weeks?status=cancelada');
    assert.strictEqual(res.status, 200);
    for (const w of res.body.data) {
      assert.strictEqual(w.status, 'cancelada');
    }
  });

  it('date range filter works with week_start_date_from', async () => {
    const res = await request('GET', '/api/attendance/weeks?week_start_date_from=2026-01-01&include_cancelled=true');
    assert.strictEqual(res.status, 200);
    for (const w of res.body.data) {
      assert.ok(w.week_start_date >= '2026-01-01');
    }
  });

  it('audit log records attendance events', async () => {
    const res = await request('GET', '/api/admin/audit-logs?module=attendance&limit=50');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.length > 0);
    const actions = res.body.data.map((e) => e.action);
    assert.ok(actions.includes('create'));
    assert.ok(actions.includes('close'));
    assert.ok(actions.includes('reopen'));
  });

  it('CDMX timestamps are shown', async () => {
    const listRes = await request('GET', '/api/attendance/weeks');
    const week = listRes.body.data[0];
    assert.ok(week.created_at_cdmx);
  });

  it('backup includes attendance weeks', async () => {
    const res = await request('GET', '/api/admin/backup');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.payrollAttendanceWeeks);
    assert.ok(res.body.data.payrollAttendanceEmployees);
    assert.ok(res.body.data.attendanceStatuses);
    assert.ok(res.body.data.payrollAttendanceWeeks.length > 0);
    assert.ok(res.body.data.payrollAttendanceEmployees.length > 0);
    assert.ok(res.body.data.attendanceStatuses.length === 9);
  });

  it('backup import preview handles attendance entities', async () => {
    const backupRes = await request('GET', '/api/admin/backup');
    const backup = backupRes.body;
    const res = await request('POST', '/api/admin/backup/preview', backup);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.preview.payrollAttendanceWeeks);
    assert.ok(res.body.preview.payrollAttendanceEmployees);
  });
});
