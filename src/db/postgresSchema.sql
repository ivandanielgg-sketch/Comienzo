CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , role TEXT NOT NULL DEFAULT 'user', updated_at TEXT, created_by_user_id INTEGER, created_by_name TEXT, updated_by_user_id INTEGER, updated_by_name TEXT, is_active INTEGER NOT NULL DEFAULT 1, locked_until TEXT, failed_login_attempts INTEGER NOT NULL DEFAULT 0, last_failed_login_at TEXT, mfa_enabled INTEGER NOT NULL DEFAULT 0, mfa_secret TEXT, mfa_verified_at TEXT);

CREATE TABLE exchange_rates (
      currency TEXT PRIMARY KEY,
      rate_to_mxn DOUBLE PRECISION NOT NULL CHECK (rate_to_mxn > 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE attendance_statuses (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      counts_as_absence INTEGER NOT NULL DEFAULT 0,
      requires_project_location INTEGER NOT NULL DEFAULT 0,
      requires_extra_payment INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

CREATE TABLE role_permissions (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE service_types (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      margin DOUBLE PRECISION NOT NULL CHECK (margin >= 0 AND margin < 1),
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE service_quote_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE financial_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      estimated_isr_rate DOUBLE PRECISION NOT NULL DEFAULT 0.10,
      ivan_commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0.10,
      project_income_recognition TEXT NOT NULL DEFAULT 'project_created_date',
      accounts_payable_recognition TEXT NOT NULL DEFAULT 'invoice_date',
      base_currency TEXT NOT NULL DEFAULT 'MXN',
      include_vat_in_sales INTEGER NOT NULL DEFAULT 0,
      include_pending_accounts_payable INTEGER NOT NULL DEFAULT 1,
      include_classified_bank_movements INTEGER NOT NULL DEFAULT 1,
      include_manual_payroll INTEGER NOT NULL DEFAULT 1,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE kpi_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      margin_green_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.40,
      margin_yellow_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.30,
      margin_red_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.20,
      receivable_bucket1_days INTEGER NOT NULL DEFAULT 30,
      receivable_bucket2_days INTEGER NOT NULL DEFAULT 60,
      receivable_bucket3_days INTEGER NOT NULL DEFAULT 90,
      receivable_critical_days INTEGER NOT NULL DEFAULT 120,
      report_missing_critical_days INTEGER NOT NULL DEFAULT 7,
      require_manual_quote_capture INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER,
      updated_by_name TEXT
    );

CREATE TABLE backup_import_logs (
      id SERIAL PRIMARY KEY,
      imported_at TEXT NOT NULL,
      imported_by TEXT NOT NULL,
      schema_version TEXT,
      backup_exported_at TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      summary_json TEXT,
      conflicts_json TEXT,
      errors_json TEXT,
      validation_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE login_attempts (
      id SERIAL PRIMARY KEY,
      user_identifier TEXT NOT NULL,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      attempted_at TEXT NOT NULL,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      entity_label TEXT,
      timestamp_utc TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE employees (
      id SERIAL PRIMARY KEY,
      employee_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      hire_date TEXT NOT NULL,
      department TEXT,
      position TEXT,
      immediate_boss TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , termination_date TEXT, inactive_reason TEXT, created_by_user_id INTEGER, created_by_name TEXT, updated_by_user_id INTEGER, updated_by_name TEXT, primary_department TEXT, secondary_department TEXT, kpi_eligible INTEGER NOT NULL DEFAULT 1, user_id INTEGER, kpi_area TEXT, kpi_configured_at TEXT, kpi_configured_by_user_id INTEGER, kpi_configured_by_name TEXT);

CREATE TABLE sales_commission_agents (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      related_user_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL,
      end_date TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE ecovis_payments (
      id SERIAL PRIMARY KEY,
      payment_date TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_method TEXT,
      bank_reference TEXT,
      source_description TEXT,
      notes TEXT,
      unallocated_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER, updated_by_user_id INTEGER, exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION);

CREATE TABLE ecovis_purchase_orders (
      id SERIAL PRIMARY KEY,
      purchase_order_number TEXT NOT NULL,
      project_name TEXT,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      order_date TEXT NOT NULL,
      total_amount DOUBLE PRECISION NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagada', 'pagada', 'cancelada')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      updated_by TEXT,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION, paid_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0, pending_amount_mxn DOUBLE PRECISION, fully_paid_at TEXT, purchase_order_number_normalized TEXT);

CREATE TABLE ecovis_projects (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      client_name TEXT NOT NULL DEFAULT 'ECOVIS',
      quote_number TEXT,
      purchase_order_number TEXT,
      invoice_number TEXT,
      project_date TEXT NOT NULL,
      description TEXT,
      total_amount DOUBLE PRECISION NOT NULL CHECK (total_amount > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcialmente_pagado', 'pagado', 'cancelado')),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER, updated_by_user_id INTEGER, ecovis_purchase_order_id INTEGER, exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION, paid_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0, pending_amount_mxn DOUBLE PRECISION, fully_paid_at TEXT);

CREATE TABLE payroll_attendance_weeks (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      week_start_date TEXT NOT NULL,
      week_end_date TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrada', 'cancelada')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE bank_statement_summaries (
      id SERIAL PRIMARY KEY,
      bank_name TEXT NOT NULL,
      account_number_masked TEXT,
      currency TEXT NOT NULL DEFAULT 'MXN',
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      initial_balance_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      deposits_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawals_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_vat_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      final_balance_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      initial_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      deposits_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawals_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      commissions_vat_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      final_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      source_file_name TEXT,
      source_file_type TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE bank_statement_movements (
      id SERIAL PRIMARY KEY,
      bank_statement_summary_id INTEGER NOT NULL,
      transaction_date TEXT NOT NULL,
      description TEXT,
      reference TEXT,
      deposit_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawal_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      deposit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      withdrawal_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      balance_original DOUBLE PRECISION,
      balance_mxn DOUBLE PRECISION,
      classification_status TEXT NOT NULL DEFAULT 'sin_clasificar' CHECK (classification_status IN ('sin_clasificar', 'clasificado', 'ignorado')),
      classification_type TEXT,
      related_project_id INTEGER,
      related_account_payable_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, financial_week_of_month INTEGER,
      FOREIGN KEY (bank_statement_summary_id) REFERENCES bank_statement_summaries(id)
    );

CREATE TABLE financial_statements (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrado', 'cancelado')),
      revenue_net_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      cost_of_sales_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      gross_profit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      operating_expenses_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      net_administrative_profit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      estimated_isr_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      profit_after_isr_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      ivan_commission_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      real_administrative_profit_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      accounts_receivable_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      accounts_payable_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_initial_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_deposits_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_withdrawals_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      bank_final_balance_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      unclassified_movements_count INTEGER NOT NULL DEFAULT 0,
      configuration_snapshot_json TEXT,
      data_snapshot_json TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      closed_at TEXT,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE financial_adjustments (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ingreso', 'costo_de_venta', 'gasto_operativo', 'impuesto', 'comision_ivan', 'banco', 'otro')),
      concept TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'cancelado')),
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE manual_payroll_expenses (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      concept TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE projects (
      id SERIAL PRIMARY KEY,
      quote_number TEXT NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      purchase_order_number TEXT,
      purchase_order_not_applicable INTEGER NOT NULL DEFAULT 0,
      seller TEXT NOT NULL,
      client_name TEXT NOT NULL,
      project_description TEXT NOT NULL DEFAULT '',
      expected_margin DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_invoiced DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_invoiced_currency TEXT NOT NULL DEFAULT 'MXN',
      progress_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      technician_name TEXT NOT NULL,
      promised_delivery_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pendiente', 'En Proceso', 'Terminado')),
      risk TEXT NOT NULL CHECK (risk IN ('Alto', 'Medio', 'Bajo')),
      observations TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER, created_by_name TEXT, updated_by_user_id INTEGER, updated_by_name TEXT, deleted_at TEXT, deleted_by_user_id INTEGER, deleted_by_name TEXT, delete_reason TEXT, credit_days INTEGER, credit_days_na INTEGER NOT NULL DEFAULT 0, invoice_date TEXT, invoice_date_na INTEGER NOT NULL DEFAULT 0, due_date TEXT, invoice_number TEXT, lead_channel TEXT, next_commercial_action TEXT, next_commercial_action_date TEXT, lost_reason TEXT, technical_closed_at TEXT, technical_report_complete INTEGER NOT NULL DEFAULT 0, rework INTEGER NOT NULL DEFAULT 0, rework_cause TEXT, invoice_requested_at TEXT, invoice_issued_at TEXT, invoice_accepted_at TEXT, invoice_paid_at TEXT, invoice_cancelled INTEGER NOT NULL DEFAULT 0, invoice_error INTEGER NOT NULL DEFAULT 0, invoice_pending_docs INTEGER NOT NULL DEFAULT 0, collection_contact_at TEXT, collection_notes TEXT);

CREATE TABLE ecovis_amount_adjustments (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'purchaseOrder', 'payment', 'allocation', 'loan', 'creditBalance')),
      entity_id INTEGER NOT NULL,
      previous_amount_original DOUBLE PRECISION NOT NULL,
      previous_currency TEXT NOT NULL,
      previous_exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      previous_amount_mxn DOUBLE PRECISION NOT NULL,
      new_amount_original DOUBLE PRECISION NOT NULL,
      new_currency TEXT NOT NULL,
      new_exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      new_amount_mxn DOUBLE PRECISION NOT NULL,
      difference_mxn DOUBLE PRECISION NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      approved_by_user_id INTEGER,
      approved_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE accounts_payable (
      id SERIAL PRIMARY KEY,
      supplier_name TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      category TEXT NOT NULL DEFAULT 'Otros',
      related_project_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagada', 'cancelada')),
      paid_at TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE accounts_payable_payments (
      id SERIAL PRIMARY KEY,
      accounts_payable_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      payment_method TEXT,
      bank_movement_id INTEGER,
      reference TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (accounts_payable_id) REFERENCES accounts_payable(id),
      FOREIGN KEY (bank_movement_id) REFERENCES bank_statement_movements(id)
    );

CREATE TABLE ecovis_movements (
      id SERIAL PRIMARY KEY,
      movement_date TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('proyecto', 'pago_recibido', 'prestamo_ecovis_a_revram', 'aplicacion_a_proyecto', 'saldo_a_favor', 'devolucion', 'ajuste', 'cancelacion')),
      description TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MXN',
      direction TEXT NOT NULL CHECK (direction IN ('ecovis_debe_a_revram', 'revram_debe_a_ecovis', 'neutral')),
      reference TEXT,
      related_project_id INTEGER,
      related_payment_id INTEGER,
      payment_method TEXT,
      bank_reference TEXT,
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION, created_by_user_id INTEGER, updated_by_user_id INTEGER,
      FOREIGN KEY (related_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (related_payment_id) REFERENCES ecovis_payments(id)
    );

CREATE TABLE ecovis_payment_allocations (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      ecovis_project_id INTEGER,
      ecovis_purchase_order_id INTEGER,
      allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proyecto', 'orden_compra', 'saldo_a_favor', 'prestamo', 'ajuste')),
      amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
      notes TEXT,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER, updated_by_user_id INTEGER, updated_by TEXT, currency TEXT NOT NULL DEFAULT 'MXN', exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1, amount_mxn DOUBLE PRECISION,
      FOREIGN KEY (payment_id) REFERENCES ecovis_payments(id),
      FOREIGN KEY (ecovis_project_id) REFERENCES ecovis_projects(id),
      FOREIGN KEY (ecovis_purchase_order_id) REFERENCES ecovis_purchase_orders(id)
    );

CREATE TABLE project_payments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER, created_by_name TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE project_costs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (
        category IN (
          'Compra',
          'Gasolina',
          'Casetas',
          'Viaticos',
          'Sueldo',
          'Materiales',
          'Hospedaje',
          'Otros'
        )
      ),
      description TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      cost_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER, created_by_name TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE project_reports (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      report_folio TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_address TEXT,
      service_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      assigned_technicians TEXT,
      burner_model TEXT,
      equipment_model_serial TEXT,
      pumps_motors_model TEXT,
      fuel TEXT,
      voltage TEXT,
      gas_pressure_inh2o TEXT,
      liquid_fuel_pressure_psi TEXT,
      working_pressure TEXT,
      pump_amperage TEXT,
      fan_amperage TEXT,
      condensate_tank_temp_c TEXT,
      operating_output_temp_c TEXT,
      flue_gas_temp_c TEXT,
      safety_tests TEXT,
      comments TEXT,
      emissions_low_fire TEXT,
      emissions_high_fire TEXT,
      technician_name TEXT,
      plant_manager_name TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, report_type TEXT NOT NULL DEFAULT 'boiler_startup', report_data TEXT, deleted_at TEXT, deleted_by TEXT, delete_reason TEXT, created_by_user_id INTEGER, updated_by_user_id INTEGER, deleted_by_user_id INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE sales_commissions (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      closed_project_id INTEGER,
      sales_agent_id INTEGER NOT NULL,
      commission_calculation_base_type TEXT NOT NULL CHECK (commission_calculation_base_type IN ('total_sale_mxn', 'gross_profit_mxn', 'net_profit_mxn', 'no_aplica')),
      commission_base_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_sale_mxn_snapshot DOUBLE PRECISION,
      gross_profit_mxn_snapshot DOUBLE PRECISION,
      net_profit_mxn_snapshot DOUBLE PRECISION,
      commission_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
      commission_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcial', 'pagada', 'no_aplica', 'cancelada')),
      no_apply_reason TEXT,
      notes TEXT,
      assigned_by_user_id INTEGER,
      assigned_by_name TEXT,
      assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );

CREATE TABLE financial_project_omissions (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      project_id INTEGER NOT NULL,
      omit INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE kpi_manual_quote_captures (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      department TEXT NOT NULL DEFAULT 'Ventas',
      employee_id INTEGER,
      employee_name_snapshot TEXT,
      quotes_sent_count INTEGER NOT NULL DEFAULT 0,
      quoted_amount_original DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      quoted_amount_mxn DOUBLE PRECISION NOT NULL DEFAULT 0,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT
    );

CREATE TABLE vacation_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      requested_days INTEGER NOT NULL CHECK (requested_days > 0),
      vacation_exercise_year INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('programada', 'tomada', 'cancelada')),
      is_first_vacation_of_exercise INTEGER NOT NULL DEFAULT 0,
      include_vacation_bonus INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      authorized_by TEXT DEFAULT 'Ivan Garcia',
      hr_responsible TEXT DEFAULT 'Alejandra Gonzalez',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, creates_negative_balance INTEGER NOT NULL DEFAULT 0, negative_days_generated INTEGER NOT NULL DEFAULT 0, admin_override_reason TEXT, balance_after_request INTEGER, created_by_user_id INTEGER, updated_by_user_id INTEGER, updated_by_name TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

CREATE TABLE payroll_attendance_employees (
      id SERIAL PRIMARY KEY,
      payroll_attendance_week_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_number_snapshot TEXT NOT NULL,
      full_name_snapshot TEXT NOT NULL,
      position_snapshot TEXT,
      department_snapshot TEXT,
      monday_status TEXT NOT NULL DEFAULT 'A',
      tuesday_status TEXT NOT NULL DEFAULT 'A',
      wednesday_status TEXT NOT NULL DEFAULT 'A',
      thursday_status TEXT NOT NULL DEFAULT 'A',
      friday_status TEXT NOT NULL DEFAULT 'A',
      saturday_status TEXT NOT NULL DEFAULT 'D',
      sunday_status TEXT NOT NULL DEFAULT 'D',
      project_location_text TEXT,
      extra_payment_amount DOUBLE PRECISION,
      extra_payment_currency TEXT DEFAULT 'MXN',
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payroll_attendance_week_id) REFERENCES payroll_attendance_weeks(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

CREATE TABLE sales_commission_payments (
      id SERIAL PRIMARY KEY,
      sales_agent_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_original DOUBLE PRECISION NOT NULL CHECK (amount_original > 0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      exchange_rate_to_mxn DOUBLE PRECISION NOT NULL DEFAULT 1,
      amount_mxn DOUBLE PRECISION NOT NULL,
      payment_method TEXT,
      reference TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER,
      updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT,
      delete_reason TEXT,
      FOREIGN KEY (sales_agent_id) REFERENCES sales_commission_agents(id)
    );

CREATE TABLE user_permissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE user_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      theme_name TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE user_session_activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      role TEXT,
      session_id_hash TEXT NOT NULL,
      login_at TEXT NOT NULL,
      logout_at TEXT,
      last_activity_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

CREATE TABLE sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    );

CREATE INDEX idx_audit_logs_action ON audit_logs (action);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp_utc);

CREATE INDEX idx_audit_logs_user ON audit_logs (user_id);

CREATE INDEX idx_ecovis_amount_adjustments_entity
      ON ecovis_amount_adjustments (entity_type, entity_id);

CREATE UNIQUE INDEX idx_fin_project_omission_unique
      ON financial_project_omissions (year, month, project_id);

CREATE UNIQUE INDEX idx_financial_statements_unique
      ON financial_statements (year, month)
      WHERE status != 'cancelado' AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_kpi_manual_quotes_period
      ON kpi_manual_quote_captures (year, month, COALESCE(employee_id, -1))
      WHERE deleted_at IS NULL;

CREATE INDEX idx_login_attempts_ip ON login_attempts (ip_address);

CREATE INDEX idx_login_attempts_time ON login_attempts (attempted_at);

CREATE INDEX idx_login_attempts_user ON login_attempts (user_identifier);

CREATE INDEX idx_payroll_emp_week ON payroll_attendance_employees (payroll_attendance_week_id);

CREATE UNIQUE INDEX idx_payroll_week_unique
      ON payroll_attendance_weeks (year, week_number)
      WHERE deleted_at IS NULL AND status != 'cancelada';

CREATE UNIQUE INDEX idx_sales_commissions_project_active ON sales_commissions (project_id) WHERE deleted_at IS NULL AND status != 'cancelada';

CREATE INDEX idx_sessions_expires ON sessions (expires);

CREATE INDEX idx_user_sessions_active ON user_session_activities (is_active);
