'use strict';

const TABLE_SQLITE = `
  CREATE TABLE IF NOT EXISTS project_failure_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    cause TEXT NOT NULL CHECK (cause IN ('interna', 'externa')),
    problem_description TEXT NOT NULL,
    failure_responsible_employee_id INTEGER,
    solution_responsible_employee_id INTEGER NOT NULL,
    registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    created_by_name TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (failure_responsible_employee_id) REFERENCES employees(id),
    FOREIGN KEY (solution_responsible_employee_id) REFERENCES employees(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_failure_reports_project
    ON project_failure_reports (project_id, registered_at DESC);
`;

const TABLE_POSTGRES = `
  CREATE TABLE IF NOT EXISTS project_failure_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    cause TEXT NOT NULL CHECK (cause IN ('interna', 'externa')),
    problem_description TEXT NOT NULL,
    failure_responsible_employee_id INTEGER,
    solution_responsible_employee_id INTEGER NOT NULL,
    registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    created_by_name TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (failure_responsible_employee_id) REFERENCES employees(id),
    FOREIGN KEY (solution_responsible_employee_id) REFERENCES employees(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_failure_reports_project
    ON project_failure_reports (project_id, registered_at DESC);
`;

function migrateProjectFailureReports(database, { postgres = false } = {}) {
  database.exec(postgres ? TABLE_POSTGRES : TABLE_SQLITE);
}

module.exports = {
  migrateProjectFailureReports,
};
