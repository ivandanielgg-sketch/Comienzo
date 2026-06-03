'use strict';

const FAILURE_REPORT_CAUSES = ['interna', 'externa'];

function createFailureReportValidators({ badRequest, enumValue, requiredText, getActiveEmployeeOrFail }) {
  function normalizeFailureReport(body) {
    const cause = enumValue(body, 'cause', 'Causa', FAILURE_REPORT_CAUSES);
    const problem_description = requiredText(body, 'problem_description', 'Descripcion del problema');
    const solutionEmployee = getActiveEmployeeOrFail(
      body.solution_responsible_employee_id,
      'responsable de solucionarlo',
    );

    let failure_responsible_employee_id = null;
    if (cause === 'interna') {
      failure_responsible_employee_id = getActiveEmployeeOrFail(
        body.failure_responsible_employee_id,
        'responsable de la falla',
      ).id;
    } else if (
      body.failure_responsible_employee_id !== undefined
      && body.failure_responsible_employee_id !== null
      && body.failure_responsible_employee_id !== ''
    ) {
      throw badRequest('No indique responsable interno de la falla cuando la causa es externa.');
    }

    return {
      cause,
      problem_description,
      failure_responsible_employee_id,
      solution_responsible_employee_id: solutionEmployee.id,
    };
  }

  return { normalizeFailureReport, FAILURE_REPORT_CAUSES };
}

function mapFailureReport(row, formatDateTimeCDMX) {
  return {
    id: row.id,
    project_id: row.project_id,
    cause: row.cause,
    cause_label: row.cause === 'interna' ? 'Interna' : 'Externa',
    problem_description: row.problem_description,
    failure_responsible_employee_id: row.failure_responsible_employee_id,
    failure_responsible_name: row.failure_responsible_name || null,
    solution_responsible_employee_id: row.solution_responsible_employee_id,
    solution_responsible_name: row.solution_responsible_name,
    registered_at: row.registered_at,
    registered_at_cdmx: formatDateTimeCDMX(row.registered_at),
    created_at: row.created_at,
    created_by_name: row.created_by_name || null,
  };
}

const FAILURE_REPORT_FROM_SQL = `
  FROM project_failure_reports fr
  LEFT JOIN employees ef ON ef.id = fr.failure_responsible_employee_id
  JOIN employees es ON es.id = fr.solution_responsible_employee_id
`;

module.exports = {
  FAILURE_REPORT_CAUSES,
  FAILURE_REPORT_FROM_SQL,
  createFailureReportValidators,
  mapFailureReport,
};
