# Control de Proyectos — Export completo de la página principal (para análisis IA)

Generado: 2026-07-15T17:33:16.089Z

## Contenido
- Archivo fuente principal: `public/index.html`
- Estilos: `public/styles.css`
- Lógica frontend: `public/app.js`
- Dependencia externa: Chart.js 4.4.1 (CDN)

## Páginas / archivos NO incluidos (separados)
- public/calculadora-emisiones.html (+ emissions-calculator.js / present)
- public/report-print.html, report-print-general.html, report-print-autoflame.html
- public/attendance-print.html, vacation-print.html, kpi-print.html, failure-report-print.html

## Tamaños aproximados
- index.html: 124273 chars
- styles.css: 30972 chars
- app.js: 341438 chars

================================================================================
# ARCHIVO 1: public/index.html
================================================================================

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Control de Proyectos</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <section id="login-view" class="auth-card hidden">
        <div>
          <p class="eyebrow">Acceso privado</p>
          <h1>Control de Proyectos</h1>
          <p class="muted">
            Ingresa con usuario y contrasena para administrar cotizaciones,
            pagos, costos y avance de cada proyecto.
          </p>
        </div>

        <form id="login-form" class="stack">
          <label>
            Usuario
            <input name="username" autocomplete="username" required />
          </label>
          <label>
            Contrasena
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <button type="submit">Entrar</button>
          <p id="login-message" class="message"></p>
        </form>
      </section>

      <section id="app-view" class="hidden">
        <header class="topbar">
          <div>
            <p class="eyebrow">Panel administrativo</p>
            <h1>Proyectos</h1>
          </div>
          <div class="topbar-actions">
            <button id="projects-tab" class="secondary active" type="button">Proyectos</button>
            <button id="closed-projects-tab" class="secondary" type="button">Proyectos Cerrados</button>
            <button id="reports-tab" class="secondary" type="button">Reportes</button>
            <button id="report-archive-tab" class="secondary" type="button">Archivo Reportes</button>
            <button id="vacations-tab" class="secondary hidden" type="button">Vacaciones</button>
            <button id="attendance-tab" class="secondary hidden" type="button">Asistencias</button>
            <button id="ecovis-tab" class="secondary hidden" type="button">Cuenta ECOVIS</button>
            <button id="service-quoter-tab" class="secondary hidden" type="button">Cotizador</button>
            <button id="financial-tab" class="secondary hidden" type="button">Estados Financieros</button>
            <button id="kpis-tab" class="secondary hidden" type="button">Tablero KPIs</button>
            <a id="emissions-calc-link" class="secondary button-link hidden" href="/calculadora-emisiones">Calculadora Emisiones</a>
            <button id="commissions-tab" class="secondary hidden" type="button">Comisiones</button>
            <button id="activity-monitor-tab" class="secondary hidden" type="button">Monitor Actividad</button>
            <button id="backup-create-btn" class="secondary hidden" type="button">Crear respaldo</button>
            <button id="backup-import-btn" class="secondary hidden" type="button">Importar respaldo</button>
            <button id="users-tab" class="secondary" type="button">Usuarios</button>
            <select id="theme-selector" title="Tema visual" aria-label="Tema visual">
              <option value="default">Azul REVRAM</option>
              <option value="dark">Modo Oscuro</option>
              <option value="corporate">Gris Corporativo</option>
              <option value="high_contrast">Alto Contraste</option>
            </select>
            <button id="logout-button" class="secondary" type="button">Cerrar sesion</button>
          </div>
        </header>

        <section id="projects-view">
          <section class="panel exchange-panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Monedas</p>
                <h2>Tipo de cambio a MXN</h2>
                <p class="muted">Los listados y calculos se muestran siempre en pesos mexicanos.</p>
              </div>
              <p class="muted">Ultima actualizacion: <strong id="exchange-updated-at">Sin cambios</strong></p>
            </div>
            <form id="exchange-rate-form" class="exchange-form">
              <label>
                MXN
                <input value="1.00" disabled />
              </label>
              <label>
                USD a MXN
                <input name="USD" type="text" inputmode="decimal" placeholder="17.12" required />
              </label>
              <label>
                EUR a MXN
                <input name="EUR" type="text" inputmode="decimal" placeholder="18.50" required />
              </label>
              <button type="submit">Actualizar tipo de cambio</button>
              <p id="exchange-message" class="message"></p>
            </form>
          </section>

          <section class="cards">
            <article>
              <span>Proyectos</span>
              <strong id="stat-projects">0</strong>
            </article>
            <article>
              <span>Total cobrado</span>
              <strong id="stat-charged">$0.00</strong>
            </article>
            <article>
              <span>Gastado</span>
              <strong id="stat-spent">$0.00</strong>
            </article>
            <article>
              <span>Pendiente de cobro</span>
              <strong id="stat-pending">$0.00</strong>
            </article>
          </section>

          <section class="layout">
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2 id="project-form-title">Nuevo proyecto</h2>
                  <p class="muted">El ID se genera automaticamente por consecutivo.</p>
                </div>
                <button id="new-project-button" class="secondary" type="button">Limpiar</button>
              </div>

              <form id="project-form" class="grid-form">
                <input type="hidden" name="id" />
                <label>
                  Numero de cotizacion
                  <input name="quote_number" required />
                </label>
                <label>
                  Numero de pedido
                  <input name="order_number" required />
                </label>
                <label>
                  Numero de orden de compra
                  <input name="purchase_order_number" required />
                </label>
                <label class="checkbox-row">
                  <input name="purchase_order_not_applicable" type="checkbox" />
                  No Aplica
                </label>
                <label>
                  Vendedor que cerro la venta
                  <select name="vendedor_id" required>
                    <option value="">Seleccione vendedor...</option>
                  </select>
                </label>
                <label>
                  Nombre del cliente
                  <input name="client_name" required />
                </label>
                <label class="full">
                  Descripcion del proyecto
                  <textarea name="project_description" rows="3" placeholder="Describe de que trata el proyecto" required></textarea>
                </label>
                <label>
                  Margen esperado de utilidad (%)
                  <input name="expected_margin" type="number" min="0" max="100" step="0.01" value="0" required />
                </label>
                <label class="full money-field">
                  Total facturado con IVA
                  <div class="money-row">
                    <input name="total_invoiced" type="text" inputmode="decimal" value="0" required />
                    <select name="total_invoiced_currency" required>
                      <option>MXN</option>
                      <option>USD</option>
                      <option>EUR</option>
                    </select>
                  </div>
                </label>
                <label>
                  Avance del proyecto (%)
                  <input name="progress_percent" type="number" min="0" max="100" step="0.01" value="0" required />
                </label>
                <label>
                  Tecnico responsable
                  <select name="tecnico_id" required>
                    <option value="">Seleccione tecnico...</option>
                  </select>
                </label>
                <label>
                  Fecha de vencimiento
                  <input name="fecha_vencimiento" type="date" required />
                </label>
                <label>
                  Fecha prometida de entrega
                  <input name="promised_delivery_date" type="date" required />
                </label>
                <label>
                  Estado
                  <select name="status" required>
                    <option>Pendiente</option>
                    <option>En Proceso</option>
                    <option>Terminado</option>
                  </select>
                </label>
                <label>
                  Riesgo
                  <select name="risk" required>
                    <option>Alto</option>
                    <option>Medio</option>
                    <option>Bajo</option>
                  </select>
                </label>
                <label class="full">
                  Observaciones
                  <textarea name="observations" rows="3"></textarea>
                </label>
                <button type="submit">Guardar proyecto</button>
                <p id="project-message" class="message"></p>
              </form>
            </div>

            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Listado</h2>
                  <p class="muted">Selecciona un proyecto para agregar pagos, compras, gastos o salarios.</p>
                </div>
              </div>
              <div class="search-row" style="margin-bottom:10px;">
                <input id="projects-search" type="text" placeholder="Buscar proyectos..." />
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cotizacion</th>
                      <th>N. Pedido</th>
                      <th>Cliente</th>
                      <th>Proyecto</th>
                      <th>Estado</th>
                      <th>Riesgo</th>
                      <th>Fecha</th>
                      <th>Cobrado</th>
                      <th>Gastado</th>
                      <th>Pendiente</th>
                      <th>Margen final</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="projects-table"></tbody>
                </table>
              </div>
              <div id="projects-pagination"></div>
            </div>
          </section>

          <div id="project-detail-drawer" class="project-drawer hidden" aria-hidden="true">
            <div id="project-detail-backdrop" class="project-drawer-backdrop" tabindex="-1"></div>
            <aside
              id="detail-panel"
              class="project-drawer-panel panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-title"
              tabindex="-1"
            >
              <div class="project-drawer-toolbar">
                <button type="button" id="detail-panel-close" class="secondary project-drawer-close" aria-label="Cerrar panel">
                  ✕ Cerrar
                </button>
              </div>
              <div class="project-drawer-body">
                <div class="panel-header">
                  <div>
                    <p class="eyebrow">Proyecto seleccionado</p>
                    <h2 id="detail-title"></h2>
                    <p id="detail-subtitle" class="muted"></p>
                    <p id="detail-description" class="project-description"></p>
                  </div>
                </div>

                <div class="detail-grid">
                  <article><span>Orden de compra</span><strong id="detail-po"></strong></article>
                  <article><span>Total facturado</span><strong id="detail-invoiced"></strong></article>
                  <article><span>Pendiente de cobro</span><strong id="detail-pending"></strong></article>
                  <article><span>Avance</span><strong id="detail-progress"></strong></article>
                </div>

                <div class="detail-reports-section" style="margin-bottom:16px;">
                  <h3>Reportes generados</h3>
                  <ul id="detail-reports-list" class="entry-list"></ul>
                  <button class="secondary" id="detail-new-report" type="button" style="margin-top:8px;">Generar reporte</button>
                </div>

                <div class="project-drawer-sections">
              <div>
                <h3>Agregar pago</h3>
                <form id="payment-form" class="stack">
                  <label>
                    Cantidad cobrada
                    <div class="money-row">
                      <input name="amount" type="text" inputmode="decimal" required />
                      <select name="currency" required>
                        <option>MXN</option>
                        <option>USD</option>
                        <option>EUR</option>
                      </select>
                    </div>
                  </label>
                  <label>
                    Fecha de pago
                    <input name="payment_date" type="date" required />
                  </label>
                  <label>
                    Nota
                    <input name="notes" />
                  </label>
                  <button type="submit">Registrar pago</button>
                </form>
                <ul id="payments-list" class="entry-list"></ul>
              </div>

              <div>
                <h3>Agregar costo</h3>
                <form id="cost-form" class="stack">
                  <label>
                    Tipo
                    <select name="category" required>
                      <option>Compra</option>
                      <option>Gasolina</option>
                      <option>Casetas</option>
                      <option>Viaticos</option>
                      <option>Sueldo</option>
                      <option>Materiales</option>
                      <option>Hospedaje</option>
                      <option>Otros</option>
                    </select>
                  </label>
                  <label>
                    Descripcion
                    <input name="description" required />
                  </label>
                  <label>
                    Importe
                    <div class="money-row">
                      <input name="amount" type="text" inputmode="decimal" required />
                      <select name="currency" required>
                        <option>MXN</option>
                        <option>USD</option>
                        <option>EUR</option>
                      </select>
                    </div>
                  </label>
                  <label>
                    Fecha
                    <input name="cost_date" type="date" required />
                  </label>
                  <button type="submit">Registrar costo</button>
                </form>
                <ul id="costs-list" class="entry-list"></ul>
              </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section id="closed-projects-view" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h2>Proyectos Cerrados</h2>
                <p class="muted">
                  Conserva el historial de proyectos cerrados con pagos y gastos.
                  El borrado definitivo requiere contrasena del admin.
                </p>
              </div>
            </div>
            <div class="search-row" style="margin-bottom:10px;">
              <input id="closed-projects-search" type="text" placeholder="Buscar proyectos cerrados..." />
              <select id="closed-view-mode" style="width:auto;min-width:160px;">
                <option value="list">Lista general</option>
                <option value="by-client">Agrupado por cliente</option>
                <option value="date-range">Rango de fechas</option>
              </select>
            </div>
            <div id="closed-date-range-controls" class="hidden" style="margin-bottom:12px;">
              <div class="search-row" style="gap:8px;flex-wrap:wrap;">
                <label style="flex-direction:row;gap:6px;align-items:center;"><span>Desde:</span><input id="closed-date-from" type="date" style="width:auto;" /></label>
                <label style="flex-direction:row;gap:6px;align-items:center;"><span>Hasta:</span><input id="closed-date-to" type="date" style="width:auto;" /></label>
                <button id="closed-date-apply" type="button" style="padding:8px 14px;">Aplicar</button>
                <button id="closed-date-this-month" type="button" class="secondary" style="padding:8px 10px;font-size:0.82rem;">Este mes</button>
                <button id="closed-date-last-month" type="button" class="secondary" style="padding:8px 10px;font-size:0.82rem;">Mes pasado</button>
                <button id="closed-date-this-year" type="button" class="secondary" style="padding:8px 10px;font-size:0.82rem;">Año actual</button>
              </div>
              <p id="closed-date-info" class="muted" style="margin-top:6px;"></p>
            </div>
            <div id="closed-by-client-panel" class="hidden"></div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cotizacion</th>
                    <th>N. Pedido</th>
                    <th>Cliente</th>
                    <th>Proyecto</th>
                    <th>Cerrado</th>
                    <th>Facturado MXN</th>
                    <th>Cobrado MXN</th>
                    <th>Gastado MXN</th>
                    <th>Margen final</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="closed-projects-table"></tbody>
              </table>
            </div>
            <div id="closed-projects-pagination"></div>
          </div>

          <section id="closed-detail-panel" class="panel hidden">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Historial cerrado</p>
                <h2 id="closed-detail-title"></h2>
                <p id="closed-detail-subtitle" class="muted"></p>
                <p id="closed-detail-description" class="project-description"></p>
              </div>
            </div>

            <div class="detail-reports-section" style="margin-bottom:16px;">
              <h3>Reportes generados</h3>
              <ul id="closed-detail-reports-list" class="entry-list"></ul>
              <button class="secondary" id="closed-detail-new-report" type="button" style="margin-top:8px;">Generar reporte</button>
            </div>

            <div class="detail-reports-section detail-failure-reports-section" style="margin-bottom:16px;">
              <h3>Reportes de falla</h3>
              <ul id="closed-detail-failure-reports-list" class="entry-list"></ul>
            </div>

            <div class="layout two-columns">
              <div>
                <h3>Pagos realizados</h3>
                <ul id="closed-payments-list" class="entry-list"></ul>
              </div>
              <div>
                <h3>Gastos registrados</h3>
                <ul id="closed-costs-list" class="entry-list"></ul>
              </div>
            </div>
          </section>
        </section>

        <section id="reports-view" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Modulo de Reportes</p>
                <h2>REPORTES</h2>
                <p class="muted">Genera reportes tecnicos ligados a proyectos activos.</p>
              </div>
            </div>

            <div class="reports-filters" style="margin-bottom:16px;">
              <div class="grid-form" style="gap:10px;">
                <label>
                  Buscar
                  <input id="report-search" type="text" placeholder="Cliente, proyecto, folio..." />
                </label>
                <label>
                  Estatus
                  <select id="report-status-filter">
                    <option value="">Todos</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Terminado">Terminado</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cotizacion</th>
                    <th>Cliente</th>
                    <th>Proyecto</th>
                    <th>Estatus</th>
                    <th>Reportes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="reports-projects-table"></tbody>
              </table>
            </div>
            <div id="reports-projects-pagination"></div>
          </div>

          <div id="report-form-panel" class="panel hidden">
            <div class="panel-header">
              <div>
                <p class="eyebrow">REVRAM</p>
                <h2 id="report-form-title">FORMATO DE ARRANQUE DE CALDERA</h2>
                <p id="report-form-subtitle" class="muted"></p>
              </div>
              <div class="row-actions">
                <button id="report-back-button" class="secondary" type="button">Volver a lista</button>
              </div>
            </div>

            <form id="report-form" class="grid-form mobile-form">
              <input type="hidden" name="id" />
              <input type="hidden" name="project_id" />

              <label>
                Folio de reporte
                <input name="report_folio" placeholder="Se genera automaticamente si se deja vacio" />
              </label>
              <label>
                Fecha del reporte
                <input name="report_date" type="date" required />
              </label>
              <label>
                Empleado que ejecuto el servicio
                <select name="executed_by_employee_id" id="report-executed-by-select" required>
                  <option value="">Seleccione empleado...</option>
                </select>
              </label>

              <h3 class="full" style="margin-bottom:0;margin-top:12px;">Datos generales</h3>
              <label>
                Cliente *
                <input name="client_name" required />
              </label>
              <label>
                Domicilio
                <input name="client_address" />
              </label>
              <label>
                Nombre de servicio *
                <input name="service_name" required />
              </label>
              <label>
                Tecnicos asignados
                <input name="assigned_technicians" />
              </label>

              <div class="full boiler-fields">
                <h3 style="margin-bottom:0;margin-top:12px;">Datos tecnicos</h3>
                <div class="grid-form" style="margin-top:10px;">
                  <label>Modelo de quemador<input name="burner_model" /></label>
                  <label>Modelo y No. de serie del equipo<input name="equipment_model_serial" /></label>
                  <label>Modelo de bombas y motores<input name="pumps_motors_model" /></label>
                  <label>Combustible<input name="fuel" /></label>
                  <label>Voltaje<input name="voltage" /></label>
                  <label>Presion de gas (inH2O)<input name="gas_pressure_inh2o" /></label>
                  <label>Presion de combustible liquido (PSI)<input name="liquid_fuel_pressure_psi" /></label>
                  <label>Presion de trabajo<input name="working_pressure" /></label>
                  <label>Amperaje de bombas<input name="pump_amperage" /></label>
                  <label>Amperaje de ventilador<input name="fan_amperage" /></label>
                  <label>Temp. tanque de condensados (°C)<input name="condensate_tank_temp_c" /></label>
                  <label>Temp. salida equipo en operacion (°C)<input name="operating_output_temp_c" /></label>
                  <label>Temp. salida de gases (°C)<input name="flue_gas_temp_c" /></label>
                </div>

                <h3 style="margin-bottom:0;margin-top:12px;">Pruebas de seguridad</h3>
                <div class="safety-checks" style="margin-top:10px;">
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_alarmas" /> Alarmas sonoras</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_alta_presion" /> Alta presion de aceite</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_paro_arranque" /> Paro y arranque</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_paro_emergencia" /> Paro de emergencia</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_switch_aire" /> Prueba en switch de presion de aire</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_cambio_fuego" /> Cambio de alto y bajo fuego</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_baja_presion" /> Baja presion de aceite</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_switch_gas" /> Prueba en switch de presion de gas</label>
                  <label class="checkbox-row" style="margin-top:0;"><input type="checkbox" name="safety_otras" /> Otras</label>
                  <label id="safety-otras-field" class="hidden" style="margin-top:4px;">Especifique<input name="safety_otras_text" /></label>
                </div>

                <h3 style="margin-bottom:0;margin-top:12px;">Tabla de emisiones</h3>
                <div class="table-wrapper" style="margin-top:10px;">
                  <table class="emissions-table">
                    <thead><tr><th>Parametro</th><th>Flama baja</th><th>Unidad</th><th>Flama alta</th><th>Unidad</th></tr></thead>
                    <tbody>
                      <tr><td>O2</td><td><input name="em_o2_low" /></td><td>%</td><td><input name="em_o2_high" /></td><td>%</td></tr>
                      <tr><td>CO2</td><td><input name="em_co2_low" /></td><td>%</td><td><input name="em_co2_high" /></td><td>%</td></tr>
                      <tr><td>CO</td><td><input name="em_co_low" /></td><td>PPM</td><td><input name="em_co_high" /></td><td>PPM</td></tr>
                      <tr><td>T. Gas</td><td><input name="em_tgas_low" /></td><td>°C</td><td><input name="em_tgas_high" /></td><td>°C</td></tr>
                      <tr><td>T. Aire</td><td><input name="em_taire_low" /></td><td>°C</td><td><input name="em_taire_high" /></td><td>°C</td></tr>
                      <tr><td>Perdidas</td><td><input name="em_perdidas_low" /></td><td>%</td><td><input name="em_perdidas_high" /></td><td>%</td></tr>
                      <tr><td>Eficiencia</td><td><input name="em_eficiencia_low" /></td><td>%</td><td><input name="em_eficiencia_high" /></td><td>%</td></tr>
                      <tr><td>Lambda</td><td><input name="em_lambda_low" /></td><td></td><td><input name="em_lambda_high" /></td><td></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <h3 class="full" style="margin-bottom:0;margin-top:12px;">Comentarios</h3>
              <label class="full">
                <textarea name="comments" rows="4" placeholder="Comentarios adicionales sobre el servicio..."></textarea>
              </label>

              <h3 class="full" style="margin-bottom:0;margin-top:12px;">Firmas</h3>
              <label>
                Tecnico REVRAM - Nombre
                <input name="technician_name" />
              </label>
              <label>
                V.B. Encargado de planta - Nombre
                <input name="plant_manager_name" />
              </label>

              <div class="row-actions full" style="margin-top:12px;">
                <button type="submit">Guardar reporte</button>
              </div>
              <p id="report-message" class="message"></p>
            </form>
          </div>

          <div id="report-list-panel" class="panel hidden">
            <div class="panel-header">
              <div>
                <h2 id="report-list-title">Reportes del proyecto</h2>
                <p id="report-list-subtitle" class="muted"></p>
              </div>
              <div class="row-actions">
                <button id="report-list-new" type="button">Nuevo reporte</button>
                <button id="report-list-back" class="secondary" type="button">Volver a lista</button>
              </div>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Servicio</th>
                    <th>Ejecuto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="report-list-table"></tbody>
              </table>
            </div>
            <div id="project-reports-pagination"></div>
          </div>

          <div id="reports-failure-panel" class="panel hidden">
            <div class="panel-header">
              <div>
                <p class="eyebrow">REVRAM</p>
                <h2>Reporte de falla</h2>
                <p id="reports-failure-subtitle" class="muted"></p>
              </div>
              <div class="row-actions">
                <button id="reports-failure-back" class="secondary" type="button">Volver a lista</button>
              </div>
            </div>
            <form id="reports-failure-form" class="stack">
              <input type="hidden" name="project_id" />
              <label>
                Causa
                <select name="cause" required>
                  <option value="interna">Interna (REVRAM)</option>
                  <option value="externa">Externa (cliente)</option>
                </select>
              </label>
              <label>
                Descripcion del problema
                <textarea name="problem_description" rows="3" required></textarea>
              </label>
              <label id="reports-failure-responsible-wrap">
                Responsable de la falla
                <select name="failure_responsible_employee_id">
                  <option value="">Seleccione empleado...</option>
                </select>
              </label>
              <label>
                Responsable de solucionarlo
                <select name="solution_responsible_employee_id" required>
                  <option value="">Seleccione empleado...</option>
                </select>
              </label>
              <button type="submit">Registrar reporte de falla</button>
              <p id="reports-failure-message" class="message"></p>
            </form>
          </div>
        </section>

        <section id="vacations-view" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Modulo de Vacaciones</p>
                <h2>Empleados</h2>
                <p class="muted">Consulta y programa vacaciones conforme a la Ley Federal del Trabajo.</p>
              </div>
              <div class="row-actions">
                <button id="new-employee-button" type="button">Agregar empleado</button>
              </div>
            </div>
            <div class="search-row" style="margin-bottom:10px;display:flex;gap:10px;align-items:end;">
              <input id="employees-search" type="text" placeholder="Buscar empleados..." />
              <select id="employees-active-filter">
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>No. Empleado</th>
                    <th>Nombre</th>
                    <th>Fecha ingreso</th>
                    <th>Antiguedad</th>
                    <th>Estatus</th>
                    <th>Dias generados acumulados</th>
                    <th>Tomados</th>
                    <th>Programados</th>
                    <th>Disponibles</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="employees-table"></tbody>
              </table>
            </div>
            <div id="employees-pagination"></div>
          </div>

          <!-- Employee Form Modal -->
          <div id="employee-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2 id="employee-form-title">Agregar empleado</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="employee-form" class="grid-form">
                <input type="hidden" name="id" />
                <label>
                  Numero de empleado
                  <input name="employee_number" required />
                </label>
                <label>
                  Nombre completo
                  <input name="full_name" required />
                </label>
                <label>
                  Fecha de ingreso
                  <input name="hire_date" type="date" required />
                </label>
                <label>
                  Departamento
                  <input name="department" />
                </label>
                <label>
                  Depto. principal KPI
                  <select name="primary_department">
                    <option value="">— Sin asignar —</option>
                    <option value="Ventas">Ventas</option>
                    <option value="Técnico">Técnico</option>
                    <option value="Cobranza">Cobranza</option>
                    <option value="Facturación">Facturación</option>
                  </select>
                </label>
                <label>
                  Depto. secundario KPI
                  <select name="secondary_department">
                    <option value="">— Ninguno —</option>
                    <option value="Ventas">Ventas</option>
                    <option value="Técnico">Técnico</option>
                    <option value="Cobranza">Cobranza</option>
                    <option value="Facturación">Facturación</option>
                  </select>
                </label>
                <label class="checkbox-row">
                  <input name="kpi_eligible" type="checkbox" checked />
                  Elegible para KPIs
                </label>
                <label>
                  Puesto
                  <input name="position" />
                </label>
                <label>
                  Jefe inmediato
                  <input name="immediate_boss" />
                </label>
                <label class="checkbox-row">
                  <input name="active" type="checkbox" checked />
                  Empleado activo
                </label>
                <div id="termination-fields" class="hidden full">
                  <label>
                    Fecha de baja
                    <input name="termination_date" type="date" />
                  </label>
                  <label>
                    Motivo de baja (opcional)
                    <input name="inactive_reason" />
                  </label>
                </div>
                <button type="submit">Guardar empleado</button>
                <p id="employee-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- Vacation Requests Modal -->
          <div id="vacation-modal" class="modal-overlay hidden">
            <div class="modal-content panel modal-large">
              <div class="panel-header">
                <div>
                  <h2 id="vacation-modal-title">Vacaciones programadas</h2>
                  <p id="vacation-modal-subtitle" class="muted"></p>
                </div>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>

              <div class="detail-grid" id="vacation-employee-summary"></div>

              <h3>Historial de solicitudes</h3>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha inicio</th>
                      <th>Fecha fin</th>
                      <th>Dias</th>
                      <th>Ejercicio</th>
                      <th>Estatus</th>
                      <th>Notas</th>
                      <th>Registrado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="vacation-requests-table"></tbody>
                </table>
              </div>
              <div id="vacation-requests-pagination"></div>

              <h3>Nueva solicitud</h3>
              <form id="vacation-request-form" class="grid-form">
                <label>
                  Fecha inicial
                  <input name="start_date" type="date" required />
                </label>
                <label>
                  Fecha final
                  <input name="end_date" type="date" required />
                </label>
                <label>
                  Dias solicitados (automatico)
                  <input name="requested_days_display" type="number" disabled />
                </label>
                <label>
                  Estatus
                  <select name="status" required>
                    <option value="programada">Programada</option>
                    <option value="tomada">Tomada</option>
                  </select>
                </label>
                <label class="checkbox-row">
                  <input name="include_vacation_bonus" type="checkbox" checked />
                  Incluir prima vacacional
                </label>
                <label class="full">
                  Notas
                  <textarea name="notes" rows="2"></textarea>
                </label>
                <div class="row-actions full">
                  <button type="submit">Guardar</button>
                  <button type="button" id="save-and-print-vacation">Guardar y generar formato</button>
                </div>
                <p id="vacation-request-message" class="message"></p>
              </form>
            </div>
          </div>
        </section>

        <section id="attendance-view" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Módulo de Asistencias</p>
                <h2>ARCHIVO DE NÓMINAS</h2>
                <p class="muted">Consulta y administra las listas semanales de asistencia por año.</p>
              </div>
              <div class="row-actions">
                <button id="attendance-new-btn" type="button">Nueva nómina semanal</button>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:end;margin-bottom:16px;flex-wrap:wrap;">
              <label>
                Año
                <select id="attendance-filter-year" style="width:120px;"></select>
              </label>
              <button id="attendance-search-btn" type="button" style="padding:8px 18px;">Buscar</button>
              <p id="attendance-search-message" class="message" style="margin:0;"></p>
            </div>

            <div id="attendance-summary" class="cards hidden" style="margin-bottom:16px;">
              <article><span>Total nóminas</span><strong id="att-summary-total">0</strong></article>
              <article><span>Borradores</span><strong id="att-summary-draft" style="color:orange;">0</strong></article>
              <article><span>Cerradas</span><strong id="att-summary-closed" style="color:green;">0</strong></article>
              <article><span>Canceladas</span><strong id="att-summary-cancelled" style="color:red;">0</strong></article>
            </div>

            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Rango de fechas</th>
                    <th>Estatus</th>
                    <th>Empleados</th>
                    <th>Inasistencias</th>
                    <th>Pagos extra</th>
                    <th>Creado por</th>
                    <th>Creado el</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="attendance-weeks-table">
                  <tr><td colspan="9" style="text-align:center;">Selecciona un año y presiona Buscar.</td></tr>
                </tbody>
              </table>
            </div>
            <div id="attendance-weeks-pagination"></div>
          </div>

          <!-- Attendance Edit Panel -->
          <div id="attendance-edit-panel" class="panel hidden">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Captura de asistencia</p>
                <h2 id="attendance-edit-title">Nómina semanal</h2>
                <p id="attendance-edit-subtitle" class="muted"></p>
              </div>
              <div class="row-actions">
                <button id="attendance-save-btn" type="button">Guardar cambios</button>
                <button id="attendance-close-btn" type="button" class="secondary">Cerrar nómina</button>
                <button id="attendance-reopen-btn" type="button" class="secondary hidden">Reabrir</button>
                <button id="attendance-print-btn" type="button" class="secondary">Imprimir</button>
                <button id="attendance-cancel-btn" type="button" class="secondary">Cancelar nómina</button>
                <button id="attendance-back-btn" type="button" class="secondary">Volver al archivo</button>
              </div>
            </div>
            <p id="attendance-edit-message" class="message"></p>
            <div class="table-wrapper" style="overflow-x:auto;">
              <table class="attendance-table">
                <thead id="attendance-table-head"></thead>
                <tbody id="attendance-table-body"></tbody>
              </table>
            </div>
            <div class="attendance-legend" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.82rem;">
              <span style="background:#fff9c4;padding:2px 6px;border-radius:3px;">F Falta</span>
              <span style="background:#e0e0e0;padding:2px 6px;border-radius:3px;">B Baja</span>
              <span style="padding:2px 6px;border:1px solid #ddd;border-radius:3px;">A Asistencia</span>
              <span style="background:#b3e5fc;padding:2px 6px;border-radius:3px;">A* Trabajo fuera</span>
              <span style="background:#ffcdd2;padding:2px 6px;border-radius:3px;">PC Permiso c/goce</span>
              <span style="background:#ef9a9a;padding:2px 6px;border-radius:3px;">PS Permiso s/goce</span>
              <span style="background:#bbdefb;padding:2px 6px;border-radius:3px;">D Descanso</span>
              <span style="background:#c8e6c9;padding:2px 6px;border-radius:3px;">I Incapacidad</span>
              <span style="background:#b2dfdb;padding:2px 6px;border-radius:3px;">V Vacaciones</span>
            </div>
          </div>

          <!-- New Week Modal -->
          <div id="attendance-new-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2>Nueva nómina semanal</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="attendance-new-form" class="grid-form mobile-form">
                <label>
                  Año *
                  <input name="year" type="number" required value="2026" />
                </label>
                <label>
                  Semana (1-53) *
                  <input name="week_number" type="number" min="1" max="53" required />
                </label>
                <p id="attendance-week-preview" class="muted"></p>
                <button type="submit">Generar nómina</button>
                <p id="attendance-new-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- Cancel Modal -->
          <div id="attendance-cancel-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2>Cancelar nómina</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="attendance-cancel-form" class="stack mobile-form">
                <label>
                  Motivo de cancelación *
                  <textarea name="reason" rows="3" required></textarea>
                </label>
                <button type="submit">Confirmar cancelación</button>
              </form>
            </div>
          </div>
        </section>

        <section id="ecovis-view" class="hidden">
          <!-- Summary cards -->
          <section class="cards ecovis-cards">
            <article><span>Total proyectos ECOVIS</span><strong id="ecovis-stat-projects">$0.00</strong></article>
            <article><span>Pagado a proyectos</span><strong id="ecovis-stat-paid">$0.00</strong></article>
            <article><span>Pendiente por cobrar</span><strong id="ecovis-stat-pending">$0.00</strong></article>
            <article><span>Prestamos vigentes</span><strong id="ecovis-stat-loans">$0.00</strong></article>
            <article><span>Saldo a favor ECOVIS</span><strong id="ecovis-stat-credit">$0.00</strong></article>
            <article><span>Pagos no asignados</span><strong id="ecovis-stat-unallocated">$0.00</strong></article>
            <article class="ecovis-balance-card"><span>Balance neto</span><strong id="ecovis-stat-balance">$0.00</strong></article>
          </section>

          <!-- Sub-navigation tabs for ECOVIS sections -->
          <div class="ecovis-subtabs">
            <button id="ecovis-subtab-projects" class="secondary active" type="button">Proyectos ECOVIS</button>
            <button id="ecovis-subtab-payments" class="secondary" type="button">Pagos / Abonos</button>
            <button id="ecovis-subtab-loans" class="secondary" type="button">Prestamos</button>
            <button id="ecovis-subtab-movements" class="secondary" type="button">Movimientos</button>
            <button id="ecovis-subtab-history" class="secondary" type="button">Historial</button>
          </div>

          <!-- ECOVIS Projects Section -->
          <div id="ecovis-projects-section">
            <div class="panel">
              <div class="panel-header">
                <h2>Proyectos ECOVIS</h2>
                <button id="ecovis-new-project-btn" type="button">Agregar proyecto</button>
              </div>
              <p class="text-muted" style="margin: 0 0 0.5rem 0; font-size: 0.85rem;">Los proyectos pagados al 100% se consultan en Historial.</p>
              <div class="search-bar">
                <input id="ecovis-projects-search" type="text" placeholder="Buscar proyectos ECOVIS..." />
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Proyecto</th>
                      <th>Cotizacion</th>
                      <th>OC</th>
                      <th>Factura</th>
                      <th>Monto total</th>
                      <th>Pagado</th>
                      <th>Pendiente</th>
                      <th>Estatus</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="ecovis-projects-table"></tbody>
                </table>
              </div>
              <div id="ecovis-projects-pagination"></div>
            </div>
          </div>

          <!-- ECOVIS Payments Section -->
          <div id="ecovis-payments-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Pagos / Abonos de ECOVIS</h2>
                <button id="ecovis-new-payment-btn" type="button">Registrar pago</button>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Moneda</th>
                      <th>Metodo</th>
                      <th>Referencia</th>
                      <th>Asignado</th>
                      <th>Sin asignar</th>
                      <th>Estatus</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="ecovis-payments-table"></tbody>
                </table>
              </div>
              <div id="ecovis-payments-pagination"></div>
            </div>
          </div>

          <!-- ECOVIS Loans Section -->
          <div id="ecovis-loans-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Prestamos ECOVIS a REVRAM</h2>
                <button id="ecovis-new-loan-btn" type="button">Registrar prestamo</button>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Moneda</th>
                      <th>Referencia</th>
                      <th>Descripcion</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="ecovis-loans-table"></tbody>
                </table>
              </div>
              <div id="ecovis-loans-pagination"></div>
            </div>
          </div>

          <!-- ECOVIS Movements Section -->
          <div id="ecovis-movements-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Historial de movimientos</h2>
                <div class="row-actions">
                  <button id="ecovis-adjustment-btn" class="secondary" type="button">Ajuste manual</button>
                </div>
              </div>
              <div class="search-bar">
                <input id="ecovis-movements-search" type="text" placeholder="Buscar movimientos..." />
                <select id="ecovis-movements-type-filter">
                  <option value="">Todos los tipos</option>
                  <option value="proyecto">Proyecto</option>
                  <option value="pago_recibido">Pago recibido</option>
                  <option value="prestamo_ecovis_a_revram">Prestamo</option>
                  <option value="aplicacion_a_proyecto">Aplicacion a proyecto</option>
                  <option value="saldo_a_favor">Saldo a favor</option>
                  <option value="devolucion">Devolucion</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="cancelacion">Cancelacion</option>
                </select>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Descripcion</th>
                      <th>Monto</th>
                      <th>Direccion</th>
                      <th>Referencia</th>
                      <th>Usuario</th>
                    </tr>
                  </thead>
                  <tbody id="ecovis-movements-table"></tbody>
                </table>
              </div>
              <div id="ecovis-movements-pagination"></div>
            </div>
          </div>

          <!-- ECOVIS History Section -->
          <div id="ecovis-history-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Historial de Proyectos Pagados</h2>
              </div>
              <div class="search-bar">
                <select id="ecovis-history-year">
                  <option value="">-- Selecciona un año --</option>
                </select>
                <select id="ecovis-history-month">
                  <option value="">Todos los meses</option>
                  <option value="1">Enero</option>
                  <option value="2">Febrero</option>
                  <option value="3">Marzo</option>
                  <option value="4">Abril</option>
                  <option value="5">Mayo</option>
                  <option value="6">Junio</option>
                  <option value="7">Julio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </select>
                <button id="ecovis-history-search-btn" type="button">Buscar</button>
              </div>
              <p class="text-muted" style="margin: 0.5rem 0; font-size: 0.85rem;">Los proyectos pagados al 100% se consultan aquí.</p>
              <div id="ecovis-history-results">
                <p class="empty-message">Selecciona un año para consultar el historial.</p>
              </div>
            </div>
          </div>

          <!-- ECOVIS Project Form Modal -->
          <div id="ecovis-project-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2 id="ecovis-project-form-title">Agregar proyecto ECOVIS</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="ecovis-project-form" class="grid-form">
                <input type="hidden" name="id" />
                <label>Nombre del proyecto *<input name="project_name" required /></label>
                <label>Fecha del proyecto *<input name="project_date" type="date" required /></label>
                <label>Cotizacion<input name="quote_number" /></label>
                <label>Orden de compra<input name="purchase_order_number" /></label>
                <label>Numero de factura<input name="invoice_number" /></label>
                <label class="full money-field">Monto total *
                  <div class="money-row">
                    <input name="total_amount" id="ecovis-project-total-amount" type="text" inputmode="decimal" required />
                    <select name="currency" id="ecovis-project-currency"><option>MXN</option><option>USD</option><option>EUR</option></select>
                  </div>
                </label>
                <p id="ecovis-project-amount-locked" class="muted hidden full">El monto esta bloqueado por pagos/asignaciones existentes. Use ajuste controlado.</p>
                <button type="button" id="ecovis-project-adjustment-btn" class="secondary hidden full">Solicitar ajuste de monto</button>
                <label class="full">Descripcion<textarea name="description" rows="2"></textarea></label>
                <label class="full">Notas<textarea name="notes" rows="2"></textarea></label>
                <button type="submit">Guardar proyecto ECOVIS</button>
                <p id="ecovis-project-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- ECOVIS Payment Form Modal -->
          <div id="ecovis-payment-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2 id="ecovis-payment-form-title">Registrar pago de ECOVIS</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="ecovis-payment-form" class="grid-form">
                <input type="hidden" name="id" />
                <label>Fecha de pago *<input name="payment_date" type="date" required /></label>
                <label class="full money-field">Monto *
                  <div class="money-row">
                    <input name="amount" id="ecovis-payment-amount" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" required />
                    <select name="currency"><option>MXN</option><option>USD</option><option>EUR</option></select>
                  </div>
                </label>
                <label>Metodo de pago<input name="payment_method" /></label>
                <label>Referencia bancaria<input name="bank_reference" /></label>
                <label class="full">Descripcion<input name="source_description" /></label>
                <label class="full">Notas<textarea name="notes" rows="2"></textarea></label>
                <button type="submit">Registrar pago</button>
                <p id="ecovis-payment-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- ECOVIS Allocation Modal -->
          <div id="ecovis-allocation-modal" class="modal-overlay hidden">
            <div class="modal-content panel modal-large">
              <div class="panel-header">
                <div>
                  <h2>Asignar pago</h2>
                  <p id="ecovis-allocation-subtitle" class="muted"></p>
                </div>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <div class="detail-grid" id="ecovis-allocation-summary"></div>
              <h3>Asignaciones existentes</h3>
              <div class="table-wrapper">
                <table>
                  <thead><tr><th>Tipo</th><th>Proyecto</th><th>Monto</th><th>Nota</th></tr></thead>
                  <tbody id="ecovis-allocations-list"></tbody>
                </table>
              </div>
              <h3>Nueva asignacion</h3>
              <form id="ecovis-allocation-form" class="grid-form">
                <label>Tipo de asignacion *
                  <select name="allocation_type" required>
                    <option value="proyecto">Proyecto ECOVIS</option>
                    <option value="saldo_a_favor">Saldo a favor de ECOVIS</option>
                    <option value="prestamo">Prestamo</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </label>
                <label id="ecovis-allocation-project-label">Proyecto ECOVIS *
                  <select name="ecovis_project_id" id="ecovis-allocation-project-select"></select>
                </label>
                <label>Monto a asignar *<input name="amount" type="text" inputmode="decimal" required /></label>
                <label class="full">Nota<input name="notes" /></label>
                <button type="submit">Asignar</button>
                <p id="ecovis-allocation-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- ECOVIS Loan Form Modal -->
          <div id="ecovis-loan-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2 id="ecovis-loan-form-title">Registrar prestamo</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="ecovis-loan-form" class="grid-form">
                <label>Fecha *<input name="movement_date" type="date" required /></label>
                <label class="full money-field">Monto *
                  <div class="money-row">
                    <input name="amount" type="text" inputmode="decimal" required />
                    <select name="currency"><option>MXN</option><option>USD</option><option>EUR</option></select>
                  </div>
                </label>
                <label>Referencia<input name="reference" /></label>
                <label class="full">Descripcion *<input name="description" required /></label>
                <label class="full">Notas<textarea name="notes" rows="2"></textarea></label>
                <button type="submit">Registrar prestamo</button>
                <p id="ecovis-loan-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- ECOVIS Adjustment Modal -->
          <div id="ecovis-adjustment-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2>Ajuste manual</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="ecovis-adjustment-form" class="grid-form">
                <label>Fecha *<input name="movement_date" type="date" required /></label>
                <label>Monto *<input name="amount" type="text" inputmode="decimal" required /></label>
                <label>Direccion *
                  <select name="direction" required>
                    <option value="ecovis_debe_a_revram">ECOVIS debe a REVRAM</option>
                    <option value="revram_debe_a_ecovis">REVRAM debe a ECOVIS</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </label>
                <label class="full">Motivo * (obligatorio)<input name="description" required /></label>
                <label>Referencia<input name="reference" /></label>
                <label class="full">Notas<textarea name="notes" rows="2"></textarea></label>
                <button type="submit">Registrar ajuste</button>
                <p id="ecovis-adjustment-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- ECOVIS Amount Adjustment Modal (admin) -->
          <div id="ecovis-amount-adjustment-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2 id="ecovis-amount-adjustment-title">Ajuste controlado de monto</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="ecovis-amount-adjustment-form" class="grid-form">
                <input type="hidden" name="entity_type" />
                <input type="hidden" name="entity_id" />
                <label class="full money-field">Nuevo monto *
                  <div class="money-row">
                    <input name="new_amount_original" type="text" inputmode="decimal" required />
                    <select name="new_currency"><option>MXN</option><option>USD</option><option>EUR</option></select>
                  </div>
                </label>
                <label class="full">Motivo del ajuste *<textarea name="reason" rows="2" required></textarea></label>
                <label class="full">Notas<textarea name="notes" rows="2"></textarea></label>
                <button type="submit">Aplicar ajuste</button>
                <p id="ecovis-amount-adjustment-message" class="message"></p>
              </form>
            </div>
          </div>

          <!-- ECOVIS Apply Credit Modal -->
          <div id="ecovis-apply-credit-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2>Aplicar saldo a favor</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <p id="ecovis-credit-available" class="muted"></p>
              <form id="ecovis-apply-credit-form" class="grid-form">
                <label>Proyecto ECOVIS *
                  <select name="ecovis_project_id" id="ecovis-credit-project-select" required></select>
                </label>
                <label>Monto a aplicar *<input name="amount" type="text" inputmode="decimal" required /></label>
                <label>Fecha *<input name="movement_date" type="date" required /></label>
                <label class="full">Notas<input name="notes" /></label>
                <button type="submit">Aplicar saldo a favor</button>
                <p id="ecovis-apply-credit-message" class="message"></p>
              </form>
            </div>
          </div>
        </section>

        <div id="backup-import-modal" class="modal-overlay hidden">
          <div class="modal-content panel modal-large">
            <div class="panel-header">
              <h2>Importar respaldo</h2>
              <button class="secondary modal-close" type="button" id="backup-close-modal">Cerrar</button>
            </div>
            <p class="muted">Selecciona un archivo .json de respaldo para previsualizar la importación.</p>
            <input type="file" id="backup-file-input" accept=".json" />
            <div id="backup-preview-area" class="hidden" style="margin-top:16px;">
              <h3>Vista previa de importación</h3>
              <p class="muted">Esta importación no reemplazará datos existentes. Primero agregará registros faltantes. Los conflictos serán reportados para revisión manual.</p>
              <div id="backup-preview-table" class="table-wrapper"></div>
              <div id="backup-preview-conflicts" class="hidden" style="margin-top:12px;">
                <h4 style="color:var(--warning);">Conflictos detectados</h4>
                <div id="backup-conflicts-detail"></div>
              </div>
              <div style="display:flex;gap:12px;margin-top:16px;">
                <button id="backup-confirm-import" type="button">Confirmar importación</button>
                <button id="backup-cancel-import" class="secondary" type="button">Cancelar</button>
              </div>
            </div>
            <p id="backup-import-message" class="message" style="margin-top:12px;"></p>
          </div>
        </div>

        <!-- Service Quoter Module -->
        <section id="service-quoter-view" class="hidden">
          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Herramienta de consulta</p>
                <h2>Cotizador Rápido de Servicios</h2>
                <p class="muted">Estimación de costos de mano de obra, transporte, viáticos e IVA. No guarda resultados.</p>
              </div>
              <div style="display:flex;gap:8px;">
                <button id="sq-calculate-btn" type="button">Calcular</button>
                <button id="sq-clear-btn" class="secondary" type="button">Limpiar</button>
                <button id="sq-config-btn" class="secondary hidden" type="button">Configuración</button>
              </div>
            </div>

            <div class="grid-form" style="grid-template-columns:1fr 1fr;gap:16px;">
              <!-- General Context + Service Type -->
              <fieldset style="border:1px solid var(--border);border-radius:8px;padding:12px;">
                <legend style="font-weight:600;font-size:0.85rem;">Datos de Consulta</legend>
                <label>Cliente (opcional)<input id="sq-client" type="text" placeholder="Nombre del cliente"></label>
                <label>Proyecto/Referencia (opcional)<input id="sq-reference" type="text" placeholder="Referencia"></label>
                <label>Tipo de servicio *<select id="sq-service-type"><option value="">Seleccionar...</option></select></label>
                <label>Margen real aplicado<input id="sq-margin-display" type="text" readonly disabled></label>
                <label>Notas internas (opcional)<textarea id="sq-notes" rows="2" placeholder="Notas de contexto"></textarea></label>
              </fieldset>

              <!-- Labor -->
              <fieldset style="border:1px solid var(--border);border-radius:8px;padding:12px;">
                <legend style="font-weight:600;font-size:0.85rem;">Mano de Obra</legend>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:0.85rem;">
                  <div><strong>Programador</strong>
                    <label>Cantidad<input id="sq-prog-qty" type="number" min="0" value="0"></label>
                    <label>Modo<select id="sq-prog-mode"><option value="horas">Horas</option><option value="dias">Días</option></select></label>
                    <label><span id="sq-prog-input-label">Horas</span><input id="sq-prog-time" type="number" min="0" value="0"></label>
                    <label>Tarifa ($/h)<input id="sq-prog-rate" type="number" min="0" step="0.01" value="300" readonly></label>
                  </div>
                  <div><strong>Técnico</strong>
                    <label>Cantidad<input id="sq-tech-qty" type="number" min="0" value="0"></label>
                    <label>Modo<select id="sq-tech-mode"><option value="horas">Horas</option><option value="dias">Días</option></select></label>
                    <label><span id="sq-tech-input-label">Horas</span><input id="sq-tech-time" type="number" min="0" value="0"></label>
                    <label>Tarifa ($/h)<input id="sq-tech-rate" type="number" min="0" step="0.01" value="250" readonly></label>
                  </div>
                  <div><strong>Ayudante</strong>
                    <label>Cantidad<input id="sq-helper-qty" type="number" min="0" value="0"></label>
                    <label>Modo<select id="sq-helper-mode"><option value="horas">Horas</option><option value="dias">Días</option></select></label>
                    <label><span id="sq-helper-input-label">Horas</span><input id="sq-helper-time" type="number" min="0" value="0"></label>
                    <label>Tarifa ($/h)<input id="sq-helper-rate" type="number" min="0" step="0.01" value="175" readonly></label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div class="grid-form" style="grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px;">
              <!-- Transport -->
              <fieldset style="border:1px solid var(--border);border-radius:8px;padding:12px;">
                <legend style="font-weight:600;font-size:0.85rem;">Transporte</legend>
                <label>Tipo<select id="sq-transport-type"><option value="vehiculo">Vehículo</option><option value="aereo">Aéreo</option></select></label>
                <div id="sq-transport-vehiculo">
                  <label>Horas de traslado<input id="sq-travel-hours" type="number" min="0" value="0"></label>
                  <label>Tarifa calculada por hora de traslado ($/h)<input id="sq-travel-rate" type="text" value="$0" readonly disabled style="background:#f3f4f6;"></label>
                  <label>Kilómetros<input id="sq-km" type="number" min="0" value="0"></label>
                  <label>Costo por km ($)<input id="sq-km-rate" type="number" min="0" step="0.01" value="7.50" readonly></label>
                </div>
                <div id="sq-transport-aereo" class="hidden">
                  <label>Personas en vuelo<input id="sq-flight-persons" type="number" min="0" value="0"></label>
                  <label>Costo vuelo/persona ($)<input id="sq-flight-cost" type="number" min="0" step="0.01" value="0"></label>
                  <label>Otros costos aéreos ($)<input id="sq-flight-other" type="number" min="0" step="0.01" value="0"></label>
                  <label>Notas transporte<input id="sq-flight-notes" type="text" placeholder="Opcional"></label>
                </div>
              </fieldset>

              <!-- Viáticos -->
              <fieldset style="border:1px solid var(--border);border-radius:8px;padding:12px;">
                <legend style="font-weight:600;font-size:0.85rem;">Viáticos</legend>
                <label>Noches hotel<input id="sq-hotel-nights" type="number" min="0" value="0"></label>
                <label>Costo hotel/noche ($)<input id="sq-hotel-rate" type="number" min="0" step="0.01" value="2500"></label>
                <label>Días comida<input id="sq-meal-days" type="number" min="0" value="0"></label>
                <label>Costo por comida ($)<input id="sq-meal-rate" type="number" min="0" step="0.01" value="150"></label>
                <label>Comidas por día<input id="sq-meals-per-day" type="number" min="0" value="3"></label>
              </fieldset>

              <!-- Otros costos -->
              <fieldset style="border:1px solid var(--border);border-radius:8px;padding:12px;">
                <legend style="font-weight:600;font-size:0.85rem;">Otros Costos</legend>
                <label>Monto ($)<input id="sq-other-costs" type="number" min="0" step="0.01" value="0"></label>
                <label>Notas<input id="sq-other-costs-notes" type="text" placeholder="Opcional"></label>
              </fieldset>
            </div>

            <!-- Results -->
            <div id="sq-results" class="hidden" style="margin-top:20px;border:2px solid var(--primary);border-radius:8px;padding:16px;">
              <h3 style="margin:0 0 12px 0;">Resumen de Cálculo</h3>
              <table style="width:100%;border-collapse:collapse;">
                <tbody>
                  <tr><td>Subtotal Mano de Obra</td><td style="text-align:right;font-weight:600;" id="sq-r-labor">$0.00</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Programador(es)</td><td style="text-align:right;color:var(--muted);" id="sq-r-labor-prog">$0.00</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Técnico(s)</td><td style="text-align:right;color:var(--muted);" id="sq-r-labor-tech">$0.00</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Ayudante(s)</td><td style="text-align:right;color:var(--muted);" id="sq-r-labor-helper">$0.00</td></tr>
                  <tr><td>Subtotal Transporte</td><td style="text-align:right;font-weight:600;" id="sq-r-transport">$0.00</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Suma tarifas personal</td><td style="text-align:right;color:var(--muted);" id="sq-r-t-sum">$0</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— 1/3 suma → redondeado</td><td style="text-align:right;color:var(--muted);" id="sq-r-t-rate">$0</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Horas traslado × tarifa</td><td style="text-align:right;color:var(--muted);" id="sq-r-t-hours-cost">$0.00</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Kilómetros</td><td style="text-align:right;color:var(--muted);" id="sq-r-t-km-cost">$0.00</td></tr>
                  <tr><td>Subtotal Viáticos</td><td style="text-align:right;font-weight:600;" id="sq-r-viaticos">$0.00</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Hotel</td><td style="text-align:right;color:var(--muted);" id="sq-r-v-hotel">$0.00</td></tr>
                  <tr><td style="padding-left:20px;color:var(--muted);">— Comidas (<span id="sq-r-v-meals-detail">0 pers × $0 × 0d × 0c</span>)</td><td style="text-align:right;color:var(--muted);" id="sq-r-v-meals">$0.00</td></tr>
                  <tr><td>Otros Costos</td><td style="text-align:right;font-weight:600;" id="sq-r-other">$0.00</td></tr>
                  <tr style="border-top:2px solid var(--border);"><td style="padding-top:8px;font-weight:700;">Subtotal Costos</td><td style="text-align:right;font-weight:700;padding-top:8px;" id="sq-r-subtotal">$0.00</td></tr>
                  <tr><td>Margen real aplicado</td><td style="text-align:right;" id="sq-r-margin">0%</td></tr>
                  <tr><td>Utilidad generada</td><td style="text-align:right;color:green;font-weight:600;" id="sq-r-profit">$0.00</td></tr>
                  <tr style="border-top:1px solid var(--border);"><td style="padding-top:6px;font-weight:700;">Precio antes de IVA</td><td style="text-align:right;font-weight:700;padding-top:6px;" id="sq-r-price-no-iva">$0.00</td></tr>
                  <tr><td>IVA 16%</td><td style="text-align:right;" id="sq-r-iva">$0.00</td></tr>
                  <tr style="border-top:2px solid var(--primary);"><td style="padding-top:8px;font-size:1.1rem;font-weight:700;">TOTAL FINAL</td><td style="text-align:right;font-size:1.1rem;font-weight:700;padding-top:8px;color:var(--primary);" id="sq-r-total">$0.00</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Configuration Modal -->
          <div id="sq-config-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.7);">
            <div class="modal" style="max-width:700px;background:#fff;border-radius:12px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
              <h2>Configuración del Cotizador</h2>
              <div id="sq-config-content">
                <div style="margin-bottom:16px;">
                  <h3 style="margin:0 0 8px 0;">Tipos de Servicio</h3>
                  <table id="sq-config-types-table" style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead><tr><th>Nombre</th><th>Margen</th><th>Activo</th><th>Orden</th><th></th></tr></thead>
                    <tbody></tbody>
                  </table>
                  <div style="margin-top:8px;display:flex;gap:8px;">
                    <input id="sq-new-type-name" type="text" placeholder="Nuevo tipo" style="flex:1;">
                    <input id="sq-new-type-margin" type="number" min="0" max="0.99" step="0.01" placeholder="0.60" style="width:80px;">
                    <button id="sq-add-type-btn" type="button" class="secondary">Agregar</button>
                  </div>
                </div>
                <div>
                  <h3 style="margin:0 0 8px 0;">Parámetros Generales</h3>
                  <div id="sq-config-settings-form" class="grid-form" style="grid-template-columns:1fr 1fr;gap:8px;"></div>
                </div>
              </div>
              <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px;">
                <label style="font-weight:600;">Contraseña de administrador *<input id="sq-config-password" type="password" autocomplete="current-password" placeholder="Requerida para guardar cambios"></label>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;">
                <button id="sq-config-save-btn" type="button">Guardar configuración</button>
                <button id="sq-config-close-btn" class="secondary" type="button">Cerrar</button>
              </div>
              <p id="sq-config-message" class="message" style="margin-top:8px;"></p>
            </div>
          </div>
        </section>

        <!-- Financial Re-auth Modal (outside financial-view so it shows when view is hidden) -->
        <div id="fin-reauth-modal" class="modal-overlay hidden">
          <div class="modal-content panel" style="max-width:400px">
            <div class="panel-header">
              <h2>Acceso a Estados Financieros</h2>
            </div>
            <form id="fin-reauth-form">
              <p style="margin:1rem 0">Ingresa tu contraseña de administrador para acceder.</p>
              <div class="form-group">
                <label>Contraseña admin</label>
                <input id="fin-reauth-password" type="password" autocomplete="current-password" required />
              </div>
              <p id="fin-reauth-message" style="min-height:1.2em"></p>
              <div class="row-actions" style="margin-top:1rem">
                <button type="submit">Ingresar</button>
                <button type="button" id="fin-reauth-cancel" class="secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Financial Statements View -->
        <section id="financial-view" class="hidden">
          <div class="ecovis-subtabs">
            <button id="fin-subtab-statement" class="secondary active" type="button">Estado de Resultados</button>
            <button id="fin-subtab-payable" class="secondary" type="button">Cuentas por Pagar</button>
            <button id="fin-subtab-receivable" class="secondary" type="button">Cuentas por Cobrar</button>
            <button id="fin-subtab-bank" class="secondary" type="button">Bancos</button>
            <button id="fin-subtab-payroll" class="secondary" type="button">Nómina</button>
            <button id="fin-subtab-adjustments" class="secondary" type="button">Ajustes</button>
            <button id="fin-subtab-archive" class="secondary" type="button">Archivo</button>
            <button id="fin-subtab-config" class="secondary" type="button">Configuración</button>
          </div>

          <div id="fin-statement-section">
            <div class="panel">
              <div class="panel-header">
                <h2>Generar Estado Financiero Mensual</h2>
              </div>
              <div class="search-bar">
                <select id="fin-stmt-year"></select>
                <select id="fin-stmt-month">
                  <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option>
                  <option value="4">Abril</option><option value="5">Mayo</option><option value="6">Junio</option>
                  <option value="7">Julio</option><option value="8">Agosto</option><option value="9">Septiembre</option>
                  <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                </select>
                <button id="fin-generate-btn" type="button">Generar / Actualizar</button>
              </div>
              <div id="fin-statement-result"></div>
            </div>
          </div>

          <div id="fin-payable-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Cuentas por Pagar</h2>
                <button id="fin-new-ap-btn" type="button">Nueva cuenta por pagar</button>
              </div>
              <div id="fin-ap-list"></div>
            </div>
          </div>

          <div id="fin-receivable-section" class="hidden">
            <div class="panel">
              <div class="panel-header"><h2>Cuentas por Cobrar</h2></div>
              <div id="fin-ar-list"></div>
            </div>
          </div>

          <div id="fin-bank-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Bancos / Estado de Cuenta</h2>
                <button id="fin-new-bank-btn" type="button">Agregar resumen bancario</button>
              </div>
              <div id="fin-bank-list"></div>
            </div>
          </div>

          <div id="fin-payroll-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Nómina Manual</h2>
                <button id="fin-new-payroll-btn" type="button">Agregar nómina</button>
              </div>
              <div id="fin-payroll-list"></div>
            </div>
          </div>

          <div id="fin-adjustments-section" class="hidden">
            <div class="panel">
              <div class="panel-header">
                <h2>Ajustes Manuales</h2>
                <button id="fin-new-adj-btn" type="button">Nuevo ajuste</button>
              </div>
              <div id="fin-adj-list"></div>
            </div>
          </div>

          <div id="fin-archive-section" class="hidden">
            <div class="panel">
              <div class="panel-header"><h2>Archivo de Estados Financieros</h2></div>
              <div id="fin-archive-list"></div>
            </div>
          </div>

          <div id="fin-config-section" class="hidden">
            <div class="panel">
              <div class="panel-header"><h2>Configuración Financiera</h2></div>
              <form id="fin-config-form">
                <div class="form-group">
                  <label>ISR Estimado Administrativo (%)</label>
                  <input type="number" name="estimated_isr_rate" step="1" min="0" max="100" />
                </div>
                <div class="form-group">
                  <label>Comisión IVAN (%)</label>
                  <input type="number" name="ivan_commission_rate" step="1" min="0" max="100" />
                </div>
                <div class="form-group">
                  <label>Contraseña admin (requerida para guardar)</label>
                  <input type="password" name="admin_password" autocomplete="off" />
                </div>
                <button type="submit">Guardar configuración</button>
                <p id="fin-config-message"></p>
              </form>
            </div>
          </div>
        </section>

        <section id="users-view" class="layout hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h2 id="user-form-title">Nuevo usuario</h2>
                <p class="muted">La contrasena es obligatoria al crear y opcional al modificar.</p>
              </div>
              <button id="new-user-button" class="secondary" type="button">Limpiar</button>
            </div>

            <form id="user-form" class="stack">
              <input type="hidden" name="id" />
              <label>
                Usuario
                <input name="username" autocomplete="off" required />
              </label>
              <label>
                Contrasena
                <input name="password" type="password" minlength="6" autocomplete="new-password" />
              </label>
              <label>
                Rol
                <select name="role">
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                  <option value="tecnico">Tecnico</option>
                </select>
              </label>
              <button type="submit">Guardar usuario</button>
              <p id="user-message" class="message"></p>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <div>
                <h2>Usuarios</h2>
                <p class="muted">Selecciona un usuario para modificar su nombre o contrasena.</p>
              </div>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Creado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="users-table"></tbody>
              </table>
            </div>
            <div id="users-pagination"></div>
          </div>
        </section>
        <section id="report-archive-view" class="hidden">
          <div id="archive-projects-panel" class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Archivo</p>
                <h2>ARCHIVO DE REPORTES</h2>
                <p class="muted">Registros archivados desde el modulo Reportes con todos sus reportes tecnicos y de falla.</p>
              </div>
            </div>
            <div style="margin-bottom:12px;">
              <input id="archive-project-search" type="text" placeholder="Buscar cliente, folio, proyecto..." style="max-width:360px;" />
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Proyecto</th>
                    <th>Reportes</th>
                    <th>Archivado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="archive-projects-table"></tbody>
              </table>
            </div>
            <div id="archive-projects-pagination"></div>
          </div>
          <div id="archive-report-list-panel" class="panel hidden">
            <div class="panel-header">
              <div>
                <h2 id="archive-report-list-title">Reportes archivados</h2>
                <p id="archive-report-list-subtitle" class="muted"></p>
              </div>
              <div class="row-actions">
                <button id="archive-report-list-back" class="secondary" type="button">Volver al archivo</button>
              </div>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Servicio</th>
                    <th>Archivado</th>
                    <th>Ejecuto / Solucion</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="archive-report-list-table"></tbody>
              </table>
            </div>
            <div id="archive-project-reports-pagination"></div>
          </div>
        </section>

        <div id="failure-report-view-modal" class="modal-overlay hidden">
          <div class="modal-content panel" style="max-width:560px;">
            <div class="panel-header">
              <h2 id="failure-report-view-title">Reporte de falla</h2>
              <button type="button" class="secondary" id="failure-report-view-close">Cerrar</button>
            </div>
            <div id="failure-report-view-body" class="stack" style="margin-top:12px;"></div>
            <div class="row-actions" style="margin-top:16px;">
              <button type="button" class="secondary" id="failure-report-view-print">Imprimir</button>
            </div>
          </div>
        </div>

        <div id="report-type-modal" class="modal-overlay hidden">
          <div class="modal-content panel">
            <h2 style="margin-bottom:16px;">Selecciona el tipo de reporte</h2>
            <div class="stack">
              <button type="button" class="report-type-option" data-type="boiler_startup">FORMATO DE ARRANQUE DE CALDERA</button>
              <button type="button" class="report-type-option" data-type="general_equipment_service_delivery">ENTREGA GENERAL DE EQUIPO/SERVICIO</button>
              <button type="button" class="report-type-option" data-type="autoflame_system_startup">ARRANQUE DE SISTEMA AUTOFLAME</button>
              <button type="button" class="report-type-option" data-type="failure_report">REPORTE DE FALLA</button>
              <button type="button" class="secondary" id="report-type-cancel">Cancelar</button>
            </div>
          </div>
        </div>
        <section id="commissions-view" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Modulo Comisiones</p>
                <h2>Comisiones de Vendedoras</h2>
                <p class="muted">Empleados activos de Vacaciones · 1% / 3% facturado o monto manual · Pago por comision · Historico con filtros</p>
              </div>
            </div>
            <div class="cards-row" id="commissions-summary-cards"></div>
            <p id="commissions-summary-hint" class="muted" style="margin:0 0 12px;font-size:0.9rem;"></p>
            <div class="ecovis-subtabs" id="commissions-subtabs">
              <button id="commissions-subtab-agents" class="secondary active" type="button">1. Vendedoras</button>
              <button id="commissions-subtab-projects" class="secondary" type="button">2. Asignar por proyecto</button>
              <button id="commissions-subtab-pending" class="secondary" type="button">3. Pendientes de pago</button>
              <button id="commissions-subtab-history" class="secondary" type="button">4. Historico pagadas</button>
            </div>

            <div id="commissions-agents-section">
              <h3>Resumen de ventas y comisiones</h3>
              <form id="commissions-period-form" class="stack inline-form" style="margin-bottom:12px;align-items:flex-end;">
                <label style="display:flex;flex-direction:column;font-size:0.9rem;">Ano
                  <select id="commissions-filter-year" name="year"><option value="">Todos</option></select>
                </label>
                <label style="display:flex;flex-direction:column;font-size:0.9rem;">Mes
                  <select id="commissions-filter-month" name="month">
                    <option value="">Todos</option>
                    <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option>
                    <option value="4">Abril</option><option value="5">Mayo</option><option value="6">Junio</option>
                    <option value="7">Julio</option><option value="8">Agosto</option><option value="9">Septiembre</option>
                    <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>
                </label>
                <button type="submit">Buscar periodo</button>
                <button type="button" class="secondary" id="commissions-period-clear">Ver acumulado total</button>
              </form>
              <div id="commissions-period-totals" class="cards-row"></div>
              <h4 style="margin:16px 0 8px;">Ventas y comisiones por mes</h4>
              <div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Mes</th><th>Total vendido</th><th>Comisiones generadas</th><th>Comisiones pagadas</th></tr></thead><tbody id="commissions-monthly-table"></tbody></table>
              </div>
              <h3 style="margin-top:20px;">Vendedoras con comisiones pendientes de pago</h3>
              <p class="muted">Proyectos y comisiones extraordinarias asignadas que aun no se han pagado.</p>
              <div id="commissions-agents-projects"></div>
              <h3 style="margin-top:20px;">Registrar vendedora (empleado activo Vacaciones)</h3>
              <form id="agent-form" class="stack inline-form">
                <input type="hidden" name="id" />
                <select name="employee_id" id="agent-employee-select" required><option value="">Empleado activo...</option></select>
                <input name="start_date" type="date" required />
                <button type="submit">Guardar vendedora</button>
              </form>
              <h3 style="margin-top:16px;">Comision extraordinaria (sin proyecto)</h3>
              <form id="commission-extraordinary-form" class="stack inline-form">
                <select name="employee_id" required><option value="">Empleado activo (Vacaciones)...</option></select>
                <input name="commission_amount_mxn" type="number" step="0.01" min="0.01" placeholder="Monto MXN" required />
                <input name="description" placeholder="Descripcion (ej. premio proveedor)" required />
                <input name="reference" placeholder="Referencia" />
                <button type="submit">Agregar a pendientes</button>
              </form>
              <h3 style="margin-top:20px;">Todas las vendedoras</h3>
              <div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Nombre</th><th>Empleado Vacaciones</th><th>Activa</th><th>Pendiente pago</th><th>Comisiones pagadas</th><th></th></tr></thead><tbody id="agents-table"></tbody></table>
              </div>
            </div>

            <div id="commissions-projects-section" class="hidden">
              <p class="muted">Proyectos abiertos o cerrados sin comision asignada. Al asignar, el proyecto desaparece de esta lista.</p>
              <p id="commissions-available-status" class="muted" style="margin:8px 0;"></p>
              <p id="commissions-available-error" class="message error hidden"></p>
              <button type="button" class="secondary" id="commissions-refresh-projects" style="margin-bottom:8px;">Actualizar lista</button>
              <div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Cotizacion</th><th>Cliente</th><th>Pedido</th><th>Facturado MXN</th><th>Utilidad real</th><th></th></tr></thead><tbody id="available-projects-table"></tbody></table>
              </div>
            </div>

            <div id="commissions-pending-section" class="hidden">
              <p class="muted">Comisiones asignadas en espera de pago (proyecto y extraordinarias).</p>
              <div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Cotizacion</th><th>Cliente</th><th>Vendedora</th><th>Base</th><th>Monto MXN</th><th>Utilidad real</th><th>Tipo</th><th></th></tr></thead><tbody id="commissions-table"></tbody></table>
              </div>
            </div>

            <div id="commissions-history-section" class="hidden">
              <p class="muted">El historico no se muestra por defecto. Indique al menos un filtro para consultar comisiones pagadas.</p>
              <form id="commission-archived-search-form" class="stack inline-form">
                <input name="client_name" placeholder="Cliente" />
                <input name="quote_number" placeholder="No. cotizacion" />
                <input name="order_number" placeholder="No. pedido" />
                <input name="date_from" type="date" title="Desde" />
                <input name="date_to" type="date" title="Hasta" />
                <button type="submit">Buscar en historico</button>
              </form>
              <div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Cotizacion</th><th>Cliente</th><th>Vendedora</th><th>Base</th><th>Monto MXN</th><th>Fecha pago</th><th>Referencia</th></tr></thead><tbody id="commissions-archived-table"></tbody></table>
              </div>
              <h3 style="margin-top:20px;">Detalle de pagos registrados</h3>
              <div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Vendedora</th><th>Cotizacion</th><th>Fecha</th><th>Monto</th><th>Moneda</th><th>Referencia</th></tr></thead><tbody id="commission-payments-table"></tbody></table>
              </div>
            </div>
          </div>

          <div id="commission-assign-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2>Asignar comision a proyecto</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="commission-assign-form" class="grid-form">
                <input type="hidden" name="project_id" />
                <p class="full muted" id="commission-assign-project-summary"></p>
                <label class="full">Empleado (Vacaciones, activos) *
                  <select name="employee_id" required><option value="">Seleccione empleado...</option></select>
                </label>
                <p class="full muted" style="margin:0;">Solo empleados activos del modulo Vacaciones. Debe estar registrado como vendedora en la pestana 1.</p>
                <label class="full">Tipo de comision *
                  <select name="commission_calculation_base_type" required>
                    <option value="facturado_1pct">1% sobre cantidad facturada</option>
                    <option value="facturado_3pct">3% sobre cantidad facturada</option>
                    <option value="monto_manual">Monto definido a mano</option>
                  </select>
                </label>
                <label id="commission-assign-manual-wrap" class="full hidden">Monto comision (MXN) *
                  <input name="commission_amount_mxn" type="number" step="0.01" min="0.01" />
                </label>
                <p class="full"><strong>Monto calculado:</strong> <span id="commission-assign-preview">—</span></p>
                <label class="full">Referencia (opcional)<input name="reference" /></label>
                <button type="submit" class="full">Asignar comision</button>
                <p id="commission-assign-message" class="message full"></p>
              </form>
            </div>
          </div>

          <div id="commission-pay-modal" class="modal-overlay hidden">
            <div class="modal-content panel">
              <div class="panel-header">
                <h2>Registrar pago de comision</h2>
                <button class="secondary modal-close" type="button">Cerrar</button>
              </div>
              <form id="commission-pay-form" class="grid-form">
                <input type="hidden" name="commission_id" />
                <p class="full muted" id="commission-pay-summary"></p>
                <label>Fecha de pago *<input name="payment_date" type="date" required /></label>
                <label class="full money-field">Monto *
                  <div class="money-row">
                    <input name="amount_original" type="number" step="0.01" min="0.01" required />
                    <select name="currency"><option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
                  </div>
                </label>
                <label id="commission-pay-rate-wrap" class="full hidden">Tipo de cambio a MXN *<input name="exchange_rate_to_mxn" type="number" step="0.0001" min="0.0001" /></label>
                <label class="full">Referencia<input name="reference" /></label>
                <button type="submit" class="full">Marcar como pagada</button>
                <p id="commission-pay-message" class="message full"></p>
              </form>
            </div>
          </div>
        </section>


        <section id="kpis-view" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Evaluacion Fase 1</p>
                <h2>Tablero KPIs</h2>
                <p class="muted">Indicadores administrativos, comerciales, operativos y de cobranza. Solo administrador.</p>
              </div>
            </div>
            <div id="kpis-access-denied" class="hidden" style="padding:24px;color:var(--danger);font-weight:600;">
              Acceso restringido. Solo el administrador puede consultar el Tablero KPIs.
            </div>
            <div id="kpis-dashboard">
              <form id="kpi-filter-form" class="kpi-filters" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:12px 0;border-bottom:1px solid var(--border);margin-bottom:12px;">
                <label style="display:flex;flex-direction:column;font-size:0.85rem;">Periodo
                  <select id="kpi-period-type" name="periodType">
                    <option value="current_month">Mes actual</option>
                    <option value="previous_month">Mes anterior</option>
                    <option value="current_quarter">Trimestre actual</option>
                    <option value="current_year">Ano actual</option>
                    <option value="custom">Rango personalizado</option>
                  </select>
                </label>
                <label id="kpi-start-label" class="hidden" style="display:none;flex-direction:column;font-size:0.85rem;">Desde
                  <input id="kpi-start-date" name="startDate" type="date" />
                </label>
                <label id="kpi-end-label" class="hidden" style="display:none;flex-direction:column;font-size:0.85rem;">Hasta
                  <input id="kpi-end-date" name="endDate" type="date" />
                </label>
                <label style="display:flex;flex-direction:column;font-size:0.85rem;">Departamento
                  <select id="kpi-department" name="department"><option value="">Todos</option></select>
                </label>
                <label style="display:flex;flex-direction:column;font-size:0.85rem;">Empleado
                  <select id="kpi-employee" name="employeeId"><option value="">Todos</option></select>
                </label>
                <label style="display:flex;flex-direction:column;font-size:0.85rem;">Cliente
                  <select id="kpi-client" name="clientName"><option value="">Todos</option></select>
                </label>
                <label style="display:flex;flex-direction:column;font-size:0.85rem;">Proyecto
                  <select id="kpi-project" name="projectId"><option value="">Todos</option></select>
                </label>
                <label style="display:flex;flex-direction:column;font-size:0.85rem;">Estatus
                  <select id="kpi-status" name="status"><option value="">Todos</option></select>
                </label>
                <button type="submit">Consultar</button>
              </form>
              
              <div class="kpi-toolbar" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;">
                <button type="button" id="kpi-btn-manual-quotes" class="secondary">Captura Cotizaciones</button>
                <button type="button" id="kpi-btn-config" class="secondary">Configuracion</button>
                <button type="button" id="kpi-btn-export-pdf" class="secondary">Exportar PDF</button>
                <button type="button" id="kpi-btn-export-excel" class="secondary">Exportar Excel</button>
              </div>
              <div id="kpi-charts-section" class="kpi-charts-grid kpi-charts-global">
                <div class="panel kpi-chart-panel"><h3>Cartera por vencimiento</h3><canvas id="kpi-chart-receivable" height="200"></canvas></div>
                <div class="panel kpi-chart-panel"><h3>Servicios realizados por mes (tecnicos)</h3><canvas id="kpi-chart-reports" height="200"></canvas></div>
              </div>

              <p id="kpi-period-label" class="muted" style="margin:8px 0;"></p>
              <div id="kpi-summary-cards" class="kpi-cards"></div>
              <div id="kpi-loading" class="muted hidden">Cargando indicadores...</div>
              <div id="kpi-error" class="hidden" style="color:var(--danger);padding:8px 0;"></div>
              <div id="kpi-sections">
                <div class="kpi-section panel" id="kpi-section-ventas"><h3>Ventas</h3>
                  <div id="kpi-ventas-cards" class="kpi-ventas-card-groups"></div>
                  <div id="kpi-ventas-pending" class="kpi-pending-capture hidden"></div>
                  <div id="kpi-ventas-charts" class="kpi-charts-grid kpi-ventas-charts-grid">
                    <div class="panel kpi-chart-panel"><h3>Tendencia mensual</h3><canvas id="kpi-chart-ventas-trend" height="220"></canvas></div>
                    <div class="panel kpi-chart-panel"><h3>Embudo comercial del periodo</h3><canvas id="kpi-chart-ventas-funnel" height="180"></canvas></div>
                    <div class="panel kpi-chart-panel"><h3>Ranking por monto vendido</h3><canvas id="kpi-chart-ventas-ranking" height="220"></canvas></div>
                    <div class="panel kpi-chart-panel"><h3>Brecha de margen: real vs deseado</h3><canvas id="kpi-chart-ventas-margin" height="220"></canvas></div>
                  </div>
                  <div id="kpi-ventas-content" class="kpi-metrics hidden"></div>
                  <div id="kpi-ventas-sellers-wrap" class="table-wrapper" style="margin-top:12px;">
                    <h4 style="margin:0 0 8px;">KPIs por vendedor</h4>
                    <table class="data-table kpi-ventas-sellers-table">
                      <thead>
                        <tr>
                          <th>Vendedor</th>
                          <th>Cotizaciones (cant.)</th>
                          <th>Monto cotizado</th>
                          <th>Proyectos cerrados</th>
                          <th>Monto vendido</th>
                          <th>Tasa cierre (%)</th>
                          <th>Margen real (%)</th>
                          <th>Cobrado</th>
                          <th>Semáforo</th>
                        </tr>
                      </thead>
                      <tbody id="kpi-ventas-sellers-table"></tbody>
                    </table>
                  </div>
                  <div id="kpi-ventas-alerts-wrap" class="kpi-ventas-alerts" style="margin-top:16px;"></div>
                </div>
                <div class="kpi-section panel" id="kpi-section-proyectos"><h3>Proyectos</h3><div id="kpi-proyectos-content" class="kpi-metrics"></div></div>
                <div class="kpi-section panel" id="kpi-section-reportes"><h3>Reportes Tecnicos</h3><div id="kpi-reportes-content" class="kpi-metrics"></div></div>
                <div class="kpi-section panel" id="kpi-section-facturacion"><h3>Facturacion</h3><div id="kpi-facturacion-content" class="kpi-metrics"></div></div>
                <div class="kpi-section panel" id="kpi-section-cobranza"><h3>Cobranza</h3><div id="kpi-cobranza-content" class="kpi-metrics"></div></div>
                <div class="kpi-section panel" id="kpi-section-departments"><h3>KPIs por Departamento</h3><div id="kpi-departments-content"></div></div>
                <div class="kpi-section panel" id="kpi-section-employees"><h3>KPIs por Empleado</h3><div class="table-wrapper"><table><thead><tr><th>Empleado</th><th>Departamento</th><th>Indicadores</th><th>Semaforo</th><th>Alertas</th></tr></thead><tbody id="kpi-employees-table"></tbody></table></div></div>
                <div class="kpi-section panel" id="kpi-section-alerts"><h3>Alertas Operativas</h3><div class="table-wrapper"><table><thead><tr><th>Severidad</th><th>Tipo</th><th>Responsable</th><th>Fecha</th><th>Accion sugerida</th><th>Registro</th></tr></thead><tbody id="kpi-alerts-table"></tbody></table></div></div>
              </div>
              <div id="kpi-unassigned" class="hidden panel" style="margin-top:12px;">
                <h3>Sin departamento asignado</h3>
                <ul id="kpi-unassigned-list"></ul>
              </div>
            </div>
          </div>
        </section>

        
        <div id="kpi-reauth-modal" class="modal-overlay hidden">
          <div class="modal">
            <h3>Confirmar administrador</h3>
            <p class="muted">Ingrese su contrasena para acceder a la configuracion del Tablero KPIs.</p>
            <form id="kpi-reauth-form">
              <label>Contrasena admin
                <input id="kpi-reauth-password" type="password" autocomplete="current-password" required />
              </label>
              <p id="kpi-reauth-message" style="min-height:1.2em;color:var(--danger);"></p>
              <div class="modal-actions">
                <button type="button" id="kpi-reauth-cancel" class="secondary">Cancelar</button>
                <button type="submit" id="kpi-reauth-submit">Continuar</button>
              </div>
            </form>
          </div>
        </div>

        <div id="kpi-manual-quotes-modal" class="modal-overlay hidden">
          <div class="modal" style="max-width:560px;">
            <h3>Captura mensual de cotizaciones</h3>
            <form id="kpi-manual-quotes-form">
              <input type="hidden" id="kpi-mq-id" name="id" />
              <div class="form-grid">
                <label>Ano <input id="kpi-mq-year" name="year" type="number" min="2000" max="2100" required /></label>
                <label>Mes <select id="kpi-mq-month" name="month" required></select></label>
                <label>Departamento
                  <select id="kpi-mq-department" name="department"><option value="Ventas">Ventas</option></select>
                </label>
                <label>Vendedora *
                  <select id="kpi-mq-employee" name="employee_id" required>
                    <option value="">Seleccione vendedora</option>
                  </select>
                </label>
                <label>No. cotizaciones enviadas * <input id="kpi-mq-count" name="quotes_sent_count" type="number" min="0" step="1" required /></label>
                <label>Moneda *
                  <select id="kpi-mq-currency" name="currency"><option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
                </label>
                <label id="kpi-mq-amount-label">Monto cotizado * <input id="kpi-mq-amount" name="quoted_amount_original" type="text" inputmode="decimal" autocomplete="off" required /></label>
                <label id="kpi-mq-rate-wrap" class="hidden">Tipo de cambio a MXN *
                  <input id="kpi-mq-rate" name="exchange_rate_to_mxn" type="number" min="0" step="0.0001" value="1" />
                </label>
                <label id="kpi-mq-mxn-wrap" class="hidden">Equivalente MXN (calculado)
                  <input id="kpi-mq-mxn-display" type="text" readonly tabindex="-1" />
                </label>
                <label style="grid-column:1/-1;">Observaciones <textarea id="kpi-mq-notes" name="notes" rows="2"></textarea></label>
              </div>
              <p id="kpi-mq-message" class="message hidden" style="color:var(--danger);"></p>
              <div id="kpi-mq-list" class="table-wrapper" style="margin-top:12px;max-height:180px;overflow:auto;"></div>
              <div class="modal-actions">
                <button type="button" id="kpi-mq-cancel" class="secondary">Cerrar</button>
                <button type="submit">Guardar captura</button>
              </div>
            </form>
          </div>
        </div>

        <div id="kpi-config-modal" class="modal-overlay hidden">
          <div class="modal" style="max-width:720px;max-height:90vh;overflow:auto;">
            <h3>Configuracion Tablero KPIs</h3>
            <p id="kpi-config-load-error" class="hidden" style="color:var(--danger);"></p>
            <section id="kpi-config-employees-section">
              <h4>Vendedores</h4>
              <p class="muted" style="margin:0 0 8px;">Empleados activos con vacaciones registradas o puesto de ventas.</p>
              <div class="table-wrapper"><table><thead><tr><th>Nombre</th><th>Puesto</th><th>Vacaciones</th><th>Asignado a KPI</th></tr></thead><tbody id="kpi-config-vendedores-table"></tbody></table></div>
              <h4 style="margin-top:16px;">Técnicos</h4>
              <p class="muted" style="margin:0 0 8px;">Empleados activos con puesto técnico.</p>
              <div class="table-wrapper"><table><thead><tr><th>Nombre</th><th>Puesto</th><th>Asignado a KPI</th></tr></thead><tbody id="kpi-config-tecnicos-table"></tbody></table></div>
            </section>
            <section id="kpi-config-formulas-section" style="margin-top:16px;">
              <h4>Formulas utilizadas</h4>
              <div id="kpi-config-formulas"></div>
            </section>
            <section id="kpi-config-params-section" style="margin-top:16px;">
              <h4>Parametros editables</h4>
              <form id="kpi-settings-form" class="form-grid">
                <label>Margen verde &gt;= (%)
                  <input id="kpi-set-margin-green" name="margin_green_percent" type="number" min="0" max="100" step="0.01" />
                </label>
                <label>Margen amarillo &gt;= (%)
                  <input id="kpi-set-margin-yellow" name="margin_yellow_percent" type="number" min="0" max="100" step="0.01" />
                </label>
                <label>Margen rojo &gt;= (%)
                  <input id="kpi-set-margin-red" name="margin_red_percent" type="number" min="0" max="100" step="0.01" />
                </label>
                <label>Cartera 1-30 dias (limite)
                  <input id="kpi-set-bucket1" name="receivable_bucket1_days" type="number" min="1" />
                </label>
                <label>Cartera 31-60 dias (limite)
                  <input id="kpi-set-bucket2" name="receivable_bucket2_days" type="number" min="1" />
                </label>
                <label>Cartera 61-90 dias (limite)
                  <input id="kpi-set-bucket3" name="receivable_bucket3_days" type="number" min="1" />
                </label>
                <label>Cartera critica (dias)
                  <input id="kpi-set-bucket-crit" name="receivable_critical_days" type="number" min="1" />
                </label>
                <label>Reporte faltante critico (dias)
                  <input id="kpi-set-report-days" name="report_missing_critical_days" type="number" min="1" />
                </label>
                <label style="display:flex;align-items:center;gap:8px;">
                  <input id="kpi-set-require-capture" name="require_manual_quote_capture" type="checkbox" checked />
                  Alerta si falta captura mensual de cotizaciones
                </label>
                <button type="submit">Guardar parametros</button>
              </form>
            </section>
            <div class="modal-actions"><button type="button" id="kpi-config-close" class="secondary">Cerrar</button></div>
          </div>
        </div>

        <section id="activity-monitor-view" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Auditoria de uso</p>
                <h2>Monitor de Actividad</h2>
                <p class="muted">Registro de actividad de usuarios en el sistema. No es una medicion directa de productividad.</p>
              </div>
            </div>
            <div class="activity-filters" style="padding:12px 0;border-bottom:1px solid var(--border);margin-bottom:12px;">
              <form id="activity-filter-form" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                <label style="display:flex;flex-direction:column;font-size:0.85rem;">Periodo
                  <select id="af-period-type" name="periodType" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);">
                    <option value="day">Dia</option>
                    <option value="week">Semana del ano</option>
                    <option value="month" selected>Mes</option>
                    <option value="year">Ano</option>
                  </select>
                </label>
                <label id="af-year-label" style="display:flex;flex-direction:column;font-size:0.85rem;">Ano
                  <input id="af-year" name="year" type="number" min="2020" max="2030" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);width:80px;" />
                </label>
                <label id="af-month-label" style="display:flex;flex-direction:column;font-size:0.85rem;">Mes
                  <select id="af-month" name="month" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);">
                    <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option><option value="4">Abril</option><option value="5">Mayo</option><option value="6">Junio</option><option value="7">Julio</option><option value="8">Agosto</option><option value="9">Septiembre</option><option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>
                </label>
                <label id="af-week-label" style="display:none;flex-direction:column;font-size:0.85rem;">Semana
                  <input id="af-week" name="weekNumber" type="number" min="1" max="53" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);width:70px;" />
                </label>
                <label id="af-date-label" style="display:none;flex-direction:column;font-size:0.85rem;">Fecha
                  <input id="af-date" name="date" type="date" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);" />
                </label>
                <button type="submit" style="padding:8px 16px;border-radius:6px;background:var(--primary);color:#fff;border:none;cursor:pointer;">Consultar</button>
                <button type="button" id="af-clear" style="padding:8px 16px;border-radius:6px;background:var(--card);color:var(--text);border:1px solid var(--border);cursor:pointer;">Limpiar filtros</button>
              </form>
            </div>
            <div id="activity-summary-cards" class="hidden" style="display:none;flex-wrap:wrap;gap:12px;padding:12px 0;"></div>
            <div id="activity-monitor-loading" class="muted" style="padding:16px;">Cargando monitor de actividad...</div>
            <div id="activity-monitor-error" class="hidden" style="padding:16px;color:var(--danger);"></div>
            <div id="activity-monitor-content" class="hidden">
              <h3>Usuarios Conectados Actualmente</h3>
              <div class="table-wrapper">
                <table><thead><tr><th>Usuario</th><th>Rol</th><th>Inicio Sesion</th><th>Ultima Actividad</th><th>Duracion</th><th>IP</th></tr></thead><tbody id="active-sessions-table"></tbody></table>
              </div>
              <h3>Ultimas Sesiones</h3>
              <div class="table-wrapper">
                <table><thead><tr><th>Usuario</th><th>Rol</th><th>Inicio</th><th>Fin</th><th>Duracion</th><th>IP</th></tr></thead><tbody id="recent-sessions-table"></tbody></table>
              </div>
              <h3>Reporte Semanal de Actividad</h3>
              <div class="table-wrapper">
                <table><thead><tr><th>Usuario</th><th>Rol</th><th>Sesiones</th><th>Tiempo Conectado</th><th>Promedio/Dia</th><th>Ultima Actividad</th></tr></thead><tbody id="weekly-report-table"></tbody></table>
              </div>
              <h3>Eventos Recientes</h3>
              <div class="table-wrapper">
                <table><thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Accion</th><th>Modulo</th><th>Detalle</th></tr></thead><tbody id="recent-events-table"></tbody></table>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>

    <div id="password-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
      <div class="modal-content modal-sm">
        <h3 id="password-modal-title">Autenticación requerida</h3>
        <p id="password-modal-message">Ingresa la contraseña del admin:</p>
        <form id="password-modal-form" autocomplete="off">
          <label for="password-modal-input">Contraseña</label>
          <input id="password-modal-input" name="admin_password" type="password" autocomplete="current-password" required aria-label="Contraseña del administrador" />
          <div class="row-actions" style="margin-top:0.75rem">
            <button type="submit" class="primary">Confirmar</button>
            <button type="button" class="secondary" id="password-modal-cancel">Cancelar</button>
          </div>
          <p id="password-modal-error" class="error-msg hidden"></p>
        </form>
      </div>
    </div>

    <script src="/app.js?v=commissions-pg-migration-20260603e"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</body>
</html>

```

================================================================================
# ARCHIVO 2: public/styles.css
================================================================================

```css
:root {
  color-scheme: light;
  --bg: #f4f7fb;
  --card: #ffffff;
  --text: #172033;
  --muted: #667085;
  --primary: #1d4ed8;
  --primary-dark: #1e40af;
  --border: #d8e0ef;
  --danger: #b42318;
  --success: #087443;
  --warning: #b54708;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #1a1a2e;
  --card: #16213e;
  --text: #e8e8e8;
  --muted: #a0a0b0;
  --primary: #4f8cff;
  --primary-dark: #3b6fd4;
  --border: #2a3a5e;
  --danger: #ff6b6b;
  --success: #51cf66;
  --warning: #fcc419;
}

[data-theme="corporate"] {
  color-scheme: light;
  --bg: #f5f5f5;
  --card: #ffffff;
  --text: #333333;
  --muted: #777777;
  --primary: #455a64;
  --primary-dark: #37474f;
  --border: #cfd8dc;
  --danger: #c62828;
  --success: #2e7d32;
  --warning: #f57f17;
}

[data-theme="high_contrast"] {
  color-scheme: light;
  --bg: #ffffff;
  --card: #ffffff;
  --text: #000000;
  --muted: #444444;
  --primary: #006400;
  --primary-dark: #004d00;
  --border: #000000;
  --danger: #cc0000;
  --success: #006600;
  --warning: #cc6600;
}

* {
  box-sizing: border-box;
}

html {
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
  overflow-y: auto;
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}

[data-theme="default"] body,
:root body {
  background: linear-gradient(135deg, #eef4ff 0%, var(--bg) 45%, #ffffff 100%);
}

@media print {
  [data-theme] { --bg: #fff; --card: #fff; --text: #000; --border: #ccc; }
}

main {
  width: min(96vw, 2400px);
  max-width: calc(100vw - 32px);
  margin: 0 auto;
  padding: 32px clamp(12px, 1.5vw, 24px);
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  border: 0;
  border-radius: 10px;
  background: var(--primary);
  color: #ffffff;
  cursor: pointer;
  font-weight: 700;
  padding: 11px 16px;
}

button:hover {
  background: var(--primary-dark);
}

button.secondary {
  background: #e9eefb;
  color: var(--primary-dark);
}

button.secondary:hover {
  background: #d9e4fb;
}

button.danger {
  background: #fff1f3;
  color: var(--danger);
}

button.danger:hover {
  background: #ffe4e8;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #344054;
  font-weight: 650;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--text);
  padding: 10px 12px;
}

textarea {
  resize: vertical;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border-bottom: 1px solid var(--border);
  padding: 10px 8px;
  text-align: left;
  overflow-wrap: break-word;
  font-size: 0.88rem;
}

th {
  color: var(--muted);
  font-size: 0.82rem;
  text-transform: uppercase;
}

.datatable-sort {
  align-items: center;
  background: transparent;
  color: inherit;
  display: inline-flex;
  gap: 6px;
  padding: 0;
  text-transform: uppercase;
}

.datatable-sort:hover:not(:disabled) {
  background: transparent;
  color: var(--primary);
}

.datatable-sort:disabled {
  cursor: default;
  opacity: 1;
}

.hidden {
  display: none !important;
}

.auth-card,
.panel,
.cards article {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(216, 224, 239, 0.9);
  border-radius: 22px;
  box-shadow: 0 20px 70px rgba(15, 23, 42, 0.08);
}

.auth-card {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 32px;
  margin: 10vh auto 0;
  max-width: 900px;
  padding: 38px;
}

.topbar,
.panel-header {
  align-items: flex-start;
  display: flex;
  gap: 18px;
  justify-content: space-between;
}

.topbar {
  margin-bottom: 24px;
}

.topbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

#theme-selector {
  width: auto;
  max-width: 9.5rem;
  flex: 0 0 auto;
  align-self: center;
  margin-left: 2px;
  padding: 3px 24px 3px 8px;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.25;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--card) 88%, var(--bg));
  color: var(--muted);
  cursor: pointer;
}

#theme-selector:hover,
#theme-selector:focus-visible {
  border-color: var(--border);
  color: var(--text);
  outline: none;
}

button.active {
  background: var(--primary);
  color: #ffffff;
}

.eyebrow {
  color: var(--primary);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.muted {
  color: var(--muted);
}

.project-description {
  background: #f8fbff;
  border-left: 4px solid var(--primary);
  border-radius: 12px;
  color: #344054;
  margin-bottom: 0;
  padding: 12px 14px;
}

.message {
  color: var(--danger);
  font-weight: 700;
  min-height: 1.4em;
}

.message.success {
  color: var(--success);
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.exchange-panel {
  margin-bottom: 24px;
}

.exchange-form {
  display: grid;
  align-items: end;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.exchange-form label,
.exchange-form input {
  min-width: 0;
}

.exchange-form .message {
  grid-column: 1 / -1;
}

.cards article,
.detail-grid article {
  padding: 18px;
}

.cards span,
.detail-grid span {
  color: var(--muted);
  display: block;
  font-size: 0.88rem;
  margin-bottom: 6px;
}

.cards strong,
.detail-grid strong {
  font-size: 1.4rem;
}

.layout {
  display: grid;
  grid-template-columns: minmax(280px, 25%) 1fr;
  gap: 24px;
}

.layout > * {
  min-width: 0;
}

.two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel {
  padding: 24px;
  min-width: 0;
  max-width: 100%;
}

.grid-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  min-width: 0;
}

.grid-form button,
.grid-form .message,
.full {
  grid-column: 1 / -1;
}

.stack {
  display: grid;
  gap: 14px;
}

.money-field .money-row {
  max-width: 520px;
}

.money-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 112px;
  gap: 8px;
  width: 100%;
}

.money-row input {
  min-width: 0;
}

.checkbox-row {
  align-items: center;
  flex-direction: row;
  gap: 10px;
  margin-top: 28px;
}

.checkbox-row input {
  width: auto;
}

.table-wrapper {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

td.col-text {
  white-space: normal;
  overflow-wrap: break-word;
  min-width: 90px;
}

td.col-currency {
  text-align: right;
  white-space: nowrap;
}

td.col-number {
  text-align: right;
  white-space: nowrap;
}

td.col-date {
  white-space: nowrap;
}

td.col-select,
td.col-boolean {
  white-space: nowrap;
}

td.col-actions {
  white-space: nowrap;
}

th.col-currency .datatable-sort,
th.col-number .datatable-sort {
  justify-content: flex-end;
}

th.col-currency,
th.col-number {
  text-align: right;
}

.row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  white-space: nowrap;
}

.row-actions button {
  padding: 7px 10px;
  font-size: 0.82rem;
}

.badge {
  border-radius: 999px;
  display: inline-flex;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 3px 8px;
  white-space: nowrap;
}

.badge.status {
  background: #e0f2fe;
  color: #075985;
}

.badge.status-terminado {
  background: #dcfae6;
  color: #087443;
}

.badge.status-pendiente {
  background: #fee4e2;
  color: #b42318;
}

.badge.status-en-proceso {
  background: #fef0c7;
  color: #b54708;
}

.badge.risk-alto {
  background: #fee4e2;
  color: var(--danger);
}

.badge.risk-medio {
  background: #fef0c7;
  color: var(--warning);
}

.badge.risk-bajo {
  background: #dcfae6;
  color: var(--success);
}

.margin-badge {
  min-width: 86px;
  justify-content: center;
}

.margin-good {
  background: #dcfae6;
  color: var(--success);
}

.margin-warning {
  background: #fef0c7;
  color: var(--warning);
}

.margin-danger {
  background: #fee4e2;
  color: var(--danger);
}

.margin-neutral {
  background: #eef2f6;
  color: #475467;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 16px 0 24px;
}

.detail-grid article {
  background: #f8fbff;
  border: 1px solid var(--border);
  border-radius: 16px;
}

.entry-list {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
}

.entry-list li {
  align-items: center;
  background: #f8fbff;
  border: 1px solid var(--border);
  border-radius: 14px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 12px;
}

.entry-list small {
  color: var(--muted);
  display: block;
}

.entry-list button {
  background: #fff1f3;
  color: var(--danger);
  padding: 8px 10px;
}

@media (max-width: 1100px) {
  .layout,
  .two-columns,
  .auth-card {
    grid-template-columns: 1fr;
  }

  .cards,
  .exchange-form,
  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .topbar-actions {
    justify-content: flex-start;
  }

  .topbar-actions button {
    font-size: 0.82rem;
    padding: 8px 12px;
  }

  #theme-selector {
    align-self: flex-end;
    max-width: 9rem;
  }

  .panel {
    padding: 18px;
  }

  th, td {
    padding: 8px 6px;
    font-size: 0.84rem;
  }
}

/* Modal: el overlay hace scroll (no bloquear con height fijo ni centrar contenido alto) */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  background: rgba(0, 0, 0, 0.5);
}

.modal-overlay.hidden {
  display: none;
}

.modal-content {
  width: 100%;
  max-width: min(700px, 100%);
  margin: auto 0;
  flex-shrink: 0;
  max-height: none;
}

.modal-content.modal-large {
  max-width: min(960px, 100%);
}

.badge.status-programada {
  background: #e0f2fe;
  color: #075985;
}

.badge.status-tomada {
  background: #dcfae6;
  color: #087443;
}

.badge.status-cancelada {
  background: #fee4e2;
  color: #b42318;
}

.badge-negative {
  background: #fee4e2;
  color: #b42318;
  font-weight: 800;
}

.negative-balance {
  color: #b42318;
}

.text-negative {
  color: #b42318;
  font-size: 0.78rem;
  font-weight: 700;
}

.summary-negative {
  background: #fff1f3 !important;
  border-color: #fecdd3 !important;
}

.summary-negative strong {
  color: #b42318;
}

.row-inactive {
  background: #fff5f5;
  border-left: 3px solid #b42318;
}

.row-inactive td {
  opacity: 0.85;
}

.badge-inactive {
  background: #fee4e2;
  color: #b42318;
  font-weight: 800;
}

.badge-active {
  background: #dcfae6;
  color: #087443;
}

.safety-checks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

#report-form-panel,
#attendance-edit-panel {
  overflow: visible;
  max-height: none;
}

.emissions-table input {
  width: 100%;
  min-width: 60px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
}

.report-type-option {
  width: 100%;
  min-height: 44px;
  text-align: left;
}

.emissions-table td,
.emissions-table th {
  padding: 6px 8px;
  font-size: 0.88rem;
}

.attendance-cell-select,
.attendance-cell-input {
  font-size: 0.88rem;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  max-width: 100%;
}

.attendance-cell-select {
  min-width: 3rem;
}

.attendance-day-cell {
  padding: 2px;
}

.detail-reports-section {
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

@media (max-width: 700px) {
  main {
    padding: 12px clamp(10px, 3vw, 16px);
  }

  .cards,
  .exchange-form,
  .detail-grid,
  .grid-form {
    grid-template-columns: 1fr;
  }

  .money-row {
    grid-template-columns: 1fr 80px;
  }

  .topbar,
  .panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .topbar-actions {
    justify-content: flex-start;
  }

  .topbar-actions button {
    font-size: 0.78rem;
    padding: 8px 10px;
  }

  #theme-selector {
    align-self: flex-end;
    max-width: 8.5rem;
    font-size: 0.7rem;
  }

  .panel {
    padding: 14px;
    border-radius: 16px;
  }

  .auth-card {
    padding: 24px 18px;
    margin-top: 4vh;
  }

  .cards article,
  .detail-grid article {
    padding: 14px;
  }

  .cards strong,
  .detail-grid strong {
    font-size: 1.15rem;
  }

  .pagination-controls {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .pagination-buttons {
    flex-wrap: wrap;
    justify-content: center;
  }

  .pagination-info {
    text-align: center;
  }

  .modal-overlay {
    padding: max(12px, env(safe-area-inset-top)) 10px max(20px, env(safe-area-inset-bottom));
    align-items: flex-start;
  }

  .modal-content {
    max-width: 100%;
    border-radius: 16px;
    padding: 1rem;
  }

  .modal-content .grid-form {
    grid-template-columns: 1fr;
  }

  .safety-checks {
    grid-template-columns: 1fr;
  }

  .safety-checks .checkbox-row {
    min-height: 44px;
    margin-top: 0;
    padding: 6px 0;
  }

  .safety-checks .checkbox-row input[type="checkbox"] {
    width: 22px;
    height: 22px;
    min-width: 22px;
    flex-shrink: 0;
  }

  .emissions-table input {
    min-height: 44px;
    font-size: 16px;
    padding: 10px 8px;
  }

  .attendance-day-cell {
    padding: 4px;
    vertical-align: middle;
  }

  .attendance-cell-select,
  .attendance-cell-input {
    min-height: 44px;
    font-size: 16px;
    width: 100%;
    min-width: 3.25rem;
    padding: 8px 6px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fff;
  }

  .attendance-cell-input--narrow {
    min-width: 4.5rem;
  }

  .attendance-table select,
  .attendance-table input[type="text"] {
    min-height: 44px;
    font-size: 16px;
    width: 100%;
    min-width: 3.5rem;
    padding: 8px 6px;
  }

  .grid-form label,
  .stack label,
  form label {
    width: 100%;
  }

  input,
  select,
  textarea,
  .grid-form input,
  .grid-form select,
  .grid-form textarea,
  .modal-content input,
  .modal-content select,
  .modal-content textarea {
    font-size: 16px;
    min-height: 44px;
    padding: 12px;
  }

  textarea {
    min-height: 88px;
  }

  .checkbox-row {
    min-height: 44px;
    margin-top: 12px;
    padding: 4px 0;
  }

  .checkbox-row input[type="checkbox"] {
    width: 22px;
    height: 22px;
    min-width: 22px;
  }

  .grid-form button,
  .modal-content button,
  #report-form button[type="submit"],
  .report-type-option {
    min-height: 44px;
    padding: 12px 16px;
  }

  #report-form-panel .panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  #report-form-panel .row-actions button {
    width: 100%;
    min-height: 44px;
  }

  .search-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-bar input[type="text"] {
    max-width: 100%;
  }

  .search-bar select {
    width: 100%;
  }

  #theme-selector {
    font-size: 0.8rem;
    min-height: 32px;
  }

  .ecovis-subtabs {
    gap: 6px;
  }

  .ecovis-subtabs button {
    font-size: 0.78rem;
    padding: 7px 10px;
  }

  .table-wrapper {
    margin: 0 -14px;
    padding: 0 14px;
    width: calc(100% + 28px);
    max-width: calc(100% + 28px);
  }

  th, td {
    padding: 8px 6px;
    font-size: 0.82rem;
  }

  .row-actions {
    gap: 4px;
  }

  .row-actions button {
    padding: 6px 8px;
    font-size: 0.75rem;
  }

  .exchange-panel .panel-header {
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .topbar h1 {
    font-size: 1.3rem;
  }

  .topbar-actions {
    gap: 6px;
  }

  .topbar-actions button {
    font-size: 0.72rem;
    padding: 6px 8px;
  }

  .cards span {
    font-size: 0.78rem;
  }

  .cards strong {
    font-size: 1rem;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .badge {
    font-size: 0.72rem;
    padding: 3px 6px;
  }

  .margin-badge {
    min-width: 60px;
  }
}

@media (max-width: 932px) and (orientation: landscape) {
  main {
    width: calc(100vw - 24px);
    max-width: none;
    padding: 16px 12px;
  }

  .cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .detail-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .grid-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .topbar,
  .panel-header {
    flex-direction: row;
    align-items: flex-start;
  }

  .modal-content {
    max-width: 90vw;
  }
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 0 4px;
  border-top: 1px solid var(--border);
  margin-top: 12px;
}

.pagination-info {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-buttons button {
  padding: 7px 12px;
  font-size: 0.82rem;
  font-weight: 700;
  border-radius: 8px;
  background: #e9eefb;
  color: var(--primary-dark);
  border: none;
  cursor: pointer;
}

.pagination-buttons button:hover:not(:disabled) {
  background: #d9e4fb;
}

.pagination-buttons button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-current {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  padding: 0 8px;
  white-space: nowrap;
}

.pagination-limit {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-limit label {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.pagination-limit select {
  width: auto;
  min-width: 60px;
  padding: 6px 8px;
  font-size: 0.82rem;
  border-radius: 8px;
}

.ecovis-cards {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.ecovis-balance-card {
  grid-column: 1 / -1;
}

.ecovis-subtabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.ecovis-status-pendiente { background: #fef0c7; color: #b54708; }
.ecovis-status-parcialmente_pagado { background: #e0f2fe; color: #075985; }
.ecovis-status-pagado { background: #dcfae6; color: #087443; }
.ecovis-status-cancelado { background: #fee4e2; color: #b42318; }

.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.search-row input {
  max-width: 300px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.search-bar input[type="text"] {
  max-width: 300px;
  padding: 8px 12px;
  font-size: 0.88rem;
}

.search-bar select {
  width: auto;
  min-width: 120px;
  padding: 8px 12px;
  font-size: 0.88rem;
}

@media (min-width: 1920px) {
  main {
    width: min(96vw, 2400px);
  }
}

@media (max-width: 700px) {
  .search-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-row input {
    max-width: 100%;
  }
}

/* Tablero KPIs: paneles solidos para lectura */
#kpi-reauth-modal .modal,
#kpi-manual-quotes-modal .modal,
#kpi-config-modal .modal {
  background: var(--surface, #fff);
  opacity: 1;
  border: 1px solid var(--border, #d1d5db);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  backdrop-filter: none;
}

#kpi-reauth-modal .modal input,
#kpi-manual-quotes-modal .modal input,
#kpi-manual-quotes-modal .modal select,
#kpi-manual-quotes-modal .modal textarea,
#kpi-config-modal .modal input,
#kpi-config-modal .modal select,
#kpi-config-modal .modal textarea {
  background: var(--input-bg, #fff);
  opacity: 1;
}

@media (prefers-color-scheme: dark) {
  #kpi-reauth-modal .modal,
  #kpi-manual-quotes-modal .modal,
  #kpi-config-modal .modal {
    background: var(--surface, #1e293b);
  }
  #kpi-reauth-modal .modal input,
  #kpi-manual-quotes-modal .modal input,
  #kpi-manual-quotes-modal .modal select,
  #kpi-manual-quotes-modal .modal textarea,
  #kpi-config-modal .modal input,
  #kpi-config-modal .modal select,
  #kpi-config-modal .modal textarea {
    background: var(--input-bg, #0f172a);
  }
}

.modal-content.panel {
  background: rgba(255, 255, 255, 0.98);
}

.modal-content {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.modal-sm {
  width: 360px;
}

.modal-content h3 {
  margin: 0 0 0.5rem;
}

.modal-content .error-msg {
  color: #dc3545;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.audit-block {
  margin-top: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: #f8f9fa;
  border-left: 3px solid #6c757d;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.audit-info {
  color: #6c757d;
  font-size: 0.78rem;
  display: block;
}

.audit-info.audit-deleted {
  color: #dc3545;
}

/* Tablero KPIs */
.kpi-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0 20px;
}

.kpi-card {
  flex: 1 1 160px;
  min-width: 140px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
}

.kpi-card-label {
  display: block;
  font-size: 0.78rem;
  color: var(--muted);
  margin-bottom: 4px;
}

.kpi-section {
  margin-bottom: 16px;
}

.kpi-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.kpi-metric {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
}

.kpi-metric-label {
  display: block;
  font-size: 0.78rem;
  color: var(--muted);
  margin-bottom: 2px;
}

.kpi-unavailable strong {
  color: var(--muted);
  font-style: italic;
}

.kpi-semaphore {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.kpi-semaphore-green { background: #22c55e; }
.kpi-semaphore-yellow { background: #eab308; }
.kpi-semaphore-red { background: #ef4444; }
.kpi-semaphore-critical { background: #7f1d1d; border: 2px solid #ef4444; }
.kpi-semaphore-gray { background: #9ca3af; }

.kpi-dept-block {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}

.kpi-dept-block h4 {
  margin: 0 0 10px;
  font-size: 1rem;
}

.kpi-dept-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.kpi-dept-block ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.kpi-filters select,
.kpi-filters input {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  min-width: 120px;
}

@media (max-width: 768px) {
  .kpi-metrics {
    grid-template-columns: 1fr 1fr;
  }
  .kpi-cards {
    flex-direction: column;
  }
}


.kpi-toolbar button { white-space: nowrap; }

.kpi-charts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(280px, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.kpi-chart-panel {
  padding: 12px;
  min-height: 260px;
}

.kpi-chart-panel h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
}

.kpi-chart-empty {
  color: var(--muted);
  font-size: 0.85rem;
  padding: 24px 0;
  text-align: center;
}

@media (max-width: 900px) {
  .kpi-charts-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-ventas-cards {
  margin-bottom: 0;
}

.kpi-ventas-card-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.kpi-ventas-group-title {
  margin: 0 0 6px;
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted, #64748b);
}

.kpi-ventas-charts-grid {
  margin: 12px 0 16px;
}

.kpi-no-data {
  color: var(--muted, #9ca3af);
}

.kpi-pending-capture {
  margin: 8px 0 12px;
  padding: 10px 12px;
  border-left: 3px solid var(--border, #d1d5db);
  background: rgba(148, 163, 184, 0.08);
  border-radius: 4px;
}

.kpi-pending-capture-title {
  margin: 0 0 4px;
  font-size: 0.9rem;
}

.kpi-ventas-sellers-table th,
.kpi-ventas-sellers-table td {
  white-space: nowrap;
  font-size: 0.88rem;
}

.kpi-semaphore-cell {
  text-align: center;
  width: 3rem;
}

.kpi-ventas-alert-groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi-ventas-alert-group {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  padding: 6px 10px;
  background: var(--panel-bg, #fff);
}

.kpi-ventas-alert-group summary {
  cursor: pointer;
  list-style: none;
}

.kpi-ventas-alert-group summary::-webkit-details-marker {
  display: none;
}

.kpi-ventas-alert-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 0.88rem;
}

.kpi-ventas-alerts-toggle {
  margin-top: 8px;
}

/* Project detail drawer (Proyectos) */
body.scroll-lock {
  overflow: hidden;
}

.project-drawer {
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
}

.project-drawer:not(.hidden) {
  pointer-events: auto;
}

.project-drawer.hidden {
  display: none;
}

.project-drawer-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: rgba(15, 23, 42, 0.45);
}

.project-drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: min(520px, 92vw);
  max-width: 100%;
  margin: 0;
  padding: 0;
  border-radius: 0;
  border-top: 0;
  border-right: 0;
  border-bottom: 0;
  border-left: 1px solid var(--border);
  background: var(--card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.22);
  transform: translateX(0);
  animation: project-drawer-in 0.22s ease-out;
}

.project-drawer-panel.panel {
  background: var(--card);
}

.project-drawer-toolbar {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px 0;
  background: var(--card);
}

.project-drawer-close {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 14px;
}

.project-drawer-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 8px 20px 24px;
  background: var(--card);
}

.project-drawer-body .panel-header {
  margin-bottom: 4px;
}

.project-drawer-body .detail-grid {
  grid-template-columns: 1fr;
  gap: 12px;
  margin: 12px 0 20px;
}

.project-drawer-body .detail-reports-section {
  margin-bottom: 24px !important;
  padding-top: 20px;
}

.project-drawer-body .project-drawer-sections {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.project-drawer-body .project-drawer-sections > div {
  min-width: 0;
  width: 100%;
}

.project-drawer-body .project-drawer-sections h3 {
  margin-top: 0;
  margin-bottom: 12px;
}

.project-drawer-body .stack {
  gap: 14px;
}

.project-drawer-body label {
  min-width: 0;
  width: 100%;
}

.project-drawer-body input,
.project-drawer-body select,
.project-drawer-body textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.project-drawer-body .money-row {
  grid-template-columns: minmax(0, 1fr) minmax(88px, 112px);
  gap: 8px;
  width: 100%;
  max-width: 100%;
}

.project-drawer-body .money-row input,
.project-drawer-body .money-row select {
  min-width: 0;
  width: 100%;
}

.project-drawer-body .entry-list {
  margin-top: 14px;
}

.project-drawer-body .entry-list li {
  flex-wrap: wrap;
}

#projects-table tbody tr:not(:has(.muted)) {
  cursor: pointer;
}

#projects-table tbody tr.row-selected {
  background: #e8efff;
  box-shadow: inset 3px 0 0 var(--primary);
}

[data-theme="dark"] #projects-table tbody tr.row-selected {
  background: rgba(79, 140, 255, 0.15);
}

@media (max-width: 768px) {
  .project-drawer-panel {
    width: 100%;
    max-width: 100%;
  }

  .project-drawer-body input,
  .project-drawer-body select,
  .project-drawer-body textarea {
    font-size: 16px;
  }

  .project-drawer-body button {
    min-height: 44px;
  }
}

@keyframes project-drawer-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Emissions calculator */
.ec-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 20px 40px;
}

.ec-topbar {
  margin-bottom: 20px;
}

.button-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  padding: 0.55rem 1rem;
  border-radius: 8px;
  font: inherit;
}

.ec-layout {
  margin-top: 16px;
}

.ec-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin: 20px 0;
}

.ec-results .calc-cell,
.ec-results-table .calc-cell {
  background: var(--surface-muted, #f3f4f6);
  font-variant-numeric: tabular-nums;
}

/* Resultados apilados — ancho completo, sin encimado */
.ec-results-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  min-width: 0;
}

.ec-results-stack > * {
  min-width: 0;
  position: static;
  z-index: auto;
  width: 100%;
  box-sizing: border-box;
}

.ec-results-block {
  position: static;
  z-index: auto;
  margin-bottom: 16px;
  background: var(--surface, #fff);
}

.ec-results-block.panel {
  overflow: visible;
}

.ec-kpi-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.ec-emissions-panel,
.ec-savings-panel {
  clear: both;
}

.ec-emissions-footnote {
  margin: 10px 0 0;
  padding: 0 4px;
}

.ec-emissions-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.ec-results-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.ec-results-table th.ec-num-cell,
.ec-results-table td.ec-num-cell,
.ec-results-table td.calc-cell {
  white-space: nowrap;
  text-align: right;
}

.ec-results-table th:first-child,
.ec-results-table td:first-child {
  text-align: left;
  white-space: nowrap;
}

.ec-bar-chart {
  width: 100%;
  min-width: 0;
}

.ec-bar-chart .ec-bar-row {
  display: grid;
  grid-template-columns: 120px 1fr 1fr;
  gap: 10px;
  align-items: center;
  margin: 8px 0;
  font-size: 0.85rem;
}

.ec-bar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ec-bar {
  height: 16px;
  border-radius: 4px;
  min-width: 2px;
}

.ec-bar.exist {
  background: #f59e0b;
}

.ec-bar.proj {
  background: #10b981;
}

.message.error {
  color: #b91c1c;
  background: #fef2f2;
  padding: 10px 12px;
  border-radius: 8px;
}

.ec-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.ec-period-savings-table {
  min-width: 520px;
}

.ec-period-table-panel {
  width: 100%;
}

.ec-currency-badge {
  margin-bottom: 8px;
}

.ec-operation-panel .ec-operation-field.hidden {
  display: none;
}

@media (max-width: 640px) {
  .ec-kpi-cards {
    grid-template-columns: 1fr;
  }

  .ec-page {
    padding: 12px 12px 32px;
  }

  .ec-bar-chart .ec-bar-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}

```

================================================================================
# ARCHIVO 3: public/app.js
================================================================================

```javascript
function formatDateTimeCDMX(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateCDMX(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function renderAuditBlock(record) {
  const parts = [];
  if (record.created_by_name || record.created_by) {
    parts.push(`<small class="audit-info">Creado por: ${record.created_by_name || record.created_by || 'N/A'} el ${formatDateTimeCDMX(record.created_at)}</small>`);
  }
  if (record.updated_by_name || record.updated_by) {
    parts.push(`<small class="audit-info">Modificado por: ${record.updated_by_name || record.updated_by || 'N/A'} el ${formatDateTimeCDMX(record.updated_at)}</small>`);
  }
  if (record.deleted_by_name || record.deleted_by) {
    parts.push(`<small class="audit-info audit-deleted">Eliminado por: ${record.deleted_by_name || record.deleted_by || 'N/A'} el ${formatDateTimeCDMX(record.deleted_at)}${record.delete_reason ? ' — Motivo: ' + record.delete_reason : ''}</small>`);
  }
  if (parts.length === 0) return '';
  return `<div class="audit-block">${parts.join('')}</div>`;
}

let userPermissions = {};

function canAccess(module, action) {
  if (state.userRole === 'admin') return true;
  if (!userPermissions || !userPermissions[module]) return false;
  return userPermissions[module].includes(action);
}

function applyTheme(themeName) {
  document.documentElement.setAttribute("data-theme", themeName || "default");
  var sel = document.getElementById("theme-selector");
  if (sel) sel.value = themeName || "default";
}

async function changeTheme(theme) {
  try {
    await api("/api/preferences/theme", { method: "PUT", body: JSON.stringify({ theme: theme }) });
    applyTheme(theme);
  } catch (e) { console.error("Error changing theme:", e.message); }
}

function applyPermissionVisibility() {
  const tabs = {
    'projects-tab': canAccess('projects', 'view'),
    'closed-projects-tab': canAccess('closedProjects', 'view'),
    'reports-tab': canAccess('reports', 'view'),
    'emissions-calc-link': canAccess('reports', 'view'),
    'report-archive-tab': canAccess('reportsArchive', 'view'),
    'vacations-tab': canAccess('vacations', 'view'),
    'ecovis-tab': canAccess('ecovisAccount', 'view'),
    'service-quoter-tab': canAccess('serviceQuoter', 'view'),
    'users-tab': canAccess('users', 'view'),
    'commissions-tab': canAccess('commissions', 'view'),
    'activity-monitor-tab': canAccess('activityMonitor', 'view'),
  };

  for (const [tabId, allowed] of Object.entries(tabs)) {
    const el = document.getElementById(tabId);
    if (el) { if (allowed) el.classList.remove("hidden"); else el.classList.add("hidden"); }
  }

  const backupBtn = document.getElementById('backup-btn');
  if (backupBtn) backupBtn.style.display = canAccess('backups', 'backup') ? '' : 'none';
  const importBtn = document.getElementById('import-btn');
  if (importBtn) importBtn.style.display = canAccess('backups', 'import') ? '' : 'none';
}

const state = {
  projects: [],
  closedProjects: [],
  users: [],
  employees: [],
  exchangeRates: { MXN: 1, USD: 17, EUR: 19 },
  exchangeUpdatedAt: null,
  selectedProjectId: null,
  projectDrawerOpen: false,
  selectedClosedProjectId: null,
  selectedUserId: null,
  selectedEmployeeId: null,
  adminVerified: false,
  userRole: null,
  reportsAllProjects: [],
  reportsProjectReports: [],
  currentReportProjectId: null,
};

state.projectsPag = { page: 1, limit: 15 };
state.projectsSearch = '';
state.projectAssignableEmployees = [];
state.closedPag = { page: 1, limit: 15 };
state.closedSearch = '';
state.employeesPag = { page: 1, limit: 15 };
state.employeesSearch = '';
state.employeesActiveFilter = 'all';
state.usersPag = { page: 1, limit: 15 };
state.vacReqPag = { page: 1, limit: 15 };
state.reportsProjPag = { page: 1, limit: 15 };
state.reportsProjSearch = '';
state.reportsProjStatus = '';
state.projReportsPag = { page: 1, limit: 15 };
state.ecovisProjectsPag = { page: 1, limit: 15 };
state.ecovisProjectsSearch = '';
state.ecovisPaymentsPag = { page: 1, limit: 15 };
state.ecovisLoansPag = { page: 1, limit: 15 };
state.ecovisMovementsPag = { page: 1, limit: 15 };
state.ecovisMovementsSearch = '';
state.ecovisMovementsTypeFilter = '';
state.selectedEcovisPaymentId = null;
state.tableSort = {};

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const projectsView = document.querySelector('#projects-view');
const closedProjectsView = document.querySelector('#closed-projects-view');
const usersView = document.querySelector('#users-view');
const projectsTab = document.querySelector('#projects-tab');
const closedProjectsTab = document.querySelector('#closed-projects-tab');
const usersTab = document.querySelector('#users-tab');
const exchangeRateForm = document.querySelector('#exchange-rate-form');
const exchangeMessage = document.querySelector('#exchange-message');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const logoutButton = document.querySelector('#logout-button');
const projectForm = document.querySelector('#project-form');
const projectMessage = document.querySelector('#project-message');
const projectFormTitle = document.querySelector('#project-form-title');
const newProjectButton = document.querySelector('#new-project-button');
const projectsTable = document.querySelector('#projects-table');
const closedProjectsTable = document.querySelector('#closed-projects-table');
const detailPanel = document.querySelector('#detail-panel');
const projectDetailDrawer = document.querySelector('#project-detail-drawer');
const projectDetailBackdrop = document.querySelector('#project-detail-backdrop');
const detailPanelClose = document.querySelector('#detail-panel-close');
const closedDetailPanel = document.querySelector('#closed-detail-panel');
const paymentForm = document.querySelector('#payment-form');
const costForm = document.querySelector('#cost-form');
const reportsFailurePanel = document.querySelector('#reports-failure-panel');
const reportsFailureForm = document.querySelector('#reports-failure-form');
const reportsFailureMessage = document.querySelector('#reports-failure-message');
const reportsFailureSubtitle = document.querySelector('#reports-failure-subtitle');
const reportsFailureBack = document.querySelector('#reports-failure-back');
const closedDetailFailureReportsList = document.querySelector('#closed-detail-failure-reports-list');
const paymentsList = document.querySelector('#payments-list');
const costsList = document.querySelector('#costs-list');
const closedPaymentsList = document.querySelector('#closed-payments-list');
const closedCostsList = document.querySelector('#closed-costs-list');
const userForm = document.querySelector('#user-form');
const userMessage = document.querySelector('#user-message');
const userFormTitle = document.querySelector('#user-form-title');
const newUserButton = document.querySelector('#new-user-button');
const usersTable = document.querySelector('#users-table');
const purchaseOrderInput = projectForm.elements.purchase_order_number;
const purchaseOrderNotApplicable = projectForm.elements.purchase_order_not_applicable;

const projectsSearchInput = document.querySelector('#projects-search');
const closedProjectsSearchInput = document.querySelector('#closed-projects-search');
const employeesSearchInput = document.querySelector('#employees-search');
const employeesActiveFilterSelect = document.querySelector('#employees-active-filter');

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const currencyFormatters = {
  MXN: money,
  USD: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }),
  EUR: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'EUR' }),
};


function parseCurrencyInput(value) {
  if (value == null || value === '') return NaN;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  return Number(cleaned);
}

function formatCurrencyDisplay(value, currency) {
  const num = typeof value === 'number' ? value : parseCurrencyInput(value);
  if (isNaN(num)) return '';
  const fmt = currencyFormatters[currency] || money;
  return fmt.format(num);
}

function formatMoney(value) {
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '$0.00';
  return money.format(num);
}

function initCurrencyInput(input, getCurrency) {
  let rawValue = parseCurrencyInput(input.value);
  if (isNaN(rawValue)) rawValue = 0;

  function formatDisplay() {
    const cur = getCurrency ? getCurrency() : 'MXN';
    if (input === document.activeElement) return;
    if (!rawValue || Math.abs(rawValue) < 0.000001) {
      input.value = '';
      return;
    }
    input.value = formatCurrencyDisplay(rawValue, cur);
  }

  input.addEventListener('focus', () => {
    input.value = (!rawValue || Math.abs(rawValue) < 0.000001) ? '' : String(rawValue);
    input.select();
  });
  input.addEventListener('blur', () => {
    const trimmed = input.value.trim();
    if (trimmed === '') {
      rawValue = 0;
    } else {
      const parsed = parseCurrencyInput(input.value);
      rawValue = isNaN(parsed) ? 0 : parsed;
    }
    formatDisplay();
  });
  input.addEventListener('input', () => {
    const trimmed = input.value.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      rawValue = 0;
      return;
    }
    const parsed = parseCurrencyInput(input.value);
    if (!isNaN(parsed)) rawValue = parsed;
  });
  input.getCurrencyValue = () => rawValue;
  input.setCurrencyValue = (v) => {
    if (v === '' || v == null) {
      rawValue = 0;
    } else {
      rawValue = typeof v === 'number' ? v : (parseCurrencyInput(v) || 0);
    }
    if (input === document.activeElement) {
      input.value = rawValue === 0 ? '' : String(rawValue);
    } else {
      formatDisplay();
    }
  };
  input.clearCurrencyValue = () => {
    rawValue = 0;
    input.value = '';
  };
  formatDisplay();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const defaultPagination = {
  page: 1,
  limit: 15,
  totalRecords: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getTableSort(tableKey) {
  return state.tableSort[tableKey] || { sortBy: '', sortOrder: 'asc' };
}

function buildTableParams(tableKey) {
  const params = {};
  const sort = getTableSort(tableKey);
  if (sort.sortBy) {
    params.sortBy = sort.sortBy;
    params.sortOrder = sort.sortOrder || 'asc';
  }
  return params;
}

function resetTableControls(tableKey) {
  state.tableSort[tableKey] = { sortBy: '', sortOrder: 'asc' };
}

function renderDataTable({
  tableBody,
  tableKey,
  columns,
  data,
  pagination,
  paginationContainerId,
  emptyMessage,
  filteredEmptyMessage,
  isFiltered = false,
  onRefresh,
  pageState,
  renderActions,
  rowClass,
}) {
  const table = tableBody.closest('table');
  const thead = table.querySelector('thead');
  const sort = getTableSort(tableKey);
  const visibleColumns = columns.filter((column) => column.visible !== false);
  const hasActionColumn = true;

  thead.innerHTML = `
    <tr>
      ${visibleColumns.map((column) => {
        const isSorted = sort.sortBy === column.key;
        const sortIcon = !column.sortable ? '' : (!isSorted ? '↕' : (sort.sortOrder === 'desc' ? '↓' : '↑'));
        const colClass = column.type ? `col-${column.type}` : '';
        return `<th class="${colClass}">
          <button class="datatable-sort" type="button" data-sort-key="${escapeHtml(column.key)}" ${column.sortable ? '' : 'disabled'}>
            ${escapeHtml(column.label)} <span>${sortIcon}</span>
          </button>
        </th>`;
      }).join('')}
      ${hasActionColumn ? '<th class="col-actions"></th>' : ''}
    </tr>
  `;

  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="${visibleColumns.length + (hasActionColumn ? 1 : 0)}" class="muted">${isFiltered ? filteredEmptyMessage : emptyMessage}</td></tr>`;
  } else {
    tableBody.innerHTML = data.map((row) => {
      const cells = visibleColumns.map((column) => {
        const raw = row[column.key];
        const value = column.render ? column.render(row) : escapeHtml(raw ?? '');
        const colClass = column.type ? `col-${column.type}` : '';
        return `<td class="${colClass}">${value}</td>`;
      }).join('');
      const actions = hasActionColumn ? `<td class="col-actions">${renderActions ? renderActions(row) : ''}</td>` : '';
      const cssClass = rowClass ? rowClass(row) : '';
      return `<tr class="${escapeHtml(cssClass)}">${cells}${actions}</tr>`;
    }).join('');
  }

  thead.querySelectorAll('[data-sort-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.sortKey;
      const current = getTableSort(tableKey);
      if (current.sortBy === key && current.sortOrder === 'desc') {
        state.tableSort[tableKey] = { sortBy: key, sortOrder: 'asc' };
      } else {
        state.tableSort[tableKey] = { sortBy: key, sortOrder: 'desc' };
      }
      pageState.page = 1;
      onRefresh();
    });
  });

  renderPaginationControls(
    paginationContainerId,
    pagination || defaultPagination,
    (newPage) => { pageState.page = newPage; onRefresh(); },
    (newLimit) => { pageState.limit = newLimit; pageState.page = 1; onRefresh(); },
  );
}

const statusOptions = ['Pendiente', 'En Proceso', 'Terminado'].map((value) => ({ value, label: value }));
const riskOptions = ['Alto', 'Medio', 'Bajo'].map((value) => ({ value, label: value }));
const employeeStatusOptions = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
];
const vacationStatusOptions = [
  { value: 'programada', label: 'Programada' },
  { value: 'tomada', label: 'Tomada' },
  { value: 'cancelada', label: 'Cancelada' },
];
const ecovisStatusOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcialmente_pagado', label: 'Parcialmente pagado' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'cancelado', label: 'Cancelado' },
];
const ecovisPaymentStatusOptions = [
  { value: 'asignado', label: 'Asignado' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'cancelado', label: 'Cancelado' },
];
const ecovisMovementOptions = [
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'pago_recibido', label: 'Pago recibido' },
  { value: 'prestamo_ecovis_a_revram', label: 'Prestamo' },
  { value: 'aplicacion_a_proyecto', label: 'Aplicacion a proyecto' },
  { value: 'saldo_a_favor', label: 'Saldo a favor' },
  { value: 'devolucion', label: 'Devolucion' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'cancelacion', label: 'Cancelacion' },
];

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase().replace(/\s+/g, '-');
  return `status-${s}`;
}

const projectColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true },
  { key: 'order_number', label: 'N. Pedido', type: 'text', sortable: true, render: (p) => escapeHtml(p.order_number || 'Sin pedido') },
  { key: 'client_name', label: 'Cliente', type: 'text', sortable: true },
  { key: 'project_description', label: 'Proyecto', type: 'text', sortable: true, render: (p) => escapeHtml(p.project_description || '') },
  { key: 'status', label: 'Estado', type: 'select', sortable: true, filterOptions: statusOptions, render: (p) => `<span class="badge status ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span>` },
  { key: 'risk', label: 'Riesgo', type: 'select', sortable: true, filterOptions: riskOptions, render: (p) => `<span class="badge risk-${escapeHtml(String(p.risk || '').toLowerCase())}">${escapeHtml(p.risk)}</span>` },
  { key: 'promised_delivery_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'total_charged', label: 'Cobrado', type: 'currency', sortable: true, render: (p) => money.format(p.total_charged) },
  { key: 'spent', label: 'Gastado', type: 'currency', sortable: true, render: (p) => money.format(p.spent) },
  { key: 'pending_collection', label: 'Pendiente', type: 'currency', sortable: true, render: (p) => money.format(p.pending_collection) },
  { key: 'final_margin', label: 'Margen final', type: 'number', sortable: true, render: (p) => `<span class="badge margin-badge ${marginBadgeClass(p)}" title="Margen esperado: ${escapeHtml(p.expected_margin)}%">${formatPercentDecimal(p.final_margin)}</span>` },
];

const closedProjectColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true },
  { key: 'order_number', label: 'N. Pedido', type: 'text', sortable: true, render: (p) => escapeHtml(p.order_number || 'Sin pedido') },
  { key: 'client_name', label: 'Cliente', type: 'text', sortable: true },
  { key: 'project_description', label: 'Proyecto', type: 'text', sortable: true, render: (p) => escapeHtml(p.project_description || '') },
  { key: 'closed_at', label: 'Cerrado', type: 'date', sortable: true },
  { key: 'total_invoiced_mxn', label: 'Facturado MXN', type: 'currency', sortable: true, render: (p) => money.format(p.total_invoiced_mxn) },
  { key: 'total_charged', label: 'Cobrado MXN', type: 'currency', sortable: true, render: (p) => money.format(p.total_charged) },
  { key: 'spent', label: 'Gastado MXN', type: 'currency', sortable: true, render: (p) => money.format(p.spent) },
  { key: 'final_margin', label: 'Margen final', type: 'number', sortable: true, render: (p) => `<span class="badge margin-badge ${marginBadgeClass(p)}">${formatPercentDecimal(p.final_margin)}</span>` },
];

const userColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'username', label: 'Usuario', type: 'text', sortable: true },
  { key: 'created_at', label: 'Creado', type: 'date', sortable: true },
];

const employeeColumns = [
  { key: 'employee_number', label: 'No. Empleado', type: 'text', sortable: true },
  { key: 'full_name', label: 'Nombre', type: 'text', sortable: true },
  { key: 'hire_date', label: 'Fecha ingreso', type: 'date', sortable: true },
  { key: 'seniority_years', label: 'Antiguedad', type: 'number', sortable: true, render: (emp) => `${emp.seniority_years} año${emp.seniority_years !== 1 ? 's' : ''}` },
  { key: 'active', label: 'Estatus', type: 'boolean', sortable: true, filterOptions: employeeStatusOptions, render: (emp) => !emp.active ? `<span class="badge badge-inactive">INACTIVO</span>${emp.termination_date ? `<br><small class="muted">${escapeHtml(emp.termination_date)}</small>` : ''}` : '<span class="badge badge-active">Activo</span>' },
  { key: 'termination_date', label: 'Fecha de baja', type: 'date', sortable: true, render: (emp) => escapeHtml(emp.termination_date || '') },
  { key: 'accrued_days', label: 'Dias generados acumulados', type: 'number', sortable: true },
  { key: 'days_taken', label: 'Tomados', type: 'number', sortable: true },
  { key: 'days_scheduled', label: 'Programados', type: 'number', sortable: true },
  { key: 'days_pending', label: 'Disponibles', type: 'number', sortable: true, render: (emp) => emp.days_pending < 0 ? `<span class="badge badge-negative">${emp.days_pending}</span><br><small class="text-negative">Saldo negativo</small>` : `${emp.days_pending}` },
];

const vacationRequestColumns = [
  { key: 'start_date', label: 'Fecha inicio', type: 'date', sortable: true },
  { key: 'end_date', label: 'Fecha fin', type: 'date', sortable: true },
  { key: 'requested_days', label: 'Dias', type: 'number', sortable: true },
  { key: 'vacation_exercise_year', label: 'Ejercicio', type: 'number', sortable: true },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: vacationStatusOptions, render: (req) => `<span class="badge status-${escapeHtml(req.status)}">${escapeHtml(req.status)}</span>` },
  { key: 'include_vacation_bonus', label: 'Prima', type: 'boolean', sortable: true, render: (req) => req.include_vacation_bonus ? 'Si' : 'No' },
  { key: 'notes', label: 'Notas', type: 'text', sortable: false, render: (req) => escapeHtml(req.notes || '') },
  { key: 'created_at', label: 'Registrado', type: 'date', sortable: true, render: (req) => escapeHtml((req.created_at || '').slice(0, 10)) },
];

const reportsProjectColumns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true },
  { key: 'order_number', label: 'N. Pedido', type: 'text', sortable: true, render: (p) => escapeHtml(p.order_number || 'Sin pedido') },
  { key: 'client_name', label: 'Cliente', type: 'text', sortable: true },
  { key: 'project_description', label: 'Proyecto', type: 'text', sortable: true, render: (p) => escapeHtml(p.project_description || '') },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: statusOptions, render: (p) => `<span class="badge status ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span>` },
  { key: 'report_count', label: 'Reportes', type: 'number', sortable: true, render: (p) => Number(p.report_count) || 0 },
];

const reportListColumns = [
  { key: 'report_folio', label: 'Folio', type: 'text', sortable: true },
  {
    key: 'report_type',
    label: 'Tipo',
    type: 'text',
    sortable: false,
    render: (r) => escapeHtml(r.report_type_label || (r._kind === 'failure' ? 'Reporte de falla' : r.report_type || '')),
  },
  { key: 'report_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'service_name', label: 'Servicio', type: 'text', sortable: true, render: (r) => escapeHtml(r.service_name || '') },
  {
    key: 'executed_by_name',
    label: 'Ejecuto',
    type: 'text',
    sortable: false,
    render: (r) => escapeHtml(r.executed_by_name || r.technician_name || r.solution_responsible_name || ''),
  },
];

const ecovisProjectColumns = [
  { key: 'project_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'project_name', label: 'Proyecto', type: 'text', sortable: true },
  { key: 'quote_number', label: 'Cotizacion', type: 'text', sortable: true, render: (p) => escapeHtml(p.quote_number || '') },
  { key: 'purchase_order_number', label: 'OC', type: 'text', sortable: true, render: (p) => escapeHtml(p.purchase_order_number || '') },
  { key: 'invoice_number', label: 'Factura', type: 'text', sortable: true, render: (p) => escapeHtml(p.invoice_number || '') },
  { key: 'total_amount', label: 'Monto original', type: 'currency', sortable: true, render: (p) => `${money.format(Number(p.total_amount || 0))} ${escapeHtml(p.currency || 'MXN')}` },
  { key: 'amount_mxn', label: 'Equiv. MXN', type: 'currency', sortable: true, render: (p) => money.format(Number(p.amount_mxn || p.total_amount || 0)) },
  { key: 'paid_amount_mxn', label: 'Pagado MXN', type: 'currency', sortable: true, render: (p) => money.format(Number(p.paid_amount_mxn || p.paid_amount || 0)) },
  { key: 'pending_amount_mxn', label: 'Pendiente MXN', type: 'currency', sortable: true, render: (p) => money.format(Number(p.pending_amount_mxn || p.pending_amount || 0)) },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: ecovisStatusOptions, render: (p) => `<span class="badge ecovis-status-${escapeHtml(p.status || 'pendiente')}">${escapeHtml(p.status || 'pendiente')}</span>` },
];

const ecovisPaymentColumns = [
  { key: 'payment_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'amount', label: 'Monto', type: 'currency', sortable: true, render: (p) => money.format(Number(p.amount || 0)) },
  { key: 'currency', label: 'Moneda', type: 'select', sortable: true, filterOptions: ['MXN', 'USD', 'EUR'].map((value) => ({ value, label: value })) },
  { key: 'payment_method', label: 'Metodo', type: 'text', sortable: true, render: (p) => escapeHtml(p.payment_method || '') },
  { key: 'bank_reference', label: 'Referencia', type: 'text', sortable: true, render: (p) => escapeHtml(p.bank_reference || '') },
  { key: 'allocated_amount', label: 'Asignado', type: 'currency', sortable: true, render: (p) => money.format(Number(p.allocated_amount ?? (Number(p.amount || 0) - Number(p.unallocated_amount || 0)))) },
  { key: 'unallocated_amount', label: 'Sin asignar', type: 'currency', sortable: true, render: (p) => money.format(Number(p.unallocated_amount || 0)) },
  { key: 'status', label: 'Estatus', type: 'select', sortable: true, filterOptions: ecovisPaymentStatusOptions, render: (p) => {
    const statusLabel = p.is_cancelled ? 'cancelado' : (Number(p.unallocated_amount || 0) > 0 ? 'parcial' : 'asignado');
    return `<span class="badge ecovis-status-${p.is_cancelled ? 'cancelado' : 'pendiente'}">${escapeHtml(statusLabel)}</span>`;
  } },
];

const ecovisLoanColumns = [
  { key: 'movement_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'amount', label: 'Monto', type: 'currency', sortable: true, render: (l) => money.format(Number(l.amount || 0)) },
  { key: 'currency', label: 'Moneda', type: 'select', sortable: true, filterOptions: ['MXN', 'USD', 'EUR'].map((value) => ({ value, label: value })) },
  { key: 'reference', label: 'Referencia', type: 'text', sortable: true, render: (l) => escapeHtml(l.reference || '') },
  { key: 'description', label: 'Descripcion', type: 'text', sortable: true, render: (l) => escapeHtml(l.description || '') },
  { key: 'outstanding', label: 'Saldo', type: 'currency', sortable: true, render: (l) => money.format(Number(l.outstanding || 0)) },
];

const ecovisMovementColumns = [
  { key: 'movement_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'movement_type', label: 'Tipo', type: 'select', sortable: true, filterOptions: ecovisMovementOptions, render: (m) => escapeHtml(ECOVIS_MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type) },
  { key: 'description', label: 'Descripcion', type: 'text', sortable: true, render: (m) => escapeHtml(m.description || '') },
  { key: 'amount', label: 'Monto', type: 'currency', sortable: true, render: (m) => money.format(Number(m.amount || 0)) },
  { key: 'direction', label: 'Direccion', type: 'select', sortable: true, filterOptions: [
    { value: 'ecovis_debe_a_revram', label: 'ECOVIS debe' },
    { value: 'revram_debe_a_ecovis', label: 'REVRAM debe' },
    { value: 'neutral', label: 'Neutral' },
  ], render: (m) => escapeHtml(ECOVIS_DIRECTION_LABELS[m.direction] || m.direction) },
  { key: 'related_project_name', label: 'Proyecto relacionado', type: 'text', sortable: true, render: (m) => escapeHtml(m.related_project_name || m.reference || '') },
  { key: 'created_by', label: 'Usuario', type: 'text', sortable: true, render: (m) => escapeHtml(m.created_by || '') },
];

function paginateMergedList(items, pageState) {
  const totalRecords = items.length;
  const limit = pageState.limit || 15;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit) || 1);
  const page = Math.min(Math.max(1, pageState.page), totalPages);
  const offset = (page - 1) * limit;
  return {
    data: items.slice(offset, offset + limit),
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      offset,
    },
  };
}

function renderPaginationControls(containerId, pagination, onPageChange, onLimitChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, limit, totalRecords, totalPages, hasNextPage, hasPreviousPage } = pagination;
  const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalRecords);

  container.innerHTML = `
    <div class="pagination-controls">
      <span class="pagination-info">Mostrando ${start}-${end} de ${totalRecords} registros</span>
      <div class="pagination-buttons">
        <button type="button" data-page="1" ${!hasPreviousPage ? 'disabled' : ''}>Primera</button>
        <button type="button" data-page="${page - 1}" ${!hasPreviousPage ? 'disabled' : ''}>Anterior</button>
        <span class="pagination-current">Pagina ${page} de ${totalPages}</span>
        <button type="button" data-page="${page + 1}" ${!hasNextPage ? 'disabled' : ''}>Siguiente</button>
        <button type="button" data-page="${totalPages}" ${!hasNextPage ? 'disabled' : ''}>Ultima</button>
      </div>
      <div class="pagination-limit">
        <label>Registros:
          <select data-limit-select>
            <option value="15" ${limit === 15 ? 'selected' : ''}>15</option>
            <option value="30" ${limit === 30 ? 'selected' : ''}>30</option>
            <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
          </select>
        </label>
      </div>
    </div>
  `;

  container.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newPage = Number(btn.dataset.page);
      if (newPage >= 1 && newPage <= totalPages) onPageChange(newPage);
    });
  });

  const limitSelect = container.querySelector('[data-limit-select]');
  if (limitSelect) {
    limitSelect.addEventListener('change', () => {
      onLimitChange(Number(limitSelect.value));
    });
  }
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  let body = options.body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    ...options,
    headers,
    body,
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('API JSON parse failed:', path, parseErr.message);
      throw new Error('No se pudo interpretar la respuesta del servidor.');
    }
  }
  if (!response.ok) {
    const msg = data.message || data.error || 'La operacion no pudo completarse.';
    throw new Error(msg);
  }
  return data;
}

function showLogin() {
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
}

async function showApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  setDefaultDates();
  resetUserForm();
  state.adminVerified = false;
  applyRoleVisibility();
  if (canAccess('projects', 'view')) {
    switchView('projects');
    await loadExchangeRates();
    await loadProjectAssignableEmployees();
    await loadProjects();
  } else if (canAccess('reports', 'view')) {
    switchView('reports');
    await loadReportsProjects();
  } else {
    switchView('reports');
  }
}

(function setupMainCurrencyInputs() {
  var totalInvoicedInput = projectForm.elements.total_invoiced;
  var totalInvoicedCurrency = projectForm.elements.total_invoiced_currency;
  if (totalInvoicedInput) {
    initCurrencyInput(totalInvoicedInput, function() { return totalInvoicedCurrency ? totalInvoicedCurrency.value : 'MXN'; });
    if (totalInvoicedCurrency) totalInvoicedCurrency.addEventListener('change', function() { if (totalInvoicedInput.setCurrencyValue) totalInvoicedInput.setCurrencyValue(totalInvoicedInput.getCurrencyValue()); });
  }
  var payAmt = paymentForm.elements.amount;
  var payCur = paymentForm.elements.currency;
  if (payAmt) {
    initCurrencyInput(payAmt, function() { return payCur ? payCur.value : 'MXN'; });
    if (payCur) payCur.addEventListener('change', function() { if (payAmt.setCurrencyValue) payAmt.setCurrencyValue(payAmt.getCurrencyValue()); });
  }
  var costAmt = costForm.elements.amount;
  var costCur = costForm.elements.currency;
  if (costAmt) {
    initCurrencyInput(costAmt, function() { return costCur ? costCur.value : 'MXN'; });
    if (costCur) costCur.addEventListener('change', function() { if (costAmt.setCurrencyValue) costAmt.setCurrencyValue(costAmt.getCurrencyValue()); });
  }


})();

function setMessage(element, message, isSuccess = false) {
  element.textContent = message || '';
  element.classList.toggle('success', Boolean(isSuccess));
}

function setDefaultDates() {
  if (!paymentForm.elements.payment_date.value) {
    paymentForm.elements.payment_date.value = today();
  }

  if (!costForm.elements.cost_date.value) {
    costForm.elements.cost_date.value = today();
  }
}

function projectPayload() {
  const formData = new FormData(projectForm);
  const payload = Object.fromEntries(formData.entries());
  payload.purchase_order_not_applicable = purchaseOrderNotApplicable.checked;
  if (purchaseOrderNotApplicable.checked) {
    payload.purchase_order_number = '';
  }
  var ti = projectForm.elements.total_invoiced;
  if (ti && ti.getCurrencyValue) payload.total_invoiced = ti.getCurrencyValue();
  return payload;
}

function simpleFormPayload(form) {
  var payload = Object.fromEntries(new FormData(form).entries());
  var ai = form.elements.amount;
  if (ai && ai.getCurrencyValue) payload.amount = ai.getCurrencyValue();
  var tai = form.elements.total_amount;
  if (tai && tai.getCurrencyValue) payload.total_amount = tai.getCurrencyValue();
  return payload;
}

function userPayload() {
  const payload = simpleFormPayload(userForm);
  if (!payload.password) {
    delete payload.password;
  }

  return payload;
}

function exchangeRatePayload() {
  return Object.fromEntries(new FormData(exchangeRateForm).entries());
}

function switchView(viewName) {
  const viewPermMap = {
    projects: ['projects', 'view'],
    'closed-projects': ['closedProjects', 'view'],
    reports: ['reports', 'view'],
    'report-archive': ['reportsArchive', 'view'],
    vacations: ['vacations', 'view'],
    attendance: ['attendance', 'view'],
    ecovis: ['ecovisAccount', 'view'],
    'service-quoter': ['serviceQuoter', 'view'],
    users: ['users', 'view'],
    commissions: ['commissions', 'view'],
    'activity-monitor': ['activityMonitor', 'view'],
  };
  const perm = viewPermMap[viewName];
  if (perm && !canAccess(perm[0], perm[1])) {
    const firstAllowed = Object.entries(viewPermMap).find(([, p]) => canAccess(p[0], p[1]));
    viewName = firstAllowed ? firstAllowed[0] : 'reports';
  }
  const showingProjects = viewName === 'projects';
  const showingClosedProjects = viewName === 'closed-projects';
  const showingUsers = viewName === 'users';
  const showingVacations = viewName === 'vacations';
  const showingAttendance = viewName === 'attendance';
  const showingReports = viewName === 'reports';
  const showingEcovis = viewName === 'ecovis';
  const showingArchive = viewName === 'report-archive';
  const showingServiceQuoter = viewName === 'service-quoter';
  const showingFinancial = viewName === 'financial';
  const showingKpis = viewName === 'kpis';
  projectsView.classList.toggle('hidden', !showingProjects);
  closedProjectsView.classList.toggle('hidden', !showingClosedProjects);
  usersView.classList.toggle('hidden', !showingUsers);
  const showingCommissions = viewName === "commissions";
  const showingActivityMonitor = viewName === "activity-monitor";
  if (vacationsView) vacationsView.classList.toggle('hidden', !showingVacations);
  if (attendanceView) attendanceView.classList.toggle('hidden', !showingAttendance);
  if (reportsView) reportsView.classList.toggle('hidden', !showingReports);
  if (ecovisView) ecovisView.classList.toggle('hidden', !showingEcovis);
  const archiveView = document.getElementById('report-archive-view');
  if (archiveView) archiveView.classList.toggle('hidden', !showingArchive);
  const sqView = document.getElementById('service-quoter-view');
  if (sqView) sqView.classList.toggle('hidden', !showingServiceQuoter);
  const finView = document.getElementById('financial-view');
  if (finView) finView.classList.toggle('hidden', !showingFinancial);
  const kpisView = document.getElementById('kpis-view');
  if (kpisView) kpisView.classList.toggle('hidden', !showingKpis);
  var comView2 = document.getElementById("commissions-view");
  if (comView2) comView2.classList.toggle("hidden", !showingCommissions);
  var amView2 = document.getElementById("activity-monitor-view");
  if (amView2) amView2.classList.toggle("hidden", !showingActivityMonitor);
  projectsTab.classList.toggle('active', showingProjects);
  closedProjectsTab.classList.toggle('active', showingClosedProjects);
  usersTab.classList.toggle('active', showingUsers);
  if (vacationsTab) vacationsTab.classList.toggle('active', showingVacations);
  if (attendanceTab) attendanceTab.classList.toggle('active', showingAttendance);
  if (reportsTab) reportsTab.classList.toggle('active', showingReports);
  if (ecovisTab) ecovisTab.classList.toggle('active', showingEcovis);
  const archiveTab = document.getElementById('report-archive-tab');
  if (archiveTab) archiveTab.classList.toggle('active', showingArchive);
  const sqTab = document.getElementById('service-quoter-tab');
  if (sqTab) sqTab.classList.toggle('active', showingServiceQuoter);
  var comTabA = document.getElementById("commissions-tab");
  if (comTabA) comTabA.classList.toggle("active", showingCommissions);
  var amTabA = document.getElementById("activity-monitor-tab");
  if (amTabA) amTabA.classList.toggle("active", showingActivityMonitor);
  const kpisTabEl = document.getElementById('kpis-tab');
  if (kpisTabEl) kpisTabEl.classList.toggle('active', showingKpis);
  if (showingKpis) initKpiDashboard();
  if (showingServiceQuoter) initServiceQuoter();
}

function showPasswordModal(message = 'Ingresa la contraseña del admin:') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('password-modal');
    const form = document.getElementById('password-modal-form');
    const input = document.getElementById('password-modal-input');
    const msgEl = document.getElementById('password-modal-message');
    const errorEl = document.getElementById('password-modal-error');
    const cancelBtn = document.getElementById('password-modal-cancel');

    msgEl.textContent = message;
    input.value = '';
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    overlay.classList.remove('hidden');
    input.focus();

    function cleanup() {
      input.value = '';
      overlay.classList.add('hidden');
      form.removeEventListener('submit', onSubmit);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onEscape);
    }

    function onSubmit(e) {
      e.preventDefault();
      const value = input.value;
      cleanup();
      resolve(value || null);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    function onEscape(e) {
      if (e.key === 'Escape') onCancel();
    }

    form.addEventListener('submit', onSubmit);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onEscape);
  });
}

async function requestAdminAuthorization(message = 'Ingresa la contraseña del admin:') {
  const password = await showPasswordModal(message);
  if (!password) {
    return false;
  }

  await api('/api/admin/verify', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  state.adminVerified = true;
  return true;
}

async function promptAdminPassword(message = 'Ingresa la contraseña del admin:') {
  return showPasswordModal(message);
}

async function loadExchangeRates() {
  const exchangeRateState = await api('/api/exchange-rates');
  state.exchangeRates = exchangeRateState.rates.reduce((rates, row) => {
    rates[row.currency] = Number(row.rate_to_mxn);
    return rates;
  }, {});
  state.exchangeUpdatedAt = exchangeRateState.last_updated_at;
  renderExchangeRates();
}

function renderExchangeRates() {
  exchangeRateForm.elements.USD.value = state.exchangeRates.USD || '';
  exchangeRateForm.elements.EUR.value = state.exchangeRates.EUR || '';
  document.querySelector('#exchange-updated-at').textContent = state.exchangeUpdatedAt
    ? new Date(state.exchangeUpdatedAt.replace(' ', 'T')).toLocaleString('es-MX')
    : 'Sin cambios';
}

async function loadProjects() {
  const params = new URLSearchParams({
    page: state.projectsPag.page,
    limit: state.projectsPag.limit,
    search: state.projectsSearch,
    ...buildTableParams('projects'),
  });
  const result = await api(`/api/projects?${params}`);
  state.projects = result.data;
  state.projectsSummary = result.summary;
  state.projectsPagination = result.pagination;
  renderProjects();

  if (state.selectedProjectId) {
    const current = state.projects.find((project) => project.id === state.selectedProjectId);
    if (current) {
      fillProjectForm(current);
      if (state.projectDrawerOpen) {
        renderDetail(current);
      }
    } else {
      clearSelection();
    }
  }
}

async function loadClosedProjects() {
  const params = new URLSearchParams({
    page: state.closedPag.page,
    limit: state.closedPag.limit,
    search: state.closedSearch,
    ...buildTableParams('closedProjects'),
  });
  const result = await api(`/api/closed-projects?${params}`);
  state.closedProjects = result.data;
  state.closedPagination = result.pagination;
  renderClosedProjects();

  if (state.selectedClosedProjectId) {
    const current = state.closedProjects.find((p) => p.id === state.selectedClosedProjectId);
    current ? selectClosedProject(current.id) : clearClosedSelection();
  }
}

function renderProjects() {
  const summary = state.projectsSummary || {};
  document.querySelector('#stat-projects').textContent = summary.totalProjects ?? 0;
  document.querySelector('#stat-charged').textContent = money.format(summary.totalCharged ?? 0);
  document.querySelector('#stat-spent').textContent = money.format(summary.totalSpent ?? 0);
  document.querySelector('#stat-pending').textContent = money.format(summary.totalPending ?? 0);

  renderDataTable({
    tableBody: projectsTable,
    tableKey: 'projects',
    columns: projectColumns,
    data: state.projects,
    pagination: state.projectsPagination || defaultPagination,
    paginationContainerId: 'projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.projectsSearch),
    onRefresh: loadProjects,
    pageState: state.projectsPag,
    renderActions: (project) => `
      <div class="row-actions">
        <button class="danger" data-action="delete-project" data-id="${project.id}" type="button">Eliminar</button>
        <button class="secondary" data-action="select" data-id="${project.id}" type="button">Abrir</button>
      </div>`,
    rowClass: (project) => (
      state.projectDrawerOpen && state.selectedProjectId === project.id ? 'row-selected' : ''
    ),
  });
}

function renderClosedProjects() {
  renderDataTable({
    tableBody: closedProjectsTable,
    tableKey: 'closedProjects',
    columns: closedProjectColumns,
    data: state.closedProjects,
    pagination: state.closedPagination || defaultPagination,
    paginationContainerId: 'closed-projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.closedSearch),
    onRefresh: loadClosedProjects,
    pageState: state.closedPag,
    renderActions: (project) => `
      <div class="row-actions">
        <button class="danger" data-action="delete-closed-project" data-id="${project.id}" type="button">Borrar definitivo</button>
        <button class="secondary" data-action="select-closed-project" data-id="${project.id}" type="button">Historial</button>
      </div>`,
  });
}

async function loadUsers() {
  const params = new URLSearchParams({
    page: state.usersPag.page,
    limit: state.usersPag.limit,
    ...buildTableParams('users'),
  });
  const result = await api(`/api/users?${params}`);
  state.users = result.data;
  state.usersPagination = result.pagination;
  renderUsers();
}

function renderUsers() {
  renderDataTable({
    tableBody: usersTable,
    tableKey: 'users',
    columns: userColumns,
    data: state.users,
    pagination: state.usersPagination || defaultPagination,
    paginationContainerId: 'users-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: loadUsers,
    pageState: state.usersPag,
    renderActions: (user) => `<button class="secondary" data-action="select-user" data-id="${user.id}" type="button">Editar</button>`,
  });
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function formatCurrency(value, currency = 'MXN') {
  const formatter = currencyFormatters[currency] || money;
  return formatter.format(Number(value || 0));
}

function formatCapturedAndMxn(amount, currency, amountMxn) {
  const captured = formatCurrency(amount, currency);
  if (currency === 'MXN') {
    return captured;
  }

  return `${captured} (${money.format(amountMxn)} MXN)`;
}

function formatPercentDecimal(value) {
  if (value === null || value === undefined) {
    return 'Sin facturar';
  }

  return `${(Number(value) * 100).toFixed(2)}%`;
}

function marginBadgeClass(project) {
  if (project.final_margin === null || project.final_margin === undefined) {
    return 'margin-neutral';
  }

  const finalMarginPercent = Number(project.final_margin) * 100;
  const expectedMarginPercent = Number(project.expected_margin || 0);
  const deficit = expectedMarginPercent - finalMarginPercent;

  if (finalMarginPercent >= expectedMarginPercent) {
    return 'margin-good';
  }

  if (deficit >= 20) {
    return 'margin-danger';
  }

  if (deficit >= 5) {
    return 'margin-warning';
  }

  return 'margin-neutral';
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

let projectDrawerFocusReturn = null;
let projectDrawerReleaseFocusTrap = null;
let projectDrawerEscapeHandler = null;

const PROJECT_DRAWER_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function lockProjectDrawerBodyScroll() {
  if (document.body.classList.contains('scroll-lock')) {
    return;
  }
  const scrollY = window.scrollY;
  document.body.dataset.projectDrawerScrollY = String(scrollY);
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  document.body.classList.add('scroll-lock');
}

function unlockProjectDrawerBodyScroll() {
  if (!document.body.classList.contains('scroll-lock')) {
    return;
  }
  const scrollY = Number(document.body.dataset.projectDrawerScrollY || 0);
  document.body.classList.remove('scroll-lock');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  delete document.body.dataset.projectDrawerScrollY;
  window.scrollTo(0, scrollY);
}

function trapProjectDrawerFocus(container) {
  function onKeyDown(event) {
    if (event.key !== 'Tab') {
      return;
    }
    const focusables = Array.from(container.querySelectorAll(PROJECT_DRAWER_FOCUSABLE))
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}

function openProjectDrawer() {
  if (!projectDetailDrawer) {
    return;
  }
  state.projectDrawerOpen = true;
  projectDetailDrawer.classList.remove('hidden');
  projectDetailDrawer.setAttribute('aria-hidden', 'false');
  lockProjectDrawerBodyScroll();
  renderProjects();

  if (projectDrawerReleaseFocusTrap) {
    projectDrawerReleaseFocusTrap();
  }
  projectDrawerReleaseFocusTrap = detailPanel ? trapProjectDrawerFocus(detailPanel) : null;

  if (projectDrawerEscapeHandler) {
    document.removeEventListener('keydown', projectDrawerEscapeHandler);
  }
  projectDrawerEscapeHandler = (event) => {
    if (event.key === 'Escape') {
      closeProjectDrawer();
    }
  };
  document.addEventListener('keydown', projectDrawerEscapeHandler);

  window.requestAnimationFrame(() => {
    detailPanel?.focus();
  });
}

function closeProjectDrawer() {
  if (!projectDetailDrawer || projectDetailDrawer.classList.contains('hidden')) {
    return;
  }
  state.projectDrawerOpen = false;
  projectDetailDrawer.classList.add('hidden');
  projectDetailDrawer.setAttribute('aria-hidden', 'true');
  unlockProjectDrawerBodyScroll();
  renderProjects();

  if (projectDrawerReleaseFocusTrap) {
    projectDrawerReleaseFocusTrap();
    projectDrawerReleaseFocusTrap = null;
  }
  if (projectDrawerEscapeHandler) {
    document.removeEventListener('keydown', projectDrawerEscapeHandler);
    projectDrawerEscapeHandler = null;
  }

  const returnTarget = projectDrawerFocusReturn;
  projectDrawerFocusReturn = null;
  if (returnTarget && typeof returnTarget.focus === 'function') {
    returnTarget.focus();
  }
}

function selectProject(projectId, focusReturnEl) {
  const project = state.projects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  state.selectedProjectId = project.id;
  if (focusReturnEl) {
    projectDrawerFocusReturn = focusReturnEl;
  }
  fillProjectForm(project);
  renderDetail(project);
  openProjectDrawer();
}

function addDaysToDateInput(baseDate, days) {
  const iso = baseDate || new Date().toISOString().slice(0, 10);
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function populateProjectStaffSelects(selectedTecnicoId, selectedVendedorId) {
  if (!projectForm) return;
  const tecnicoSelect = projectForm.elements.tecnico_id;
  const vendedorSelect = projectForm.elements.vendedor_id;
  if (!tecnicoSelect || !vendedorSelect) return;

  const options = (state.projectAssignableEmployees || []).map((emp) => (
    `<option value="${emp.id}">${escapeHtml(emp.full_name)} (${escapeHtml(emp.employee_number)})</option>`
  )).join('');

  tecnicoSelect.innerHTML = `<option value="">Seleccione tecnico...</option>${options}`;
  vendedorSelect.innerHTML = `<option value="">Seleccione vendedor...</option>${options}`;

  if (selectedTecnicoId) tecnicoSelect.value = String(selectedTecnicoId);
  if (selectedVendedorId) vendedorSelect.value = String(selectedVendedorId);
}

async function loadProjectAssignableEmployees() {
  try {
    const result = await api('/api/projects/assignable-employees');
    state.projectAssignableEmployees = result.data || [];
    populateProjectStaffSelects(
      projectForm?.elements?.id?.value ? projectForm.elements.tecnico_id?.value : null,
      projectForm?.elements?.id?.value ? projectForm.elements.vendedor_id?.value : null,
    );
    populateReportsFailureEmployeeSelects();
  } catch (_error) {
    state.projectAssignableEmployees = [];
  }
}

async function loadReportsAssignableEmployees() {
  try {
    const result = await api('/api/reports/assignable-employees');
    state.reportsAssignableEmployees = result.data || [];
    populateReportExecutedBySelect();
    populateReportsFailureEmployeeSelects();
  } catch (_error) {
    state.reportsAssignableEmployees = state.projectAssignableEmployees || [];
    populateReportExecutedBySelect();
    populateReportsFailureEmployeeSelects();
  }
}

function populateReportExecutedBySelect(selectedId) {
  if (!reportForm?.elements?.executed_by_employee_id) return;
  const employees = state.reportsAssignableEmployees || state.projectAssignableEmployees || [];
  const options = employees.map((emp) => (
    `<option value="${emp.id}">${escapeHtml(emp.full_name)} (${escapeHtml(emp.employee_number)})</option>`
  )).join('');
  reportForm.elements.executed_by_employee_id.innerHTML =
    `<option value="">Seleccione empleado...</option>${options}`;
  if (selectedId) {
    reportForm.elements.executed_by_employee_id.value = String(selectedId);
  }
}

function populateReportsFailureEmployeeSelects() {
  if (!reportsFailureForm) {
    return;
  }
  const employees = state.reportsAssignableEmployees || state.projectAssignableEmployees || [];
  const options = employees.map((emp) => (
    `<option value="${emp.id}">${escapeHtml(emp.full_name)} (${escapeHtml(emp.employee_number)})</option>`
  )).join('');
  const failureSelect = reportsFailureForm.elements.failure_responsible_employee_id;
  const solutionSelect = reportsFailureForm.elements.solution_responsible_employee_id;
  if (failureSelect) failureSelect.innerHTML = `<option value="">Seleccione empleado...</option>${options}`;
  if (solutionSelect) solutionSelect.innerHTML = `<option value="">Seleccione empleado...</option>${options}`;
}

function syncReportsFailureResponsibleVisibility() {
  if (!reportsFailureForm) return;
  const cause = reportsFailureForm.elements.cause?.value || 'interna';
  const wrap = document.getElementById('reports-failure-responsible-wrap');
  const failureSelect = reportsFailureForm.elements.failure_responsible_employee_id;
  const isInterna = cause === 'interna';
  if (wrap) wrap.classList.toggle('hidden', !isInterna);
  if (failureSelect) {
    failureSelect.required = isInterna;
    if (!isInterna) failureSelect.value = '';
  }
}

function openReportsFailureForm(projectId) {
  const project = state.reportsAllProjects.find((p) => p.id === Number(projectId));
  if (!project || !reportsFailurePanel || !reportsFailureForm) return;
  state.currentReportProjectId = Number(projectId);
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportFormPanel.classList.add('hidden');
  reportListPanel.classList.add('hidden');
  reportsFailurePanel.classList.remove('hidden');
  reportsFailureForm.reset();
  reportsFailureForm.elements.project_id.value = project.id;
  if (reportsFailureSubtitle) {
    reportsFailureSubtitle.textContent = `Proyecto #${project.id} - ${project.client_name}`;
  }
  populateReportsFailureEmployeeSelects();
  syncReportsFailureResponsibleVisibility();
  setMessage(reportsFailureMessage, '');
}

function renderFailureReportEntry(report) {
  const failureLine = report.cause === 'interna' && report.failure_responsible_name
    ? `<small>Responsable de la falla: ${escapeHtml(report.failure_responsible_name)}</small>`
    : '<small>Responsable de la falla: Cliente</small>';
  return `
    <li>
      <div>
        <strong>${escapeHtml(report.cause_label)} — ${escapeHtml(report.registered_at_cdmx || report.registered_at)}</strong>
        <small>${escapeHtml(report.problem_description)}</small>
        ${failureLine}
        <small>Responsable de solucionarlo: ${escapeHtml(report.solution_responsible_name || '')}</small>
      </div>
    </li>
  `;
}

async function loadFailureReports(projectId, listElement) {
  if (!listElement || !projectId) {
    return;
  }
  try {
    const result = await api(`/api/projects/${projectId}/failure-reports`);
    const items = result.data || [];
    listElement.innerHTML = renderEntries(
      items,
      renderFailureReportEntry,
      'Sin reportes de falla registrados.',
    );
  } catch (error) {
    listElement.innerHTML = `<li class="muted">${escapeHtml(error.message)}</li>`;
  }
}

function fillProjectForm(project) {
  projectFormTitle.textContent = `Editar proyecto #${project.id}`;
  populateProjectStaffSelects(project.tecnico_id, project.vendedor_id);
  projectForm.elements.id.value = project.id;
  projectForm.elements.quote_number.value = project.quote_number;
  projectForm.elements.order_number.value = project.order_number;
  projectForm.elements.purchase_order_number.value = project.purchase_order_number || '';
  projectForm.elements.purchase_order_not_applicable.checked = Boolean(
    project.purchase_order_not_applicable,
  );
  projectForm.elements.client_name.value = project.client_name;
  projectForm.elements.project_description.value = project.project_description || '';
  projectForm.elements.expected_margin.value = project.expected_margin;
  if (projectForm.elements.total_invoiced.setCurrencyValue) { projectForm.elements.total_invoiced.setCurrencyValue(project.total_invoiced); } else { projectForm.elements.total_invoiced.value = project.total_invoiced; }
  projectForm.elements.total_invoiced_currency.value = project.total_invoiced_currency || 'MXN';
  projectForm.elements.progress_percent.value = project.progress_percent;
  if (projectForm.elements.tecnico_id) {
    projectForm.elements.tecnico_id.value = project.tecnico_id ? String(project.tecnico_id) : '';
  }
  if (projectForm.elements.vendedor_id) {
    projectForm.elements.vendedor_id.value = project.vendedor_id ? String(project.vendedor_id) : '';
  }
  projectForm.elements.fecha_vencimiento.value = project.fecha_vencimiento || addDaysToDateInput(project.created_at, 30);
  projectForm.elements.promised_delivery_date.value = project.promised_delivery_date;
  projectForm.elements.status.value = project.status;
  projectForm.elements.risk.value = project.risk;
  projectForm.elements.observations.value = project.observations || '';
  togglePurchaseOrder();
  setMessage(projectMessage, '');
}

function resetProjectForm() {
  projectForm.reset();
  projectFormTitle.textContent = 'Nuevo proyecto';
  projectForm.elements.id.value = '';
  projectForm.elements.expected_margin.value = 0;
  if (projectForm.elements.total_invoiced.setCurrencyValue) { projectForm.elements.total_invoiced.setCurrencyValue(0); } else { projectForm.elements.total_invoiced.value = 0; }
  projectForm.elements.total_invoiced_currency.value = 'MXN';
  projectForm.elements.progress_percent.value = 0;
  projectForm.elements.fecha_vencimiento.value = addDaysToDateInput(null, 30);
  populateProjectStaffSelects();
  togglePurchaseOrder();
  setMessage(projectMessage, '');
}

function clearSelection() {
  state.selectedProjectId = null;
  closeProjectDrawer();
  resetProjectForm();
}

function clearClosedSelection() {
  state.selectedClosedProjectId = null;
  closedDetailPanel.classList.add('hidden');
}

async function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  const confirmed = window.confirm(
    `Se cerrara el proyecto #${project.id} (${project.quote_number}) y se movera a Proyectos Cerrados.`,
  );
  if (!confirmed) {
    return;
  }

  const password = await promptAdminPassword('Ingresa la contraseña del admin para cerrar el proyecto:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/projects/${project.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });

    if (state.selectedProjectId === project.id) {
      clearSelection();
    }

    await loadProjects();
    await loadClosedProjects();
  } catch (error) {
    window.alert(error.message);
  }
}

async function deleteClosedProject(projectId) {
  const project = state.closedProjects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  const confirmed = window.confirm(
    `Se borrara definitivamente el proyecto cerrado #${project.id} (${project.quote_number}). Esta accion no se puede deshacer.`,
  );
  if (!confirmed) {
    return;
  }

  const password = await promptAdminPassword('Ingresa la contraseña del admin para borrar definitivamente:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/closed-projects/${project.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });

    if (state.selectedClosedProjectId === project.id) {
      clearClosedSelection();
    }

    await loadClosedProjects();
  } catch (error) {
    window.alert(error.message);
  }
}

function selectClosedProject(projectId) {
  const project = state.closedProjects.find((item) => item.id === Number(projectId));
  if (!project) {
    return;
  }

  state.selectedClosedProjectId = project.id;
  closedDetailPanel.classList.remove('hidden');
  document.querySelector('#closed-detail-title').textContent = `#${project.id} - ${project.client_name}`;
  document.querySelector('#closed-detail-subtitle').textContent =
    `Cotizacion ${project.quote_number} | Cerrado ${project.closed_at || ''}`;
  document.querySelector('#closed-detail-description').textContent =
    project.project_description || '';

  const cdrl = document.querySelector('#closed-detail-reports-list');
  if (cdrl && typeof renderDetailReports === 'function') {
    renderDetailReports(project.id, cdrl);
  }
  loadFailureReports(project.id, closedDetailFailureReportsList);

  closedPaymentsList.innerHTML = renderEntries(
    project.payments,
    (payment) => `
      <li>
        <div>
          <strong>${formatCapturedAndMxn(payment.amount, payment.currency, payment.amount_mxn)}</strong>
          <small>${escapeHtml(payment.payment_date)} ${escapeHtml(payment.notes || '')}</small>
        </div>
      </li>
    `,
    'Sin pagos registrados.',
  );
  closedCostsList.innerHTML = renderEntries(
    project.costs,
    (cost) => `
      <li>
        <div>
          <strong>${escapeHtml(cost.category)}: ${formatCapturedAndMxn(cost.amount, cost.currency, cost.amount_mxn)}</strong>
          <small>${escapeHtml(cost.cost_date)} - ${escapeHtml(cost.description)}</small>
          <small>Porcentaje vs facturado: ${formatPercentDecimal(cost.invoice_cost_percentage)}</small>
        </div>
      </li>
    `,
    'Sin gastos registrados.',
  );
}

function selectUser(userId) {
  const user = state.users.find((item) => item.id === Number(userId));
  if (!user) {
    return;
  }

  state.selectedUserId = user.id;
  userFormTitle.textContent = `Editar usuario #${user.id}`;
  userForm.elements.id.value = user.id;
  userForm.elements.username.value = user.username;
  userForm.elements.password.value = '';
  userForm.elements.password.required = false;
  setMessage(userMessage, '');
}

function resetUserForm() {
  state.selectedUserId = null;
  userForm.reset();
  userFormTitle.textContent = 'Nuevo usuario';
  userForm.elements.id.value = '';
  userForm.elements.password.required = true;
  setMessage(userMessage, '');
}

function renderDetail(project) {
  document.querySelector('#detail-title').textContent = `#${project.id} - ${project.client_name}`;
  document.querySelector('#detail-subtitle').textContent =
    `Cotizacion ${project.quote_number} | Pedido ${project.order_number} | Tecnico ${project.technician_name}`;
  document.querySelector('#detail-description').textContent = project.project_description || '';
  document.querySelector('#detail-po').textContent = project.purchase_order_display;
  document.querySelector('#detail-invoiced').textContent = formatCapturedAndMxn(
    project.total_invoiced,
    project.total_invoiced_currency,
    project.total_invoiced_mxn,
  );
  document.querySelector('#detail-pending').textContent = money.format(project.pending_collection);
  document.querySelector('#detail-progress').textContent = formatPercent(project.progress_percent);

  const drl = document.querySelector('#detail-reports-list');
  if (drl && typeof renderDetailReports === 'function') {
    renderDetailReports(project.id, drl);
  }

  paymentsList.innerHTML = renderEntries(
    project.payments,
    (payment) => `
      <li>
        <div>
          <strong>${formatCapturedAndMxn(payment.amount, payment.currency, payment.amount_mxn)}</strong>
          <small>${escapeHtml(payment.payment_date)} ${escapeHtml(payment.notes || '')}</small>
        </div>
        <button data-action="delete-payment" data-id="${payment.id}" type="button">Eliminar</button>
      </li>
    `,
    'Sin pagos registrados.',
  );

  costsList.innerHTML = renderEntries(
    project.costs,
    (cost) => `
      <li>
        <div>
          <strong>${escapeHtml(cost.category)}: ${formatCapturedAndMxn(cost.amount, cost.currency, cost.amount_mxn)}</strong>
          <small>${escapeHtml(cost.cost_date)} - ${escapeHtml(cost.description)}</small>
          <small>Porcentaje vs facturado: ${formatPercentDecimal(cost.invoice_cost_percentage)}</small>
        </div>
        <button data-action="delete-cost" data-id="${cost.id}" type="button">Eliminar</button>
      </li>
    `,
    'Sin compras, gastos o salarios registrados.',
  );
}

function renderEntries(entries, renderer, emptyMessage) {
  if (!entries.length) {
    return `<li class="muted">${emptyMessage}</li>`;
  }

  return entries.map(renderer).join('');
}

function togglePurchaseOrder() {
  const disabled = purchaseOrderNotApplicable.checked;
  purchaseOrderInput.disabled = disabled;
  purchaseOrderInput.required = !disabled;
  if (disabled) {
    purchaseOrderInput.value = '';
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(loginMessage, '');

  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify(simpleFormPayload(loginForm)),
    });
    state.userRole = result.role || 'user';
    try {
      const sessionData = await api('/api/session');
      userPermissions = sessionData.permissions || {};
      if (sessionData.theme) applyTheme(sessionData.theme);
    } catch { userPermissions = {}; }
    showVacationsTab();
    showAttendanceTab();
    showEcovisTab();
    loginForm.reset();
    await showApp();
  } catch (error) {
    setMessage(loginMessage, error.message);
  }
});

logoutButton.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  clearSelection();
  clearClosedSelection();
  resetUserForm();
  state.adminVerified = false;
  showLogin();
});

projectsTab.addEventListener('click', () => switchView('projects'));
closedProjectsTab.addEventListener('click', async () => {
  switchView('closed-projects');
  await loadClosedProjects();
});

const serviceQuoterTabBtn = document.getElementById('service-quoter-tab');
if (serviceQuoterTabBtn) serviceQuoterTabBtn.addEventListener('click', () => switchView('service-quoter'));

usersTab.addEventListener('click', async () => {
  try {
    if (!state.adminVerified) {
      const authorized = await requestAdminAuthorization(
        'Ingresa la contrasena del admin para acceder a Usuarios:',
      );
      if (!authorized) {
        return;
      }
    }

    switchView('users');
    await loadUsers();
  } catch (error) {
    window.alert(error.message);
  }
});



exchangeRateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(exchangeMessage, '');

  try {
    const exchangeRateState = await api('/api/exchange-rates', {
      method: 'PUT',
      body: JSON.stringify(exchangeRatePayload()),
    });
    state.exchangeRates = exchangeRateState.rates.reduce((rates, row) => {
      rates[row.currency] = Number(row.rate_to_mxn);
      return rates;
    }, {});
    state.exchangeUpdatedAt = exchangeRateState.last_updated_at;
    renderExchangeRates();
    await loadProjects();
    setMessage(exchangeMessage, 'Tipo de cambio actualizado.', true);
  } catch (error) {
    setMessage(exchangeMessage, error.message);
  }
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(projectMessage, '');

  try {
    const id = projectForm.elements.id.value;
    const savedProject = await api(id ? `/api/projects/${id}` : '/api/projects', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(projectPayload()),
    });

    setMessage(projectMessage, 'Proyecto guardado correctamente.', true);
    await loadProjects();
    selectProject(savedProject.id);
  } catch (error) {
    setMessage(projectMessage, error.message);
  }
});

newProjectButton.addEventListener('click', clearSelection);
purchaseOrderNotApplicable.addEventListener('change', togglePurchaseOrder);
newUserButton.addEventListener('click', resetUserForm);

projectsTable.addEventListener('click', (event) => {
  const selectButton = event.target.closest('button[data-action="select"]');
  if (selectButton) {
    selectProject(selectButton.dataset.id, selectButton);
    return;
  }

  const row = event.target.closest('tr');
  if (row && !event.target.closest('button') && !row.querySelector('.muted')) {
    const idCell = row.querySelector('td.col-number') || row.cells[0];
    const projectId = idCell?.textContent?.trim();
    if (projectId) {
      const openButton = row.querySelector('button[data-action="select"]');
      selectProject(projectId, openButton || row);
      return;
    }
  }

  const deleteButton = event.target.closest('button[data-action="delete-project"]');
  if (deleteButton) {
    deleteProject(deleteButton.dataset.id);
  }
});

closedProjectsTable.addEventListener('click', (event) => {
  const selectButton = event.target.closest('button[data-action="select-closed-project"]');
  if (selectButton) {
    selectClosedProject(selectButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest('button[data-action="delete-closed-project"]');
  if (deleteButton) {
    deleteClosedProject(deleteButton.dataset.id);
  }
});

usersTable.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="select-user"]');
  if (button) {
    selectUser(button.dataset.id);
  }
});

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(userMessage, '');

  try {
    const id = userForm.elements.id.value;
    const savedUser = await api(id ? `/api/users/${id}` : '/api/users', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(userPayload()),
    });

    setMessage(userMessage, 'Usuario guardado correctamente.', true);
    await loadUsers();
    selectUser(savedUser.id);
  } catch (error) {
    setMessage(userMessage, error.message);
  }
});

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedProjectId) {
    return;
  }

  await api(`/api/projects/${state.selectedProjectId}/payments`, {
    method: 'POST',
    body: JSON.stringify(simpleFormPayload(paymentForm)),
  });
  paymentForm.reset();
  setDefaultDates();
  await loadProjects();
});

costForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedProjectId) {
    return;
  }

  await api(`/api/projects/${state.selectedProjectId}/costs`, {
    method: 'POST',
    body: JSON.stringify(simpleFormPayload(costForm)),
  });
  costForm.reset();
  setDefaultDates();
  await loadProjects();
});

if (detailPanelClose) {
  detailPanelClose.addEventListener('click', closeProjectDrawer);
}

if (projectDetailBackdrop && detailPanel) {
  let projectDrawerBackdropDown = false;
  projectDetailBackdrop.addEventListener('mousedown', () => {
    projectDrawerBackdropDown = true;
  });
  projectDetailBackdrop.addEventListener('click', () => {
    if (projectDrawerBackdropDown) {
      closeProjectDrawer();
    }
    projectDrawerBackdropDown = false;
  });
  detailPanel.addEventListener('mousedown', () => {
    projectDrawerBackdropDown = false;
  });
}

paymentsList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="delete-payment"]');
  if (!button || !state.selectedProjectId) {
    return;
  }

  const password = await promptAdminPassword('Ingresa la contraseña del admin para eliminar el pago:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/projects/${state.selectedProjectId}/payments/${button.dataset.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    await loadProjects();
  } catch (error) {
    window.alert(error.message);
  }
});

costsList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="delete-cost"]');
  if (!button || !state.selectedProjectId) {
    return;
  }

  const password = await promptAdminPassword('Ingresa la contraseña del admin para eliminar el costo:');
  if (!password) {
    return;
  }

  try {
    await api(`/api/projects/${state.selectedProjectId}/costs/${button.dataset.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    await loadProjects();
  } catch (error) {
    window.alert(error.message);
  }
});

// ===================== SEARCH INPUTS =====================

if (projectsSearchInput) {
  projectsSearchInput.addEventListener('input', debounce(() => {
    state.projectsSearch = projectsSearchInput.value;
    state.projectsPag.page = 1;
    loadProjects();
  }));
}

if (closedProjectsSearchInput) {
  closedProjectsSearchInput.addEventListener('input', debounce(() => {
    state.closedSearch = closedProjectsSearchInput.value;
    state.closedPag.page = 1;
    loadClosedProjects();
  }));
}

if (employeesSearchInput) {
  employeesSearchInput.addEventListener('input', debounce(() => {
    state.employeesSearch = employeesSearchInput.value;
    state.employeesPag.page = 1;
    loadEmployees();
  }));
}

if (employeesActiveFilterSelect) {
  employeesActiveFilterSelect.addEventListener('change', () => {
    state.employeesActiveFilter = employeesActiveFilterSelect.value;
    state.employeesPag.page = 1;
    loadEmployees();
  });
}

// ===================== VACATION MODULE =====================

const vacationsTab = document.querySelector('#vacations-tab');
const vacationsView = document.querySelector('#vacations-view');
const employeesTable = document.querySelector('#employees-table');
const employeeModal = document.querySelector('#employee-modal');
const employeeForm = document.querySelector('#employee-form');
const employeeFormTitle = document.querySelector('#employee-form-title');
const employeeMessage = document.querySelector('#employee-message');
const newEmployeeButton = document.querySelector('#new-employee-button');
const vacationModal = document.querySelector('#vacation-modal');
const vacationModalTitle = document.querySelector('#vacation-modal-title');
const vacationModalSubtitle = document.querySelector('#vacation-modal-subtitle');
const vacationEmployeeSummary = document.querySelector('#vacation-employee-summary');
const vacationRequestsTable = document.querySelector('#vacation-requests-table');
const vacationRequestForm = document.querySelector('#vacation-request-form');
const vacationRequestMessage = document.querySelector('#vacation-request-message');
const saveAndPrintVacation = document.querySelector('#save-and-print-vacation');

function showVacationsTab() {
  if (canAccess('vacations', 'view')) {
    vacationsTab.classList.remove('hidden');
  } else {
    vacationsTab.classList.add('hidden');
  }
}

async function loadEmployees() {
  const params = new URLSearchParams({
    page: state.employeesPag.page,
    limit: state.employeesPag.limit,
    search: state.employeesSearch,
    activeFilter: state.employeesActiveFilter,
    ...buildTableParams('employees'),
  });
  const result = await api(`/api/employees?${params}`);
  state.employees = result.data;
  state.employeesPagination = result.pagination;
  renderEmployees();
}

function renderEmployees() {
  renderDataTable({
    tableBody: employeesTable,
    tableKey: 'employees',
    columns: employeeColumns,
    data: state.employees,
    pagination: state.employeesPagination || defaultPagination,
    paginationContainerId: 'employees-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.employeesSearch || state.employeesActiveFilter !== 'all'),
    onRefresh: loadEmployees,
    pageState: state.employeesPag,
    rowClass: (emp) => (!emp.active ? 'row-inactive' : ''),
    renderActions: (emp) => `
      <div class="row-actions">
        <button class="secondary" data-action="edit-employee" data-id="${emp.id}" type="button">Editar</button>
        <button class="secondary" data-action="open-vacations" data-id="${emp.id}" type="button">Vacaciones programadas</button>
      </div>`,
  });
}

function openEmployeeModal(employee) {
  employeeModal.classList.remove('hidden');
  setMessage(employeeMessage, '');
  if (employee) {
    employeeFormTitle.textContent = `Editar empleado #${employee.id}`;
    employeeForm.elements.id.value = employee.id;
    employeeForm.elements.employee_number.value = employee.employee_number;
    employeeForm.elements.full_name.value = employee.full_name;
    employeeForm.elements.hire_date.value = employee.hire_date;
    employeeForm.elements.department.value = employee.department || '';
    if (employeeForm.elements.primary_department) {
      employeeForm.elements.primary_department.value = employee.primary_department || employee.department || '';
    }
    if (employeeForm.elements.secondary_department) {
      employeeForm.elements.secondary_department.value = employee.secondary_department || '';
    }
    if (employeeForm.elements.kpi_eligible) {
      employeeForm.elements.kpi_eligible.checked = employee.kpi_eligible !== false;
    }
    employeeForm.elements.position.value = employee.position || '';
    employeeForm.elements.immediate_boss.value = employee.immediate_boss || '';
    employeeForm.elements.active.checked = Boolean(employee.active);
    employeeForm.elements.termination_date.value = employee.termination_date || '';
    employeeForm.elements.inactive_reason.value = employee.inactive_reason || '';
  } else {
    employeeFormTitle.textContent = 'Agregar empleado';
    employeeForm.reset();
    employeeForm.elements.id.value = '';
    employeeForm.elements.active.checked = true;
  }
  toggleTerminationFields();
}

function toggleTerminationFields() {
  const terminationFields = document.getElementById('termination-fields');
  const isActive = employeeForm.elements.active.checked;
  terminationFields.classList.toggle('hidden', isActive);
  if (isActive) {
    employeeForm.elements.termination_date.value = '';
    employeeForm.elements.inactive_reason.value = '';
  }
}

function closeEmployeeModal() {
  employeeModal.classList.add('hidden');
  employeeForm.reset();
}

async function openVacationModal(employeeId) {
  const emp = state.employees.find((e) => e.id === Number(employeeId));
  if (!emp) return;

  state.selectedEmployeeId = emp.id;
  resetTableControls('vacationRequests');
  vacationModal.classList.remove('hidden');
  vacationModalTitle.textContent = `Vacaciones - ${emp.full_name}`;
  vacationModalSubtitle.textContent = `No. ${emp.employee_number} | Ingreso: ${emp.hire_date}`;

  const pendingClass = emp.days_pending < 0 ? 'summary-negative' : '';
  const negativeNote = emp.days_pending < 0
    ? '<p class="text-negative" style="grid-column:1/-1;margin:0;">Saldo negativo por vacaciones anticipadas. Se descontara del siguiente ejercicio vacacional.</p>'
    : '';
  const inactiveNote = !emp.active
    ? `<p class="text-negative" style="grid-column:1/-1;margin:0;">Empleado inactivo. Calculo realizado hasta la fecha de baja (${escapeHtml(emp.termination_date || '')}).</p>`
    : '';

  vacationEmployeeSummary.innerHTML = `
    <article><span>Antiguedad</span><strong>${emp.seniority_years} año${emp.seniority_years !== 1 ? 's' : ''}</strong></article>
    <article><span>Dias generados acumulados</span><strong>${emp.accrued_days}</strong></article>
    <article><span>Dias tomados</span><strong>${emp.days_taken}</strong></article>
    <article><span>Dias programados</span><strong>${emp.days_scheduled}</strong></article>
    <article class="${pendingClass}"><span>Dias disponibles</span><strong>${emp.days_pending}</strong></article>
    ${negativeNote}
    ${inactiveNote}
  `;

  setMessage(vacationRequestMessage, '');
  vacationRequestForm.reset();
  state.vacReqPag = { page: 1, limit: 15 };
  await loadVacationRequests(emp.id);
}

async function loadVacationRequests(employeeId) {
  const params = new URLSearchParams({
    page: state.vacReqPag.page,
    limit: state.vacReqPag.limit,
    ...buildTableParams('vacationRequests'),
  });
  const result = await api(`/api/employees/${employeeId}/vacation-requests?${params}`);
  const requests = result.data;
  state.vacReqPagination = result.pagination;

  renderDataTable({
    tableBody: vacationRequestsTable,
    tableKey: 'vacationRequests',
    columns: vacationRequestColumns,
    data: requests,
    pagination: state.vacReqPagination || defaultPagination,
    paginationContainerId: 'vacation-requests-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: () => loadVacationRequests(employeeId),
    pageState: state.vacReqPag,
    renderActions: (req) => `
      <div class="row-actions">
        ${req.status !== 'cancelada' ? `<button class="danger" data-action="cancel-vacation" data-id="${req.id}" type="button">Cancelar</button>` : ''}
        ${req.status === 'programada' ? `<button class="secondary" data-action="mark-taken" data-id="${req.id}" type="button">Marcar tomada</button>` : ''}
        <button class="secondary" data-action="print-vacation" data-id="${req.id}" type="button">Formato</button>
      </div>`,
  });
}

function closeVacationModal() {
  vacationModal.classList.add('hidden');
  state.selectedEmployeeId = null;
}

function calculateDisplayDays() {
  const startDate = vacationRequestForm.elements.start_date.value;
  const endDate = vacationRequestForm.elements.end_date.value;
  if (startDate && endDate && endDate >= startDate) {
    let count = 0;
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    vacationRequestForm.elements.requested_days_display.value = count;
  } else {
    vacationRequestForm.elements.requested_days_display.value = '';
  }
}

async function submitVacationRequest(andPrint) {
  if (!state.selectedEmployeeId) return;
  setMessage(vacationRequestMessage, '');

  const startDate = vacationRequestForm.elements.start_date.value;
  const endDate = vacationRequestForm.elements.end_date.value;
  const status = vacationRequestForm.elements.status.value;
  const includeBonus = vacationRequestForm.elements.include_vacation_bonus.checked;
  const notes = vacationRequestForm.elements.notes.value;

  if (!startDate || !endDate) {
    setMessage(vacationRequestMessage, 'Fecha inicial y final son obligatorias.');
    return;
  }

  const payload = {
    start_date: startDate,
    end_date: endDate,
    status,
    include_vacation_bonus: includeBonus,
    notes: notes || undefined,
  };

  try {
    const response = await fetch(`/api/employees/${state.selectedEmployeeId}/vacation-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.status === 409 && data.requires_confirmation) {
      const reason = window.prompt(
        `${data.message}\n\nDias disponibles: ${data.available_days}\nDias solicitados: ${data.requested_days}\nSaldo posterior: ${data.balance_after}\n\nIngresa el motivo de autorizacion para continuar:`,
        'Vacaciones anticipadas autorizadas por direccion.',
      );
      if (!reason) {
        setMessage(vacationRequestMessage, 'Solicitud cancelada por el usuario.');
        return;
      }

      payload.confirm_negative_balance = true;
      payload.admin_override_reason = reason;

      const confirmResult = await api(`/api/employees/${state.selectedEmployeeId}/vacation-requests`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(vacationRequestMessage, 'Solicitud con saldo negativo guardada correctamente.', true);
      vacationRequestForm.reset();
      await loadEmployees();
      await openVacationModal(state.selectedEmployeeId);
      if (andPrint) {
        window.open(`/vacation-print.html?id=${confirmResult.id}`, '_blank');
      }
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || 'La operacion no pudo completarse.');
    }

    setMessage(vacationRequestMessage, 'Solicitud guardada correctamente.', true);
    vacationRequestForm.reset();
    await loadEmployees();
    await openVacationModal(state.selectedEmployeeId);

    if (andPrint) {
      window.open(`/vacation-print.html?id=${data.id}`, '_blank');
    }
  } catch (error) {
    setMessage(vacationRequestMessage, error.message);
  }
}

newEmployeeButton.addEventListener('click', () => openEmployeeModal(null));
employeeForm.elements.active.addEventListener('change', toggleTerminationFields);

employeeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(employeeMessage, '');

  const isActive = employeeForm.elements.active.checked;
  if (!isActive && !employeeForm.elements.termination_date.value) {
    setMessage(employeeMessage, 'La fecha de baja es obligatoria para empleados inactivos.');
    return;
  }

  const id = employeeForm.elements.id.value;
  const payload = {
    employee_number: employeeForm.elements.employee_number.value,
    full_name: employeeForm.elements.full_name.value,
    hire_date: employeeForm.elements.hire_date.value,
    department: employeeForm.elements.department.value || undefined,
    position: employeeForm.elements.position.value || undefined,
    immediate_boss: employeeForm.elements.immediate_boss.value || undefined,
    active: isActive,
    termination_date: !isActive ? employeeForm.elements.termination_date.value : undefined,
    inactive_reason: !isActive ? (employeeForm.elements.inactive_reason.value || undefined) : undefined,
  };

  try {
    await api(id ? `/api/employees/${id}` : '/api/employees', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(employeeMessage, 'Empleado guardado correctamente.', true);
    await loadEmployees();
    setTimeout(closeEmployeeModal, 800);
  } catch (error) {
    setMessage(employeeMessage, error.message);
  }
});

employeeModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === employeeModal) {
    closeEmployeeModal();
  }
});

vacationModal.addEventListener('click', (event) => {
  if (event.target.closest('.modal-close') || event.target === vacationModal) {
    closeVacationModal();
  }
});

vacationRequestForm.elements.start_date.addEventListener('change', calculateDisplayDays);
vacationRequestForm.elements.end_date.addEventListener('change', calculateDisplayDays);

vacationRequestForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitVacationRequest(false);
});

saveAndPrintVacation.addEventListener('click', () => {
  submitVacationRequest(true);
});

employeesTable.addEventListener('click', (event) => {
  const editBtn = event.target.closest('[data-action="edit-employee"]');
  if (editBtn) {
    const emp = state.employees.find((e) => e.id === Number(editBtn.dataset.id));
    if (emp) openEmployeeModal(emp);
    return;
  }

  const vacBtn = event.target.closest('[data-action="open-vacations"]');
  if (vacBtn) {
    openVacationModal(vacBtn.dataset.id);
    return;
  }

  const printBtn = event.target.closest('[data-action="print-format"]');
  if (printBtn) {
    openVacationModal(printBtn.dataset.id);
  }
});

vacationRequestsTable.addEventListener('click', async (event) => {
  const cancelBtn = event.target.closest('[data-action="cancel-vacation"]');
  if (cancelBtn) {
    if (!window.confirm('¿Cancelar esta solicitud de vacaciones?')) return;
    try {
      await api(`/api/vacation-requests/${cancelBtn.dataset.id}/cancel`, { method: 'PATCH' });
      await loadEmployees();
      await openVacationModal(state.selectedEmployeeId);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const takenBtn = event.target.closest('[data-action="mark-taken"]');
  if (takenBtn) {
    try {
      const reqData = await api(`/api/vacation-requests/${takenBtn.dataset.id}`);
      await api(`/api/vacation-requests/${takenBtn.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          start_date: reqData.start_date,
          end_date: reqData.end_date,
          status: 'tomada',
          include_vacation_bonus: Boolean(reqData.include_vacation_bonus),
          notes: reqData.notes || '',
        }),
      });
      await loadEmployees();
      await openVacationModal(state.selectedEmployeeId);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const printVacBtn = event.target.closest('[data-action="print-vacation"]');
  if (printVacBtn) {
    window.open(`/vacation-print.html?id=${printVacBtn.dataset.id}`, '_blank');
  }
});

vacationsTab.addEventListener('click', async () => {
  if (!canAccess('vacations', 'view')) {
    window.alert('Acceso restringido. No tienes permisos para consultar o modificar este apartado.');
    return;
  }
  switchView('vacations');
  await loadEmployees();
});

// ===================== END VACATION MODULE =====================

// ===================== REPORTS MODULE =====================

const reportsTab = document.querySelector('#reports-tab');
const reportsView = document.querySelector('#reports-view');
const reportsProjectsTable = document.querySelector('#reports-projects-table');
const reportFormPanel = document.querySelector('#report-form-panel');
const reportForm = document.querySelector('#report-form');
const reportFormTitle = document.querySelector('#report-form-title');
const reportFormSubtitle = document.querySelector('#report-form-subtitle');
const reportMessage = document.querySelector('#report-message');
const reportBackButton = document.querySelector('#report-back-button');
const reportListPanel = document.querySelector('#report-list-panel');
const reportListTitle = document.querySelector('#report-list-title');
const reportListSubtitle = document.querySelector('#report-list-subtitle');
const reportListTable = document.querySelector('#report-list-table');
const reportListNew = document.querySelector('#report-list-new');
const reportListBack = document.querySelector('#report-list-back');
const reportSearch = document.querySelector('#report-search');
const reportStatusFilter = document.querySelector('#report-status-filter');
const detailReportsList = document.querySelector('#detail-reports-list');
const detailNewReport = document.querySelector('#detail-new-report');
const closedDetailReportsList = document.querySelector('#closed-detail-reports-list');
const closedDetailNewReport = document.querySelector('#closed-detail-new-report');
const safetyOtrasCheckbox = document.querySelector('[name="safety_otras"]');
const safetyOtrasField = document.querySelector('#safety-otras-field');

if (safetyOtrasCheckbox) {
  safetyOtrasCheckbox.addEventListener('change', () => {
    safetyOtrasField.classList.toggle('hidden', !safetyOtrasCheckbox.checked);
  });
}

async function loadReportsProjects() {
  const params = new URLSearchParams({
    page: state.reportsProjPag.page,
    limit: state.reportsProjPag.limit,
    search: state.reportsProjSearch,
    status: state.reportsProjStatus,
    ...buildTableParams('reportsProjects'),
  });
  const result = await api(`/api/reports/projects?${params}`);
  state.reportsAllProjects = result.data;
  state.reportsProjPagination = result.pagination;
  renderReportsProjectsTable();
}

function renderReportsProjectsTable() {
  const projects = state.reportsAllProjects;

  renderDataTable({
    tableBody: reportsProjectsTable,
    tableKey: 'reportsProjects',
    columns: reportsProjectColumns,
    data: projects,
    pagination: state.reportsProjPagination || defaultPagination,
    paginationContainerId: 'reports-projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.reportsProjSearch || state.reportsProjStatus),
    onRefresh: loadReportsProjects,
    pageState: state.reportsProjPag,
    renderActions: (p) => `
      <div class="row-actions">
        <button class="secondary" data-action="report-new" data-id="${p.id}" type="button">Generar reporte</button>
        <button class="secondary" data-action="report-list" data-id="${p.id}" type="button">Ver reportes</button>
        ${canAccess('reports', 'edit')
    ? `<button class="secondary" data-action="project-report-archive" data-id="${p.id}" type="button">Archivar</button>`
    : ''}
      </div>`,
  });
}

function showReportsMainList() {
  reportFormPanel.classList.add('hidden');
  reportListPanel.classList.add('hidden');
  if (reportsFailurePanel) reportsFailurePanel.classList.add('hidden');
  reportsProjectsTable.closest('.panel').classList.remove('hidden');
  loadReportsProjects();
}

function openReportForm(projectId, reportData) {
  const project = state.reportsAllProjects.find((p) => p.id === Number(projectId));
  if (!project && !reportData) return;

  state.currentReportProjectId = Number(projectId);
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportListPanel.classList.add('hidden');
  reportFormPanel.classList.remove('hidden');

  reportForm.reset();
  setMessage(reportMessage, '');

  if (reportData) {
    state.currentReportType = reportData.report_type || 'boiler_startup';
    reportFormTitle.textContent = 'Editar reporte';
    reportFormSubtitle.textContent = `Folio: ${reportData.report_folio}`;
    reportForm.elements.id.value = reportData.id;
    reportForm.elements.project_id.value = reportData.project_id;
    reportForm.elements.report_folio.value = reportData.report_folio || '';
    reportForm.elements.report_date.value = reportData.report_date || '';
    reportForm.elements.client_name.value = reportData.client_name || '';
    reportForm.elements.client_address.value = reportData.client_address || '';
    reportForm.elements.service_name.value = reportData.service_name || '';
    reportForm.elements.assigned_technicians.value = reportData.assigned_technicians || '';
    reportForm.elements.burner_model.value = reportData.burner_model || '';
    reportForm.elements.equipment_model_serial.value = reportData.equipment_model_serial || '';
    reportForm.elements.pumps_motors_model.value = reportData.pumps_motors_model || '';
    reportForm.elements.fuel.value = reportData.fuel || '';
    reportForm.elements.voltage.value = reportData.voltage || '';
    reportForm.elements.gas_pressure_inh2o.value = reportData.gas_pressure_inh2o || '';
    reportForm.elements.liquid_fuel_pressure_psi.value = reportData.liquid_fuel_pressure_psi || '';
    reportForm.elements.working_pressure.value = reportData.working_pressure || '';
    reportForm.elements.pump_amperage.value = reportData.pump_amperage || '';
    reportForm.elements.fan_amperage.value = reportData.fan_amperage || '';
    reportForm.elements.condensate_tank_temp_c.value = reportData.condensate_tank_temp_c || '';
    reportForm.elements.operating_output_temp_c.value = reportData.operating_output_temp_c || '';
    reportForm.elements.flue_gas_temp_c.value = reportData.flue_gas_temp_c || '';
    reportForm.elements.comments.value = reportData.comments || '';
    reportForm.elements.technician_name.value = reportData.technician_name || '';
    reportForm.elements.plant_manager_name.value = reportData.plant_manager_name || '';
    populateReportExecutedBySelect(reportData.executed_by_employee_id);

    const safety = reportData.safety_tests ? JSON.parse(reportData.safety_tests) : {};
    reportForm.elements.safety_alarmas.checked = Boolean(safety.alarmas);
    reportForm.elements.safety_alta_presion.checked = Boolean(safety.alta_presion);
    reportForm.elements.safety_paro_arranque.checked = Boolean(safety.paro_arranque);
    reportForm.elements.safety_paro_emergencia.checked = Boolean(safety.paro_emergencia);
    reportForm.elements.safety_switch_aire.checked = Boolean(safety.switch_aire);
    reportForm.elements.safety_cambio_fuego.checked = Boolean(safety.cambio_fuego);
    reportForm.elements.safety_baja_presion.checked = Boolean(safety.baja_presion);
    reportForm.elements.safety_switch_gas.checked = Boolean(safety.switch_gas);
    reportForm.elements.safety_otras.checked = Boolean(safety.otras);
    if (safety.otras) {
      safetyOtrasField.classList.remove('hidden');
      reportForm.elements.safety_otras_text.value = safety.otras_text || '';
    }

    const emLow = reportData.emissions_low_fire ? JSON.parse(reportData.emissions_low_fire) : {};
    const emHigh = reportData.emissions_high_fire ? JSON.parse(reportData.emissions_high_fire) : {};
    const emKeys = ['o2', 'co2', 'co', 'tgas', 'taire', 'perdidas', 'eficiencia', 'lambda'];
    emKeys.forEach((k) => {
      if (reportForm.elements['em_' + k + '_low']) reportForm.elements['em_' + k + '_low'].value = emLow[k] || '';
      if (reportForm.elements['em_' + k + '_high']) reportForm.elements['em_' + k + '_high'].value = emHigh[k] || '';
    });
  } else {
    reportFormTitle.textContent = 'FORMATO DE ARRANQUE DE CALDERA';
    reportFormSubtitle.textContent = `Proyecto #${project.id} - ${project.client_name}`;
    reportForm.elements.id.value = '';
    reportForm.elements.project_id.value = project.id;
    reportForm.elements.report_date.value = today();
    reportForm.elements.client_name.value = project.client_name || '';
    reportForm.elements.service_name.value = project.project_description || '';
    reportForm.elements.assigned_technicians.value = project.technician_name || '';
    populateReportExecutedBySelect(project.tecnico_id || null);
    state.currentReportType = 'boiler_startup';
  }
}

function collectReportPayload() {
  const safetyTests = {
    alarmas: reportForm.elements.safety_alarmas.checked,
    alta_presion: reportForm.elements.safety_alta_presion.checked,
    paro_arranque: reportForm.elements.safety_paro_arranque.checked,
    paro_emergencia: reportForm.elements.safety_paro_emergencia.checked,
    switch_aire: reportForm.elements.safety_switch_aire.checked,
    cambio_fuego: reportForm.elements.safety_cambio_fuego.checked,
    baja_presion: reportForm.elements.safety_baja_presion.checked,
    switch_gas: reportForm.elements.safety_switch_gas.checked,
    otras: reportForm.elements.safety_otras.checked,
    otras_text: reportForm.elements.safety_otras_text ? reportForm.elements.safety_otras_text.value : '',
  };

  const emKeys = ['o2', 'co2', 'co', 'tgas', 'taire', 'perdidas', 'eficiencia', 'lambda'];
  const emLow = {};
  const emHigh = {};
  emKeys.forEach((k) => {
    emLow[k] = (reportForm.elements['em_' + k + '_low'] || {}).value || '';
    emHigh[k] = (reportForm.elements['em_' + k + '_high'] || {}).value || '';
  });

  return {
    project_id: Number(reportForm.elements.project_id.value),
    report_folio: reportForm.elements.report_folio.value || '',
    report_date: reportForm.elements.report_date.value,
    client_name: reportForm.elements.client_name.value,
    client_address: reportForm.elements.client_address.value,
    service_name: reportForm.elements.service_name.value,
    assigned_technicians: reportForm.elements.assigned_technicians.value,
    burner_model: reportForm.elements.burner_model.value,
    equipment_model_serial: reportForm.elements.equipment_model_serial.value,
    pumps_motors_model: reportForm.elements.pumps_motors_model.value,
    fuel: reportForm.elements.fuel.value,
    voltage: reportForm.elements.voltage.value,
    gas_pressure_inh2o: reportForm.elements.gas_pressure_inh2o.value,
    liquid_fuel_pressure_psi: reportForm.elements.liquid_fuel_pressure_psi.value,
    working_pressure: reportForm.elements.working_pressure.value,
    pump_amperage: reportForm.elements.pump_amperage.value,
    fan_amperage: reportForm.elements.fan_amperage.value,
    condensate_tank_temp_c: reportForm.elements.condensate_tank_temp_c.value,
    operating_output_temp_c: reportForm.elements.operating_output_temp_c.value,
    flue_gas_temp_c: reportForm.elements.flue_gas_temp_c.value,
    safety_tests: safetyTests,
    comments: reportForm.elements.comments.value,
    emissions_low_fire: emLow,
    emissions_high_fire: emHigh,
    technician_name: reportForm.elements.technician_name.value,
    plant_manager_name: reportForm.elements.plant_manager_name.value,
    executed_by_employee_id: Number(reportForm.elements.executed_by_employee_id.value),
    report_type: state.currentReportType || 'boiler_startup',
  };
}

async function openReportListForProject(projectId) {
  const project = state.reportsAllProjects.find((p) => p.id === Number(projectId));
  if (!project) return;

  state.currentReportProjectId = Number(projectId);
  state.projReportsPag = { page: 1, limit: 15 };
  resetTableControls('projectReports');
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportFormPanel.classList.add('hidden');
  reportListPanel.classList.remove('hidden');

  reportListTitle.textContent = `Reportes - Proyecto #${project.id}`;
  reportListSubtitle.textContent = `${project.client_name} | ${project.project_description || ''}`;

  await loadProjectReports(projectId);
  loadReportsProjects();
}

async function loadProjectReports(projectId) {
  try {
    const params = new URLSearchParams({
      page: state.projReportsPag.page,
      limit: state.projReportsPag.limit,
      ...buildTableParams('projectReports'),
    });
    const [result, failures] = await Promise.all([
      api(`/api/projects/${projectId}/reports?${params}`),
      api(`/api/projects/${projectId}/failure-reports`),
    ]);
    const failureRows = (failures.data || []).map((fr) => ({
      ...fr,
      _kind: 'failure',
      report_folio: `FALLA-${fr.id}`,
      report_date: String(fr.registered_at || '').slice(0, 10),
      service_name: fr.problem_description,
      report_type: 'failure_report',
      report_type_label: 'Reporte de falla',
      executed_by_name: fr.solution_responsible_name,
    }));
    const merged = [...(result.data || []), ...failureRows];
    state.reportsProjectReports = merged;
    state.projReportsPagination = result.pagination;
    renderReportList(merged, result.pagination, projectId);
  } catch (error) {
    reportListTable.innerHTML = '<tr><td colspan="6" class="muted">Error al cargar reportes.</td></tr>';
  }
}

function renderReportList(reports, pagination, projectId) {
  const pid = projectId || state.currentReportProjectId;
  renderDataTable({
    tableBody: reportListTable,
    tableKey: 'projectReports',
    columns: reportListColumns,
    data: reports,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'project-reports-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: () => loadProjectReports(pid),
    pageState: state.projReportsPag,
    renderActions: (r) => {
      if (r._kind === 'failure') {
        return `
          <div class="row-actions">
            <button class="secondary" data-action="failure-archive" data-id="${r.id}" type="button">Archivar</button>
          </div>`;
      }
      return `
        <div class="row-actions">
          <button class="secondary" data-action="report-edit" data-id="${r.id}" type="button">Editar</button>
          <button class="secondary" data-action="report-print" data-id="${r.id}" data-type="${r.report_type || 'boiler_startup'}" type="button">Imprimir</button>
          <button class="secondary" data-action="report-archive" data-id="${r.id}" type="button">Archivar</button>
        </div>`;
    },
  });
}

async function renderDetailReports(projectId, listElement) {
  try {
    const result = await api('/api/projects/' + projectId + '/reports?limit=50');
    const reports = result.data || [];
    if (!reports.length) {
      listElement.innerHTML = '<li class="muted">Sin reportes generados.</li>';
      return;
    }
    listElement.innerHTML = reports.map((r) => `
      <li>
        <div>
          <strong>${escapeHtml(r.report_folio)}</strong>
          <small>${escapeHtml(r.report_date)} - ${escapeHtml(r.service_name || '')} - ${escapeHtml(r.technician_name || '')}</small>
        </div>
        <div class="row-actions">
          <button class="secondary" data-action="detail-report-edit" data-id="${r.id}" data-project="${projectId}" type="button">Editar</button>
          <button class="secondary" data-action="detail-report-print" data-id="${r.id}" type="button">Imprimir</button>
        </div>
      </li>
    `).join('');
  } catch (_e) {
    listElement.innerHTML = '<li class="muted">Error al cargar reportes.</li>';
  }
}

if (reportsTab) {
  reportsTab.addEventListener('click', async () => {
    switchView('reports');
    showReportsMainList();
    state.reportsProjPag = { page: 1, limit: 15 };
    state.reportsProjSearch = '';
    state.reportsProjStatus = '';
    if (reportSearch) reportSearch.value = '';
    if (reportStatusFilter) reportStatusFilter.value = '';
    await loadReportsAssignableEmployees();
    await loadReportsProjects();
  });
}

if (reportSearch) {
  reportSearch.addEventListener('input', debounce(() => {
    state.reportsProjSearch = reportSearch.value;
    state.reportsProjPag.page = 1;
    loadReportsProjects();
  }));
}
if (reportStatusFilter) {
  reportStatusFilter.addEventListener('change', () => {
    state.reportsProjStatus = reportStatusFilter.value;
    state.reportsProjPag.page = 1;
    loadReportsProjects();
  });
}

if (reportsProjectsTable) {
  reportsProjectsTable.addEventListener('click', async (event) => {
    const newBtn = event.target.closest('[data-action="report-new"]');
    if (newBtn) {
      showReportTypeSelector(newBtn.dataset.id);
      return;
    }
    const listBtn = event.target.closest('[data-action="report-list"]');
    if (listBtn) {
      openReportListForProject(listBtn.dataset.id);
      return;
    }
    const projectArchiveBtn = event.target.closest('[data-action="project-report-archive"]');
    if (projectArchiveBtn) {
      if (!window.confirm('Archivar este registro y todos sus reportes (tecnicos y de falla) en el Archivo de Reportes?')) return;
      try {
        await api(`/api/reports/projects/${projectArchiveBtn.dataset.id}/archive`, { method: 'POST', body: '{}' });
        await loadReportsProjects();
      } catch (error) {
        window.alert(error.message);
      }
    }
  });
}

if (reportBackButton) {
  reportBackButton.addEventListener('click', () => {
    showReportsMainList();
  });
}

if (reportListBack) {
  reportListBack.addEventListener('click', () => {
    showReportsMainList();
  });
}

if (reportListNew) {
  reportListNew.addEventListener('click', () => {
    if (state.currentReportProjectId) {
      showReportTypeSelector(state.currentReportProjectId);
    }
  });
}

if (reportListTable) {
  reportListTable.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-action="report-edit"]');
    if (editBtn) {
      try {
        const reportData = await api('/api/reports/' + editBtn.dataset.id);
        openReportForm(reportData.project_id, reportData);
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }
    const printBtn = event.target.closest('[data-action="report-print"]');
    if (printBtn) {
      openReportPrintView(printBtn.dataset.id, printBtn.dataset.type);
      return;
    }
    const archiveBtn = event.target.closest('[data-action="report-archive"]');
    if (archiveBtn) {
      if (!window.confirm('Archivar este reporte en el Archivo de Reportes?')) return;
      try {
        await api(`/api/reports/${archiveBtn.dataset.id}/archive`, { method: 'POST', body: '{}' });
        await loadProjectReports(state.currentReportProjectId);
        loadReportsProjects();
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }
    const failureArchiveBtn = event.target.closest('[data-action="failure-archive"]');
    if (failureArchiveBtn) {
      if (!window.confirm('Archivar este reporte de falla en el Archivo de Reportes?')) return;
      try {
        await api(`/api/failure-reports/${failureArchiveBtn.dataset.id}/archive`, { method: 'POST', body: '{}' });
        await loadProjectReports(state.currentReportProjectId);
        loadReportsProjects();
      } catch (error) {
        window.alert(error.message);
      }
    }
  });
}

if (reportForm) {
  reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(reportMessage, '');

    try {
      const payload = collectReportPayload();
      const id = reportForm.elements.id.value;
      const result = await api(id ? '/api/reports/' + id : '/api/reports', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(reportMessage, 'Reporte guardado correctamente.', true);
      setTimeout(async () => {
        await loadReportsProjects();
        openReportListForProject(result.project_id);
      }, 800);
    } catch (error) {
      setMessage(reportMessage, error.message);
    }
  });
}

if (detailReportsList) {
  detailReportsList.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-action="detail-report-edit"]');
    if (editBtn) {
      try {
        const reportData = await api('/api/reports/' + editBtn.dataset.id);
        state.reportsAllProjects = state.projects;
        switchView('reports');
        openReportForm(reportData.project_id, reportData);
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }
    const printBtn = event.target.closest('[data-action="detail-report-print"]');
    if (printBtn) {
      openReportPrintView(printBtn.dataset.id, printBtn.dataset.type);
    }
  });
}

if (detailNewReport) {
  detailNewReport.addEventListener('click', async () => {
    if (!state.selectedProjectId) return;
    state.reportsAllProjects = state.projects;
    switchView('reports');
    showReportTypeSelector(state.selectedProjectId);
  });
}

if (closedDetailReportsList) {
  closedDetailReportsList.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-action="detail-report-edit"]');
    if (editBtn) {
      try {
        const reportData = await api('/api/reports/' + editBtn.dataset.id);
        state.reportsAllProjects = state.closedProjects;
        switchView('reports');
        openReportForm(reportData.project_id, reportData);
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }
    const printBtn = event.target.closest('[data-action="detail-report-print"]');
    if (printBtn) {
      openReportPrintView(printBtn.dataset.id, printBtn.dataset.type);
    }
  });
}

if (closedDetailNewReport) {
  closedDetailNewReport.addEventListener('click', async () => {
    if (!state.selectedClosedProjectId) return;
    state.reportsAllProjects = state.closedProjects;
    switchView('reports');
    showReportTypeSelector(state.selectedClosedProjectId);
  });
}

// ===================== END REPORTS MODULE =====================

// ===================== ECOVIS MODULE =====================

const ecovisTab = document.querySelector('#ecovis-tab');
const ecovisView = document.querySelector('#ecovis-view');
const ecovisProjectsTable = document.querySelector('#ecovis-projects-table');
const ecovisPaymentsTable = document.querySelector('#ecovis-payments-table');
const ecovisLoansTable = document.querySelector('#ecovis-loans-table');
const ecovisMovementsTable = document.querySelector('#ecovis-movements-table');
const ecovisProjectModal = document.querySelector('#ecovis-project-modal');
const ecovisProjectForm = document.querySelector('#ecovis-project-form');
const ecovisProjectFormTitle = document.querySelector('#ecovis-project-form-title');
const ecovisProjectMessage = document.querySelector('#ecovis-project-message');
const ecovisProjectAmountLocked = document.querySelector('#ecovis-project-amount-locked');
const ecovisProjectAdjustmentBtn = document.querySelector('#ecovis-project-adjustment-btn');
const ecovisPaymentModal = document.querySelector('#ecovis-payment-modal');
const ecovisPaymentForm = document.querySelector('#ecovis-payment-form');
const ecovisPaymentFormTitle = document.querySelector('#ecovis-payment-form-title');
const ecovisPaymentMessage = document.querySelector('#ecovis-payment-message');
const ecovisAllocationModal = document.querySelector('#ecovis-allocation-modal');
const ecovisAllocationForm = document.querySelector('#ecovis-allocation-form');
const ecovisAllocationMessage = document.querySelector('#ecovis-allocation-message');
const ecovisAllocationSubtitle = document.querySelector('#ecovis-allocation-subtitle');
const ecovisAllocationSummary = document.querySelector('#ecovis-allocation-summary');
const ecovisAllocationsList = document.querySelector('#ecovis-allocations-list');
const ecovisAllocationProjectLabel = document.querySelector('#ecovis-allocation-project-label');
const ecovisAllocationProjectSelect = document.querySelector('#ecovis-allocation-project-select');
const ecovisLoanModal = document.querySelector('#ecovis-loan-modal');
const ecovisLoanForm = document.querySelector('#ecovis-loan-form');
const ecovisLoanFormTitle = document.querySelector('#ecovis-loan-form-title');
const ecovisLoanMessage = document.querySelector('#ecovis-loan-message');
const ecovisAdjustmentModal = document.querySelector('#ecovis-adjustment-modal');
const ecovisAdjustmentForm = document.querySelector('#ecovis-adjustment-form');
const ecovisAdjustmentMessage = document.querySelector('#ecovis-adjustment-message');
const ecovisApplyCreditModal = document.querySelector('#ecovis-apply-credit-modal');
const ecovisApplyCreditForm = document.querySelector('#ecovis-apply-credit-form');
const ecovisApplyCreditMessage = document.querySelector('#ecovis-apply-credit-message');
const ecovisCreditAvailable = document.querySelector('#ecovis-credit-available');
const ecovisCreditProjectSelect = document.querySelector('#ecovis-credit-project-select');
const ecovisProjectsSearchInput = document.querySelector('#ecovis-projects-search');
const ecovisMovementsSearchInput = document.querySelector('#ecovis-movements-search');
const ecovisMovementsTypeFilterSelect = document.querySelector('#ecovis-movements-type-filter');
const ecovisAmountAdjustmentModal = document.querySelector('#ecovis-amount-adjustment-modal');
const ecovisAmountAdjustmentForm = document.querySelector('#ecovis-amount-adjustment-form');
const ecovisAmountAdjustmentMessage = document.querySelector('#ecovis-amount-adjustment-message');

function resetEcovisCurrencyField(input, value = 0) {
  if (!input) return;
  if (value === 0 && input.clearCurrencyValue) {
    input.clearCurrencyValue();
  } else if (input.setCurrencyValue) {
    input.setCurrencyValue(value);
  } else {
    input.value = value === 0 ? '' : String(value);
  }
}

function resetEcovisPaymentForm() {
  if (ecovisPaymentForm.elements.amount && ecovisPaymentForm.elements.amount.clearCurrencyValue) {
    ecovisPaymentForm.elements.amount.clearCurrencyValue();
  }
  ecovisPaymentForm.reset();
  if (ecovisPaymentForm.elements.id) ecovisPaymentForm.elements.id.value = '';
  ecovisPaymentForm.elements.payment_date.value = today();
  if (ecovisPaymentForm.elements.currency) {
    ecovisPaymentForm.elements.currency.value = 'MXN';
    ecovisPaymentForm.elements.currency.disabled = false;
  }
  if (ecovisPaymentForm.elements.amount) {
    ecovisPaymentForm.elements.amount.readOnly = false;
    resetEcovisCurrencyField(ecovisPaymentForm.elements.amount, 0);
  }
  if (ecovisPaymentFormTitle) ecovisPaymentFormTitle.textContent = 'Registrar pago de ECOVIS';
  setMessage(ecovisPaymentMessage, '');
}

function resetEcovisProjectForm() {
  ecovisProjectForm.reset();
  ecovisProjectForm.elements.id.value = '';
  ecovisProjectForm.elements.project_date.value = today();
  if (ecovisProjectForm.elements.currency) ecovisProjectForm.elements.currency.value = 'MXN';
  resetEcovisCurrencyField(ecovisProjectForm.elements.total_amount, 0);
  setEcovisProjectAmountLock(false);
  setMessage(ecovisProjectMessage, '');
  const submitBtn = ecovisProjectForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = false;
}

function resetEcovisAllocationForm() {
  ecovisAllocationForm.reset();
  resetEcovisCurrencyField(ecovisAllocationForm.elements.amount, 0);
  setMessage(ecovisAllocationMessage, '');
}

function closeEcovisModal(modal, resetFn) {
  modal.classList.add('hidden');
  if (resetFn) resetFn();
}

function attachEcovisModalClose(modal, resetFn) {
  modal.addEventListener('mousedown', (event) => {
    if (event.target === modal) {
      modal.dataset.backdropDown = '1';
    }
  });
  modal.addEventListener('click', (event) => {
    if (event.target.closest('.modal-close')) {
      closeEcovisModal(modal, resetFn);
      return;
    }
    if (event.target === modal && modal.dataset.backdropDown === '1') {
      closeEcovisModal(modal, resetFn);
    }
    delete modal.dataset.backdropDown;
  });
  const content = modal.querySelector('.modal-content');
  if (content) {
    content.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      delete modal.dataset.backdropDown;
    });
  }
}

function setEcovisProjectAmountLock(locked) {
  const amtInput = ecovisProjectForm.elements.total_amount;
  const curSelect = ecovisProjectForm.elements.currency;
  if (amtInput) amtInput.readOnly = Boolean(locked);
  if (curSelect) curSelect.disabled = Boolean(locked);
  if (ecovisProjectAmountLocked) ecovisProjectAmountLocked.classList.toggle('hidden', !locked);
  if (ecovisProjectAdjustmentBtn) {
    ecovisProjectAdjustmentBtn.classList.toggle('hidden', !locked || state.userRole !== 'admin');
  }
}

function openEcovisAmountAdjustmentModal(entityType, entityId, currentAmount, currentCurrency) {
  ecovisAmountAdjustmentForm.reset();
  ecovisAmountAdjustmentForm.elements.entity_type.value = entityType;
  ecovisAmountAdjustmentForm.elements.entity_id.value = entityId;
  ecovisAmountAdjustmentForm.elements.new_currency.value = currentCurrency || 'MXN';
  resetEcovisCurrencyField(ecovisAmountAdjustmentForm.elements.new_amount_original, Number(currentAmount || 0));
  setMessage(ecovisAmountAdjustmentMessage, '');
  ecovisAmountAdjustmentModal.classList.remove('hidden');
}

(function setupEcovisCurrencyInputs() {
  if (ecovisProjectForm && ecovisProjectForm.elements.total_amount) {
    initCurrencyInput(ecovisProjectForm.elements.total_amount, function() { return ecovisProjectForm.elements.currency ? ecovisProjectForm.elements.currency.value : 'MXN'; });
    if (ecovisProjectForm.elements.currency) {
      ecovisProjectForm.elements.currency.addEventListener('change', function() {
        resetEcovisCurrencyField(ecovisProjectForm.elements.total_amount, ecovisProjectForm.elements.total_amount.getCurrencyValue());
      });
    }
  }
  if (ecovisPaymentForm && ecovisPaymentForm.elements.amount) {
    initCurrencyInput(ecovisPaymentForm.elements.amount, function() { return ecovisPaymentForm.elements.currency ? ecovisPaymentForm.elements.currency.value : 'MXN'; });
    if (ecovisPaymentForm.elements.currency) {
      ecovisPaymentForm.elements.currency.addEventListener('change', function() {
        resetEcovisCurrencyField(ecovisPaymentForm.elements.amount, ecovisPaymentForm.elements.amount.getCurrencyValue());
      });
    }
  }
  if (ecovisLoanForm && ecovisLoanForm.elements.amount) {
    initCurrencyInput(ecovisLoanForm.elements.amount, function() { return ecovisLoanForm.elements.currency ? ecovisLoanForm.elements.currency.value : 'MXN'; });
  }
  var allocForm = document.querySelector('#ecovis-allocation-form');
  if (allocForm && allocForm.elements.amount) initCurrencyInput(allocForm.elements.amount, function() { return 'MXN'; });
  if (ecovisAmountAdjustmentForm && ecovisAmountAdjustmentForm.elements.new_amount_original) {
    initCurrencyInput(ecovisAmountAdjustmentForm.elements.new_amount_original, function() {
      return ecovisAmountAdjustmentForm.elements.new_currency ? ecovisAmountAdjustmentForm.elements.new_currency.value : 'MXN';
    });
  }
  if (ecovisApplyCreditForm && ecovisApplyCreditForm.elements.amount) {
    initCurrencyInput(ecovisApplyCreditForm.elements.amount, function() { return 'MXN'; });
  }
  if (ecovisAdjustmentForm && ecovisAdjustmentForm.elements.amount) {
    initCurrencyInput(ecovisAdjustmentForm.elements.amount, function() { return 'MXN'; });
  }
})();

const ECOVIS_MOVEMENT_TYPE_LABELS = {
  proyecto: 'Proyecto',
  pago_recibido: 'Pago recibido',
  prestamo_ecovis_a_revram: 'Préstamo',
  aplicacion_a_proyecto: 'Aplicación a proyecto',
  saldo_a_favor: 'Saldo a favor',
  devolucion: 'Devolución',
  ajuste: 'Ajuste',
  cancelacion: 'Cancelación',
};

const ECOVIS_DIRECTION_LABELS = {
  ecovis_debe_a_revram: 'ECOVIS debe a REVRAM',
  revram_debe_a_ecovis: 'REVRAM debe a ECOVIS',
  neutral: 'Neutral',
};

function showEcovisTab() {
  if (canAccess('ecovisAccount', 'view')) {
    ecovisTab.classList.remove('hidden');
  } else {
    ecovisTab.classList.add('hidden');
  }
  const createBtn = document.getElementById('backup-create-btn');
  const importBtn = document.getElementById('backup-import-btn');
  if (createBtn) createBtn.classList.toggle('hidden', !canAccess('backups', 'backup'));
  if (importBtn) importBtn.classList.toggle('hidden', !canAccess('backups', 'import'));
}

function switchEcovisSubtab(name) {
  const sections = ['projects', 'payments', 'loans', 'movements', 'history'];
  sections.forEach((s) => {
    const section = document.getElementById('ecovis-' + s + '-section');
    const btn = document.getElementById('ecovis-subtab-' + s);
    if (section) section.classList.toggle('hidden', s !== name);
    if (btn) btn.classList.toggle('active', s === name);
  });
}

document.getElementById('ecovis-subtab-projects').addEventListener('click', () => {
  switchEcovisSubtab('projects');
  loadEcovisProjects();
});
document.getElementById('ecovis-subtab-payments').addEventListener('click', () => {
  switchEcovisSubtab('payments');
  loadEcovisPayments();
});
document.getElementById('ecovis-subtab-loans').addEventListener('click', () => {
  switchEcovisSubtab('loans');
  loadEcovisLoans();
});
document.getElementById('ecovis-subtab-movements').addEventListener('click', () => {
  switchEcovisSubtab('movements');
  loadEcovisMovements();
});
if (document.getElementById('ecovis-subtab-history')) {
  document.getElementById('ecovis-subtab-history').addEventListener('click', () => {
    switchEcovisSubtab('history');
    loadEcovisHistoryYears();
  });
}

async function loadEcovisSummary() {
  try {
    const summary = await api('/api/ecovis/summary');
    document.getElementById('ecovis-stat-projects').textContent = money.format(summary.active_projects_total_mxn || summary.total_projected || 0);
    document.getElementById('ecovis-stat-paid').textContent = money.format(summary.active_projects_paid_mxn || summary.total_paid_to_projects || 0);
    document.getElementById('ecovis-stat-pending').textContent = money.format(summary.active_projects_pending_mxn || summary.pending_project_amount || 0);
    document.getElementById('ecovis-stat-loans').textContent = money.format(summary.outstanding_loans || 0);
    document.getElementById('ecovis-stat-credit').textContent = money.format(summary.credit_balance || 0);
    const unallocated = (summary.total_payments_received || 0) - (summary.total_allocated || 0);
    document.getElementById('ecovis-stat-unallocated').textContent = money.format(unallocated);
    document.getElementById('ecovis-stat-balance').textContent = money.format(summary.net_balance || 0);
    state.ecovisSummary = summary;
  } catch (error) {
    console.error('Error loading ECOVIS summary:', error);
  }
}

async function loadEcovisProjects() {
  const params = new URLSearchParams({
    page: state.ecovisProjectsPag.page,
    limit: state.ecovisProjectsPag.limit,
    search: state.ecovisProjectsSearch,
    exclude_paid: '1',
    ...buildTableParams('ecovisProjects'),
  });
  const result = await api('/api/ecovis/projects?' + params);
  renderEcovisProjects(result.data, result.pagination);
}

function renderEcovisProjects(projects, pagination) {
  renderDataTable({
    tableBody: ecovisProjectsTable,
    tableKey: 'ecovisProjects',
    columns: ecovisProjectColumns,
    data: projects,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-projects-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.ecovisProjectsSearch),
    onRefresh: loadEcovisProjects,
    pageState: state.ecovisProjectsPag,
    renderActions: (p) => {
      const statusLabel = p.status || 'pendiente';
      return '<div class="row-actions">' +
        '<button class="secondary" data-action="ecovis-edit-project" data-id="' + p.id + '" type="button">Editar</button>' +
        (statusLabel !== 'cancelado'
          ? '<button class="danger" data-action="ecovis-cancel-project" data-id="' + p.id + '" type="button">Cancelar</button>'
          : '') +
        '<button class="secondary" data-action="ecovis-apply-credit" data-id="' + p.id + '" type="button">Saldo a favor</button>' +
      '</div>';
    },
  });
}

async function loadEcovisPayments() {
  const params = new URLSearchParams({
    page: state.ecovisPaymentsPag.page,
    limit: state.ecovisPaymentsPag.limit,
    ...buildTableParams('ecovisPayments'),
  });
  const result = await api('/api/ecovis/payments?' + params);
  renderEcovisPayments(result.data, result.pagination);
}

function renderEcovisPayments(payments, pagination) {
  renderDataTable({
    tableBody: ecovisPaymentsTable,
    tableKey: 'ecovisPayments',
    columns: ecovisPaymentColumns,
    data: payments,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-payments-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: loadEcovisPayments,
    pageState: state.ecovisPaymentsPag,
    renderActions: (p) => {
      const canAllocate = !p.is_cancelled && Number(p.unallocated_amount || 0) > 0.005;
      const canEdit = !p.is_cancelled;
      return '<div class="row-actions">' +
        (canAllocate ? '<button class="secondary" data-action="ecovis-allocate-payment" data-id="' + p.id + '" type="button">Asignar</button>' : '') +
        (canEdit ? '<button class="secondary" data-action="ecovis-edit-payment" data-id="' + p.id + '" type="button">Editar</button>' : '') +
      '</div>';
    },
  });
}

async function loadEcovisLoans() {
  const params = new URLSearchParams({
    page: state.ecovisLoansPag.page,
    limit: state.ecovisLoansPag.limit,
    ...buildTableParams('ecovisLoans'),
  });
  const result = await api('/api/ecovis/loans?' + params);
  renderEcovisLoans(result.data, result.pagination);
}

function renderEcovisLoans(loans, pagination) {
  renderDataTable({
    tableBody: ecovisLoansTable,
    tableKey: 'ecovisLoans',
    columns: ecovisLoanColumns,
    data: loans,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-loans-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    onRefresh: loadEcovisLoans,
    pageState: state.ecovisLoansPag,
    renderActions: (l) => '<div class="row-actions"><button class="secondary" data-action="ecovis-repay-loan" data-id="' + l.id + '" type="button">Devolucion</button></div>',
  });
}

async function loadEcovisMovements() {
  const params = new URLSearchParams({
    page: state.ecovisMovementsPag.page,
    limit: state.ecovisMovementsPag.limit,
    search: state.ecovisMovementsSearch,
    ...buildTableParams('ecovisMovements'),
  });
  if (state.ecovisMovementsTypeFilter) {
    params.set('type', state.ecovisMovementsTypeFilter);
  }
  const result = await api('/api/ecovis/movements?' + params);
  renderEcovisMovements(result.data, result.pagination);
}

function renderEcovisMovements(movements, pagination) {
  renderDataTable({
    tableBody: ecovisMovementsTable,
    tableKey: 'ecovisMovements',
    columns: ecovisMovementColumns,
    data: movements,
    pagination: pagination || defaultPagination,
    paginationContainerId: 'ecovis-movements-pagination',
    emptyMessage: 'No hay registros para mostrar.',
    filteredEmptyMessage: 'No se encontraron registros con la busqueda actual.',
    isFiltered: Boolean(state.ecovisMovementsSearch || state.ecovisMovementsTypeFilter),
    onRefresh: loadEcovisMovements,
    pageState: state.ecovisMovementsPag,
  });
}

// --- ECOVIS History ---

async function loadEcovisHistoryYears() {
  try {
    const years = await api('/api/ecovis/projects/history/years');
    const sel = document.getElementById('ecovis-history-year');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Selecciona un año --</option>';
    (years || []).forEach((y) => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (String(y) === current) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('Error loading history years', e);
  }
}

async function loadEcovisHistory() {
  const yearSel = document.getElementById('ecovis-history-year');
  const monthSel = document.getElementById('ecovis-history-month');
  const container = document.getElementById('ecovis-history-results');
  if (!yearSel || !container) return;

  const year = yearSel.value;
  if (!year) {
    container.innerHTML = '<p class="empty-message">Selecciona un año para consultar el historial.</p>';
    return;
  }

  const params = new URLSearchParams({ year });
  const month = monthSel ? monthSel.value : '';
  if (month) params.set('month', month);

  try {
    const result = await api('/api/ecovis/projects/history?' + params);
    const { data, summary } = result;

    let html = '<div class="ecovis-cards">';
    html += '<div class="ecovis-card"><div class="ecovis-card-label">Total Proyectos MXN</div><div class="ecovis-card-value">' + money.format(summary.total_projects_mxn || 0) + '</div></div>';
    html += '<div class="ecovis-card"><div class="ecovis-card-label">Total Cobrado MXN</div><div class="ecovis-card-value">' + money.format(summary.total_paid_mxn || 0) + '</div></div>';
    html += '<div class="ecovis-card"><div class="ecovis-card-label">Pendiente MXN</div><div class="ecovis-card-value">' + money.format(summary.total_pending_mxn || 0) + '</div></div>';
    html += '<div class="ecovis-card"><div class="ecovis-card-label">Proyectos Pagados</div><div class="ecovis-card-value">' + (summary.project_count || 0) + '</div></div>';
    html += '</div>';

    if (!data || data.length === 0) {
      html += '<p class="empty-message">No se encontraron proyectos pagados para el periodo seleccionado.</p>';
    } else {
      html += '<table class="data-table"><thead><tr>';
      html += '<th>Fecha pagado</th><th>Proyecto</th><th>Cotización</th><th>Monto original</th><th>Equiv. MXN</th><th>Pagado MXN</th><th>Estatus</th>';
      html += '</tr></thead><tbody>';
      data.forEach((p) => {
        const paidAt = p.fully_paid_at ? new Date(p.fully_paid_at).toLocaleDateString('es-MX') : '-';
        html += '<tr>';
        html += '<td>' + escapeHtml(paidAt) + '</td>';
        html += '<td>' + escapeHtml(p.project_name || '') + '</td>';
        html += '<td>' + escapeHtml(p.quote_number || '') + '</td>';
        html += '<td>' + money.format(Number(p.total_amount || 0)) + ' ' + escapeHtml(p.currency || 'MXN') + '</td>';
        html += '<td>' + money.format(Number(p.amount_mxn || p.total_amount || 0)) + '</td>';
        html += '<td>' + money.format(Number(p.paid_amount_mxn || 0)) + '</td>';
        html += '<td><span class="badge ecovis-status-pagado">pagado</span></td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="empty-message">Error al cargar historial.</p>';
    console.error('Error loading history', e);
  }
}

if (document.getElementById('ecovis-history-search-btn')) {
  document.getElementById('ecovis-history-search-btn').addEventListener('click', loadEcovisHistory);
}

ecovisTab.addEventListener('click', async () => {
  if (!canAccess('ecovisAccount', 'view')) {
    window.alert('Acceso restringido. No tienes permisos para consultar o modificar este apartado.');
    return;
  }
  switchView('ecovis');
  switchEcovisSubtab('projects');
  await loadEcovisSummary();
  await loadEcovisProjects();
});

document.getElementById('ecovis-new-project-btn').addEventListener('click', () => {
  ecovisProjectFormTitle.textContent = 'Agregar proyecto ECOVIS';
  resetEcovisProjectForm();
  ecovisProjectModal.classList.remove('hidden');
});

ecovisProjectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisProjectMessage, '');
  const submitBtn = event.submitter || ecovisProjectForm.querySelector('button[type="submit"]');
  const payload = simpleFormPayload(ecovisProjectForm);
  const id = ecovisProjectForm.elements.id.value;
  if (!id) {
    delete payload.id;
  }
  if (submitBtn) submitBtn.disabled = true;
  try {
    await api(id ? '/api/ecovis/projects/' + id : '/api/ecovis/projects', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisProjectMessage, 'Proyecto ECOVIS guardado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisProjects();
    setTimeout(() => { closeEcovisModal(ecovisProjectModal, resetEcovisProjectForm); }, 600);
  } catch (error) {
    setMessage(ecovisProjectMessage, error.message);
    if (submitBtn) submitBtn.disabled = false;
  }
});

attachEcovisModalClose(ecovisProjectModal, resetEcovisProjectForm);

ecovisProjectsTable.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('[data-action="ecovis-edit-project"]');
  if (editBtn) {
    try {
      const projects = (await api('/api/ecovis/projects?limit=9999')).data;
      const project = projects.find((p) => p.id === Number(editBtn.dataset.id));
      if (!project) return;
      ecovisProjectFormTitle.textContent = 'Editar proyecto ECOVIS #' + project.id;
      ecovisProjectForm.elements.id.value = project.id;
      ecovisProjectForm.elements.project_name.value = project.project_name || '';
      ecovisProjectForm.elements.project_date.value = project.project_date || '';
      ecovisProjectForm.elements.quote_number.value = project.quote_number || '';
      ecovisProjectForm.elements.purchase_order_number.value = project.purchase_order_number || '';
      ecovisProjectForm.elements.invoice_number.value = project.invoice_number || '';
      resetEcovisCurrencyField(ecovisProjectForm.elements.total_amount, Number(project.total_amount || 0));
      ecovisProjectForm.elements.currency.value = project.currency || 'MXN';
      setEcovisProjectAmountLock(Boolean(project.critical_amount_locked));
      ecovisProjectForm.elements.description.value = project.description || '';
      ecovisProjectForm.elements.notes.value = project.notes || '';
      setMessage(ecovisProjectMessage, '');
      ecovisProjectModal.classList.remove('hidden');
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const cancelBtn = event.target.closest('[data-action="ecovis-cancel-project"]');
  if (cancelBtn) {
    const reason = window.prompt('Motivo de cancelacion del proyecto ECOVIS:');
    if (!reason) return;
    try {
      await api('/api/ecovis/projects/' + cancelBtn.dataset.id + '/cancel', {
        method: 'POST',
        body: JSON.stringify({ reason: reason }),
      });
      await loadEcovisSummary();
      await loadEcovisProjects();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const creditBtn = event.target.closest('[data-action="ecovis-apply-credit"]');
  if (creditBtn) {
    openApplyCreditModal(creditBtn.dataset.id);
  }
});

if (ecovisProjectAdjustmentBtn) {
  ecovisProjectAdjustmentBtn.addEventListener('click', () => {
    const entityId = ecovisProjectForm.elements.id.value;
    if (!entityId) return;
    openEcovisAmountAdjustmentModal(
      'project',
      entityId,
      ecovisProjectForm.elements.total_amount.getCurrencyValue(),
      ecovisProjectForm.elements.currency.value,
    );
  });
}

document.getElementById('ecovis-new-payment-btn').addEventListener('click', () => {
  resetEcovisPaymentForm();
  ecovisPaymentModal.classList.remove('hidden');
});

ecovisPaymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisPaymentMessage, '');
  const payload = simpleFormPayload(ecovisPaymentForm);
  try {
    const id = ecovisPaymentForm.elements.id.value;
    await api(id ? '/api/ecovis/payments/' + id : '/api/ecovis/payments', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisPaymentMessage, id ? 'Pago actualizado correctamente.' : 'Pago registrado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisPayments();
    resetEcovisPaymentForm();
    setTimeout(() => { closeEcovisModal(ecovisPaymentModal); }, 600);
  } catch (error) {
    setMessage(ecovisPaymentMessage, error.message);
  }
});

attachEcovisModalClose(ecovisPaymentModal, resetEcovisPaymentForm);

ecovisPaymentsTable.addEventListener('click', async (event) => {
  const allocBtn = event.target.closest('[data-action="ecovis-allocate-payment"]');
  if (allocBtn) {
    await openAllocationModal(allocBtn.dataset.id);
    return;
  }
  const editBtn = event.target.closest('[data-action="ecovis-edit-payment"]');
  if (editBtn) {
    try {
      const payment = await api('/api/ecovis/payments/' + editBtn.dataset.id);
      resetEcovisPaymentForm();
      ecovisPaymentForm.elements.id.value = payment.id;
      ecovisPaymentFormTitle.textContent = 'Editar pago ECOVIS #' + payment.id;
      ecovisPaymentForm.elements.payment_date.value = payment.payment_date || today();
      resetEcovisCurrencyField(ecovisPaymentForm.elements.amount, Number(payment.amount || 0));
      ecovisPaymentForm.elements.currency.value = payment.currency || 'MXN';
      ecovisPaymentForm.elements.payment_method.value = payment.payment_method || '';
      ecovisPaymentForm.elements.bank_reference.value = payment.bank_reference || '';
      ecovisPaymentForm.elements.source_description.value = payment.source_description || '';
      ecovisPaymentForm.elements.notes.value = payment.notes || '';
      if (payment.critical_amount_locked) {
        ecovisPaymentForm.elements.amount.readOnly = true;
        ecovisPaymentForm.elements.currency.disabled = true;
      } else {
        ecovisPaymentForm.elements.amount.readOnly = false;
        ecovisPaymentForm.elements.currency.disabled = false;
      }
      ecovisPaymentModal.classList.remove('hidden');
    } catch (error) {
      window.alert(error.message);
    }
  }
});

function dedupeEcovisAssignableProjects(projects) {
  const seen = new Map();
  for (const p of projects || []) {
    if (!p || p.id == null) continue;
    if (!seen.has(p.id)) seen.set(p.id, p);
  }
  return Array.from(seen.values());
}

function renderEcovisAssignableProjectOptions(projects) {
  const unique = dedupeEcovisAssignableProjects(projects);
  if (!unique.length) {
    return '<option value="">No hay proyectos ECOVIS con saldo pendiente para asignar este pago.</option>';
  }
  return unique.map((p) => {
    const label = p.label || (p.project_name + ' — Pendiente ' + money.format(Number(p.pending_amount_mxn || 0)) + ' MXN');
    return '<option value="' + escapeHtml(String(p.id)) + '">' + escapeHtml(label) + '</option>';
  }).join('');
}

async function loadEcovisAssignableProjects() {
  const result = await api('/api/ecovis/projects/assignable');
  return dedupeEcovisAssignableProjects(result.data || result);
}

async function openAllocationModal(paymentId) {
  state.selectedEcovisPaymentId = Number(paymentId);
  resetEcovisAllocationForm();

  try {
    const payment = await api('/api/ecovis/payments/' + paymentId);
    if (!payment || payment.is_cancelled || Number(payment.unallocated_amount || 0) <= 0.005) {
      window.alert('Este pago no tiene saldo disponible para asignar.');
      return;
    }

    ecovisAllocationModal.classList.remove('hidden');

    ecovisAllocationSubtitle.textContent = 'Pago #' + payment.id + ' — ' + money.format(Number(payment.amount || 0)) + ' (' + (payment.currency || 'MXN') + ')';
    ecovisAllocationSummary.innerHTML =
      '<article><span>Monto total</span><strong>' + money.format(Number(payment.amount || 0)) + '</strong></article>' +
      '<article><span>Asignado</span><strong>' + money.format(Number(payment.allocated_amount || 0)) + '</strong></article>' +
      '<article><span>Sin asignar</span><strong>' + money.format(Number(payment.unallocated_amount || 0)) + '</strong></article>';

    const allocations = payment.allocations || [];
    if (!allocations.length) {
      ecovisAllocationsList.innerHTML = '<tr><td colspan="4" class="muted">Sin asignaciones.</td></tr>';
    } else {
      ecovisAllocationsList.innerHTML = allocations.map((a) => {
        return '<tr>' +
          '<td>' + escapeHtml(a.allocation_type || '') + '</td>' +
          '<td>' + (a.ecovis_project_id || '-') + '</td>' +
          '<td>' + money.format(Number(a.amount || 0)) + '</td>' +
          '<td>' + escapeHtml(a.notes || '') + '</td>' +
        '</tr>';
      }).join('');
    }

    const projects = await loadEcovisAssignableProjects();
    ecovisAllocationProjectSelect.innerHTML = renderEcovisAssignableProjectOptions(projects);

    toggleAllocationProjectField();
  } catch (error) {
    window.alert(error.message);
  }
}

function toggleAllocationProjectField() {
  const type = ecovisAllocationForm.elements.allocation_type.value;
  ecovisAllocationProjectLabel.classList.toggle('hidden', type !== 'proyecto');
}

ecovisAllocationForm.elements.allocation_type.addEventListener('change', toggleAllocationProjectField);

ecovisAllocationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisAllocationMessage, '');
  const payload = simpleFormPayload(ecovisAllocationForm);
  if (payload.allocation_type !== 'proyecto') {
    delete payload.ecovis_project_id;
  }
  try {
    await api('/api/ecovis/payments/' + state.selectedEcovisPaymentId + '/allocations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisAllocationMessage, 'Asignacion registrada correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisProjects();
    await loadEcovisPayments();
    resetEcovisAllocationForm();
    await openAllocationModal(state.selectedEcovisPaymentId);
  } catch (error) {
    setMessage(ecovisAllocationMessage, error.message);
  }
});

function closeEcovisAllocationModal() {
  closeEcovisModal(ecovisAllocationModal, () => {
    resetEcovisAllocationForm();
    state.selectedEcovisPaymentId = null;
  });
}
attachEcovisModalClose(ecovisAllocationModal, () => {
  resetEcovisAllocationForm();
  state.selectedEcovisPaymentId = null;
});

document.getElementById('ecovis-new-loan-btn').addEventListener('click', () => {
  ecovisLoanForm.reset();
  ecovisLoanFormTitle.textContent = 'Registrar prestamo';
  ecovisLoanForm.elements.movement_date.value = today();
  setMessage(ecovisLoanMessage, '');
  ecovisLoanModal.classList.remove('hidden');
});

ecovisLoanForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisLoanMessage, '');
  const payload = simpleFormPayload(ecovisLoanForm);
  try {
    await api('/api/ecovis/loans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisLoanMessage, 'Prestamo registrado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisLoans();
    setTimeout(() => { ecovisLoanModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisLoanMessage, error.message);
  }
});

attachEcovisModalClose(ecovisLoanModal, () => {
  ecovisLoanForm.reset();
  resetEcovisCurrencyField(ecovisLoanForm.elements.amount, 0);
});

ecovisLoansTable.addEventListener('click', async (event) => {
  const repayBtn = event.target.closest('[data-action="ecovis-repay-loan"]');
  if (repayBtn) {
    const amountStr = window.prompt('Monto de devolucion:');
    if (!amountStr) return;
    const description = window.prompt('Descripcion de la devolucion:');
    if (!description) return;
    try {
      await api('/api/ecovis/loans/' + repayBtn.dataset.id + '/repayment', {
        method: 'POST',
        body: JSON.stringify({ amount: amountStr, description }),
      });
      await loadEcovisSummary();
      await loadEcovisLoans();
    } catch (error) {
      window.alert(error.message);
    }
  }
});

document.getElementById('ecovis-adjustment-btn').addEventListener('click', () => {
  ecovisAdjustmentForm.reset();
  ecovisAdjustmentForm.elements.movement_date.value = today();
  setMessage(ecovisAdjustmentMessage, '');
  ecovisAdjustmentModal.classList.remove('hidden');
});

ecovisAdjustmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisAdjustmentMessage, '');
  const payload = simpleFormPayload(ecovisAdjustmentForm);
  try {
    await api('/api/ecovis/adjustments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisAdjustmentMessage, 'Ajuste registrado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisMovements();
    setTimeout(() => { ecovisAdjustmentModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisAdjustmentMessage, error.message);
  }
});

attachEcovisModalClose(ecovisAdjustmentModal, () => {
  ecovisAdjustmentForm.reset();
  resetEcovisCurrencyField(ecovisAdjustmentForm.elements.amount, 0);
});

if (ecovisAmountAdjustmentForm) {
  ecovisAmountAdjustmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(ecovisAmountAdjustmentMessage, '');
    const payload = simpleFormPayload(ecovisAmountAdjustmentForm);
    payload.entity_id = Number(payload.entity_id);
    try {
      await api('/api/ecovis/amount-adjustments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(ecovisAmountAdjustmentMessage, 'Ajuste aplicado correctamente.', true);
      await loadEcovisSummary();
      await loadEcovisProjects();
      await loadEcovisPayments();
      setTimeout(() => {
        closeEcovisModal(ecovisAmountAdjustmentModal, () => ecovisAmountAdjustmentForm.reset());
        closeEcovisModal(ecovisProjectModal, resetEcovisProjectForm);
        closeEcovisModal(ecovisPaymentModal, resetEcovisPaymentForm);
      }, 600);
    } catch (error) {
      setMessage(ecovisAmountAdjustmentMessage, error.message);
    }
  });
  attachEcovisModalClose(ecovisAmountAdjustmentModal, () => ecovisAmountAdjustmentForm.reset());
}

async function openApplyCreditModal(projectId) {
  ecovisApplyCreditForm.reset();
  ecovisApplyCreditForm.elements.movement_date.value = today();
  setMessage(ecovisApplyCreditMessage, '');

  try {
    const summary = await api('/api/ecovis/summary');
    ecovisCreditAvailable.textContent = 'Saldo a favor disponible: ' + money.format(summary.credit_balance || 0);

    const projects = await loadEcovisAssignableProjects();
    ecovisCreditProjectSelect.innerHTML = renderEcovisAssignableProjectOptions(projects);
    if (projectId && ecovisCreditProjectSelect.querySelector('option[value="' + projectId + '"]')) {
      ecovisCreditProjectSelect.value = String(projectId);
    }

    ecovisApplyCreditModal.classList.remove('hidden');
  } catch (error) {
    window.alert(error.message);
  }
}

ecovisApplyCreditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(ecovisApplyCreditMessage, '');
  const payload = simpleFormPayload(ecovisApplyCreditForm);
  try {
    await api('/api/ecovis/apply-credit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(ecovisApplyCreditMessage, 'Saldo a favor aplicado correctamente.', true);
    await loadEcovisSummary();
    await loadEcovisProjects();
    setTimeout(() => { ecovisApplyCreditModal.classList.add('hidden'); }, 600);
  } catch (error) {
    setMessage(ecovisApplyCreditMessage, error.message);
  }
});

attachEcovisModalClose(ecovisApplyCreditModal, () => {
  ecovisApplyCreditForm.reset();
  resetEcovisCurrencyField(ecovisApplyCreditForm.elements.amount, 0);
});

if (ecovisProjectsSearchInput) {
  ecovisProjectsSearchInput.addEventListener('input', debounce(() => {
    state.ecovisProjectsSearch = ecovisProjectsSearchInput.value;
    state.ecovisProjectsPag.page = 1;
    loadEcovisProjects();
  }));
}

if (ecovisMovementsSearchInput) {
  ecovisMovementsSearchInput.addEventListener('input', debounce(() => {
    state.ecovisMovementsSearch = ecovisMovementsSearchInput.value;
    state.ecovisMovementsPag.page = 1;
    loadEcovisMovements();
  }));
}

if (ecovisMovementsTypeFilterSelect) {
  ecovisMovementsTypeFilterSelect.addEventListener('change', () => {
    state.ecovisMovementsTypeFilter = ecovisMovementsTypeFilterSelect.value;
    state.ecovisMovementsPag.page = 1;
    loadEcovisMovements();
  });
}

// ===================== BACKUP MODULE =====================

document.getElementById('backup-create-btn').addEventListener('click', async () => {
  if (!window.confirm('Se generara un respaldo integral de todas las areas del sistema.')) return;
  const btn = document.getElementById('backup-create-btn');
  try {
    btn.textContent = 'Generando respaldo...';
    btn.disabled = true;
    const response = await fetch('/api/admin/backup', { headers: { 'Content-Type': 'application/json' } });
    const backup = await response.json();
    if (!response.ok && response.status !== 207) throw new Error(backup.message || 'Error generando respaldo.');
    if (backup.backupMetadata && backup.backupMetadata.warnings && backup.backupMetadata.warnings.length > 0) {
      window.alert('Respaldo generado con advertencias:\n' + backup.backupMetadata.warnings.join('\n'));
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[T:]/g, '-').slice(0, 16);
    link.href = URL.createObjectURL(blob);
    link.download = 'REVRAM_BACKUP_' + dateStr + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    window.alert('Respaldo generado correctamente.');
  } catch (error) {
    window.alert(error.message || 'No se pudo generar el respaldo.');
  } finally {
    btn.textContent = 'Crear respaldo';
    btn.disabled = false;
  }
});

document.getElementById('backup-import-btn').addEventListener('click', () => {
  document.getElementById('backup-import-modal').classList.remove('hidden');
  document.getElementById('backup-file-input').value = '';
  document.getElementById('backup-preview-area').classList.add('hidden');
  document.getElementById('backup-import-message').textContent = '';
});

document.getElementById('backup-close-modal').addEventListener('click', () => {
  document.getElementById('backup-import-modal').classList.add('hidden');
});

document.getElementById('backup-cancel-import').addEventListener('click', () => {
  document.getElementById('backup-import-modal').classList.add('hidden');
});

let pendingBackupData = null;

document.getElementById('backup-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const msgEl = document.getElementById('backup-import-message');
  msgEl.textContent = '';
  if (!file) return;
  if (!file.name.endsWith('.json')) { msgEl.textContent = 'Solo se permiten archivos .json'; return; }
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    if (!backup.backupMetadata || !backup.data) { msgEl.textContent = 'Archivo de respaldo invalido.'; return; }
    pendingBackupData = backup;
    msgEl.textContent = 'Analizando respaldo...';
    const result = await api('/api/admin/backup/preview', { method: 'POST', body: JSON.stringify(backup) });
    renderBackupPreview(result);
    msgEl.textContent = '';
  } catch (error) {
    msgEl.textContent = error.message || 'Error al procesar el archivo.';
    pendingBackupData = null;
  }
});

function renderBackupPreview(result) {
  const area = document.getElementById('backup-preview-area');
  const tableDiv = document.getElementById('backup-preview-table');
  area.classList.remove('hidden');
  const labels = { projects:'Proyectos activos', closedProjects:'Proyectos cerrados', projectPayments:'Pagos', projectCosts:'Costos', projectReports:'Reportes', employees:'Empleados', vacationRequests:'Vacaciones', exchangeRates:'Tipos de cambio', ecovisProjects:'ECOVIS Proyectos', ecovisPayments:'ECOVIS Pagos', ecovisPaymentAllocations:'ECOVIS Asignaciones', ecovisMovements:'ECOVIS Movimientos', usersSafe:'Usuarios' };
  let html = '<table style="width:100%;font-size:0.88rem;"><thead><tr><th>Entidad</th><th>Respaldo</th><th>Existentes</th><th>Nuevos</th><th>Duplicados</th><th>Conflictos</th></tr></thead><tbody>';
  for (const [key, info] of Object.entries(result.preview)) {
    html += '<tr><td>' + (labels[key]||key) + '</td><td>' + info.inBackup + '</td><td>' + info.existing + '</td><td style="color:var(--success);font-weight:700;">' + info.newToAdd + '</td><td>' + info.duplicatesOmitted + '</td><td style="color:' + (info.conflicts>0?'var(--warning)':'inherit') + ';font-weight:' + (info.conflicts>0?'700':'normal') + ';">' + info.conflicts + '</td></tr>';
  }
  html += '</tbody></table>';
  tableDiv.innerHTML = html;
  const conflictsDiv = document.getElementById('backup-preview-conflicts');
  if (result.conflicts && result.conflicts.length > 0) {
    conflictsDiv.classList.remove('hidden');
    let cHtml = '';
    for (const c of result.conflicts) {
      cHtml += '<p><strong>' + (labels[c.entity]||c.entity) + '</strong>: ' + c.items.length + ' conflicto(s)</p>';
    }
    document.getElementById('backup-conflicts-detail').innerHTML = cHtml;
  } else {
    conflictsDiv.classList.add('hidden');
  }
}

document.getElementById('backup-confirm-import').addEventListener('click', async () => {
  if (!pendingBackupData) return;
  if (!window.confirm('Confirmar importacion? Se agregaran los registros faltantes sin modificar existentes.')) return;
  const msgEl = document.getElementById('backup-import-message');
  try {
    msgEl.textContent = 'Importando registros...';
    document.getElementById('backup-confirm-import').disabled = true;
    const result = await api('/api/admin/backup/import', { method: 'POST', body: JSON.stringify(pendingBackupData) });
    let msg = 'Importacion completada.\n\n';
    if (result.importLog && result.importLog.summary) {
      for (const [key, val] of Object.entries(result.importLog.summary)) {
        if (val.added > 0) msg += key + ': +' + val.added + ' agregados\n';
      }
    }
    window.alert(msg);
    msgEl.classList.add('success');
    msgEl.textContent = 'Importacion completada exitosamente.';
    pendingBackupData = null;
    document.getElementById('backup-import-modal').classList.add('hidden');
    await loadProjects();
  } catch (error) {
    msgEl.textContent = error.message || 'Error durante la importacion.';
  } finally {
    document.getElementById('backup-confirm-import').disabled = false;
  }
});

// ===================== END BACKUP MODULE =====================

// ===================== ROLE VISIBILITY & REPORT TYPE SELECTOR =====================

function applyRoleVisibility() {
  projectsTab.classList.toggle('hidden', !canAccess('projects', 'view'));
  closedProjectsTab.classList.toggle('hidden', !canAccess('closedProjects', 'view'));
  usersTab.classList.toggle('hidden', !canAccess('users', 'view'));
  if (vacationsTab) vacationsTab.classList.toggle('hidden', !canAccess('vacations', 'view'));
  if (attendanceTab) attendanceTab.classList.toggle('hidden', !canAccess('attendance', 'view'));
  if (ecovisTab) ecovisTab.classList.toggle('hidden', !canAccess('ecovisAccount', 'view'));
  const sqTab = document.getElementById('service-quoter-tab');
  if (sqTab) sqTab.classList.toggle('hidden', !canAccess('serviceQuoter', 'view'));
  const finTab = document.getElementById('financial-tab');
  if (finTab) finTab.classList.toggle('hidden', state.userRole !== 'admin');
  const kpisTab = document.getElementById('kpis-tab');
  if (kpisTab) kpisTab.classList.toggle('hidden', state.userRole !== 'admin');
  const archiveTab = document.getElementById('report-archive-tab');
  if (archiveTab) archiveTab.classList.toggle('hidden', !canAccess('reportsArchive', 'view'));
  const reportsTab = document.getElementById('reports-tab');
  if (reportsTab) reportsTab.classList.toggle('hidden', !canAccess('reports', 'view'));
  const emissionsLink = document.getElementById('emissions-calc-link');
  if (emissionsLink) emissionsLink.classList.toggle('hidden', !canAccess('reports', 'view'));
  const backupCreateBtn = document.getElementById('backup-create-btn');
  const backupImportBtn = document.getElementById('backup-import-btn');
  if (backupCreateBtn) backupCreateBtn.classList.toggle('hidden', !canAccess('backups', 'backup'));
  if (backupImportBtn) backupImportBtn.classList.toggle('hidden', !canAccess('backups', 'import'));
  var comTab = document.getElementById("commissions-tab");
  if (comTab) comTab.classList.toggle("hidden", !canAccess("commissions", "view"));
  var amTab = document.getElementById("activity-monitor-tab");
  if (amTab) amTab.classList.toggle("hidden", !canAccess("activityMonitor", "view"));
  const exchangePanel = document.querySelector('.exchange-panel');
  if (exchangePanel) exchangePanel.classList.toggle('hidden', !canAccess('settings', 'view'));
}

function openReportPrintView(reportId, reportType) {
  const type = reportType || 'boiler_startup';
  let url = '/report-print.html?id=' + reportId;
  if (type === 'general_equipment_service_delivery') {
    url = '/report-print-general.html?id=' + reportId;
  } else if (type === 'autoflame_system_startup') {
    url = '/report-print-autoflame.html?id=' + reportId;
  }
  window.open(url, '_blank');
}

function openFailureReportPrintView(reportId) {
  window.open('/failure-report-print.html?id=' + reportId, '_blank');
}

let failureReportViewId = null;

async function showFailureReportViewModal(reportId) {
  const modal = document.getElementById('failure-report-view-modal');
  const body = document.getElementById('failure-report-view-body');
  const title = document.getElementById('failure-report-view-title');
  if (!modal || !body) return;
  try {
    const report = await api('/api/failure-reports/' + reportId);
    failureReportViewId = report.id;
    if (title) title.textContent = `Reporte de falla FALLA-${report.id}`;
    const failureResponsible = report.cause === 'interna'
      ? (report.failure_responsible_name || '—')
      : 'Cliente (causa externa)';
    body.innerHTML = `
      <p><strong>Proyecto:</strong> #${escapeHtml(report.project?.id || report.project_id)} — ${escapeHtml(report.project?.client_name || '')}</p>
      <p><strong>Causa:</strong> ${escapeHtml(report.cause_label || report.cause || '')}</p>
      <p><strong>Descripcion del problema:</strong><br>${escapeHtml(report.problem_description || '')}</p>
      <p><strong>Responsable de la falla:</strong> ${escapeHtml(failureResponsible)}</p>
      <p><strong>Responsable de solucionarlo:</strong> ${escapeHtml(report.solution_responsible_name || '')}</p>
      <p><strong>Registrado:</strong> ${escapeHtml(report.registered_at_cdmx || report.registered_at || '')}</p>
      <p><strong>Archivado:</strong> ${escapeHtml(report.archived_at_cdmx || report.archived_at || '—')}</p>
    `;
    modal.classList.remove('hidden');
  } catch (error) {
    window.alert(error.message);
  }
}

(function initFailureReportViewModal() {
  const modal = document.getElementById('failure-report-view-modal');
  if (!modal) return;
  const closeBtn = document.getElementById('failure-report-view-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      failureReportViewId = null;
    });
  }
  const printBtn = document.getElementById('failure-report-view-print');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (failureReportViewId) openFailureReportPrintView(failureReportViewId);
    });
  }
  modal.addEventListener('mousedown', (event) => {
    if (event.target === modal) {
      modal.classList.add('hidden');
      failureReportViewId = null;
    }
  });
})();

let pendingReportProjectId = null;

function showReportTypeSelector(projectId) {
  pendingReportProjectId = projectId;
  const modal = document.getElementById('report-type-modal');
  if (modal) modal.classList.remove('hidden');
}

(function initReportTypeModal() {
  const modal = document.getElementById('report-type-modal');
  if (!modal) return;
  const cancelBtn = document.getElementById('report-type-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.querySelectorAll('.report-type-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
      const type = btn.dataset.type;
      if (type === 'boiler_startup') {
        openReportForm(pendingReportProjectId, null);
      } else if (type === 'general_equipment_service_delivery') {
        openGeneralEquipmentForm(pendingReportProjectId);
      } else if (type === 'autoflame_system_startup') {
        openAutoflameForm(pendingReportProjectId);
      } else if (type === 'failure_report') {
        openReportsFailureForm(pendingReportProjectId);
      }
    });
  });
})();

if (reportsFailureBack) {
  reportsFailureBack.addEventListener('click', () => {
    if (state.currentReportProjectId) {
      openReportListForProject(state.currentReportProjectId);
      return;
    }
    showReportsMainList();
  });
}

if (reportsFailureForm) {
  reportsFailureForm.elements.cause?.addEventListener('change', syncReportsFailureResponsibleVisibility);
  syncReportsFailureResponsibleVisibility();
  reportsFailureForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const projectId = reportsFailureForm.elements.project_id.value;
    syncReportsFailureResponsibleVisibility();
    const payload = {
      cause: reportsFailureForm.elements.cause.value,
      problem_description: reportsFailureForm.elements.problem_description.value.trim(),
      solution_responsible_employee_id: reportsFailureForm.elements.solution_responsible_employee_id.value,
    };
    if (payload.cause === 'interna') {
      payload.failure_responsible_employee_id =
        reportsFailureForm.elements.failure_responsible_employee_id.value;
    }
    try {
      await api(`/api/projects/${projectId}/failure-reports`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(reportsFailureMessage, 'Reporte de falla registrado.', true);
      setTimeout(async () => {
        await loadReportsProjects();
        openReportListForProject(projectId);
      }, 600);
    } catch (error) {
      setMessage(reportsFailureMessage, error.message);
    }
  });
}

// ===================== GENERAL EQUIPMENT/SERVICE DELIVERY REPORT =====================

function openGeneralEquipmentForm(projectId) {
  const project = state.reportsAllProjects.find((p) => p.id === Number(projectId));
  if (!project) return;
  state.currentReportProjectId = Number(projectId);
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportListPanel.classList.add('hidden');
  reportFormPanel.classList.remove('hidden');
  reportForm.reset();
  setMessage(reportMessage, '');
  reportFormTitle.textContent = 'ENTREGA GENERAL DE EQUIPO/SERVICIO';
  reportFormSubtitle.textContent = `Proyecto #${project.id} - ${project.client_name}`;
  reportForm.elements.id.value = '';
  reportForm.elements.project_id.value = project.id;
  reportForm.elements.report_date.value = today();
  reportForm.elements.client_name.value = project.client_name || '';
  reportForm.elements.service_name.value = project.project_description || '';
  reportForm.elements.assigned_technicians.value = project.technician_name || '';
  populateReportExecutedBySelect(project.tecnico_id || null);
  state.currentReportType = 'general_equipment_service_delivery';
  showGeneralEquipmentFields();
}

function showGeneralEquipmentFields() {
  const technicalFields = reportFormPanel.querySelectorAll('.boiler-fields');
  technicalFields.forEach((el) => el.classList.add('hidden'));
  let extraPanel = document.getElementById('general-equipment-extra');
  if (!extraPanel) {
    extraPanel = document.createElement('div');
    extraPanel.id = 'general-equipment-extra';
    extraPanel.className = 'grid-form';
    extraPanel.style.marginTop = '16px';
    extraPanel.innerHTML = `
      <label>Domicilio<input name="ge_address" /></label>
      <label>Zona del Equipo/Servicio<input name="ge_zone" /></label>
      <label class="full">Descripcion de Actividades<textarea name="ge_activities" rows="5" required></textarea></label>
    `;
    reportForm.appendChild(extraPanel);
  }
  extraPanel.classList.remove('hidden');
  let autoflamePanel = document.getElementById('autoflame-extra');
  if (autoflamePanel) autoflamePanel.classList.add('hidden');
}

// ===================== AUTOFLAME SYSTEM STARTUP REPORT =====================

function openAutoflameForm(projectId) {
  const project = state.reportsAllProjects.find((p) => p.id === Number(projectId));
  if (!project) return;
  state.currentReportProjectId = Number(projectId);
  reportsProjectsTable.closest('.panel').classList.add('hidden');
  reportListPanel.classList.add('hidden');
  reportFormPanel.classList.remove('hidden');
  reportForm.reset();
  setMessage(reportMessage, '');
  reportFormTitle.textContent = 'ARRANQUE DE SISTEMA AUTOFLAME';
  reportFormSubtitle.textContent = `Proyecto #${project.id} - ${project.client_name}`;
  reportForm.elements.id.value = '';
  reportForm.elements.project_id.value = project.id;
  reportForm.elements.report_date.value = today();
  reportForm.elements.client_name.value = project.client_name || '';
  reportForm.elements.service_name.value = project.project_description || '';
  reportForm.elements.assigned_technicians.value = project.technician_name || '';
  populateReportExecutedBySelect(project.tecnico_id || null);
  state.currentReportType = 'autoflame_system_startup';
  showAutoflameFields();
}

function showAutoflameFields() {
  const technicalFields = reportFormPanel.querySelectorAll('.boiler-fields');
  technicalFields.forEach((el) => el.classList.add('hidden'));
  let extraPanel = document.getElementById('general-equipment-extra');
  if (extraPanel) extraPanel.classList.add('hidden');
  let afPanel = document.getElementById('autoflame-extra');
  if (!afPanel) {
    afPanel = document.createElement('div');
    afPanel.id = 'autoflame-extra';
    afPanel.style.marginTop = '16px';
    let pointsHtml = '';
    for (let i = 1; i <= 15; i++) {
      pointsHtml += `<tr>
        <td>${i}</td>
        <td><input name="af_p${i}_high" /></td><td><input name="af_p${i}_low" /></td>
        <td><input name="af_p${i}_ch1" /></td><td><input name="af_p${i}_ch2" /></td>
        <td><input name="af_p${i}_ch3" /></td><td><input name="af_p${i}_ch4" /></td>
        <td><input name="af_p${i}_ch5" /></td><td><input name="af_p${i}_ch6" /></td>
        <td><input name="af_p${i}_o2" /></td><td><input name="af_p${i}_co2" /></td>
        <td><input name="af_p${i}_co" /></td><td><input name="af_p${i}_no" /></td>
        <td><input name="af_p${i}_so2" /></td><td><input name="af_p${i}_tgas" /></td>
        <td><input name="af_p${i}_p_horno" /></td><td><input name="af_p${i}_p_windbox" /></td>
        <td><input name="af_p${i}_p_stack" /></td><td><input name="af_p${i}_smoke" /></td>
        <td><input name="af_p${i}_comments" /></td>
      </tr>`;
    }
    afPanel.innerHTML = `
      <div class="grid-form">
        <label>Sitio / Planta<input name="af_site" required /></label>
        <label>Quemador / Equipo<input name="af_burner" /></label>
        <label>Tipo de combustible<input name="af_fuel" /></label>
        <label>Presion suministro<input name="af_supply_pressure" /></label>
        <label>Unidad presion suministro<input name="af_supply_unit" placeholder="psi, bar, mbar..." /></label>
        <label>Presion retorno (aceite)<input name="af_return_pressure" /></label>
        <label>Unidad presion retorno<input name="af_return_unit" /></label>
        <label class="full">Comentarios datos generales<textarea name="af_data_comments" rows="2"></textarea></label>
      </div>
      <h3 style="margin:16px 0 8px;">Puntos de Ajuste / Curva de Combustion</h3>
      <div class="table-wrapper">
        <table class="emissions-table" style="font-size:0.78rem;">
          <thead><tr>
            <th>Pto</th><th>Alto</th><th>Bajo</th><th>Ch1</th><th>Ch2</th><th>Ch3</th>
            <th>Ch4</th><th>Ch5</th><th>Ch6</th><th>O2</th><th>CO2</th><th>CO</th>
            <th>NO</th><th>SO2</th><th>T.Gas</th><th>P.Horno</th><th>P.Wind</th>
            <th>P.Stack</th><th>Humo</th><th>Coment.</th>
          </tr></thead>
          <tbody>${pointsHtml}</tbody>
        </table>
      </div>
      <div class="grid-form" style="margin-top:16px;">
        <label>Inicio FGR<input name="af_fgr" /></label>
        <label>Golden Start<input name="af_golden" /></label>
        <label class="full">Comentarios generales<textarea name="af_general_comments" rows="3"></textarea></label>
      </div>
    `;
    reportForm.appendChild(afPanel);
  }
  afPanel.classList.remove('hidden');
}

// Override collectReportPayload for new types
const originalCollectReportPayload = collectReportPayload;
collectReportPayload = function() {
  if (state.currentReportType === 'general_equipment_service_delivery') {
    return {
      project_id: Number(reportForm.elements.project_id.value),
      report_type: 'general_equipment_service_delivery',
      report_folio: reportForm.elements.report_folio.value || '',
      report_date: reportForm.elements.report_date.value,
      client_name: reportForm.elements.client_name.value,
      client_address: (reportForm.elements.ge_address || {}).value || reportForm.elements.client_address.value || '',
      service_name: reportForm.elements.service_name.value,
      assigned_technicians: reportForm.elements.assigned_technicians.value,
      technician_name: reportForm.elements.technician_name.value || reportForm.elements.assigned_technicians.value,
      plant_manager_name: reportForm.elements.plant_manager_name.value,
      executed_by_employee_id: Number(reportForm.elements.executed_by_employee_id.value),
      comments: reportForm.elements.comments.value,
      report_data: {
        equipment_zone: (reportForm.elements.ge_zone || {}).value || '',
        activity_description: (reportForm.elements.ge_activities || {}).value || '',
      },
    };
  }
  if (state.currentReportType === 'autoflame_system_startup') {
    const points = [];
    for (let i = 1; i <= 15; i++) {
      points.push({
        high: (reportForm.elements['af_p' + i + '_high'] || {}).value || '',
        low: (reportForm.elements['af_p' + i + '_low'] || {}).value || '',
        ch1: (reportForm.elements['af_p' + i + '_ch1'] || {}).value || '',
        ch2: (reportForm.elements['af_p' + i + '_ch2'] || {}).value || '',
        ch3: (reportForm.elements['af_p' + i + '_ch3'] || {}).value || '',
        ch4: (reportForm.elements['af_p' + i + '_ch4'] || {}).value || '',
        ch5: (reportForm.elements['af_p' + i + '_ch5'] || {}).value || '',
        ch6: (reportForm.elements['af_p' + i + '_ch6'] || {}).value || '',
        o2: (reportForm.elements['af_p' + i + '_o2'] || {}).value || '',
        co2: (reportForm.elements['af_p' + i + '_co2'] || {}).value || '',
        co: (reportForm.elements['af_p' + i + '_co'] || {}).value || '',
        no: (reportForm.elements['af_p' + i + '_no'] || {}).value || '',
        so2: (reportForm.elements['af_p' + i + '_so2'] || {}).value || '',
        tgas: (reportForm.elements['af_p' + i + '_tgas'] || {}).value || '',
        p_horno: (reportForm.elements['af_p' + i + '_p_horno'] || {}).value || '',
        p_windbox: (reportForm.elements['af_p' + i + '_p_windbox'] || {}).value || '',
        p_stack: (reportForm.elements['af_p' + i + '_p_stack'] || {}).value || '',
        smoke_number: (reportForm.elements['af_p' + i + '_smoke'] || {}).value || '',
        comments: (reportForm.elements['af_p' + i + '_comments'] || {}).value || '',
      });
    }
    return {
      project_id: Number(reportForm.elements.project_id.value),
      report_type: 'autoflame_system_startup',
      report_folio: reportForm.elements.report_folio.value || '',
      report_date: reportForm.elements.report_date.value,
      client_name: reportForm.elements.client_name.value,
      client_address: reportForm.elements.client_address.value,
      service_name: reportForm.elements.service_name.value,
      assigned_technicians: reportForm.elements.assigned_technicians.value,
      technician_name: reportForm.elements.technician_name.value || reportForm.elements.assigned_technicians.value,
      plant_manager_name: reportForm.elements.plant_manager_name.value,
      executed_by_employee_id: Number(reportForm.elements.executed_by_employee_id.value),
      comments: reportForm.elements.comments.value,
      report_data: {
        site_name: (reportForm.elements.af_site || {}).value || '',
        burner_equipment: (reportForm.elements.af_burner || {}).value || '',
        fuel_type: (reportForm.elements.af_fuel || {}).value || '',
        supply_pressure: (reportForm.elements.af_supply_pressure || {}).value || '',
        supply_pressure_unit: (reportForm.elements.af_supply_unit || {}).value || '',
        return_pressure: (reportForm.elements.af_return_pressure || {}).value || '',
        return_pressure_unit: (reportForm.elements.af_return_unit || {}).value || '',
        general_data_comments: (reportForm.elements.af_data_comments || {}).value || '',
        combustion_points: points,
        fgr_start: (reportForm.elements.af_fgr || {}).value || '',
        golden_start: (reportForm.elements.af_golden || {}).value || '',
        general_comments: (reportForm.elements.af_general_comments || {}).value || '',
      },
    };
  }
  state.currentReportType = 'boiler_startup';
  const base = originalCollectReportPayload();
  base.report_type = 'boiler_startup';
  return base;
};

function resetReportTypeFields() {
  state.currentReportType = null;
  const technicalFields = reportFormPanel.querySelectorAll('.boiler-fields');
  technicalFields.forEach((el) => el.classList.remove('hidden'));
  let extraPanel = document.getElementById('general-equipment-extra');
  if (extraPanel) extraPanel.classList.add('hidden');
  let afPanel = document.getElementById('autoflame-extra');
  if (afPanel) afPanel.classList.add('hidden');
}

const origOpenReportForm = openReportForm;
openReportForm = function(projectId, reportData) {
  resetReportTypeFields();
  if (reportData && reportData.report_type && reportData.report_type !== 'boiler_startup') {
    if (reportData.report_type === 'general_equipment_service_delivery') {
      openGeneralEquipmentForm(projectId);
      reportForm.elements.id.value = reportData.id;
      reportFormTitle.textContent = 'Editar - ENTREGA GENERAL DE EQUIPO/SERVICIO';
      reportFormSubtitle.textContent = `Folio: ${reportData.report_folio}`;
      reportForm.elements.report_folio.value = reportData.report_folio || '';
      reportForm.elements.report_date.value = reportData.report_date || '';
      reportForm.elements.client_name.value = reportData.client_name || '';
      reportForm.elements.service_name.value = reportData.service_name || '';
      reportForm.elements.assigned_technicians.value = reportData.assigned_technicians || '';
      reportForm.elements.technician_name.value = reportData.technician_name || '';
      reportForm.elements.plant_manager_name.value = reportData.plant_manager_name || '';
      reportForm.elements.comments.value = reportData.comments || '';
      const d = reportData.report_data ? JSON.parse(reportData.report_data) : {};
      if (reportForm.elements.ge_address) reportForm.elements.ge_address.value = reportData.client_address || '';
      if (reportForm.elements.ge_zone) reportForm.elements.ge_zone.value = d.equipment_zone || '';
      if (reportForm.elements.ge_activities) reportForm.elements.ge_activities.value = d.activity_description || '';
      return;
    }
    if (reportData.report_type === 'autoflame_system_startup') {
      openAutoflameForm(projectId);
      reportForm.elements.id.value = reportData.id;
      reportFormTitle.textContent = 'Editar - ARRANQUE DE SISTEMA AUTOFLAME';
      reportFormSubtitle.textContent = `Folio: ${reportData.report_folio}`;
      reportForm.elements.report_folio.value = reportData.report_folio || '';
      reportForm.elements.report_date.value = reportData.report_date || '';
      reportForm.elements.client_name.value = reportData.client_name || '';
      reportForm.elements.service_name.value = reportData.service_name || '';
      reportForm.elements.assigned_technicians.value = reportData.assigned_technicians || '';
      reportForm.elements.technician_name.value = reportData.technician_name || '';
      reportForm.elements.plant_manager_name.value = reportData.plant_manager_name || '';
      reportForm.elements.comments.value = reportData.comments || '';
      const d = reportData.report_data ? JSON.parse(reportData.report_data) : {};
      if (reportForm.elements.af_site) reportForm.elements.af_site.value = d.site_name || '';
      if (reportForm.elements.af_burner) reportForm.elements.af_burner.value = d.burner_equipment || '';
      if (reportForm.elements.af_fuel) reportForm.elements.af_fuel.value = d.fuel_type || '';
      if (reportForm.elements.af_supply_pressure) reportForm.elements.af_supply_pressure.value = d.supply_pressure || '';
      if (reportForm.elements.af_supply_unit) reportForm.elements.af_supply_unit.value = d.supply_pressure_unit || '';
      if (reportForm.elements.af_return_pressure) reportForm.elements.af_return_pressure.value = d.return_pressure || '';
      if (reportForm.elements.af_return_unit) reportForm.elements.af_return_unit.value = d.return_pressure_unit || '';
      if (reportForm.elements.af_data_comments) reportForm.elements.af_data_comments.value = d.general_data_comments || '';
      if (reportForm.elements.af_fgr) reportForm.elements.af_fgr.value = d.fgr_start || '';
      if (reportForm.elements.af_golden) reportForm.elements.af_golden.value = d.golden_start || '';
      if (reportForm.elements.af_general_comments) reportForm.elements.af_general_comments.value = d.general_comments || '';
      const pts = d.combustion_points || [];
      for (let i = 0; i < 15; i++) {
        const p = pts[i] || {};
        const idx = i + 1;
        ['high','low','ch1','ch2','ch3','ch4','ch5','ch6','o2','co2','co','no','so2','tgas','p_horno','p_windbox','p_stack','smoke','comments'].forEach((k) => {
          const field = reportForm.elements['af_p' + idx + '_' + k];
          if (field) field.value = p[k] || p[k === 'smoke' ? 'smoke_number' : k] || '';
        });
      }
      return;
    }
  }
  state.currentReportType = 'boiler_startup';
  origOpenReportForm(projectId, reportData);
};

// ===================== REPORT ARCHIVE MODULE =====================

const archiveProjectsTable = document.getElementById('archive-projects-table');
const archiveProjectsPanel = document.getElementById('archive-projects-panel');
const archiveReportListPanel = document.getElementById('archive-report-list-panel');
const archiveReportListTable = document.getElementById('archive-report-list-table');
const archiveReportListTitle = document.getElementById('archive-report-list-title');
const archiveReportListSubtitle = document.getElementById('archive-report-list-subtitle');
const archiveReportListBack = document.getElementById('archive-report-list-back');
const archiveProjectSearch = document.getElementById('archive-project-search');

state.archiveAllProjects = [];
state.archiveProjPag = { page: 1, limit: 15 };
state.archiveProjSearch = '';
state.archiveProjReportsPag = { page: 1, limit: 15 };
state.currentArchiveProjectId = null;

const archiveProjectColumns = [
  { key: 'quote_number', label: 'Folio', type: 'text', sortable: true },
  { key: 'client_name', label: 'Cliente', type: 'text', sortable: true },
  { key: 'project_description', label: 'Proyecto', type: 'text', sortable: true },
  { key: 'report_count', label: 'Reportes', type: 'number', sortable: true, render: (p) => Number(p.report_count) || 0 },
  {
    key: 'reports_archived_at',
    label: 'Archivado',
    type: 'text',
    sortable: true,
    render: (p) => escapeHtml(p.reports_archived_at_cdmx || p.reports_archived_at || ''),
  },
];

const archiveReportListColumns = [
  { key: 'report_folio', label: 'Folio', type: 'text', sortable: true },
  {
    key: 'report_type',
    label: 'Tipo',
    type: 'text',
    sortable: true,
    render: (r) => escapeHtml(r.report_type_label || (r._kind === 'failure' ? 'Reporte de falla' : r.report_type || '')),
  },
  { key: 'report_date', label: 'Fecha', type: 'date', sortable: true },
  { key: 'service_name', label: 'Servicio', type: 'text', sortable: true },
  {
    key: 'archived_at',
    label: 'Archivado',
    type: 'text',
    sortable: true,
    render: (r) => escapeHtml(r.archived_at_cdmx || r.archived_at || ''),
  },
  {
    key: 'executed_by_name',
    label: 'Ejecuto / Solucion',
    type: 'text',
    sortable: true,
    render: (r) => escapeHtml(r.executed_by_name || r.solution_responsible_name || ''),
  },
];

const archiveTab = document.getElementById('report-archive-tab');
if (archiveTab) {
  archiveTab.addEventListener('click', async () => {
    switchView('report-archive');
    showArchiveProjectsList();
    await loadArchiveProjects();
  });
}

function showArchiveProjectsList() {
  if (archiveProjectsPanel) archiveProjectsPanel.classList.remove('hidden');
  if (archiveReportListPanel) archiveReportListPanel.classList.add('hidden');
}

async function loadArchiveProjects() {
  if (!archiveProjectsTable) return;
  const params = new URLSearchParams({
    page: state.archiveProjPag.page,
    limit: state.archiveProjPag.limit,
    search: state.archiveProjSearch,
    ...buildTableParams('archiveProjects'),
  });
  try {
    const result = await api(`/api/reports/archive/projects?${params}`);
    state.archiveAllProjects = result.data || [];
    renderDataTable({
      tableBody: archiveProjectsTable,
      tableKey: 'archiveProjects',
      columns: archiveProjectColumns,
      data: state.archiveAllProjects,
      pagination: result.pagination || defaultPagination,
      paginationContainerId: 'archive-projects-pagination',
      emptyMessage: 'No hay registros archivados.',
      filteredEmptyMessage: 'No se encontraron registros archivados con la busqueda actual.',
      isFiltered: Boolean(state.archiveProjSearch),
      onRefresh: loadArchiveProjects,
      pageState: state.archiveProjPag,
      renderActions: (p) => `
        <button class="secondary" data-action="archive-view-project" data-id="${p.id}" type="button">Ver reportes</button>`,
    });
  } catch (_e) {
    archiveProjectsTable.innerHTML = '<tr><td colspan="6" class="muted">Error al cargar archivo.</td></tr>';
  }
}

async function openArchiveReportListForProject(projectId) {
  const project = state.archiveAllProjects.find((p) => p.id === Number(projectId));
  if (!project) return;
  state.currentArchiveProjectId = Number(projectId);
  state.archiveProjReportsPag = { page: 1, limit: 15 };
  resetTableControls('archiveProjectReports');
  if (archiveProjectsPanel) archiveProjectsPanel.classList.add('hidden');
  if (archiveReportListPanel) archiveReportListPanel.classList.remove('hidden');
  if (archiveReportListTitle) {
    archiveReportListTitle.textContent = `Reportes archivados - Proyecto #${project.id}`;
  }
  if (archiveReportListSubtitle) {
    archiveReportListSubtitle.textContent = `${project.client_name} | ${project.project_description || ''} | Archivado: ${project.reports_archived_at_cdmx || project.reports_archived_at || ''}`;
  }
  await loadArchiveProjectReports(projectId);
}

async function loadArchiveProjectReports(projectId) {
  if (!archiveReportListTable) return;
  try {
    const params = new URLSearchParams({
      page: 1,
      limit: 500,
      ...buildTableParams('archiveProjectReports'),
    });
    const [result, failures] = await Promise.all([
      api(`/api/reports/archive/projects/${projectId}/reports?${params}`),
      api(`/api/reports/archive/projects/${projectId}/failure-reports`),
    ]);
    const failureRows = (failures.data || []).map((fr) => ({
      ...fr,
      _kind: 'failure',
      report_folio: `FALLA-${fr.id}`,
      report_date: String(fr.registered_at || '').slice(0, 10),
      service_name: fr.problem_description,
      report_type: 'failure_report',
      report_type_label: 'Reporte de falla',
      executed_by_name: fr.solution_responsible_name,
    }));
    const merged = [...(result.data || []), ...failureRows];
    const { data, pagination } = paginateMergedList(merged, state.archiveProjReportsPag);
    renderDataTable({
      tableBody: archiveReportListTable,
      tableKey: 'archiveProjectReports',
      columns: archiveReportListColumns,
      data,
      pagination,
      paginationContainerId: 'archive-project-reports-pagination',
      emptyMessage: 'No hay reportes archivados para este registro.',
      filteredEmptyMessage: 'No se encontraron reportes archivados con la busqueda actual.',
      onRefresh: () => loadArchiveProjectReports(projectId),
      pageState: state.archiveProjReportsPag,
      renderActions: (r) => {
        if (r._kind === 'failure') {
          return `
            <div class="row-actions">
              <button class="secondary" data-action="archive-view-failure" data-id="${r.id}" type="button">Consultar</button>
              <button class="secondary" data-action="archive-print-failure" data-id="${r.id}" type="button">Imprimir</button>
            </div>`;
        }
        return `
          <div class="row-actions">
            <button class="secondary" data-action="archive-view-report" data-id="${r.id}" data-type="${r.report_type || 'boiler_startup'}" type="button">Consultar</button>
            <button class="secondary" data-action="archive-print" data-id="${r.id}" data-type="${r.report_type || 'boiler_startup'}" type="button">Imprimir</button>
          </div>`;
      },
    });
  } catch (_e) {
    archiveReportListTable.innerHTML = '<tr><td colspan="6" class="muted">Error al cargar reportes archivados.</td></tr>';
  }
}

if (archiveProjectSearch) {
  archiveProjectSearch.addEventListener('input', debounce(() => {
    state.archiveProjSearch = archiveProjectSearch.value;
    state.archiveProjPag.page = 1;
    loadArchiveProjects();
  }));
}

if (archiveProjectsTable) {
  archiveProjectsTable.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="archive-view-project"]');
    if (viewBtn) {
      openArchiveReportListForProject(viewBtn.dataset.id);
    }
  });
}

if (archiveReportListTable) {
  archiveReportListTable.addEventListener('click', (event) => {
    const archivePrintBtn = event.target.closest('[data-action="archive-print"]');
    if (archivePrintBtn) {
      openReportPrintView(archivePrintBtn.dataset.id, archivePrintBtn.dataset.type);
      return;
    }
    const archiveViewReportBtn = event.target.closest('[data-action="archive-view-report"]');
    if (archiveViewReportBtn) {
      openReportPrintView(archiveViewReportBtn.dataset.id, archiveViewReportBtn.dataset.type);
      return;
    }
    const archiveViewFailureBtn = event.target.closest('[data-action="archive-view-failure"]');
    if (archiveViewFailureBtn) {
      showFailureReportViewModal(archiveViewFailureBtn.dataset.id);
      return;
    }
    const archivePrintFailureBtn = event.target.closest('[data-action="archive-print-failure"]');
    if (archivePrintFailureBtn) {
      openFailureReportPrintView(archivePrintFailureBtn.dataset.id);
    }
  });
}

if (archiveReportListBack) {
  archiveReportListBack.addEventListener('click', () => {
    showArchiveProjectsList();
    loadArchiveProjects();
  });
}

// ===================== CLOSED PROJECTS VIEW MODES =====================

const closedViewMode = document.getElementById('closed-view-mode');
const closedDateRangeControls = document.getElementById('closed-date-range-controls');
const closedByClientPanel = document.getElementById('closed-by-client-panel');

if (closedViewMode) {
  closedViewMode.addEventListener('change', async () => {
    const mode = closedViewMode.value;
    const tableWrapper = closedProjectsTable.closest('.table-wrapper');
    const paginationEl = document.getElementById('closed-projects-pagination');
    if (closedDateRangeControls) closedDateRangeControls.classList.toggle('hidden', mode !== 'date-range');
    if (closedByClientPanel) closedByClientPanel.classList.toggle('hidden', mode !== 'by-client');
    if (tableWrapper) tableWrapper.classList.toggle('hidden', mode === 'by-client');
    if (paginationEl) paginationEl.classList.toggle('hidden', mode === 'by-client');
    if (mode === 'list') {
      await loadClosedProjects();
    } else if (mode === 'by-client') {
      await loadClosedProjectsByClient();
    } else if (mode === 'date-range') {
      // Wait for user to apply
    }
  });
}

async function loadClosedProjectsByClient() {
  if (!closedByClientPanel) return;
  const search = closedProjectsSearchInput ? closedProjectsSearchInput.value : '';
  try {
    const result = await api('/api/closed-projects/by-client?search=' + encodeURIComponent(search));
    const clients = result.data || [];
    if (!clients.length) {
      closedByClientPanel.innerHTML = '<p class="muted">No hay proyectos cerrados.</p>';
      return;
    }
    closedByClientPanel.innerHTML = clients.map((c) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:#f8fbff;">
        <div>
          <strong>${escapeHtml(c.client_name)}</strong>
          <small class="muted" style="display:block;">Proyectos: ${c.projects_count} | Facturado: ${money.format(c.total_invoiced_mxn || 0)} | Ultimo cierre: ${c.last_closed_at ? c.last_closed_at.slice(0, 10) : 'N/A'}</small>
        </div>
        <button class="secondary" data-action="closed-view-client" data-client="${escapeHtml(c.client_name)}" type="button">Ver proyectos</button>
      </div>
    `).join('');
  } catch (e) {
    closedByClientPanel.innerHTML = '<p class="muted">Error al cargar agrupacion.</p>';
  }
}

document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-action="closed-view-client"]');
  if (btn) {
    const clientName = btn.dataset.client;
    try {
      const result = await api(`/api/closed-projects/client/${encodeURIComponent(clientName)}?limit=50`);
      const projects = result.data || [];
      closedByClientPanel.innerHTML = `
        <div style="margin-bottom:12px;"><button class="secondary" id="closed-client-back" type="button">← Volver a clientes</button> <strong>${escapeHtml(clientName)}</strong></div>
        ${projects.length ? projects.map((p) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;">
            <div>
              <strong>#${p.id} - ${escapeHtml(p.quote_number)}</strong>
              <small class="muted" style="display:block;">${escapeHtml(p.project_description || '')} | Cerrado: ${p.closed_at ? p.closed_at.slice(0, 10) : ''} | Reportes: ${p.report_count || 0}</small>
            </div>
          </div>
        `).join('') : '<p class="muted">Sin proyectos cerrados.</p>'}
      `;
      const backBtn = document.getElementById('closed-client-back');
      if (backBtn) backBtn.addEventListener('click', () => loadClosedProjectsByClient());
    } catch (e) {
      window.alert(e.message);
    }
  }
});

const closedDateApply = document.getElementById('closed-date-apply');
if (closedDateApply) {
  closedDateApply.addEventListener('click', async () => {
    const from = (document.getElementById('closed-date-from') || {}).value || '';
    const to = (document.getElementById('closed-date-to') || {}).value || '';
    if (!from && !to) { window.alert('Selecciona al menos una fecha.'); return; }
    const params = new URLSearchParams({ page: 1, limit: state.closedPag.limit });
    if (from) params.set('closed_at_from', from);
    if (to) params.set('closed_at_to', to);
    const search = closedProjectsSearchInput ? closedProjectsSearchInput.value : '';
    if (search) params.set('search', search);
    try {
      const result = await api('/api/closed-projects/date-range?' + params);
      state.closedProjects = result.data;
      renderClosedProjects(result.data, result.pagination);
      const info = document.getElementById('closed-date-info');
      if (info) info.textContent = `Mostrando ${result.pagination.totalRecords} proyectos cerrados del rango seleccionado.`;
    } catch (e) {
      window.alert(e.message);
    }
  });
}

function setDateRange(from, to) {
  const fromInput = document.getElementById('closed-date-from');
  const toInput = document.getElementById('closed-date-to');
  if (fromInput) fromInput.value = from;
  if (toInput) toInput.value = to;
}

const closedDateThisMonth = document.getElementById('closed-date-this-month');
if (closedDateThisMonth) closedDateThisMonth.addEventListener('click', () => {
  const now = new Date();
  const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0');
  setDateRange(`${y}-${m}-01`, `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`);
});

const closedDateLastMonth = document.getElementById('closed-date-last-month');
if (closedDateLastMonth) closedDateLastMonth.addEventListener('click', () => {
  const now = new Date(); now.setMonth(now.getMonth() - 1);
  const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0');
  setDateRange(`${y}-${m}-01`, `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`);
});

const closedDateThisYear = document.getElementById('closed-date-this-year');
if (closedDateThisYear) closedDateThisYear.addEventListener('click', () => {
  const y = new Date().getFullYear();
  setDateRange(`${y}-01-01`, `${y}-12-31`);
});

// ===================== ATTENDANCE MODULE =====================

const attendanceTab = document.getElementById('attendance-tab');
const attendanceView = document.getElementById('attendance-view');

function showAttendanceTab() {
  if (attendanceTab) {
    attendanceTab.classList.toggle('hidden', !canAccess('attendance', 'view'));
  }
}

let attendanceCurrentWeek = null;
let attendanceSelectedYear = null;

const ATTENDANCE_STATUS_OPTIONS = [
  { code: 'A', label: 'Asistencia' },
  { code: 'A*', label: 'Trabajo fuera' },
  { code: 'F', label: 'Falta' },
  { code: 'B', label: 'Baja' },
  { code: 'PC', label: 'Permiso c/goce' },
  { code: 'PS', label: 'Permiso s/goce' },
  { code: 'D', label: 'Descanso' },
  { code: 'I', label: 'Incapacidad' },
  { code: 'V', label: 'Vacaciones' },
];

const STATUS_COLORS = { A: '#ffffff', 'A*': '#b3e5fc', F: '#fff9c4', B: '#e0e0e0', PC: '#ffcdd2', PS: '#ef9a9a', D: '#bbdefb', I: '#c8e6c9', V: '#b2dfdb' };

async function initAttendanceYearSelector() {
  const sel = document.getElementById('attendance-filter-year');
  if (!sel) return;
  try {
    const result = await api('/api/attendance/years');
    const years = result.years || [];
    sel.innerHTML = '';
    if (years.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— Sin nóminas —';
      sel.appendChild(opt);
      attendanceSelectedYear = null;
      return;
    }
    for (const y of years) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    }
    attendanceSelectedYear = years[0];
    sel.value = String(years[0]);
  } catch (e) {
    sel.innerHTML = '<option value="">Error</option>';
    const msg = document.getElementById('attendance-search-message');
    if (msg) { msg.textContent = 'No se pudieron cargar los años disponibles.'; msg.style.color = 'red'; }
  }
}

if (attendanceTab) {
  attendanceTab.addEventListener('click', async () => {
    switchView('attendance');
    await initAttendanceYearSelector();
    if (attendanceSelectedYear) {
      loadAttendanceWeeks(1);
    }
  });
}

async function loadAttendanceWeeks(page = 1) {
  const yearSel = document.getElementById('attendance-filter-year');
  const msg = document.getElementById('attendance-search-message');
  const summaryDiv = document.getElementById('attendance-summary');

  const year = yearSel ? Number(yearSel.value) : null;
  if (!year || !Number.isFinite(year)) {
    if (msg) { msg.textContent = 'Selecciona un año para consultar las nóminas.'; msg.style.color = 'red'; }
    if (summaryDiv) summaryDiv.classList.add('hidden');
    const tbody = document.getElementById('attendance-weeks-table');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No hay nóminas generadas.</td></tr>';
    const pag = document.getElementById('attendance-weeks-pagination');
    if (pag) pag.innerHTML = '';
    return;
  }

  attendanceSelectedYear = year;
  if (msg) msg.textContent = '';

  try {
    const result = await api(`/api/attendance/weeks?year=${year}&page=${page}&limit=15&include_cancelled=true`);
    renderAttendanceWeeksTable(result.data);
    renderAttendancePagination(result.pagination);
    renderAttendanceSummary(result.summary);
  } catch (e) {
    if (msg) { msg.textContent = 'No se pudieron cargar las nóminas. Intenta nuevamente.'; msg.style.color = 'red'; }
    console.error('Error loading attendance weeks:', e);
  }
}

function renderAttendanceSummary(summary) {
  const div = document.getElementById('attendance-summary');
  if (!div || !summary) { if (div) div.classList.add('hidden'); return; }
  div.classList.remove('hidden');
  const totalEl = document.getElementById('att-summary-total');
  const draftEl = document.getElementById('att-summary-draft');
  const closedEl = document.getElementById('att-summary-closed');
  const cancelledEl = document.getElementById('att-summary-cancelled');
  if (totalEl) totalEl.textContent = summary.totalWeeks;
  if (draftEl) draftEl.textContent = summary.draftCount;
  if (closedEl) closedEl.textContent = summary.closedCount;
  if (cancelledEl) cancelledEl.textContent = summary.cancelledCount;
}

function renderAttendanceWeeksTable(weeks) {
  const tbody = document.getElementById('attendance-weeks-table');
  if (!tbody) return;
  if (!weeks || weeks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No se encontraron nóminas para el año seleccionado.</td></tr>';
    return;
  }
  tbody.innerHTML = weeks.map((w) => {
    const statusBadge = w.status === 'cerrada'
      ? '<span style="color:green;font-weight:bold;">Cerrada</span>'
      : w.status === 'cancelada'
        ? '<span style="color:red;">Cancelada</span>'
        : '<span style="color:orange;font-weight:bold;">Borrador</span>';
    const extraPay = w.total_extra_payments > 0 ? formatMoney(w.total_extra_payments) : '-';
    const range = `${escapeHtml(w.week_start_date)} – ${escapeHtml(w.week_end_date)}`;
    return `<tr style="${w.status === 'cancelada' ? 'opacity:0.6;' : ''}">
      <td><strong>${w.week_number}</strong></td>
      <td>${range}</td>
      <td>${statusBadge}</td>
      <td>${w.employee_count}</td>
      <td>${w.total_absences}</td>
      <td>${extraPay}</td>
      <td>${escapeHtml(w.created_by_name || '')}</td>
      <td>${escapeHtml(w.created_at_cdmx || '')}</td>
      <td><button class="secondary" onclick="openAttendanceWeek(${w.id})">Abrir</button></td>
    </tr>`;
  }).join('');
}

function renderAttendancePagination(pagination) {
  const container = document.getElementById('attendance-weeks-pagination');
  if (!container || !pagination) return;
  if (pagination.totalPages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  if (pagination.hasPreviousPage) html += `<button class="secondary" onclick="loadAttendanceWeeks(${pagination.page - 1})">Anterior</button> `;
  html += `<span>Página ${pagination.page} de ${pagination.totalPages}</span> `;
  if (pagination.hasNextPage) html += `<button class="secondary" onclick="loadAttendanceWeeks(${pagination.page + 1})">Siguiente</button>`;
  container.innerHTML = html;
}

async function openAttendanceWeek(weekId) {
  try {
    const week = await api(`/api/attendance/weeks/${weekId}`);
    attendanceCurrentWeek = week;
    renderAttendanceEditPanel(week);
  } catch (e) {
    window.alert(e.message || 'Error al abrir nómina.');
  }
}

function renderAttendanceEditPanel(week) {
  const panel = document.getElementById('attendance-edit-panel');
  const title = document.getElementById('attendance-edit-title');
  const subtitle = document.getElementById('attendance-edit-subtitle');
  const msg = document.getElementById('attendance-edit-message');

  if (!panel) return;
  panel.classList.remove('hidden');

  title.textContent = week.title || `Semana ${week.week_number} - ${week.year}`;
  subtitle.textContent = `Estatus: ${week.status} | ${week.week_start_date} al ${week.week_end_date}`;
  if (msg) msg.textContent = '';

  const saveBtn = document.getElementById('attendance-save-btn');
  const closeBtn = document.getElementById('attendance-close-btn');
  const reopenBtn = document.getElementById('attendance-reopen-btn');
  const cancelBtn = document.getElementById('attendance-cancel-btn');

  const isClosed = week.status === 'cerrada';
  const isCancelled = week.status === 'cancelada';
  const isEditable = !isClosed && !isCancelled;

  if (saveBtn) saveBtn.classList.toggle('hidden', !isEditable || !canAccess('attendance', 'edit'));
  if (closeBtn) closeBtn.classList.toggle('hidden', isClosed || isCancelled || !canAccess('attendance', 'approve'));
  if (reopenBtn) reopenBtn.classList.toggle('hidden', !isClosed || !canAccess('attendance', 'reopen'));
  if (cancelBtn) cancelBtn.classList.toggle('hidden', isCancelled || !canAccess('attendance', 'delete'));

  renderAttendanceTable(week, isEditable);
}

function renderAttendanceTable(week, editable) {
  const thead = document.getElementById('attendance-table-head');
  const tbody = document.getElementById('attendance-table-body');
  if (!thead || !tbody) return;

  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const startDate = new Date(week.week_start_date + 'T00:00:00Z');
  const dayDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    dayDates.push(`${d.getUTCDate()}/${d.getUTCMonth() + 1}`);
  }

  thead.innerHTML = `<tr>
    <th>#</th><th>Nombre</th><th>Puesto</th>
    ${days.map((d, i) => `<th>${d}<br><small>${dayDates[i]}</small></th>`).join('')}
    <th>Proyecto/Ubicación</th><th>Pago extra</th><th>Notas</th>
  </tr>`;

  const dayFields = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];

  tbody.innerHTML = (week.employees || []).map((emp, idx) => {
    const dayCells = dayFields.map((field) => {
      const val = emp[field] || 'A';
      const bg = STATUS_COLORS[val] || '#fff';
      if (editable) {
        const options = ATTENDANCE_STATUS_OPTIONS.map((o) => `<option value="${o.code}" ${o.code === val ? 'selected' : ''}>${o.code}</option>`).join('');
        return `<td class="attendance-day-cell" style="background:${bg};"><select class="attendance-cell-select" data-emp-id="${emp.id}" data-field="${field}" onchange="onAttendanceCellChange(this)">${options}</select></td>`;
      }
      return `<td style="background:${bg};text-align:center;font-weight:bold;font-size:0.85rem;">${escapeHtml(val)}</td>`;
    }).join('');

    const projInput = editable
      ? `<td><input type="text" class="attendance-cell-input" data-emp-id="${emp.id}" data-field="project_location_text" value="${escapeHtml(emp.project_location_text || '')}" /></td>`
      : `<td>${escapeHtml(emp.project_location_text || '')}</td>`;

    const extraInput = editable
      ? `<td><input type="text" class="attendance-cell-input attendance-cell-input--narrow" data-emp-id="${emp.id}" data-field="extra_payment_amount" value="${emp.extra_payment_amount || ''}" inputmode="decimal" /></td>`
      : `<td>${emp.extra_payment_amount ? formatMoney(emp.extra_payment_amount) : ''}</td>`;

    const notesInput = editable
      ? `<td><input type="text" class="attendance-cell-input" data-emp-id="${emp.id}" data-field="notes" value="${escapeHtml(emp.notes || '')}" /></td>`
      : `<td>${escapeHtml(emp.notes || '')}</td>`;

    return `<tr>
      <td>${escapeHtml(emp.employee_number_snapshot)}</td>
      <td style="white-space:nowrap;">${escapeHtml(emp.full_name_snapshot)}</td>
      <td>${escapeHtml(emp.position_snapshot || '')}</td>
      ${dayCells}
      ${projInput}
      ${extraInput}
      ${notesInput}
    </tr>`;
  }).join('');
}

function onAttendanceCellChange(select) {
  const bg = STATUS_COLORS[select.value] || '#fff';
  select.parentElement.style.background = bg;
}

function collectAttendanceEmployeeData() {
  const employees = [];
  if (!attendanceCurrentWeek || !attendanceCurrentWeek.employees) return employees;

  for (const emp of attendanceCurrentWeek.employees) {
    const row = { id: emp.id };
    const dayFields = ['monday_status', 'tuesday_status', 'wednesday_status', 'thursday_status', 'friday_status', 'saturday_status', 'sunday_status'];
    for (const field of dayFields) {
      const sel = document.querySelector(`select[data-emp-id="${emp.id}"][data-field="${field}"]`);
      row[field] = sel ? sel.value : emp[field];
    }
    const projInput = document.querySelector(`input[data-emp-id="${emp.id}"][data-field="project_location_text"]`);
    row.project_location_text = projInput ? projInput.value : emp.project_location_text;
    const extraInput = document.querySelector(`input[data-emp-id="${emp.id}"][data-field="extra_payment_amount"]`);
    row.extra_payment_amount = extraInput ? (extraInput.value || null) : emp.extra_payment_amount;
    const notesInput = document.querySelector(`input[data-emp-id="${emp.id}"][data-field="notes"]`);
    row.notes = notesInput ? notesInput.value : emp.notes;
    employees.push(row);
  }
  return employees;
}

const attendanceSaveBtn = document.getElementById('attendance-save-btn');
if (attendanceSaveBtn) {
  attendanceSaveBtn.addEventListener('click', async () => {
    if (!attendanceCurrentWeek) return;
    const msg = document.getElementById('attendance-edit-message');
    try {
      const employees = collectAttendanceEmployeeData();
      const result = await api(`/api/attendance/weeks/${attendanceCurrentWeek.id}`, {
        method: 'PUT',
        body: JSON.stringify({ employees }),
      });
      attendanceCurrentWeek = result;
      renderAttendanceEditPanel(result);
      if (msg) { msg.textContent = 'Guardado correctamente.'; msg.style.color = 'green'; }
    } catch (e) {
      if (msg) { msg.textContent = e.message || 'Error al guardar.'; msg.style.color = 'red'; }
    }
  });
}

const attendanceCloseBtn = document.getElementById('attendance-close-btn');
if (attendanceCloseBtn) {
  attendanceCloseBtn.addEventListener('click', async () => {
    if (!attendanceCurrentWeek) return;
    if (!window.confirm('¿Cerrar esta nómina? No se podrá editar hasta que se reabra.')) return;
    try {
      const result = await api(`/api/attendance/weeks/${attendanceCurrentWeek.id}/close`, { method: 'POST' });
      attendanceCurrentWeek = result;
      renderAttendanceEditPanel(result);
    } catch (e) {
      window.alert(e.message || 'Error al cerrar nómina.');
    }
  });
}

const attendanceReopenBtn = document.getElementById('attendance-reopen-btn');
if (attendanceReopenBtn) {
  attendanceReopenBtn.addEventListener('click', async () => {
    if (!attendanceCurrentWeek) return;
    if (!window.confirm('¿Reabrir nómina para edición?')) return;
    try {
      const result = await api(`/api/attendance/weeks/${attendanceCurrentWeek.id}/reopen`, { method: 'POST' });
      attendanceCurrentWeek = result;
      renderAttendanceEditPanel(result);
    } catch (e) {
      window.alert(e.message || 'Error al reabrir nómina.');
    }
  });
}

const attendancePrintBtn = document.getElementById('attendance-print-btn');
if (attendancePrintBtn) {
  attendancePrintBtn.addEventListener('click', () => {
    if (!attendanceCurrentWeek) return;
    window.open(`/attendance-print.html?id=${attendanceCurrentWeek.id}`, '_blank');
  });
}

const attendanceCancelBtn = document.getElementById('attendance-cancel-btn');
if (attendanceCancelBtn) {
  attendanceCancelBtn.addEventListener('click', () => {
    const modal = document.getElementById('attendance-cancel-modal');
    if (modal) modal.classList.remove('hidden');
  });
}

const attendanceCancelForm = document.getElementById('attendance-cancel-form');
if (attendanceCancelForm) {
  attendanceCancelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!attendanceCurrentWeek) return;
    const reason = attendanceCancelForm.elements.reason.value.trim();
    if (!reason) return;
    try {
      await api(`/api/attendance/weeks/${attendanceCurrentWeek.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      const modal = document.getElementById('attendance-cancel-modal');
      if (modal) modal.classList.add('hidden');
      attendanceCancelForm.reset();
      document.getElementById('attendance-edit-panel').classList.add('hidden');
      attendanceCurrentWeek = null;
      loadAttendanceWeeks();
    } catch (err) {
      window.alert(err.message || 'Error al cancelar.');
    }
  });
}

const attendanceBackBtn = document.getElementById('attendance-back-btn');
if (attendanceBackBtn) {
  attendanceBackBtn.addEventListener('click', () => {
    document.getElementById('attendance-edit-panel').classList.add('hidden');
    attendanceCurrentWeek = null;
    loadAttendanceWeeks(1);
  });
}

const attendanceNewBtn = document.getElementById('attendance-new-btn');
if (attendanceNewBtn) {
  attendanceNewBtn.addEventListener('click', () => {
    const modal = document.getElementById('attendance-new-modal');
    if (modal) modal.classList.remove('hidden');
    const yearInput = modal.querySelector('input[name="year"]');
    if (yearInput && !yearInput.value) yearInput.value = new Date().getFullYear();
  });
}

const attendanceNewForm = document.getElementById('attendance-new-form');
if (attendanceNewForm) {
  const weekInput = attendanceNewForm.querySelector('input[name="week_number"]');
  const yearInput = attendanceNewForm.querySelector('input[name="year"]');
  const preview = document.getElementById('attendance-week-preview');

  function updateWeekPreview() {
    if (!preview) return;
    const y = Number(yearInput.value);
    const w = Number(weekInput.value);
    if (y && w >= 1 && w <= 53) {
      try {
        const jan4 = new Date(Date.UTC(y, 0, 4));
        const jan4Dow = jan4.getUTCDay() || 7;
        const mon1 = new Date(jan4);
        mon1.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
        const target = new Date(mon1);
        target.setUTCDate(target.getUTCDate() + (w - 1) * 7);
        const sun = new Date(target);
        sun.setUTCDate(sun.getUTCDate() + 6);
        preview.textContent = `${target.toISOString().slice(0, 10)} al ${sun.toISOString().slice(0, 10)}`;
      } catch { preview.textContent = ''; }
    } else {
      preview.textContent = '';
    }
  }

  if (weekInput) weekInput.addEventListener('input', updateWeekPreview);
  if (yearInput) yearInput.addEventListener('input', updateWeekPreview);

  attendanceNewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('attendance-new-message');
    const year = Number(yearInput.value);
    const week_number = Number(weekInput.value);
    try {
      const result = await api('/api/attendance/weeks', {
        method: 'POST',
        body: JSON.stringify({ year, week_number }),
      });
      const modal = document.getElementById('attendance-new-modal');
      if (modal) modal.classList.add('hidden');
      attendanceNewForm.reset();
      if (msg) msg.textContent = '';
      if (preview) preview.textContent = '';
      await initAttendanceYearSelector();
      const yearSel = document.getElementById('attendance-filter-year');
      if (yearSel) yearSel.value = String(year);
      attendanceSelectedYear = year;
      await loadAttendanceWeeks(1);
      attendanceCurrentWeek = result;
      renderAttendanceEditPanel(result);
      const editPanel = document.getElementById('attendance-edit-panel');
      if (editPanel) editPanel.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      if (err.message && err.message.includes('Ya existe')) {
        if (msg) { msg.textContent = err.message; msg.style.color = 'orange'; }
        const yearSel = document.getElementById('attendance-filter-year');
        if (yearSel) yearSel.value = String(year);
        await loadAttendanceWeeks(1);
      } else {
        if (msg) { msg.textContent = err.message || 'Error al crear nómina.'; msg.style.color = 'red'; }
      }
    }
  });
}

const attendanceSearchBtn = document.getElementById('attendance-search-btn');
if (attendanceSearchBtn) {
  attendanceSearchBtn.addEventListener('click', () => loadAttendanceWeeks(1));
}

// ===================== END ATTENDANCE MODULE =====================

// ===================== SERVICE QUOTER MODULE =====================

function showServiceQuoterTab() {
  const sqTab = document.getElementById('service-quoter-tab');
  if (sqTab) {
    if (canAccess('serviceQuoter', 'view')) {
      sqTab.classList.remove('hidden');
    } else {
      sqTab.classList.add('hidden');
    }
  }
}

let sqConfig = null;
let sqInitialized = false;

async function initServiceQuoter() {
  if (sqInitialized) return;
  sqInitialized = true;

  try {
    const data = await api('/api/service-quoter/config');
    sqConfig = data;
    populateServiceQuoterDefaults(data);
  } catch (e) {
    console.error('Error loading service quoter config:', e);
  }

  const configBtn = document.getElementById('sq-config-btn');
  if (configBtn && canAccess('serviceQuoter', 'configure')) {
    configBtn.classList.remove('hidden');
    configBtn.addEventListener('click', openSqConfig);
  }

  document.getElementById('sq-calculate-btn').addEventListener('click', calculateServiceQuote);
  document.getElementById('sq-clear-btn').addEventListener('click', clearServiceQuote);

  const serviceTypeSelect = document.getElementById('sq-service-type');
  serviceTypeSelect.addEventListener('change', () => {
    const selected = sqConfig.serviceTypes.find((t) => t.id === Number(serviceTypeSelect.value));
    const marginDisplay = document.getElementById('sq-margin-display');
    marginDisplay.value = selected ? (selected.margin * 100).toFixed(0) + '%' : '';
  });

  document.getElementById('sq-transport-type').addEventListener('change', (e) => {
    document.getElementById('sq-transport-vehiculo').classList.toggle('hidden', e.target.value !== 'vehiculo');
    document.getElementById('sq-transport-aereo').classList.toggle('hidden', e.target.value !== 'aereo');
  });

  ['sq-prog-mode', 'sq-tech-mode', 'sq-helper-mode'].forEach((id) => {
    document.getElementById(id).addEventListener('change', (e) => {
      const prefix = id.replace('-mode', '');
      document.getElementById(prefix + '-input-label').textContent = e.target.value === 'dias' ? 'Días' : 'Horas';
    });
  });

  ['sq-prog-qty', 'sq-tech-qty', 'sq-helper-qty'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateTravelRate);
  });
}

function roundUpToNearestTen(value) {
  return Math.ceil(value / 10) * 10;
}

function updateTravelRate() {
  const num = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);
  const progQty = num('sq-prog-qty');
  const techQty = num('sq-tech-qty');
  const helperQty = num('sq-helper-qty');
  const progRate = num('sq-prog-rate');
  const techRate = num('sq-tech-rate');
  const helperRate = num('sq-helper-rate');

  const sumaTarifas = (progQty * progRate) + (techQty * techRate) + (helperQty * helperRate);
  const tarifaBase = sumaTarifas / 3;
  const tarifaTraslado = sumaTarifas > 0 ? roundUpToNearestTen(tarifaBase) : 0;
  document.getElementById('sq-travel-rate').value = '$' + tarifaTraslado;
}

function populateServiceQuoterDefaults(data) {
  const typeSelect = document.getElementById('sq-service-type');
  typeSelect.innerHTML = '<option value="">Seleccionar...</option>';
  for (const st of data.serviceTypes) {
    typeSelect.innerHTML += `<option value="${st.id}">${st.name} (${(st.margin * 100).toFixed(0)}%)</option>`;
  }

  const settingsMap = Object.fromEntries(data.settings.map((s) => [s.key, s.value]));

  const progRate = settingsMap['tarifa_programador_hora'] || '300';
  const techRate = settingsMap['tarifa_tecnico_hora'] || '250';
  const helperRate = settingsMap['tarifa_ayudante_hora'] || '175';
  const kmRate = settingsMap['costo_por_kilometro'] || '7.50';
  const hotelRate = settingsMap['hotel_default'] || '2500';
  const mealRate = settingsMap['costo_por_comida'] || settingsMap['comida_diaria_default'] || '150';
  const mealsPerDay = settingsMap['comidas_por_dia'] || '3';

  document.getElementById('sq-prog-rate').value = progRate;
  document.getElementById('sq-tech-rate').value = techRate;
  document.getElementById('sq-helper-rate').value = helperRate;
  document.getElementById('sq-km-rate').value = kmRate;
  document.getElementById('sq-hotel-rate').value = hotelRate;
  document.getElementById('sq-meal-rate').value = mealRate;
  document.getElementById('sq-meals-per-day').value = mealsPerDay;
  updateTravelRate();
}

function calculateServiceQuote() {
  const serviceTypeSelect = document.getElementById('sq-service-type');
  if (!serviceTypeSelect.value) { alert('Selecciona un tipo de servicio.'); return; }
  const selectedType = sqConfig.serviceTypes.find((t) => t.id === Number(serviceTypeSelect.value));
  if (!selectedType) return;
  const margin = selectedType.margin;

  const settingsMap = Object.fromEntries(sqConfig.settings.map((s) => [s.key, s.value]));
  const hoursPerDay = Number(settingsMap['horas_por_dia_servicio']) || 9;

  const num = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);
  const getHours = (prefix) => {
    const mode = document.getElementById(prefix + '-mode').value;
    const time = num(prefix + '-time');
    return mode === 'dias' ? time * hoursPerDay : time;
  };

  const progQty = num('sq-prog-qty');
  const progHours = getHours('sq-prog');
  const progRate = num('sq-prog-rate');
  const costoProgramador = progQty * progHours * progRate;

  const techQty = num('sq-tech-qty');
  const techHours = getHours('sq-tech');
  const techRate = num('sq-tech-rate');
  const costoTecnico = techQty * techHours * techRate;

  const helperQty = num('sq-helper-qty');
  const helperHours = getHours('sq-helper');
  const helperRate = num('sq-helper-rate');
  const costoAyudante = helperQty * helperHours * helperRate;

  const subtotalManoObra = costoProgramador + costoTecnico + costoAyudante;

  let subtotalTransporte = 0;
  let sumaTarifas = 0;
  let tarifaTrasladoHora = 0;
  let costoHorasTraslado = 0;
  let costoKm = 0;
  const transportType = document.getElementById('sq-transport-type').value;
  if (transportType === 'vehiculo') {
    sumaTarifas = (progQty * progRate) + (techQty * techRate) + (helperQty * helperRate);
    const tarifaBase = sumaTarifas / 3;
    tarifaTrasladoHora = sumaTarifas > 0 ? roundUpToNearestTen(tarifaBase) : 0;
    const travelHours = num('sq-travel-hours');
    const km = num('sq-km');
    const kmRate = num('sq-km-rate');
    costoHorasTraslado = travelHours * tarifaTrasladoHora;
    costoKm = km * kmRate;
    subtotalTransporte = costoHorasTraslado + costoKm;
  } else {
    const persons = num('sq-flight-persons');
    const costPerPerson = num('sq-flight-cost');
    const otherFlight = num('sq-flight-other');
    subtotalTransporte = (persons * costPerPerson) + otherFlight;
  }

  const hotelNights = num('sq-hotel-nights');
  const hotelRate = num('sq-hotel-rate');
  const mealDays = num('sq-meal-days');
  const mealCost = num('sq-meal-rate');
  const mealsPerDay = num('sq-meals-per-day');
  const totalPersonas = progQty + techQty + helperQty;
  const costoHotel = hotelNights * hotelRate;
  const costoComidas = mealCost * totalPersonas * mealDays * mealsPerDay;
  const subtotalViaticos = costoHotel + costoComidas;

  const otherCosts = num('sq-other-costs');
  const subtotalCostos = subtotalManoObra + subtotalTransporte + subtotalViaticos + otherCosts;

  if (subtotalCostos < 0) { alert('El subtotal de costos no puede ser negativo.'); return; }

  const precioAntesIVA = subtotalCostos / (1 - margin);
  const utilidadGenerada = precioAntesIVA - subtotalCostos;
  const ivaFinal = precioAntesIVA * 0.16;
  const totalFinal = precioAntesIVA + ivaFinal;

  const fmt = (v) => money.format(v);
  document.getElementById('sq-r-labor').textContent = fmt(subtotalManoObra);
  document.getElementById('sq-r-labor-prog').textContent = fmt(costoProgramador);
  document.getElementById('sq-r-labor-tech').textContent = fmt(costoTecnico);
  document.getElementById('sq-r-labor-helper').textContent = fmt(costoAyudante);
  document.getElementById('sq-r-transport').textContent = fmt(subtotalTransporte);
  document.getElementById('sq-r-t-sum').textContent = '$' + sumaTarifas;
  document.getElementById('sq-r-t-rate').textContent = '$' + Math.round(sumaTarifas / 3) + ' → $' + tarifaTrasladoHora;
  document.getElementById('sq-r-t-hours-cost').textContent = fmt(costoHorasTraslado);
  document.getElementById('sq-r-t-km-cost').textContent = fmt(costoKm);
  document.getElementById('sq-r-viaticos').textContent = fmt(subtotalViaticos);
  document.getElementById('sq-r-v-hotel').textContent = fmt(costoHotel);
  document.getElementById('sq-r-v-meals').textContent = fmt(costoComidas);
  document.getElementById('sq-r-v-meals-detail').textContent = `${totalPersonas} pers × $${mealCost} × ${mealDays}d × ${mealsPerDay}c`;
  document.getElementById('sq-r-other').textContent = fmt(otherCosts);
  document.getElementById('sq-r-subtotal').textContent = fmt(subtotalCostos);
  document.getElementById('sq-r-margin').textContent = (margin * 100).toFixed(0) + '%';
  document.getElementById('sq-r-profit').textContent = fmt(utilidadGenerada);
  document.getElementById('sq-r-price-no-iva').textContent = fmt(precioAntesIVA);
  document.getElementById('sq-r-iva').textContent = fmt(ivaFinal);
  document.getElementById('sq-r-total').textContent = fmt(totalFinal);
  document.getElementById('sq-results').classList.remove('hidden');
}

function clearServiceQuote() {
  document.getElementById('sq-client').value = '';
  document.getElementById('sq-reference').value = '';
  document.getElementById('sq-notes').value = '';
  document.getElementById('sq-service-type').value = '';
  document.getElementById('sq-margin-display').value = '';
  document.getElementById('sq-prog-qty').value = '0';
  document.getElementById('sq-prog-time').value = '0';
  document.getElementById('sq-prog-mode').value = 'horas';
  document.getElementById('sq-prog-input-label').textContent = 'Horas';
  document.getElementById('sq-tech-qty').value = '0';
  document.getElementById('sq-tech-time').value = '0';
  document.getElementById('sq-tech-mode').value = 'horas';
  document.getElementById('sq-tech-input-label').textContent = 'Horas';
  document.getElementById('sq-helper-qty').value = '0';
  document.getElementById('sq-helper-time').value = '0';
  document.getElementById('sq-helper-mode').value = 'horas';
  document.getElementById('sq-helper-input-label').textContent = 'Horas';
  document.getElementById('sq-transport-type').value = 'vehiculo';
  document.getElementById('sq-transport-vehiculo').classList.remove('hidden');
  document.getElementById('sq-transport-aereo').classList.add('hidden');
  document.getElementById('sq-travel-hours').value = '0';
  document.getElementById('sq-km').value = '0';
  document.getElementById('sq-flight-persons').value = '0';
  document.getElementById('sq-flight-cost').value = '0';
  document.getElementById('sq-flight-other').value = '0';
  document.getElementById('sq-flight-notes').value = '';
  document.getElementById('sq-hotel-nights').value = '0';
  document.getElementById('sq-meal-days').value = '0';
  document.getElementById('sq-other-costs').value = '0';
  document.getElementById('sq-other-costs-notes').value = '';
  document.getElementById('sq-results').classList.add('hidden');
  if (sqConfig) populateServiceQuoterDefaults(sqConfig);
}

async function openSqConfig() {
  const modal = document.getElementById('sq-config-modal');
  modal.classList.remove('hidden');
  document.getElementById('sq-config-password').value = '';
  document.getElementById('sq-config-message').textContent = '';

  try {
    const [types, settings] = await Promise.all([
      api('/api/service-quoter/service-types'),
      api('/api/service-quoter/settings'),
    ]);
    renderSqConfigTypes(types);
    renderSqConfigSettings(settings);
  } catch (e) {
    document.getElementById('sq-config-message').textContent = 'Error cargando configuración: ' + e.message;
  }

  document.getElementById('sq-config-close-btn').onclick = () => modal.classList.add('hidden');
  document.getElementById('sq-config-save-btn').onclick = saveSqConfig;
  document.getElementById('sq-add-type-btn').onclick = addSqServiceType;
}

function renderSqConfigTypes(types) {
  const tbody = document.querySelector('#sq-config-types-table tbody');
  tbody.innerHTML = '';
  for (const t of types) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${t.name}" data-id="${t.id}" data-field="name" style="width:100%;"></td>
      <td><input type="number" value="${t.margin}" data-id="${t.id}" data-field="margin" min="0" max="0.99" step="0.01" style="width:70px;"></td>
      <td><input type="checkbox" data-id="${t.id}" data-field="active" ${t.active ? 'checked' : ''}></td>
      <td><input type="number" value="${t.sort_order}" data-id="${t.id}" data-field="sort_order" min="0" style="width:50px;"></td>
      <td><button class="secondary sq-save-type-btn" data-id="${t.id}" type="button" style="font-size:0.75rem;padding:2px 6px;">Guardar</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.sq-save-type-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const row = btn.closest('tr');
      const name = row.querySelector('[data-field="name"]').value;
      const marginVal = Number(row.querySelector('[data-field="margin"]').value);
      const active = row.querySelector('[data-field="active"]').checked;
      const sort_order = Number(row.querySelector('[data-field="sort_order"]').value);
      const adminPassword = document.getElementById('sq-config-password').value;
      if (!adminPassword) { document.getElementById('sq-config-message').textContent = 'Ingresa contraseña de admin.'; return; }

      try {
        await api(`/api/service-quoter/service-types/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, margin: marginVal, active, sort_order, adminPassword }),
        });
        document.getElementById('sq-config-message').textContent = 'Tipo actualizado.';
        document.getElementById('sq-config-password').value = '';
        setTimeout(() => { document.getElementById('sq-config-message').textContent = ''; }, 2000);
        refreshSqConfig();
      } catch (e) {
        document.getElementById('sq-config-message').textContent = e.message || 'Error al actualizar.';
      }
    });
  });
}

function renderSqConfigSettings(settings) {
  const container = document.getElementById('sq-config-settings-form');
  container.innerHTML = '';
  for (const s of settings) {
    const label = document.createElement('label');
    label.style.fontSize = '0.85rem';
    label.innerHTML = `${s.label || s.key}<input type="text" data-key="${s.key}" value="${s.value}" style="margin-top:2px;">`;
    if (s.updated_by_name) {
      label.innerHTML += `<small style="color:var(--muted);">Mod: ${s.updated_by_name} - ${s.updated_at_cdmx || ''}</small>`;
    }
    container.appendChild(label);
  }
}

async function addSqServiceType() {
  const name = document.getElementById('sq-new-type-name').value.trim();
  const marginVal = Number(document.getElementById('sq-new-type-margin').value);
  const adminPassword = document.getElementById('sq-config-password').value;
  if (!name) { alert('Ingresa un nombre.'); return; }
  if (Number.isNaN(marginVal) || marginVal < 0 || marginVal >= 1) { alert('Margen entre 0 y 0.99.'); return; }
  if (!adminPassword) { document.getElementById('sq-config-message').textContent = 'Ingresa contraseña de admin.'; return; }

  try {
    await api('/api/service-quoter/service-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, margin: marginVal, sort_order: 99, adminPassword }),
    });
    document.getElementById('sq-new-type-name').value = '';
    document.getElementById('sq-new-type-margin').value = '';
    document.getElementById('sq-config-password').value = '';
    document.getElementById('sq-config-message').textContent = 'Tipo agregado.';
    setTimeout(() => { document.getElementById('sq-config-message').textContent = ''; }, 2000);
    refreshSqConfig();
    const types = await api('/api/service-quoter/service-types');
    renderSqConfigTypes(types);
  } catch (e) {
    document.getElementById('sq-config-message').textContent = e.message || 'Error al agregar.';
  }
}

async function saveSqConfig() {
  const inputs = document.querySelectorAll('#sq-config-settings-form input[data-key]');
  const settings = {};
  inputs.forEach((inp) => { settings[inp.dataset.key] = inp.value; });
  const adminPassword = document.getElementById('sq-config-password').value;
  if (!adminPassword) { document.getElementById('sq-config-message').textContent = 'Ingresa contraseña de admin.'; return; }

  try {
    await api('/api/service-quoter/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, adminPassword }),
    });
    document.getElementById('sq-config-message').textContent = 'Configuración guardada.';
    document.getElementById('sq-config-password').value = '';
    setTimeout(() => { document.getElementById('sq-config-message').textContent = ''; }, 2000);
    refreshSqConfig();
  } catch (e) {
    document.getElementById('sq-config-message').textContent = e.message || 'Error al guardar.';
  }
}

async function refreshSqConfig() {
  try {
    const data = await api('/api/service-quoter/config');
    sqConfig = data;
    populateServiceQuoterDefaults(data);
  } catch (e) { /* ignore */ }
}

// ===================== END SERVICE QUOTER MODULE =====================

// ===================== FINANCIAL STATEMENTS MODULE =====================

const financialTab = document.getElementById('financial-tab');
const kpisTabBtn = document.getElementById('kpis-tab');

function showFinancialTab() {
  if (state.userRole === 'admin' && financialTab) {
    financialTab.classList.remove('hidden');
  }
}

function showKpisTab() {
  if (state.userRole === 'admin' && kpisTabBtn) {
    kpisTabBtn.classList.remove('hidden');
  }
}

function switchFinSubtab(name) {
  const sections = ['statement', 'payable', 'receivable', 'bank', 'payroll', 'adjustments', 'archive', 'config'];
  sections.forEach((s) => {
    const section = document.getElementById('fin-' + s + '-section');
    const btn = document.getElementById('fin-subtab-' + s);
    if (section) section.classList.toggle('hidden', s !== name);
    if (btn) btn.classList.toggle('active', s === name);
  });
}

['statement', 'payable', 'receivable', 'bank', 'payroll', 'adjustments', 'archive', 'config'].forEach((tab) => {
  const btn = document.getElementById('fin-subtab-' + tab);
  if (btn) btn.addEventListener('click', () => { switchFinSubtab(tab); loadFinSection(tab); });
});

async function loadFinSection(section) {
  if (section === 'receivable') await loadFinReceivable();
  if (section === 'payable') await loadFinPayable();
  if (section === 'bank') await loadFinBank();
  if (section === 'payroll') await loadFinPayroll();
  if (section === 'adjustments') await loadFinAdjustments();
  if (section === 'archive') await loadFinArchive();
  if (section === 'config') await loadFinConfig();
}

function initFinYearSelector() {
  const sel = document.getElementById('fin-stmt-year');
  if (!sel) return;
  const currentYear = new Date().getFullYear();
  sel.innerHTML = '';
  for (let y = currentYear; y >= currentYear - 3; y--) {
    sel.innerHTML += `<option value="${y}">${y}</option>`;
  }
  const monthSel = document.getElementById('fin-stmt-month');
  if (monthSel) monthSel.value = String(new Date().getMonth() + 1);
}

async function generateFinStatement() {
  const year = document.getElementById('fin-stmt-year').value;
  const month = document.getElementById('fin-stmt-month').value;
  try {
    const result = await api('/api/financial/statements/generate', { method: 'POST', body: JSON.stringify({ year: Number(year), month: Number(month) }), headers: { 'Content-Type': 'application/json' } });
    renderFinStatement(result);
  } catch (e) {
    document.getElementById('fin-statement-result').innerHTML = `<p class="error">${escapeHtml(e.message || 'Error al generar')}</p>`;
  }
}

function renderFinStatement(s) {
  const container = document.getElementById('fin-statement-result');
  const warn = s.unclassified_movements_count > 0 ? `<p class="text-muted" style="color:orange;">⚠ ${s.unclassified_movements_count} movimientos bancarios sin clasificar</p>` : '';
  container.innerHTML = `
    ${warn}
    <table class="data-table">
      <tbody>
        <tr><th colspan="2" style="text-align:left;background:#f0f0f0">VENTAS NETAS</th></tr>
        <tr><td>Ingresos de proyectos</td><td style="text-align:right">${money.format(s.revenue_net_mxn)}</td></tr>
        <tr><th colspan="2" style="text-align:left;background:#f0f0f0">COSTO DE VENTAS</th></tr>
        <tr><td>Costos directos</td><td style="text-align:right">${money.format(s.cost_of_sales_mxn)}</td></tr>
        <tr style="font-weight:bold"><td>UTILIDAD BRUTA</td><td style="text-align:right">${money.format(s.gross_profit_mxn)}</td></tr>
        <tr><th colspan="2" style="text-align:left;background:#f0f0f0">GASTOS DE OPERACIÓN</th></tr>
        <tr><td>Gastos operativos</td><td style="text-align:right">${money.format(s.operating_expenses_mxn)}</td></tr>
        <tr style="font-weight:bold"><td>UTILIDAD NETA ADMINISTRATIVA</td><td style="text-align:right">${money.format(s.net_administrative_profit_mxn)}</td></tr>
        <tr><td>ISR Estimado Administrativo (10%)</td><td style="text-align:right">${money.format(s.estimated_isr_mxn)}</td></tr>
        <tr><td>Utilidad después de ISR estimado</td><td style="text-align:right">${money.format(s.profit_after_isr_mxn)}</td></tr>
        <tr><td>Comisión IVAN 10%</td><td style="text-align:right">${money.format(s.ivan_commission_mxn)}</td></tr>
        <tr style="font-weight:bold;background:#e8f5e9"><td>UTILIDAD REAL ADMINISTRATIVA</td><td style="text-align:right">${money.format(s.real_administrative_profit_mxn)}</td></tr>
        <tr><td colspan="2" style="height:10px"></td></tr>
        <tr><td>Cuentas por cobrar</td><td style="text-align:right">${money.format(s.accounts_receivable_mxn)}</td></tr>
        <tr><td>Cuentas por pagar</td><td style="text-align:right">${money.format(s.accounts_payable_mxn)}</td></tr>
        <tr><td>Saldo bancario final</td><td style="text-align:right">${money.format(s.bank_final_balance_mxn)}</td></tr>
      </tbody>
    </table>
    <p class="text-muted" style="font-size:0.8rem;margin-top:0.5rem">Estado: ${escapeHtml(s.status || 'borrador')} | Todos los montos en MXN</p>
  `;
}

async function loadFinPayable() {
  try {
    const result = await api('/api/financial/accounts-payable');
    const container = document.getElementById('fin-ap-list');
    if (!result.data || result.data.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay cuentas por pagar registradas.</p>';
      return;
    }
    let html = '<table class="data-table"><thead><tr><th>Proveedor</th><th>Factura</th><th>Fecha</th><th>Monto</th><th>Moneda</th><th>MXN</th><th>Categoría</th><th>Estado</th></tr></thead><tbody>';
    result.data.forEach((ap) => {
      html += `<tr><td>${escapeHtml(ap.supplier_name)}</td><td>${escapeHtml(ap.invoice_number)}</td><td>${escapeHtml(ap.invoice_date)}</td><td>${money.format(ap.amount_original)}</td><td>${escapeHtml(ap.currency)}</td><td>${money.format(ap.amount_mxn)}</td><td>${escapeHtml(ap.category)}</td><td><span class="badge">${escapeHtml(ap.status)}</span></td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

async function loadFinReceivable() {
  try {
    const result = await api('/api/financial/accounts-receivable');
    const container = document.getElementById('fin-ar-list');
    let html = '<div class="ecovis-cards">';
    html += `<div class="ecovis-card"><div class="ecovis-card-label">Total CxC</div><div class="ecovis-card-value">${money.format(result.summary.total_mxn)}</div></div>`;
    html += `<div class="ecovis-card" style="border-left:3px solid #4caf50"><div class="ecovis-card-label">No vencido</div><div class="ecovis-card-value">${money.format(result.summary.not_overdue || 0)}</div></div>`;
    html += `<div class="ecovis-card" style="border-left:3px solid #f44336"><div class="ecovis-card-label">Vencido</div><div class="ecovis-card-value">${money.format(result.summary.overdue || 0)}</div></div>`;
    html += `<div class="ecovis-card"><div class="ecovis-card-label">1-30 días</div><div class="ecovis-card-value">${money.format(result.summary.d1_30)}</div></div>`;
    html += `<div class="ecovis-card"><div class="ecovis-card-label">31-60 días</div><div class="ecovis-card-value">${money.format(result.summary.d31_60)}</div></div>`;
    html += `<div class="ecovis-card"><div class="ecovis-card-label">61-90 días</div><div class="ecovis-card-value">${money.format(result.summary.d61_90)}</div></div>`;
    html += `<div class="ecovis-card"><div class="ecovis-card-label">>90 días</div><div class="ecovis-card-value">${money.format(result.summary.d90plus)}</div></div>`;
    html += '</div>';
    if (result.data.length > 0) {
      html += '<table class="data-table"><thead><tr><th>Cliente</th><th>Proyecto</th><th>Facturado</th><th>Cobrado</th><th>Pendiente MXN</th><th>Días crédito</th><th>Vencimiento</th><th>Días vencido</th><th>Estado</th></tr></thead><tbody>';
      result.data.forEach((ar) => {
        const colorStyle = ar.status_color === 'red' ? 'color:#f44336;font-weight:bold' : ar.status_color === 'green' ? 'color:#4caf50' : 'color:#9e9e9e';
        const dot = ar.status_color === 'red' ? '🔴' : ar.status_color === 'green' ? '🟢' : '⚪';
        const dueDisplay = ar.due_date || (ar.credit_days_na || ar.invoice_date_na ? 'N/A' : '-');
        html += `<tr><td>${escapeHtml(ar.client_name || '')}</td><td>${escapeHtml(ar.project_description || '')}</td><td>${money.format(ar.total_invoiced)} ${escapeHtml(ar.total_invoiced_currency)}</td><td>${money.format(ar.total_charged_mxn)}</td><td style="${colorStyle}">${money.format(ar.pending_mxn)}</td><td>${ar.credit_days != null ? ar.credit_days : 'N/A'}</td><td>${escapeHtml(dueDisplay)}</td><td>${ar.days_overdue || 0}</td><td>${dot}</td></tr>`;
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="empty-message">No hay cuentas por cobrar pendientes.</p>';
    }
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

async function loadFinBank() {
  try {
    const result = await api('/api/financial/bank-summaries');
    const container = document.getElementById('fin-bank-list');
    if (!result.data || result.data.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay estados de cuenta registrados.</p>';
      return;
    }
    let html = '<table class="data-table"><thead><tr><th>Banco</th><th>Cuenta</th><th>Moneda</th><th>Mes</th><th>Saldo Inicial</th><th>Depósitos</th><th>Retiros</th><th>Saldo Final</th></tr></thead><tbody>';
    result.data.forEach((b) => {
      html += `<tr><td>${escapeHtml(b.bank_name)}</td><td>${escapeHtml(b.account_number_masked || '')}</td><td>${escapeHtml(b.currency)}</td><td>${b.year}-${String(b.month).padStart(2,'0')}</td><td>${money.format(b.initial_balance_mxn)}</td><td>${money.format(b.deposits_mxn)}</td><td>${money.format(b.withdrawals_mxn)}</td><td>${money.format(b.final_balance_mxn)}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

async function loadFinPayroll() {
  try {
    const result = await api('/api/financial/payroll?year=' + new Date().getFullYear());
    const container = document.getElementById('fin-payroll-list');
    if (!result.data || result.data.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay registros de nómina manual.</p>';
      return;
    }
    let html = `<p><strong>Total MXN: ${money.format(result.total_mxn)}</strong></p>`;
    html += '<table class="data-table"><thead><tr><th>Mes</th><th>Concepto</th><th>Monto</th><th>Moneda</th><th>MXN</th></tr></thead><tbody>';
    result.data.forEach((p) => {
      html += `<tr><td>${p.year}-${String(p.month).padStart(2,'0')}</td><td>${escapeHtml(p.concept)}</td><td>${money.format(p.amount_original)}</td><td>${escapeHtml(p.currency)}</td><td>${money.format(p.amount_mxn)}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

async function loadFinAdjustments() {
  try {
    const result = await api('/api/financial/adjustments?year=' + new Date().getFullYear());
    const container = document.getElementById('fin-adj-list');
    if (!result.data || result.data.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay ajustes registrados.</p>';
      return;
    }
    let html = '<table class="data-table"><thead><tr><th>Mes</th><th>Tipo</th><th>Concepto</th><th>Monto MXN</th><th>Estado</th></tr></thead><tbody>';
    result.data.forEach((a) => {
      html += `<tr><td>${a.year}-${String(a.month).padStart(2,'0')}</td><td>${escapeHtml(a.adjustment_type)}</td><td>${escapeHtml(a.concept)}</td><td>${money.format(a.amount_mxn)}</td><td><span class="badge">${escapeHtml(a.status)}</span></td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

async function loadFinArchive() {
  try {
    const { data } = await api('/api/financial/statements');
    const container = document.getElementById('fin-archive-list');
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-message">No hay estados financieros generados.</p>';
      return;
    }
    let html = '<table class="data-table"><thead><tr><th>Periodo</th><th>Ventas</th><th>Costo</th><th>Utilidad Bruta</th><th>Gastos Op.</th><th>Utilidad Neta</th><th>ISR Est.</th><th>Com. IVAN</th><th>Utilidad Real</th><th>Estado</th></tr></thead><tbody>';
    data.forEach((s) => {
      html += `<tr><td>${s.year}-${String(s.month).padStart(2,'0')}</td><td>${money.format(s.revenue_net_mxn)}</td><td>${money.format(s.cost_of_sales_mxn)}</td><td>${money.format(s.gross_profit_mxn)}</td><td>${money.format(s.operating_expenses_mxn)}</td><td>${money.format(s.net_administrative_profit_mxn)}</td><td>${money.format(s.estimated_isr_mxn)}</td><td>${money.format(s.ivan_commission_mxn)}</td><td>${money.format(s.real_administrative_profit_mxn)}</td><td><span class="badge">${escapeHtml(s.status)}</span></td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

async function loadFinConfig() {
  try {
    const settings = await api('/api/financial/settings');
    const form = document.getElementById('fin-config-form');
    form.elements.estimated_isr_rate.value = Math.round(settings.estimated_isr_rate * 100);
    form.elements.ivan_commission_rate.value = Math.round(settings.ivan_commission_rate * 100);
  } catch (e) { console.error(e); }
}

if (financialTab) {
  financialTab.addEventListener('click', async () => {
    if (state.userRole !== 'admin') {
      window.alert('Acceso restringido. Solo el administrador puede consultar Estados Financieros.');
      return;
    }
    // Check re-auth status
    try {
      const status = await api('/api/financial/reauth-status');
      if (status.authenticated) {
        switchView('financial');
        switchFinSubtab('statement');
        initFinYearSelector();
        return;
      }
    } catch (e) { /* need reauth */ }
    // Show re-auth modal
    const modal = document.getElementById('fin-reauth-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = document.getElementById('fin-reauth-password');
      if (input) { input.value = ''; input.focus(); }
    }
  });
}

if (document.getElementById('fin-reauth-form')) {
  document.getElementById('fin-reauth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('fin-reauth-password');
    const msg = document.getElementById('fin-reauth-message');
    const password = input.value;
    if (!password) { msg.textContent = 'Ingresa tu contraseña.'; return; }
    try {
      await api('/api/financial/admin-reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      input.value = '';
      msg.textContent = '';
      document.getElementById('fin-reauth-modal').classList.add('hidden');
      switchView('financial');
      switchFinSubtab('statement');
      initFinYearSelector();
    } catch (err) {
      msg.textContent = err.message || 'Contrasena incorrecta o acceso no autorizado.';
      msg.style.color = 'red';
      input.value = '';
    }
  });
}

if (document.getElementById('fin-reauth-cancel')) {
  document.getElementById('fin-reauth-cancel').addEventListener('click', () => {
    document.getElementById('fin-reauth-modal').classList.add('hidden');
    document.getElementById('fin-reauth-password').value = '';
  });
}

if (document.getElementById('fin-generate-btn')) {
  document.getElementById('fin-generate-btn').addEventListener('click', generateFinStatement);
}

if (document.getElementById('fin-config-form')) {
  document.getElementById('fin-config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = document.getElementById('fin-config-message');
    try {
      const result = await api('/api/financial/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimated_isr_rate: Number(form.elements.estimated_isr_rate.value) / 100,
          ivan_commission_rate: Number(form.elements.ivan_commission_rate.value) / 100,
          admin_password: form.elements.admin_password.value,
        }),
      });
      msg.textContent = 'Configuración guardada.';
      msg.style.color = 'green';
      form.elements.admin_password.value = '';
    } catch (err) {
      msg.textContent = err.message || 'Error al guardar.';
      msg.style.color = 'red';
    }
  });
}

// ===================== END FINANCIAL STATEMENTS MODULE =====================

// ===================== END NEW MODULES =====================

// ===================== MOBILE FORM UX =====================
function initMobileFormScrollIntoView() {
  document.addEventListener('focusin', (event) => {
    const el = event.target;
    if (!el?.matches) return;
    if (!el.matches('input, select, textarea, button')) return;
    if (el.type === 'hidden' || el.disabled || el.closest('[aria-hidden="true"]')) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
  }, { passive: true });
}
initMobileFormScrollIntoView();

api('/api/session')
  .then((session) => {
    if (session.authenticated) {
      state.userRole = session.user.role || 'user';
      userPermissions = session.permissions || {};
      showVacationsTab();
      showAttendanceTab();
      showEcovisTab();
      showServiceQuoterTab();
      showFinancialTab();
      showApp();
    } else {
      showLogin();
    }
  })
  .catch(showLogin);

// ===================== THEME SELECTOR =====================
(function() {
  var themeSelector = document.getElementById('theme-selector');
  if (themeSelector) {
    themeSelector.addEventListener('change', function() { changeTheme(themeSelector.value); });
  }
})();

// ===================== COMMISSIONS MODULE =====================
var commissionsTab = document.getElementById('commissions-tab');
var commissionsView = document.getElementById('commissions-view');
var commissionActiveEmployees = [];
var commissionProjectsById = {};
var commissionAssignProjectSale = 0;

function formatCommissionMargin(row) {
  if (row.final_margin != null && row.final_margin !== undefined) return formatPercentDecimal(row.final_margin);
  if (row.final_margin_percent != null && row.final_margin_percent !== undefined) return row.final_margin_percent + '%';
  if (row.margin != null && row.margin !== undefined) return row.margin + '%';
  return 'Sin facturar';
}

function switchCommissionsSubtab(name) {
  var sections = ['agents', 'projects', 'pending', 'history'];
  sections.forEach(function(s) {
    var section = document.getElementById('commissions-' + s + '-section');
    var btn = document.getElementById('commissions-subtab-' + s);
    if (section) section.classList.toggle('hidden', s !== name);
    if (btn) btn.classList.toggle('active', s === name);
  });
}

function attachCommissionModalClose(modal) {
  if (!modal || modal.dataset.boundClose) return;
  modal.dataset.boundClose = '1';
  modal.addEventListener('mousedown', function(event) {
    if (event.target === modal) modal.dataset.backdropDown = '1';
  });
  modal.addEventListener('click', function(event) {
    if (event.target.closest('.modal-close') || (event.target === modal && modal.dataset.backdropDown === '1')) {
      modal.classList.add('hidden');
    }
    delete modal.dataset.backdropDown;
  });
  var content = modal.querySelector('.modal-content');
  if (content) {
    content.addEventListener('mousedown', function(event) {
      event.stopPropagation();
      delete modal.dataset.backdropDown;
    });
  }
}

if (commissionsTab) {
  commissionsTab.addEventListener('click', async function() {
    switchView('commissions');
    switchCommissionsSubtab('agents');
    await loadCommissions();
  });
}

['agents', 'projects', 'pending', 'history'].forEach(function(tab) {
  var btn = document.getElementById('commissions-subtab-' + tab);
  if (btn) btn.addEventListener('click', function() {
    switchCommissionsSubtab(tab);
    if (tab === 'projects') loadAvailableProjectsOnly();
  });
});

function populateCommissionsYearFilter() {
  var sel = document.getElementById('commissions-filter-year');
  if (!sel || sel.dataset.populated) return;
  var y = new Date().getFullYear();
  var html = '<option value="">Todos</option>';
  for (var i = y; i >= y - 5; i--) html += '<option value="' + i + '">' + i + '</option>';
  sel.innerHTML = html;
  sel.dataset.populated = '1';
}

function getCommissionsPeriodQuery() {
  var yearSel = document.getElementById('commissions-filter-year');
  var monthSel = document.getElementById('commissions-filter-month');
  if (!yearSel || !monthSel) return '';
  var year = yearSel.value;
  var month = monthSel.value;
  if (!year || !month) return '';
  return '?year=' + encodeURIComponent(year) + '&month=' + encodeURIComponent(month);
}

async function loadAvailableProjectsOnly() {
  var statusEl = document.getElementById('commissions-available-status');
  var errEl = document.getElementById('commissions-available-error');
  if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
  if (statusEl) statusEl.textContent = 'Cargando proyectos...';
  try {
    var available = await api('/api/commissions/available-projects');
    renderAvailableProjects(available);
    if (statusEl) statusEl.textContent = available.length + ' proyecto(s) disponibles para asignar comision.';
  } catch (e) {
    console.error('Error loading available projects:', e);
    if (errEl) { errEl.textContent = e.message || 'No se pudieron cargar los proyectos.'; errEl.classList.remove('hidden'); }
    if (statusEl) statusEl.textContent = '';
    renderAvailableProjects([]);
  }
}

async function loadCommissions() {
  if (!commissionsView) return;
  populateCommissionsYearFilter();
  var summaryError = null;
  try {
    commissionActiveEmployees = await api('/api/commissions/active-employees');
    populateAssignModalEmployees();
  } catch (e) {
    console.error('Error loading active employees:', e);
    commissionActiveEmployees = [];
  }
  try {
    var agents = await api('/api/commissions/agents');
    var commissions = await api('/api/commissions');
    var payments = await api('/api/commissions/payments');
    renderCommissionsTable(commissions);
    renderCommissionPayments(payments);
    populateCommissionEmployeeSelect(agents);
    populateAgentSelects(agents, commissionActiveEmployees);
    try {
      var summary = await api('/api/commissions/summary' + getCommissionsPeriodQuery());
      renderCommissionsSummary(summary);
      renderCommissionsPeriodTotals(summary);
      renderCommissionsMonthlySeries(summary.monthly_series, summary.period);
      renderAgentsWithProjects(summary.agents_with_projects);
      renderAgentsTable(agents, summary);
    } catch (e) {
      summaryError = e;
      console.error('Error loading commissions summary:', e);
      renderAgentsTable(agents, null);
    }
  } catch (e) {
    console.error('Error loading commissions:', e);
    window.alert(e.message || 'Error al cargar comisiones.');
  }
  await loadAvailableProjectsOnly();
  if (summaryError) {
    window.alert(summaryError.message || 'No se pudo cargar el resumen de comisiones. Los empleados activos y proyectos siguen disponibles si el servidor esta actualizado.');
  }
}

function renderCommissionsSummary(summary) {
  var el = document.getElementById('commissions-summary-cards');
  var hint = document.getElementById('commissions-summary-hint');
  if (!el) return;
  var pending = summary.pending_balance_mxn != null ? summary.pending_balance_mxn : (summary.totals && summary.totals.commissions_pending_mxn);
  el.innerHTML =
    '<div class="stat-card" title="Suma de comisiones en estado pendiente, por pagar a vendedoras"><strong>' + money.format(pending) + '</strong><small>Comisiones pendientes de pago</small></div>' +
    '<div class="stat-card" title="Proyectos que aun no tienen comision asignada"><strong>' + summary.pending_projects + '</strong><small>Proyectos sin comision</small></div>' +
    '<div class="stat-card" title="Vendedoras registradas y activas"><strong>' + summary.active_agents + '</strong><small>Vendedoras activas</small></div>' +
    '<div class="stat-card" title="Vendedoras con al menos una comision pendiente"><strong>' + ((summary.agents_with_projects || []).length) + '</strong><small>Vendedoras con pendientes</small></div>';
  if (hint) {
    hint.textContent = 'Resumen global. En la pestana 1 puede filtrar por mes (ej. Mayo) para ver vendido y comisiones de ese periodo.';
  }
}

function renderCommissionsPeriodTotals(summary) {
  var el = document.getElementById('commissions-period-totals');
  if (!el || !summary.totals) return;
  var t = summary.totals;
  el.innerHTML =
    '<div class="stat-card"><strong>' + escapeHtml(t.period_label) + '</strong><small>Periodo consultado</small></div>' +
    '<div class="stat-card"><strong>' + money.format(t.sold_mxn) + '</strong><small>Total vendido (facturado en comisiones)</small></div>' +
    '<div class="stat-card"><strong>' + money.format(t.commissions_generated_mxn) + '</strong><small>Comisiones generadas</small></div>' +
    '<div class="stat-card"><strong>' + money.format(t.commissions_paid_mxn) + '</strong><small>Comisiones pagadas</small></div>' +
    '<div class="stat-card"><strong>' + money.format(t.commissions_pending_mxn) + '</strong><small>Pendientes de pago (actual)</small></div>';
}

function renderCommissionsMonthlySeries(series, period) {
  var el = document.getElementById('commissions-monthly-table');
  if (!el) return;
  var rows = series || [];
  if (!rows.length) {
    el.innerHTML = '<tr><td colspan="4" class="muted">Sin datos por mes.</td></tr>';
    return;
  }
  el.innerHTML = rows.map(function(row) {
    var highlight = period && period.filtered && period.year === row.year && period.month === row.month ? ' style="font-weight:600;background:var(--surface-alt,#f0f6ff);"' : '';
    return '<tr' + highlight + '><td>' + escapeHtml(row.month_label) + '</td><td>' + money.format(row.sold_mxn) + '</td><td>' + money.format(row.commissions_generated_mxn) + '</td><td>' + money.format(row.commissions_paid_mxn) + '</td></tr>';
  }).join('');
}

function renderAgentsWithProjects(agentsWithProjects) {
  var el = document.getElementById('commissions-agents-projects');
  if (!el) return;
  var list = agentsWithProjects || [];
  if (!list.length) {
    el.innerHTML = '<p class="muted">No hay vendedoras con comisiones pendientes de pago.</p>';
    return;
  }
  el.innerHTML = list.map(function(agent) {
    var projectRows = (agent.assigned_projects || []).map(function(p) {
      return '<tr><td>' + escapeHtml(p.quote_number) + '</td><td>' + escapeHtml(p.client_name) + '</td><td>' + escapeHtml(p.order_number) + '</td><td>' + money.format(p.sold_mxn) + '</td><td>' + escapeHtml(p.commission_base_label) + '</td><td>' + money.format(p.commission_mxn) + '</td><td>' + escapeHtml(p.assigned_at || '') + '</td></tr>';
    }).join('');
    return '<div class="panel" style="margin-bottom:12px;padding:12px;border:1px solid var(--border,#dde3ee);border-radius:8px;">' +
      '<p style="margin:0 0 8px;"><strong>' + escapeHtml(agent.name) + '</strong>' +
      (agent.employee_name ? ' <span class="muted">(' + escapeHtml(agent.employee_name) + ')</span>' : '') +
      ' — Pendiente: <strong>' + money.format(agent.pending_commissions_mxn) + '</strong> (' + agent.pending_commissions_count + ' comision/es)</p>' +
      '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Cotizacion</th><th>Cliente</th><th>Pedido</th><th>Vendido</th><th>Base</th><th>Comision</th><th>Asignada</th></tr></thead><tbody>' +
      projectRows + '</tbody></table></div></div>';
  }).join('');
}

function renderAgentsTable(agents, summary) {
  var el = document.getElementById('agents-table');
  if (!el) return;
  var agentMap = {};
  if (summary && summary.agents) summary.agents.forEach(function(a) { agentMap[a.id] = a; });
  el.innerHTML = agents.map(function(a) {
    var s = agentMap[a.id] || { pending_mxn: 0, paid_mxn: 0 };
    var empLabel = a.employee_name ? escapeHtml(a.employee_name) : '—';
    return '<tr><td>' + escapeHtml(a.name) + '</td><td>' + empLabel + '</td><td>' + (a.active ? 'Si' : 'No') + '</td><td>' + money.format(s.pending_mxn) + '</td><td>' + money.format(s.paid_mxn) + '</td><td><button class="secondary" onclick="toggleAgent(' + a.id + ',' + (a.active ? 0 : 1) + ')">' + (a.active ? 'Desactivar' : 'Activar') + '</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">Sin vendedoras.</td></tr>';
}

function renderAvailableProjects(projects) {
  var el = document.getElementById('available-projects-table');
  if (!el) return;
  commissionProjectsById = {};
  (projects || []).forEach(function(p) { commissionProjectsById[p.id] = p; });
  el.innerHTML = projects.map(function(p) {
    return '<tr><td>' + escapeHtml(p.quote_number) + '</td><td>' + escapeHtml(p.client_name) + '</td><td>' + escapeHtml(p.order_number || '—') + '</td><td>' + money.format(p.total_sale_mxn) + '</td><td>' + formatCommissionMargin(p) + '</td><td><button type="button" class="secondary" onclick="openAssignCommissionModal(' + p.id + ')">Asignar comision</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">No hay proyectos disponibles para comision.</td></tr>';
}

function renderCommissionsTable(commissions) {
  var el = document.getElementById('commissions-table');
  if (!el) return;
  el.innerHTML = commissions.map(function(c) {
    var tipo = c.commission_type === 'extraordinaria' ? 'Extraordinaria' : 'Proyecto';
    var marginCell = c.commission_type === 'extraordinaria' ? '—' : formatCommissionMargin(c);
    return '<tr><td>' + escapeHtml(c.display_quote || c.quote_number || '—') + '</td><td>' + escapeHtml(c.display_client || c.client_name || '—') + '</td><td>' + escapeHtml(c.agent_name) + '</td><td>' + escapeHtml(c.commission_base_label || '') + '</td><td>' + money.format(c.commission_amount_mxn) + '</td><td>' + marginCell + '</td><td>' + tipo + '</td><td><button type="button" class="secondary" onclick="openPayCommissionModal(' + c.id + ')">Registrar pago</button></td></tr>';
  }).join('') || '<tr><td colspan="8" class="muted">Sin comisiones en espera de pago.</td></tr>';
}

function renderArchivedCommissions(commissions) {
  var el = document.getElementById('commissions-archived-table');
  if (!el) return;
  el.innerHTML = commissions.map(function(c) {
    return '<tr><td>' + escapeHtml(c.display_quote || c.quote_number || '—') + '</td><td>' + escapeHtml(c.display_client || c.client_name || '—') + '</td><td>' + escapeHtml(c.agent_name) + '</td><td>' + escapeHtml(c.commission_base_label || '') + '</td><td>' + money.format(c.commission_amount_mxn) + '</td><td>' + (c.paid_at || c.updated_at || c.assigned_at || '') + '</td><td>' + escapeHtml(c.reference || '') + '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="muted">Sin resultados. Use los filtros para consultar el historico.</td></tr>';
}

function renderCommissionPayments(payments) {
  var el = document.getElementById('commission-payments-table');
  if (!el) return;
  el.innerHTML = payments.map(function(p) {
    return '<tr><td>' + escapeHtml(p.agent_name || '') + '</td><td>' + escapeHtml(p.quote_number || (p.commission_type === 'extraordinaria' ? 'Extraordinaria' : '—')) + '</td><td>' + p.payment_date + '</td><td>' + money.format(p.amount_mxn) + '</td><td>' + p.currency + '</td><td>' + escapeHtml(p.reference || '') + '</td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">Sin pagos registrados.</td></tr>';
}

function populateCommissionEmployeeSelect(agents) {
  var sel = document.getElementById('agent-employee-select');
  if (!sel) return;
  var registeredIds = {};
  (agents || []).forEach(function(a) { if (a.employee_id) registeredIds[a.employee_id] = true; });
  var options = (commissionActiveEmployees || [])
    .filter(function(e) { return !registeredIds[e.id]; })
    .map(function(e) {
      return '<option value="' + e.id + '">' + escapeHtml(e.full_name) + (e.employee_number ? ' (' + escapeHtml(e.employee_number) + ')' : '') + '</option>';
    }).join('');
  sel.innerHTML = '<option value="">Empleado (Vacaciones activos)...</option>' + options;
}

function populateAgentSelects(agents, activeEmployees) {
  var active = agents.filter(function(a) { return a.active; });
  window._commissionActiveAgents = active;
  window._commissionActiveEmployees = activeEmployees || commissionActiveEmployees || [];
  populateAssignModalEmployees();
  var extraSel = document.querySelector('#commission-extraordinary-form select[name="employee_id"]');
  if (extraSel) {
    extraSel.innerHTML = buildVacationEmployeeOptions(window._commissionActiveEmployees);
  }
}

function buildVacationEmployeeOptions(employees) {
  return '<option value="">Empleado activo (Vacaciones)...</option>' + (employees || []).map(function(e) {
    return '<option value="' + e.id + '">' + escapeHtml(e.full_name) +
      (e.employee_number ? ' (' + escapeHtml(e.employee_number) + ')' : '') + '</option>';
  }).join('');
}

function populateAssignModalEmployees() {
  var sel = document.querySelector('#commission-assign-form select[name="employee_id"]');
  if (!sel) return;
  sel.innerHTML = buildVacationEmployeeOptions(commissionActiveEmployees);
}

function updateCommissionAssignPreview() {
  var form = document.getElementById('commission-assign-form');
  var preview = document.getElementById('commission-assign-preview');
  if (!form || !preview) return;
  var baseType = form.elements.commission_calculation_base_type.value;
  var manualWrap = document.getElementById('commission-assign-manual-wrap');
  if (manualWrap) manualWrap.classList.toggle('hidden', baseType !== 'monto_manual');
  var sale = commissionAssignProjectSale || 0;
  var amount = 0;
  if (baseType === 'facturado_1pct') amount = Math.round(sale * 0.01 * 100) / 100;
  else if (baseType === 'facturado_3pct') amount = Math.round(sale * 0.03 * 100) / 100;
  else if (baseType === 'monto_manual') amount = Number(form.elements.commission_amount_mxn.value) || 0;
  preview.textContent = amount > 0 ? money.format(amount) : '—';
}

function openAssignCommissionModal(projectId) {
  var p = commissionProjectsById[projectId];
  if (!p) return;
  var employees = commissionActiveEmployees || [];
  if (!employees.length) {
    window.alert('No hay empleados activos en Vacaciones para asignar comisiones.');
    return;
  }
  var modal = document.getElementById('commission-assign-modal');
  var form = document.getElementById('commission-assign-form');
  if (!modal || !form) return;
  commissionAssignProjectSale = Number(p.total_sale_mxn) || 0;
  form.reset();
  form.elements.project_id.value = projectId;
  document.getElementById('commission-assign-project-summary').textContent =
    'Cotizacion ' + p.quote_number + ' · Cliente ' + p.client_name + ' · Facturado ' + money.format(p.total_sale_mxn) + ' · Utilidad real ' + formatCommissionMargin(p);
  populateAssignModalEmployees();
  form.elements.commission_calculation_base_type.value = 'facturado_1pct';
  updateCommissionAssignPreview();
  document.getElementById('commission-assign-message').textContent = '';
  modal.classList.remove('hidden');
  switchCommissionsSubtab('projects');
}

function openPayCommissionModal(commissionId) {
  var modal = document.getElementById('commission-pay-modal');
  var form = document.getElementById('commission-pay-form');
  if (!modal || !form) return;
  api('/api/commissions').then(function(rows) {
    var c = rows.find(function(x) { return x.id === commissionId; });
    if (!c) { window.alert('Comision no encontrada.'); return; }
    form.reset();
    form.elements.commission_id.value = commissionId;
    form.elements.payment_date.value = new Date().toISOString().slice(0, 10);
    form.elements.amount_original.value = c.commission_amount_mxn;
    form.elements.currency.value = 'MXN';
    document.getElementById('commission-pay-rate-wrap').classList.add('hidden');
    document.getElementById('commission-pay-summary').textContent =
      (c.display_quote || '—') + ' · ' + (c.display_client || '—') + ' · ' + (c.agent_name || '') + ' · ' + money.format(c.commission_amount_mxn);
    document.getElementById('commission-pay-message').textContent = '';
    modal.classList.remove('hidden');
  }).catch(function(e) { window.alert(e.message); });
}

async function toggleAgent(id, active) {
  var agents = await api('/api/commissions/agents');
  var agent = agents.find(function(a) { return a.id === id; });
  if (!agent) return;
  try { await api('/api/commissions/agents/' + id, { method: 'PUT', body: JSON.stringify({ name: agent.name, active: active, start_date: agent.start_date }) }); await loadCommissions(); }
  catch (e) { window.alert(e.message); }
}

var agentForm = document.getElementById('agent-form');
if (agentForm) {
  agentForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var payload = Object.fromEntries(new FormData(agentForm).entries());
    payload.employee_id = Number(payload.employee_id);
    try { await api('/api/commissions/agents', { method: 'POST', body: JSON.stringify(payload) }); agentForm.reset(); await loadCommissions(); }
    catch (err) { window.alert(err.message); }
  });
}

var commissionExtraordinaryForm = document.getElementById('commission-extraordinary-form');
if (commissionExtraordinaryForm) {
  commissionExtraordinaryForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var payload = Object.fromEntries(new FormData(commissionExtraordinaryForm).entries());
    payload.employee_id = Number(payload.employee_id);
    payload.commission_amount_mxn = Number(payload.commission_amount_mxn);
    try {
      await api('/api/commissions/extraordinary', { method: 'POST', body: JSON.stringify(payload) });
      commissionExtraordinaryForm.reset();
      await loadCommissions();
      await loadAvailableProjectsOnly();
      switchCommissionsSubtab('pending');
    } catch (err) { window.alert(err.message); }
  });
}

var commissionArchivedSearchForm = document.getElementById('commission-archived-search-form');
if (commissionArchivedSearchForm) {
  commissionArchivedSearchForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(commissionArchivedSearchForm);
    var params = new URLSearchParams({ paid: '1' });
    ['client_name', 'quote_number', 'order_number', 'date_from', 'date_to'].forEach(function(key) {
      var val = (fd.get(key) || '').toString().trim();
      if (val) params.set(key, val);
    });
    try {
      var rows = await api('/api/commissions?' + params.toString());
      renderArchivedCommissions(rows);
      switchCommissionsSubtab('history');
    } catch (err) { window.alert(err.message); }
  });
}

var commissionAssignForm = document.getElementById('commission-assign-form');
if (commissionAssignForm) {
  commissionAssignForm.elements.commission_calculation_base_type.addEventListener('change', updateCommissionAssignPreview);
  commissionAssignForm.elements.commission_amount_mxn.addEventListener('input', updateCommissionAssignPreview);
  commissionAssignForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var msg = document.getElementById('commission-assign-message');
    var fd = new FormData(commissionAssignForm);
    var payload = {
      project_id: Number(fd.get('project_id')),
      employee_id: Number(fd.get('employee_id')),
      commission_calculation_base_type: fd.get('commission_calculation_base_type'),
      reference: fd.get('reference') || undefined,
    };
    if (payload.commission_calculation_base_type === 'monto_manual') {
      payload.commission_amount_mxn = Number(fd.get('commission_amount_mxn'));
    }
    try {
      await api('/api/commissions', { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('commission-assign-modal').classList.add('hidden');
      await loadCommissions();
      await loadAvailableProjectsOnly();
      switchCommissionsSubtab('pending');
      if (msg) msg.textContent = '';
    } catch (err) {
      if (msg) { msg.textContent = err.message; msg.className = 'message error'; }
      else window.alert(err.message);
    }
  });
}

var commissionPayForm = document.getElementById('commission-pay-form');
if (commissionPayForm) {
  commissionPayForm.elements.currency.addEventListener('change', function() {
    var wrap = document.getElementById('commission-pay-rate-wrap');
    if (wrap) wrap.classList.toggle('hidden', commissionPayForm.elements.currency.value === 'MXN');
  });
  commissionPayForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var msg = document.getElementById('commission-pay-message');
    var fd = new FormData(commissionPayForm);
    var commissionId = fd.get('commission_id');
    var payload = {
      payment_date: fd.get('payment_date'),
      amount_original: Number(fd.get('amount_original')),
      currency: fd.get('currency'),
      reference: fd.get('reference') || undefined,
    };
    if (payload.currency !== 'MXN') payload.exchange_rate_to_mxn = Number(fd.get('exchange_rate_to_mxn'));
    try {
      await api('/api/commissions/' + commissionId + '/pay', { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('commission-pay-modal').classList.add('hidden');
      await loadCommissions();
      switchCommissionsSubtab('history');
      if (msg) msg.textContent = '';
    } catch (err) {
      if (msg) { msg.textContent = err.message; msg.className = 'message error'; }
      else window.alert(err.message);
    }
  });
}

attachCommissionModalClose(document.getElementById('commission-assign-modal'));
attachCommissionModalClose(document.getElementById('commission-pay-modal'));

var commissionsPeriodForm = document.getElementById('commissions-period-form');
if (commissionsPeriodForm) {
  commissionsPeriodForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var yearSel = document.getElementById('commissions-filter-year');
    var monthSel = document.getElementById('commissions-filter-month');
    if (yearSel && monthSel && yearSel.value && !monthSel.value) {
      window.alert('Seleccione tambien el mes, o use Ver acumulado total.');
      return;
    }
    if (yearSel && monthSel && monthSel.value && !yearSel.value) {
      window.alert('Seleccione el ano del periodo.');
      return;
    }
    loadCommissions();
  });
}
var commissionsPeriodClear = document.getElementById('commissions-period-clear');
if (commissionsPeriodClear) {
  commissionsPeriodClear.addEventListener('click', function() {
    var yearSel = document.getElementById('commissions-filter-year');
    var monthSel = document.getElementById('commissions-filter-month');
    if (yearSel) yearSel.value = '';
    if (monthSel) monthSel.value = '';
    loadCommissions();
  });
}
var commissionsRefreshProjects = document.getElementById('commissions-refresh-projects');
if (commissionsRefreshProjects) {
  commissionsRefreshProjects.addEventListener('click', function() { loadAvailableProjectsOnly(); });
}

// ===================== ACTIVITY MONITOR =====================
var activityMonitorTab = document.getElementById('activity-monitor-tab');
var activityMonitorView = document.getElementById('activity-monitor-view');
if (activityMonitorTab) {
  activityMonitorTab.addEventListener('click', async function() {
    switchView('activity-monitor');
    await loadActivityMonitor();
  });
}

async function loadActivityMonitor() {
  var loadingEl = document.getElementById("activity-monitor-loading");
  var errorEl = document.getElementById("activity-monitor-error");
  var contentEl = document.getElementById("activity-monitor-content");
  if (loadingEl) loadingEl.classList.remove("hidden");
  if (errorEl) errorEl.classList.add("hidden");
  if (contentEl) contentEl.classList.add("hidden");
  try {
    var results = await Promise.all([
      api("/api/activity-monitor/sessions"),
      api("/api/activity-monitor/recent-sessions"),
      api("/api/activity-monitor/weekly-report"),
      api("/api/activity-monitor/recent-events"),
    ]);
    renderActiveSessions(results[0]);
    renderRecentSessions((results[1] && results[1].data) || []);
    renderWeeklyReport(results[2]);
    renderRecentEvents((results[3] && results[3].data) || []);
    if (loadingEl) loadingEl.classList.add("hidden");
    if (contentEl) contentEl.classList.remove("hidden");
  } catch (e) {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (errorEl) { errorEl.textContent = "No se pudo cargar el Monitor de Actividad: " + e.message; errorEl.classList.remove("hidden"); }
  }
}
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? h + "h " + m + "m" : m + "m";
}
function renderActiveSessions(sessions) {
  var el = document.getElementById("active-sessions-table");
  if (!el) return;
  if (!sessions || sessions.length === 0) { el.innerHTML = '<tr><td colspan="6" class="muted">No hay usuarios conectados actualmente.</td></tr>'; return; }
  el.innerHTML = sessions.map(function(s) {
    return '<tr><td>' + escapeHtml(s.user_name) + '</td><td>' + escapeHtml(s.role || '') + '</td><td>' + formatDateTimeCDMX(s.login_at) + '</td><td>' + formatDateTimeCDMX(s.last_activity_at) + '</td><td>' + formatDuration(s.duration_seconds) + '</td><td>' + escapeHtml(s.ip_address || '') + '</td></tr>';
  }).join("");
}
function renderRecentSessions(sessions) {
  var el = document.getElementById("recent-sessions-table");
  if (!el) return;
  if (!sessions || sessions.length === 0) { el.innerHTML = '<tr><td colspan="6" class="muted">No hay sesiones registradas todavia.</td></tr>'; return; }
  el.innerHTML = sessions.map(function(s) {
    return '<tr><td>' + escapeHtml(s.user_name) + '</td><td>' + escapeHtml(s.role || '') + '</td><td>' + formatDateTimeCDMX(s.login_at) + '</td><td>' + (s.logout_at ? formatDateTimeCDMX(s.logout_at) : '<em>Activa</em>') + '</td><td>' + formatDuration(s.duration_seconds) + '</td><td>' + escapeHtml(s.ip_address || '') + '</td></tr>';
  }).join("");
}
function renderWeeklyReport(report) {
  var el = document.getElementById("weekly-report-table");
  if (!el) return;
  var users = (report && report.users) || [];
  if (users.length === 0) { el.innerHTML = '<tr><td colspan="6" class="muted">No hay actividad registrada para esta semana.</td></tr>'; return; }
  el.innerHTML = users.map(function(u) {
    return '<tr><td>' + escapeHtml(u.user_name) + '</td><td>' + escapeHtml(u.role || '') + '</td><td>' + (u.total_sessions || 0) + '</td><td>' + formatDuration(u.total_seconds) + '</td><td>' + formatDuration(u.avg_per_day) + '</td><td>' + formatDateTimeCDMX(u.last_activity) + '</td></tr>';
  }).join("");
}
function renderRecentEvents(events) {
  var el = document.getElementById("recent-events-table");
  if (!el) return;
  if (!events || events.length === 0) { el.innerHTML = '<tr><td colspan="5" class="muted">No hay eventos recientes.</td></tr>'; return; }
  el.innerHTML = events.map(function(ev) {
    return '<tr><td>' + formatDateTimeCDMX(ev.timestamp_utc) + '</td><td>' + escapeHtml(ev.user_name || '') + '</td><td>' + escapeHtml(ev.action || '') + '</td><td>' + escapeHtml(ev.module || '') + '</td><td>' + escapeHtml(ev.entity_label || ev.entity_type || '') + '</td></tr>';
  }).join("");
}

// ===================== ACTIVITY MONITOR FILTERS =====================
(function() {
  var periodType = document.getElementById('af-period-type');
  var yearLabel = document.getElementById('af-year-label');
  var monthLabel = document.getElementById('af-month-label');
  var weekLabel = document.getElementById('af-week-label');
  var dateLabel = document.getElementById('af-date-label');
  var yearInput = document.getElementById('af-year');
  var monthInput = document.getElementById('af-month');
  var weekInput = document.getElementById('af-week');
  var dateInput = document.getElementById('af-date');
  var filterForm = document.getElementById('activity-filter-form');
  var clearBtn = document.getElementById('af-clear');

  if (!periodType || !filterForm) return;

  var now = new Date();
  if (yearInput) yearInput.value = now.getFullYear();
  if (monthInput) monthInput.value = now.getMonth() + 1;
  if (weekInput) weekInput.value = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7*24*60*60*1000));
  if (dateInput) dateInput.value = now.toISOString().split('T')[0];

  function updateVisibility() {
    var type = periodType.value;
    yearLabel.style.display = (type === 'year' || type === 'month' || type === 'week') ? 'flex' : 'none';
    monthLabel.style.display = (type === 'month') ? 'flex' : 'none';
    weekLabel.style.display = (type === 'week') ? 'flex' : 'none';
    dateLabel.style.display = (type === 'day') ? 'flex' : 'none';
  }
  periodType.addEventListener('change', updateVisibility);
  updateVisibility();

  filterForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var type = periodType.value;
    var params = 'periodType=' + type;
    if (type === 'year' || type === 'month' || type === 'week') params += '&year=' + yearInput.value;
    if (type === 'month') params += '&month=' + monthInput.value;
    if (type === 'week') params += '&weekNumber=' + weekInput.value;
    if (type === 'day') params += '&date=' + dateInput.value;
    await loadActivitySummary(params);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      periodType.value = 'month';
      yearInput.value = now.getFullYear();
      monthInput.value = now.getMonth() + 1;
      weekInput.value = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7*24*60*60*1000));
      dateInput.value = now.toISOString().split('T')[0];
      updateVisibility();
      var cards = document.getElementById('activity-summary-cards');
      if (cards) cards.style.display = 'none';
      var table = document.getElementById('activity-summary-users');
      if (table) table.innerHTML = '';
      var evTable = document.getElementById('activity-summary-events');
      if (evTable) evTable.innerHTML = '';
    });
  }
})();

async function loadActivitySummary(queryStr) {
  var cards = document.getElementById('activity-summary-cards');
  var loadingEl = document.getElementById('activity-monitor-loading');
  var errorEl = document.getElementById('activity-monitor-error');
  var contentEl = document.getElementById('activity-monitor-content');
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (contentEl) contentEl.classList.add('hidden');
  if (cards) cards.style.display = 'none';
  try {
    var data = await api('/api/activity-monitor/summary?' + queryStr);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
    renderActivitySummaryCards(data);
    renderActivitySummaryUsers(data.users || []);
    renderActiveSessions([]); 
    renderRecentSessions([]);
    renderWeeklyReport({ users: data.users || [] });
    renderRecentEvents(data.events || []);
  } catch(e) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) { errorEl.textContent = 'No se pudo cargar la actividad del periodo seleccionado: ' + e.message; errorEl.classList.remove('hidden'); }
  }
}

function renderActivitySummaryCards(data) {
  var el = document.getElementById('activity-summary-cards');
  if (!el) return;
  var s = data.summary || {};
  el.style.display = 'flex';
  el.innerHTML = '<div class="stat-card"><strong>' + (s.totalUsers || 0) + '</strong><small>Usuarios activos</small></div>' +
    '<div class="stat-card"><strong>' + (s.totalSessions || 0) + '</strong><small>Sesiones</small></div>' +
    '<div class="stat-card"><strong>' + formatDuration(s.totalDurationSeconds) + '</strong><small>Tiempo conectado</small></div>' +
    '<div class="stat-card"><strong>' + formatDuration(s.averageSessionDurationSeconds) + '</strong><small>Promedio por sesion</small></div>' +
    '<div class="stat-card"><strong>' + (s.totalEvents || 0) + '</strong><small>Eventos</small></div>' +
    '<div class="stat-card"><strong>' + (s.deniedAccessEvents || 0) + '</strong><small>Accesos denegados</small></div>';
  var periodLabel = (data.period && data.period.label) ? '<p class="muted" style="width:100%;margin-top:8px;">Periodo: <strong>' + escapeHtml(data.period.label) + '</strong></p>' : '';
  el.innerHTML += periodLabel;
}

function renderActivitySummaryUsers(users) {
  var el = document.getElementById('weekly-report-table');
  if (!el) return;
  if (!users || users.length === 0) {
    el.innerHTML = '<tr><td colspan="6" class="muted">No hay actividad registrada para el periodo seleccionado.</td></tr>';
    return;
  }
  el.innerHTML = users.map(function(u) {
    return '<tr><td>' + escapeHtml(u.user_name) + '</td><td>' + escapeHtml(u.role || '') + '</td><td>' + (u.total_sessions || 0) + '</td><td>' + formatDuration(u.total_seconds) + '</td><td>' + formatDuration(u.avg_per_session) + '</td><td>' + formatDateTimeCDMX(u.last_activity) + '</td></tr>';
  }).join('');
}

// ===================== TABLERO KPIs MODULE =====================

// --- Tablero KPIs Fase 2: moneda, captura, config, graficas, exportacion ---
let kpiChartInstances = {};
/** @type {{ promise: Promise<boolean>, resolve: (value: boolean) => void } | null} */
let kpiReauthDeferred = null;

function clearKpiReauthDeferred() {
  kpiReauthDeferred = null;
}

function mountKpiModalToBody(modalId) {
  const modal = document.getElementById(modalId);
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  return modal;
}

function formatCurrencyMXN(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return money.format(num);
}

function parsePlainAmount(value) {
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function isKpiCurrencyKey(key) {
  return /_mxn$|amount|sold|quoted|collected|overdue|invoiced/i.test(String(key || ''));
}

function formatKpiDisplayValue(key, value) {
  if (value && typeof value === 'object' && value.display != null) {
    if (value.not_captured) return value.display;
    if (isKpiCurrencyKey(key) && typeof value.value === 'number') {
      return formatCurrencyMXN(value.value);
    }
    return value.display;
  }
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    if (isKpiCurrencyKey(key)) return formatCurrencyMXN(value);
    if (/rate|margin|portfolio|compliance|evidence|percent/i.test(key)) {
      return Number.isFinite(value) ? value + '%' : '—';
    }
    if (/days/i.test(key)) return value + ' días';
    return String(value);
  }
  return String(value);
}

function resetKpiReauthModalUi() {
  const input = document.getElementById('kpi-reauth-password');
  const msg = document.getElementById('kpi-reauth-message');
  const submitBtn = document.getElementById('kpi-reauth-submit');
  if (input) input.value = '';
  if (msg) msg.textContent = '';
  if (submitBtn) submitBtn.disabled = false;
}

function closeKpiReauthModal() {
  const modal = document.getElementById('kpi-reauth-modal');
  if (modal) modal.classList.add('hidden');
  resetKpiReauthModalUi();
  if (kpiReauthDeferred && kpiReauthDeferred.resolve) {
    const r = kpiReauthDeferred.resolve;
    clearKpiReauthDeferred();
    return r;
  }
  clearKpiReauthDeferred();
  return null;
}

function setupKpiReauthFormOnce() {
  const form = document.getElementById('kpi-reauth-form');
  const cancelBtn = document.getElementById('kpi-reauth-cancel');
  if (!form || form.dataset.kpiReauthBound === '1') return;
  form.dataset.kpiReauthBound = '1';
  cancelBtn?.addEventListener('click', function() {
    const resolve = closeKpiReauthModal();
    if (resolve) resolve(false);
  });
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const input = document.getElementById('kpi-reauth-password');
    const msg = document.getElementById('kpi-reauth-message');
    const submitBtn = document.getElementById('kpi-reauth-submit');
    if (!input || !kpiReauthDeferred || !kpiReauthDeferred.resolve) return;
    msg.textContent = '';
    if (submitBtn) submitBtn.disabled = true;
    try {
      const result = await api('/api/kpis/admin-reauth', {
        method: 'POST',
        body: { password: input.value },
      });
      if (result && result.success === false) {
        throw new Error(result.message || 'Contraseña incorrecta o acceso no autorizado.');
      }
      const resolve = kpiReauthDeferred.resolve;
      input.value = '';
      closeKpiReauthModal();
      resolve(true);
    } catch (err) {
      console.error('KPI reauth failed:', err.message);
      msg.textContent = err.message || 'No se pudo validar la contraseña. Intenta nuevamente.';
      input.value = '';
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

async function ensureKpiReauth() {
  try {
    const status = await api('/api/kpis/reauth-status');
    if (status && status.authenticated) return true;
  } catch (err) {
    console.error('KPI reauth status error:', err.message);
  }
  if (kpiReauthDeferred) return kpiReauthDeferred.promise;
  const deferred = {};
  deferred.promise = new Promise(function(resolve) {
    deferred.resolve = resolve;
    const modal = mountKpiModalToBody('kpi-reauth-modal');
    if (!modal) {
      clearKpiReauthDeferred();
      resolve(false);
      return;
    }
    setupKpiReauthFormOnce();
    resetKpiReauthModalUi();
    modal.classList.remove('hidden');
    document.getElementById('kpi-reauth-password')?.focus();
  });
  kpiReauthDeferred = deferred;
  return deferred.promise;
}

function destroyKpiCharts() {
  Object.keys(kpiChartInstances).forEach(function(id) {
    if (kpiChartInstances[id]) { kpiChartInstances[id].destroy(); }
  });
  kpiChartInstances = {};
}

function kpiChartPanel(canvasId) {
  const canvas = document.getElementById(canvasId);
  return canvas ? canvas.closest('.kpi-chart-panel') : null;
}

function ensureKpiChartCanvas(canvasId) {
  const panel = kpiChartPanel(canvasId);
  if (!panel) return null;
  let canvas = document.getElementById(canvasId);
  const empty = panel.querySelector('.kpi-chart-empty');
  if (empty) empty.remove();
  if (!canvas || canvas.tagName !== 'CANVAS') {
    if (canvas && canvas.tagName !== 'CANVAS') canvas.remove();
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.height = 200;
    panel.appendChild(canvas);
  }
  return canvas;
}

function showKpiChartEmpty(canvasId, message) {
  const panel = kpiChartPanel(canvasId);
  if (!panel) return;
  const canvas = panel.querySelector('canvas');
  if (canvas) canvas.remove();
  const existing = panel.querySelector('.kpi-chart-empty');
  if (existing) {
    existing.textContent = message;
    return;
  }
  const p = document.createElement('p');
  p.className = 'kpi-chart-empty muted';
  p.textContent = message;
  panel.appendChild(p);
}

const KPI_CHART_COLORS = ['#2563eb', '#22c55e', '#eab308', '#f97316', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
const VENTAS_CHART_COLORS = {
  quoted: '#2563eb',
  sold: '#0d9488',
  collected: '#eab308',
  quotedBg: 'rgba(37, 99, 235, 0.25)',
  soldBar: '#0d9488',
  marginPositive: '#22c55e',
  marginNegative: '#ef4444',
};

const kpiBarValueLabelsPlugin = {
  id: 'kpiBarValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    chart.data.datasets.forEach(function(dataset, datasetIndex) {
      if (dataset._skipValueLabels) return;
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;
      meta.data.forEach(function(bar, index) {
        const raw = dataset.data[index];
        if (raw == null || !Number.isFinite(Number(raw))) return;
        const value = Number(raw);
        const isPoints = dataset._valueFormat === 'points';
        const label = isPoints ? ((value >= 0 ? '+' : '') + value + ' pts') : formatCurrencyMXN(value);
        ctx.save();
        ctx.fillStyle = '#334155';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        if (chart.options.indexAxis === 'y') {
          const xPos = value >= 0 ? bar.x + 6 : bar.x - 6;
          ctx.textAlign = value >= 0 ? 'left' : 'right';
          if (xPos > chartArea.left && xPos < chartArea.right - 4) ctx.fillText(label, xPos, bar.y);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(label, bar.x, bar.y - 6);
        }
        ctx.restore();
      });
    });
  },
};

function setKpiChartCanvasHeight(canvasId, rowCount, minHeight) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const h = Math.max(minHeight || 180, (rowCount || 1) * 38 + 48);
  canvas.height = h;
  canvas.style.height = h + 'px';
}

function renderKpiCharts(summary) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js no cargado; graficas KPI omitidas.');
    return;
  }
  destroyKpiCharts();
  const charts = summary.charts || {};

  const buckets = charts.receivable_buckets || [];
  const recCanvas = ensureKpiChartCanvas('kpi-chart-receivable');
  if (recCanvas) {
    if (!buckets.length || buckets.every(function(b) { return !b.amount && !b.count; })) {
      showKpiChartEmpty('kpi-chart-receivable', 'Sin cartera pendiente con los filtros actuales.');
    } else {
      kpiChartInstances.receivable = new Chart(recCanvas, {
        type: 'bar',
        data: {
          labels: buckets.map(function(b) { return b.label; }),
          datasets: [{
            label: 'Monto MXN',
            data: buckets.map(function(b) { return b.amount || 0; }),
            backgroundColor: ['#22c55e', '#ef4444'],
          }],
        },
        options: {
          plugins: {
            tooltip: {
              callbacks: {
                label: function(c) {
                  const bucket = buckets[c.dataIndex];
                  return formatCurrencyMXN(c.parsed.y) + ' (' + (bucket.count || 0) + ' proyectos)';
                },
              },
            },
          },
          scales: {
            y: { ticks: { callback: function(v) { return formatCurrencyMXN(v); } } },
          },
        },
        plugins: [kpiBarValueLabelsPlugin],
      });
    }
  }

  const services = charts.services_by_month || { labels: [], series: [] };
  const repCanvas = ensureKpiChartCanvas('kpi-chart-reports');
  if (repCanvas) {
    const series = services.series || [];
    if (!series.length || !(services.labels || []).length) {
      showKpiChartEmpty('kpi-chart-reports', 'Sin servicios/reportes ejecutados en el periodo.');
    } else {
      kpiChartInstances.reports = new Chart(repCanvas, {
        type: 'bar',
        data: {
          labels: services.labels,
          datasets: series.map(function(s, idx) {
            return {
              label: s.full_name,
              data: s.data || [],
              backgroundColor: KPI_CHART_COLORS[idx % KPI_CHART_COLORS.length],
            };
          }),
        },
        options: {
          plugins: { tooltip: { mode: 'index', intersect: false } },
          scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    }
  }
}

function renderVentasCharts(ventas) {
  if (typeof Chart === 'undefined' || !ventas) return;
  const charts = ventas.charts || {};

  const trend = charts.monthly_trend || [];
  const trendCanvas = ensureKpiChartCanvas('kpi-chart-ventas-trend');
  if (trendCanvas) {
    const hasTrendData = trend.some(function(t) {
      return (t.quoted_amount_mxn || 0) > 0 || (t.sold_amount_mxn || 0) > 0 || (t.collected_amount_mxn || 0) > 0;
    });
    if (!trend.length || !hasTrendData) {
      showKpiChartEmpty('kpi-chart-ventas-trend', 'Sin datos en el periodo.');
    } else {
      kpiChartInstances.ventasTrend = new Chart(trendCanvas, {
        type: 'line',
        data: {
          labels: trend.map(function(t) { return t.label; }),
          datasets: [
            { label: 'Monto cotizado', data: trend.map(function(t) { return t.quoted_amount_mxn || 0; }), borderColor: VENTAS_CHART_COLORS.quoted, tension: 0.25 },
            { label: 'Monto vendido', data: trend.map(function(t) { return t.sold_amount_mxn || 0; }), borderColor: VENTAS_CHART_COLORS.sold, tension: 0.25 },
            { label: 'Monto cobrado', data: trend.map(function(t) { return t.collected_amount_mxn || 0; }), borderColor: VENTAS_CHART_COLORS.collected, tension: 0.25 },
          ],
        },
        options: {
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + formatCurrencyMXN(ctx.parsed.y); } } },
          },
          scales: { y: { beginAtZero: true, ticks: { callback: function(v) { return formatCurrencyMXN(v); } } } },
        },
      });
    }
  }

  const funnelStages = (charts.sales_funnel && charts.sales_funnel.stages) || [];
  const funnelCanvas = ensureKpiChartCanvas('kpi-chart-ventas-funnel');
  if (funnelCanvas) {
    if (!funnelStages.length) {
      showKpiChartEmpty('kpi-chart-ventas-funnel', 'Sin datos en el periodo.');
    } else {
      setKpiChartCanvasHeight('kpi-chart-ventas-funnel', funnelStages.length, 160);
      kpiChartInstances.ventasFunnel = new Chart(funnelCanvas, {
        type: 'bar',
        data: {
          labels: funnelStages.map(function(s) { return s.label; }),
          datasets: [{ label: 'Monto MXN', data: funnelStages.map(function(s) { return s.amount || 0; }), backgroundColor: funnelStages.map(function(s) { return s.color; }), borderRadius: 4 }],
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return formatCurrencyMXN(ctx.parsed.x); } } } },
          scales: { x: { beginAtZero: true, ticks: { callback: function(v) { return formatCurrencyMXN(v); } } } },
        },
        plugins: [kpiBarValueLabelsPlugin],
      });
    }
  }

  const ranking = charts.seller_ranking || [];
  const rankingCanvas = ensureKpiChartCanvas('kpi-chart-ventas-ranking');
  if (rankingCanvas) {
    if (!ranking.length) {
      showKpiChartEmpty('kpi-chart-ventas-ranking', 'Sin datos en el periodo.');
    } else {
      setKpiChartCanvasHeight('kpi-chart-ventas-ranking', ranking.length, 200);
      kpiChartInstances.ventasRanking = new Chart(rankingCanvas, {
        type: 'bar',
        data: {
          labels: ranking.map(function(r) { return r.label; }),
          datasets: [
            { label: 'Monto cotizado (referencia)', data: ranking.map(function(r) { return r.quoted_amount_mxn || 0; }), backgroundColor: VENTAS_CHART_COLORS.quotedBg, borderRadius: 4, order: 2, _skipValueLabels: true },
            { label: 'Monto vendido', data: ranking.map(function(r) { return r.sold_amount_mxn || 0; }), backgroundColor: VENTAS_CHART_COLORS.soldBar, borderRadius: 4, order: 1 },
          ],
        },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + formatCurrencyMXN(ctx.parsed.x); } } },
          },
          scales: { x: { beginAtZero: true, ticks: { callback: function(v) { return formatCurrencyMXN(v); } } } },
        },
        plugins: [kpiBarValueLabelsPlugin],
      });
    }
  }

  const marginGap = charts.margin_gap_by_seller || [];
  const marginCanvas = ensureKpiChartCanvas('kpi-chart-ventas-margin');
  if (marginCanvas) {
    if (!marginGap.length) {
      showKpiChartEmpty('kpi-chart-ventas-margin', 'Sin datos en el periodo.');
    } else {
      setKpiChartCanvasHeight('kpi-chart-ventas-margin', marginGap.length, 200);
      const gapValues = marginGap.map(function(r) { return r.gap_points; });
      const maxAbs = Math.max.apply(null, gapValues.map(function(v) { return Math.abs(v); }).concat([5]));
      kpiChartInstances.ventasMargin = new Chart(marginCanvas, {
        type: 'bar',
        data: {
          labels: marginGap.map(function(r) { return r.label; }),
          datasets: [{
            label: 'Brecha margen (pts)',
            data: gapValues,
            backgroundColor: gapValues.map(function(v) { return v >= 0 ? VENTAS_CHART_COLORS.marginPositive : VENTAS_CHART_COLORS.marginNegative; }),
            borderRadius: 4,
            _valueFormat: 'points',
          }],
        },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function(ctx) { const v = ctx.parsed.x; return 'Brecha: ' + (v >= 0 ? '+' : '') + v + ' pts'; } } },
          },
          scales: {
            x: {
              min: -maxAbs - 2,
              max: maxAbs + 2,
              ticks: { callback: function(v) { return v + ' pts'; } },
              grid: {
                color: function(ctx) { return ctx.tick.value === 0 ? '#64748b' : 'rgba(148,163,184,0.25)'; },
                lineWidth: function(ctx) { return ctx.tick.value === 0 ? 2 : 1; },
              },
            },
          },
        },
        plugins: [kpiBarValueLabelsPlugin],
      });
    }
  }
}

function populateKpiManualQuoteMonths() {
  const sel = document.getElementById('kpi-mq-month');
  if (!sel || sel.options.length > 1) return;
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  months.forEach(function(name, i) {
    sel.innerHTML += '<option value="' + (i + 1) + '">' + name + '</option>';
  });
  const now = new Date();
  const y = document.getElementById('kpi-mq-year');
  if (y && !y.value) y.value = now.getFullYear();
  if (sel && !sel.value) sel.value = now.getMonth() + 1;
}

async function loadKpiSalesEmployees() {
  const empSel = document.getElementById('kpi-mq-employee');
  if (!empSel) return;
  const data = await api('/api/kpis/sales-employees');
  empSel.innerHTML = '<option value="">Seleccione vendedora</option>';
  (data.employees || []).forEach(function(e) {
    empSel.innerHTML += '<option value="' + e.employee_id + '">' + escapeHtml(e.full_name) + '</option>';
  });
}

function resetKpiManualQuoteForm() {
  const form = document.getElementById('kpi-manual-quotes-form');
  const idEl = document.getElementById('kpi-mq-id');
  if (idEl) idEl.value = '';
  if (form) form.reset();
  populateKpiManualQuoteMonths();
  syncKpiQuoteAmountFields();
}

async function openKpiManualQuotesModal() {
  populateKpiManualQuoteMonths();
  const modal = mountKpiModalToBody('kpi-manual-quotes-modal');
  const msg = document.getElementById('kpi-mq-message');
  if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
  await loadKpiSalesEmployees();
  resetKpiManualQuoteForm();
  await refreshKpiManualQuotesList();
  if (modal) modal.classList.remove('hidden');
}

async function refreshKpiManualQuotesList() {
  const year = document.getElementById('kpi-mq-year')?.value;
  const month = document.getElementById('kpi-mq-month')?.value;
  const list = document.getElementById('kpi-mq-list');
  if (!list || !year || !month) return;
  const data = await api('/api/kpis/manual-quotes?year=' + year + '&month=' + month);
  list.innerHTML = '<table><thead><tr><th>Empleado</th><th>Cotiz.</th><th>Monto MXN</th><th></th></tr></thead><tbody>' +
    (data.captures || []).map(function(c) {
      return '<tr><td>' + escapeHtml(c.employee_name_snapshot || '—') + '</td><td>' + c.quotes_sent_count + '</td><td>' + formatCurrencyMXN(c.quoted_amount_mxn) + '</td><td><button type="button" class="secondary kpi-mq-edit" data-id="' + c.id + '">Editar</button></td></tr>';
    }).join('') + '</tbody></table>';
  list.querySelectorAll('.kpi-mq-edit').forEach(function(btn) {
    btn.addEventListener('click', function() { loadKpiManualQuoteForEdit(btn.dataset.id, data.captures); });
  });
}

function loadKpiManualQuoteForEdit(id, captures) {
  const c = (captures || []).find(function(x) { return String(x.id) === String(id); });
  if (!c) return;
  document.getElementById('kpi-mq-id').value = c.id;
  document.getElementById('kpi-mq-year').value = c.year;
  document.getElementById('kpi-mq-month').value = c.month;
  document.getElementById('kpi-mq-employee').value = c.employee_id || '';
  document.getElementById('kpi-mq-count').value = c.quotes_sent_count;
  document.getElementById('kpi-mq-amount').value = c.quoted_amount_original;
  document.getElementById('kpi-mq-currency').value = c.currency || 'MXN';
  document.getElementById('kpi-mq-rate').value = c.exchange_rate_to_mxn || 1;
  document.getElementById('kpi-mq-notes').value = c.notes || '';
  syncKpiQuoteAmountFields();
}

function syncKpiQuoteAmountFields() {
  const currency = document.getElementById('kpi-mq-currency')?.value || 'MXN';
  const rateWrap = document.getElementById('kpi-mq-rate-wrap');
  const mxnWrap = document.getElementById('kpi-mq-mxn-wrap');
  const amountLabel = document.getElementById('kpi-mq-amount-label');
  const rateInput = document.getElementById('kpi-mq-rate');
  const mxnDisplay = document.getElementById('kpi-mq-mxn-display');
  const isForeign = currency !== 'MXN';
  if (rateWrap) rateWrap.classList.toggle('hidden', !isForeign);
  if (mxnWrap) mxnWrap.classList.toggle('hidden', !isForeign);
  if (amountLabel) {
    amountLabel.firstChild && (amountLabel.childNodes[0].textContent = isForeign ? 'Monto cotizado (original) * ' : 'Monto cotizado * ');
  }
  if (!isForeign && rateInput) rateInput.value = '1';
  const amount = parsePlainAmount(document.getElementById('kpi-mq-amount')?.value);
  const rate = isForeign ? (Number(rateInput?.value) || 0) : 1;
  const mxn = isForeign ? amount * rate : amount;
  if (mxnDisplay) mxnDisplay.value = formatCurrencyMXN(mxn);
}

function updateKpiManualQuoteMxnPreview() {
  syncKpiQuoteAmountFields();
}

async function openKpiConfigModal() {
  const errEl = document.getElementById('kpi-config-load-error');
  try {
    const ok = await ensureKpiReauth();
    if (!ok) return;
    const modal = mountKpiModalToBody('kpi-config-modal');
    if (!modal) {
      throw new Error('No se encontro el modal de configuracion KPI.');
    }
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
    modal.classList.remove('hidden');
    const results = await Promise.allSettled([
      api('/api/kpis/employee-config'),
      api('/api/kpis/formulas'),
      api('/api/kpis/settings'),
    ]);
    const errors = [];
    if (results[0].status === 'fulfilled') {
      renderKpiConfigEmployees(results[0].value);
    } else {
      errors.push('Empleados KPI: ' + (results[0].reason?.message || 'error'));
    }
    if (results[1].status === 'fulfilled') {
      renderKpiConfigFormulas(results[1].value.formulas || []);
    } else {
      errors.push('Fórmulas: ' + (results[1].reason?.message || 'error'));
    }
    if (results[2].status === 'fulfilled') {
      fillKpiSettingsForm(results[2].value);
    } else {
      errors.push('Parámetros: ' + (results[2].reason?.message || 'error'));
    }
    if (errors.length && errEl) {
      errEl.textContent = errors.join(' · ');
      errEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('openKpiConfigModal failed:', err);
    if (errEl) {
      errEl.textContent = err.message || 'No se pudo abrir la configuracion KPI.';
      errEl.classList.remove('hidden');
      mountKpiModalToBody('kpi-config-modal')?.classList.remove('hidden');
    } else {
      alert(err.message || 'No se pudo abrir la configuracion KPI.');
    }
  }
}

function renderKpiConfigEmployees(config) {
  renderKpiConfigEmployeeTable(
    'kpi-config-vendedores-table',
    config.vendedores || config.employees || [],
    'Ventas',
    true,
  );
  renderKpiConfigEmployeeTable(
    'kpi-config-tecnicos-table',
    config.tecnicos || [],
    'Técnico',
    false,
  );
}

function renderKpiConfigEmployeeTable(tbodyId, employees, defaultArea, showVacations) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!employees.length) {
    const cols = showVacations ? 4 : 3;
    tbody.innerHTML = '<tr><td colspan="' + cols + '" class="muted">No hay empleados para mostrar.</td></tr>';
    return;
  }
  tbody.innerHTML = employees.map(function(e) {
    const vacCell = showVacations
      ? '<td>' + (e.has_vacation_requests ? 'Sí' : 'No') + '</td>'
      : '';
    const assigned = e.kpi_eligible && e.kpi_area === defaultArea;
    return '<tr data-id="' + e.employee_id + '" data-area="' + escapeHtml(defaultArea) + '">' +
      '<td>' + escapeHtml(e.full_name) + '</td>' +
      '<td>' + escapeHtml(e.position || '') + '</td>' +
      vacCell +
      '<td><label style="display:flex;align-items:center;gap:6px;margin:0;cursor:pointer;">' +
      '<input type="checkbox" class="kpi-emp-eligible"' + (assigned ? ' checked' : '') + ' aria-label="Asignado a KPI" />' +
      '</label></td></tr>';
  }).join('');
}

async function handleKpiEmployeeEligibleToggle(chk) {
  const tr = chk.closest('tr');
  if (!tr) return;
  const id = tr.dataset.id;
  const area = tr.dataset.area;
  const eligible = chk.checked;
  const previousChecked = !eligible;
  chk.disabled = true;
  try {
    const ok = await ensureKpiReauth();
    if (!ok) {
      chk.checked = previousChecked;
      return;
    }
    const updated = await api('/api/kpis/employee-config/' + id, {
      method: 'PUT',
      body: { kpi_area: eligible ? area : 'Sin asignar', kpi_eligible: eligible },
    });
    chk.checked = !!(updated && updated.kpi_eligible);
    if (document.getElementById('kpi-manual-quotes-modal') &&
        !document.getElementById('kpi-manual-quotes-modal').classList.contains('hidden')) {
      await loadKpiSalesEmployees();
    }
    await loadKpiDashboard();
  } catch (err) {
    chk.checked = previousChecked;
    alert(err.message || 'No se pudo guardar la asignacion.');
  } finally {
    chk.disabled = false;
  }
}

function setupKpiEmployeeConfigHandlersOnce() {
  const section = document.getElementById('kpi-config-employees-section');
  if (!section || section.dataset.kpiEligibleBound === '1') return;
  section.dataset.kpiEligibleBound = '1';
  section.addEventListener('change', function(ev) {
    const chk = ev.target;
    if (!chk.classList || !chk.classList.contains('kpi-emp-eligible')) return;
    handleKpiEmployeeEligibleToggle(chk);
  });
}

function renderKpiConfigFormulas(formulas) {
  const el = document.getElementById('kpi-config-formulas');
  if (!el) return;
  el.innerHTML = formulas.map(function(f) {
    const params = (f.parameters || []).map(function(p) {
      return '<li>' + escapeHtml(p.label) + ': ' + escapeHtml(String(p.value)) + (p.unit || '') + '</li>';
    }).join('');
    return '<div class="panel" style="margin-bottom:8px;padding:10px;"><h4>' + escapeHtml(f.name) + '</h4>' +
      '<p class="muted">' + escapeHtml(f.description) + '</p>' +
      '<p><strong>Formula:</strong> ' + escapeHtml(f.formula_text) + '</p>' +
      '<p><strong>Fuente:</strong> ' + escapeHtml(f.data_source) + '</p>' +
      (params ? '<ul>' + params + '</ul>' : '') + '</div>';
  }).join('');
}

function fillKpiSettingsForm(s) {
  if (!s) return;
  const set = function(id, v) {
    const el = document.getElementById(id);
    if (el && v != null && v !== '') el.value = v;
  };
  set('kpi-set-margin-green', s.margin_green_percent);
  set('kpi-set-margin-yellow', s.margin_yellow_percent);
  set('kpi-set-margin-red', s.margin_red_percent);
  set('kpi-set-bucket1', s.receivable_bucket1_days);
  set('kpi-set-bucket2', s.receivable_bucket2_days);
  set('kpi-set-bucket3', s.receivable_bucket3_days);
  set('kpi-set-bucket-crit', s.receivable_critical_days);
  set('kpi-set-report-days', s.report_missing_critical_days);
  const chk = document.getElementById('kpi-set-require-capture');
  if (chk) chk.checked = !!s.require_manual_quote_capture;
}

function exportKpiPdf() {
  const qs = buildKpiQueryParams();
  window.open('/kpi-print.html?qs=' + encodeURIComponent(qs), '_blank', 'noopener');
}

function exportKpiExcel() {
  const qs = buildKpiQueryParams();
  window.location.href = '/api/kpis/export/excel?' + qs;
}

// Override renderKpiDashboard tail — patched in init


let kpiFiltersLoaded = false;

const KPI_FIELD_LABELS = {
  quotes_sent: 'Cotizaciones enviadas',
  quoted_amount_mxn: 'Monto cotizado (MXN)',
  projects_closed: 'Proyectos cerrados',
  sold_amount_mxn: 'Monto vendido (MXN)',
  close_rate_count: 'Tasa de cierre por cantidad (%)',
  close_rate_amount: 'Tasa de cierre por monto (%)',
  avg_real_margin: 'Margen real promedio (%)',
  avg_desired_margin: 'Margen deseado promedio (%)',
  margin_gap_points: 'Brecha margen (pts)',
  collected_amount_mxn: 'Monto cobrado (MXN)',
  active_projects: 'Proyectos activos',
  gross_margin_real: 'Margen bruto real (%)',
  red_margin_projects: 'Proyectos con margen rojo',
  delivery_compliance: 'Cumplimiento de entrega (%)',
  reworks: 'Retrabajos',
  rework_rate: 'Tasa de retrabajo (%)',
  technical_close_pending: 'Cierre técnico pendiente',
  complete_reports: 'Reportes completos (%)',
  complete_count: 'Reportes completos (#)',
  complete_evidence: 'Evidencias completas (%)',
  services_without_report: 'Servicios sin reporte',
  services_total: 'Servicios realizados',
  invoices_issued: 'Facturas emitidas',
  invoiced_amount_mxn: 'Monto facturado (MXN)',
  billing_time_days: 'Tiempo de facturación (días)',
  cancelled_invoices: 'Facturas canceladas',
  error_invoices: 'Facturas con error',
  pending_documentation: 'Pendientes por documentación',
  collected_amount_mxn: 'Monto cobrado (MXN)',
  collected_invoices: 'Facturas cobradas',
  avg_collection_days: 'Días promedio de cobranza',
  overdue_portfolio: 'Cartera vencida (%)',
  overdue_amount_mxn: 'Cartera vencida (MXN)',
  accounts_over_120_days: 'Cuentas +120 días',
  accounts_over_120_amount_mxn: 'Monto cuentas +120 días (MXN)',
  invoices_without_contact: 'Facturas sin contacto de pago',
  assigned_services: 'Servicios asignados',
  avg_margin: 'Margen promedio (%)',
  overdue_assigned: 'Cartera vencida asignada (MXN)',
  accounts_over_120: 'Cuentas +120 días',
  avg_billing_days: 'Tiempo promedio de facturación (días)',
  cancelled: 'Facturas canceladas',
  pending_docs: 'Pendientes por documentación',
  note: 'Observación',
};

function getKpiFieldLabel(key) {
  if (KPI_FIELD_LABELS[key]) return KPI_FIELD_LABELS[key];
  return String(key || '')
    .replace(/_mxn$/i, ' (MXN)')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function renderDepartmentKpis(departments) {
  if (!departments || !departments.length) {
    return '<p class="muted">Sin datos de departamentos para el periodo seleccionado.</p>';
  }
  return departments.map(function(d) {
    const metrics = Object.entries(d.kpis || {}).map(function(entry) {
      const metric = entry[1];
      if (d.department === 'Ventas' && metric && metric.has_data === false) return '';
      const label = getKpiFieldLabel(entry[0]);
      const display = formatKpiDisplayValue(entry[0], entry[1]);
      const unavailable = metric && metric.available === false;
      return renderKpiMetric(label, unavailable ? metric : { display: display, available: true });
    }).join('');
    if (d.department === 'Ventas' && !metrics.trim()) {
      return '<div class="kpi-dept-block"><h4>' + escapeHtml(d.department) + '</h4><p class="muted">Sin datos de ventas en el periodo seleccionado.</p></div>';
    }
    return '<div class="kpi-dept-block"><h4>' + escapeHtml(d.department) + '</h4><div class="kpi-dept-metrics">' + metrics + '</div></div>';
  }).join('');
}

function formatVentasTableCell(value, type) {
  if (value === null || value === undefined) {
    return '<span class="kpi-no-data">—</span>';
  }
  if (type === 'currency') return escapeHtml(formatCurrencyMXN(value));
  if (type === 'percent') return escapeHtml(Number.isFinite(Number(value)) ? Number(value) + '%' : '—');
  return escapeHtml(String(value));
}

function renderVentasSellersTable(sellers) {
  const tbody = document.getElementById('kpi-ventas-sellers-table');
  if (!tbody) return;
  if (!sellers || !sellers.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted">Sin vendedores activos de Ventas.</td></tr>';
    return;
  }
  tbody.innerHTML = sellers.map(function(row) {
    const closeRate = row.close_rate_count != null ? row.close_rate_count : null;
    const margin = row.avg_real_margin != null ? row.avg_real_margin : null;
    const sem = row.traffic_light && row.traffic_light !== 'gray'
      ? renderTrafficLight(row.traffic_light)
      : '<span class="kpi-no-data">—</span>';
    return '<tr>'
      + '<td>' + escapeHtml(row.full_name) + '</td>'
      + '<td>' + formatVentasTableCell(row.has_quote_data ? row.quotes_sent : null) + '</td>'
      + '<td>' + formatVentasTableCell(row.has_quote_data ? row.quoted_amount_mxn : null, 'currency') + '</td>'
      + '<td>' + formatVentasTableCell(row.projects_closed > 0 ? row.projects_closed : (row.has_sold_data ? 0 : null)) + '</td>'
      + '<td>' + formatVentasTableCell(row.has_sold_data || row.projects_closed > 0 ? row.sold_amount_mxn : null, 'currency') + '</td>'
      + '<td>' + formatVentasTableCell(closeRate, 'percent') + '</td>'
      + '<td>' + formatVentasTableCell(margin, 'percent') + '</td>'
      + '<td>' + formatVentasTableCell(row.collected_amount_mxn, 'currency') + '</td>'
      + '<td class="kpi-semaphore-cell">' + sem + '</td>'
      + '</tr>';
  }).join('');
}

function renderVentasAlertsGrouped(groups) {
  const wrap = document.getElementById('kpi-ventas-alerts-wrap');
  if (!wrap) return;
  if (!groups || !groups.length) {
    wrap.innerHTML = '';
    return;
  }
  const initialLimit = 5;
  let html = '<h4 style="margin:0 0 8px;">Cotizaciones sin seguimiento</h4>';
  html += '<div class="kpi-ventas-alert-groups">';
  groups.forEach(function(g, idx) {
    const hiddenClass = idx >= initialLimit ? ' hidden kpi-alert-group-collapsed' : '';
    html += '<details class="kpi-ventas-alert-group' + hiddenClass + '"' + (idx < initialLimit ? ' open' : '') + '>';
    html += '<summary><strong>' + escapeHtml(g.seller_name) + '</strong> — ' + g.count + ' cotización' + (g.count === 1 ? '' : 'es') + ' sin seguimiento</summary>';
    html += '<ul class="kpi-ventas-alert-list">';
    g.alerts.forEach(function(a) {
      html += '<li>' + escapeHtml(a.quote_number || ('Proyecto #' + a.project_id))
        + (a.client_name ? ' · ' + escapeHtml(a.client_name) : '')
        + (a.date ? ' · ' + escapeHtml(a.date) : '') + '</li>';
    });
    html += '</ul></details>';
  });
  html += '</div>';
  if (groups.length > initialLimit) {
    html += '<button type="button" class="secondary kpi-ventas-alerts-toggle" id="kpi-ventas-alerts-toggle">Ver todas (' + groups.length + ')</button>';
  }
  wrap.innerHTML = html;
  const toggleBtn = document.getElementById('kpi-ventas-alerts-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      wrap.querySelectorAll('.kpi-alert-group-collapsed').forEach(function(el) {
        el.classList.remove('hidden', 'kpi-alert-group-collapsed');
      });
      toggleBtn.remove();
    });
  }
}

function renderVentasSection(ventas) {
  if (!ventas) return;
  const cardsEl = document.getElementById('kpi-ventas-cards');
  const groups = [
    { title: 'Captación', keys: ['quotes_sent', 'quoted_amount_mxn'] },
    { title: 'Cierre', keys: ['projects_closed', 'sold_amount_mxn', 'close_rate_count', 'close_rate_amount'] },
    { title: 'Rentabilidad', keys: ['avg_real_margin', 'avg_desired_margin', 'margin_gap_points'] },
    { title: 'Cobro', keys: ['collected_amount_mxn'] },
  ];
  const metricDefs = {
    quotes_sent: 'Cotizaciones enviadas (cant.)',
    quoted_amount_mxn: 'Monto cotizado (MXN)',
    projects_closed: 'Proyectos cerrados (cant.)',
    sold_amount_mxn: 'Monto vendido (MXN)',
    close_rate_count: 'Tasa de cierre por cantidad (%)',
    close_rate_amount: 'Tasa de cierre por monto (%)',
    avg_real_margin: 'Margen real promedio (%)',
    avg_desired_margin: 'Margen deseado promedio (%)',
    margin_gap_points: 'Brecha margen (pts)',
    collected_amount_mxn: 'Monto cobrado (MXN)',
  };
  let hasAnyCard = false;
  if (cardsEl) {
    cardsEl.innerHTML = groups.map(function(group) {
      const cards = group.keys.map(function(key) {
        const metric = ventas[key];
        if (!metric || !metric.has_data) return '';
        hasAnyCard = true;
        return '<div class="kpi-card"><span class="kpi-card-label">' + escapeHtml(metricDefs[key]) + '</span><strong>' + escapeHtml(metric.display) + '</strong></div>';
      }).join('');
      if (!cards.trim()) return '';
      return '<div class="kpi-ventas-card-group"><h4 class="kpi-ventas-group-title">' + escapeHtml(group.title) + '</h4><div class="kpi-cards kpi-ventas-cards">' + cards + '</div></div>';
    }).join('');
    if (!hasAnyCard) {
      cardsEl.innerHTML = '<p class="muted kpi-chart-empty">Sin datos de ventas en el periodo seleccionado.</p>';
    }
  }

  const pendingEl = document.getElementById('kpi-ventas-pending');
  if (pendingEl) {
    if (ventas.pending_capture && ventas.pending_capture.months && ventas.pending_capture.months.length) {
      pendingEl.classList.remove('hidden');
      pendingEl.innerHTML = '<p class="kpi-pending-capture-title"><strong>Pendiente de captura</strong></p>'
        + '<p class="muted">' + escapeHtml(ventas.pending_capture.message) + '</p>';
    } else {
      pendingEl.classList.add('hidden');
      pendingEl.innerHTML = '';
    }
  }

  try {
    renderVentasCharts(ventas);
  } catch (chartErr) {
    console.error('Error al renderizar graficas Ventas:', chartErr);
  }

  renderVentasSellersTable(ventas.sellers_table || []);
  renderVentasAlertsGrouped(ventas.sales_alerts_by_seller || []);
}

function renderEmployeeKpiSummary(kpis) {
  if (!kpis || typeof kpis !== 'object') return '—';
  return Object.entries(kpis).map(function(entry) {
    const label = getKpiFieldLabel(entry[0]);
    const display = formatKpiDisplayValue(entry[0], entry[1]);
    return escapeHtml(label) + ': ' + escapeHtml(display);
  }).join(' · ');
}


function renderTrafficLight(color) {
  const labels = { green: 'Verde', yellow: 'Amarillo', red: 'Rojo', critical: 'Critico', gray: 'N/A' };
  return '<span class="kpi-semaphore kpi-semaphore-' + escapeHtml(color || 'gray') + '" title="' + escapeHtml(labels[color] || 'N/A') + '"></span>';
}

function renderKpiMetric(label, kpiObj) {
  const display = kpiObj && kpiObj.display != null ? kpiObj.display : (kpiObj != null ? String(kpiObj) : '—');
  const cls = kpiObj && kpiObj.available === false ? ' kpi-unavailable' : '';
  return '<div class="kpi-metric' + cls + '"><span class="kpi-metric-label">' + escapeHtml(label) + '</span><strong>' + escapeHtml(display) + '</strong></div>';
}

function renderKpiSectionMetrics(containerId, metrics) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = metrics.map(function(m) { return renderKpiMetric(m.label, m.value); }).join('');
}

function buildKpiQueryParams() {
  const form = document.getElementById('kpi-filter-form');
  if (!form) return '';
  const fd = new FormData(form);
  const params = new URLSearchParams();
  ['periodType', 'startDate', 'endDate', 'department', 'employeeId', 'clientName', 'projectId', 'status'].forEach(function(key) {
    const val = fd.get(key);
    if (val) params.set(key, val);
  });
  return params.toString();
}

async function loadKpiFilters() {
  if (kpiFiltersLoaded) return;
  const data = await api('/api/kpis/filters');
  const deptSel = document.getElementById('kpi-department');
  const empSel = document.getElementById('kpi-employee');
  const clientSel = document.getElementById('kpi-client');
  const projSel = document.getElementById('kpi-project');
  const statusSel = document.getElementById('kpi-status');
  if (deptSel && data.departments) {
    data.departments.forEach(function(d) {
      deptSel.innerHTML += '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + '</option>';
    });
  }
  if (empSel && data.employees) {
    data.employees.forEach(function(e) {
      empSel.innerHTML += '<option value="' + e.employeeId + '">' + escapeHtml(e.fullName) + '</option>';
    });
  }
  if (clientSel && data.clients) {
    data.clients.forEach(function(c) {
      clientSel.innerHTML += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    });
  }
  if (projSel && data.projects) {
    data.projects.forEach(function(p) {
      projSel.innerHTML += '<option value="' + p.id + '">' + escapeHtml(p.quote_number + ' - ' + p.client_name) + '</option>';
    });
  }
  if (statusSel && data.statuses) {
    Object.values(data.statuses).flat().forEach(function(s) {
      statusSel.innerHTML += '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>';
    });
  }
  kpiFiltersLoaded = true;
}

function renderKpiDashboard(summary, alerts, employees) {
  const cardsEl = document.getElementById('kpi-summary-cards');
  if (cardsEl && summary.summary_cards) {
    const visibleCards = summary.summary_cards.filter(function(c) {
      return c.section !== 'ventas' || (c.value && c.value !== '—' && c.value !== 'Dato no capturado' && c.value !== 'Dato no disponible');
    });
    cardsEl.innerHTML = visibleCards.map(function(c) {
      let val = c.value;
      if (/MXN|cotizado|vendido|cobrado|facturado/i.test(c.label) && typeof val === 'number') {
        val = formatCurrencyMXN(val);
      }
      return '<div class="kpi-card"><span class="kpi-card-label">' + escapeHtml(c.label) + '</span><strong>' + escapeHtml(val) + '</strong></div>';
    }).join('');
  }
  const periodLabel = document.getElementById('kpi-period-label');
  if (periodLabel && summary.period) {
    periodLabel.textContent = 'Periodo: ' + (summary.period.label || '') + ' (Hora CDMX)';
  }

  try {
    renderKpiCharts(summary);
  } catch (chartErr) {
    console.error('Error al renderizar graficas KPI:', chartErr);
  }

  renderVentasSection(summary.ventas);

  renderKpiSectionMetrics('kpi-proyectos-content', [
    { label: 'Proyectos activos', value: summary.proyectos.active_projects },
    { label: 'Margen bruto real (%)', value: summary.proyectos.gross_margin_real },
    { label: 'Proyectos margen rojo', value: summary.proyectos.red_margin_projects },
    { label: 'Cumplimiento entrega (%)', value: summary.proyectos.delivery_compliance },
    { label: 'Retrabajos', value: summary.proyectos.reworks },
    { label: 'Tasa retrabajo (%)', value: summary.proyectos.rework_rate },
    { label: 'Cierre tecnico pendiente', value: summary.proyectos.technical_close_pending },
  ]);

  renderKpiSectionMetrics('kpi-reportes-content', [
    { label: 'Reportes completos (%)', value: summary.reportes.complete_reports },
    { label: 'Reportes completos (#)', value: summary.reportes.complete_count },
    { label: 'Evidencias completas (%)', value: summary.reportes.complete_evidence },
    { label: 'Servicios sin reporte', value: summary.reportes.services_without_report },
  ]);

  renderKpiSectionMetrics('kpi-facturacion-content', [
    { label: 'Facturas emitidas', value: summary.facturacion.invoices_issued },
    { label: 'Monto facturado (MXN)', value: summary.facturacion.invoiced_amount_mxn },
    { label: 'Tiempo facturacion (dias)', value: summary.facturacion.billing_time_days },
    { label: 'Facturas canceladas', value: summary.facturacion.cancelled_invoices },
    { label: 'Facturas con error', value: summary.facturacion.error_invoices },
    { label: 'Pendientes documentacion', value: summary.facturacion.pending_documentation },
  ]);

  renderKpiSectionMetrics('kpi-cobranza-content', [
    { label: 'Monto cobrado (MXN)', value: summary.cobranza.collected_amount_mxn },
    { label: 'Facturas cobradas', value: summary.cobranza.collected_invoices },
    { label: 'Dias prom. cobranza', value: summary.cobranza.avg_collection_days },
    { label: 'Cartera vencida (%)', value: summary.cobranza.overdue_portfolio },
    { label: 'Cuentas +120 dias', value: summary.cobranza.accounts_over_120_days },
    { label: 'Sin contacto de pago', value: summary.cobranza.invoices_without_contact },
  ]);

  const deptContent = document.getElementById('kpi-departments-content');
  if (deptContent && summary.departments) {
    deptContent.innerHTML = renderDepartmentKpis(summary.departments);
  }

  const empTable = document.getElementById('kpi-employees-table');
  if (empTable && employees && employees.employees) {
    empTable.innerHTML = employees.employees.map(function(e) {
      return '<tr><td>' + escapeHtml(e.employee) + '</td><td>' + escapeHtml(e.department) + '</td><td>' + renderEmployeeKpiSummary(e.kpis) + '</td><td>' + renderTrafficLight(e.traffic_light) + '</td><td>' + (e.alerts && e.alerts.length ? e.alerts.length : '0') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">Sin empleados activos en departamentos medibles.</td></tr>';
  }

  const alertsTable = document.getElementById('kpi-alerts-table');
  if (alertsTable && alerts && alerts.alerts) {
    alertsTable.innerHTML = alerts.alerts.slice(0, 100).map(function(a) {
      const link = a.link ? (a.link.quote_number || ('Proyecto #' + a.link.project_id)) : '—';
      const sem = a.traffic_light ? renderTrafficLight(a.traffic_light) : '';
      return '<tr><td>' + sem + escapeHtml(a.severity) + '</td><td>' + escapeHtml(a.type) + '</td><td>' + escapeHtml(a.responsible || '') + '</td><td>' + escapeHtml(a.date || '') + '</td><td>' + escapeHtml(a.suggested_action || '') + '</td><td>' + escapeHtml(link) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Sin alertas para el periodo seleccionado.</td></tr>';
  }

  const unassignedEl = document.getElementById('kpi-unassigned');
  const unassignedList = document.getElementById('kpi-unassigned-list');
  if (unassignedEl && unassignedList && summary.unassigned_employees && summary.unassigned_employees.length) {
    unassignedEl.classList.remove('hidden');
    unassignedList.innerHTML = summary.unassigned_employees.map(function(e) {
      return '<li>' + escapeHtml(e.fullName) + (e.department ? ' (' + escapeHtml(e.department) + ')' : '') + '</li>';
    }).join('');
  } else if (unassignedEl) {
    unassignedEl.classList.add('hidden');
  }
}

async function loadKpiDashboard() {
  const loading = document.getElementById('kpi-loading');
  const errorEl = document.getElementById('kpi-error');
  const denied = document.getElementById('kpis-access-denied');
  const dashboard = document.getElementById('kpis-dashboard');
  if (state.userRole !== 'admin') {
    if (denied) denied.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    return;
  }
  if (denied) denied.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  if (loading) loading.classList.remove('hidden');
  if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }
  try {
    await loadKpiFilters();
    const qs = buildKpiQueryParams();
    const [summary, alerts, employees] = await Promise.all([
      api('/api/kpis/summary?' + qs),
      api('/api/kpis/alerts?' + qs),
      api('/api/kpis/employees?' + qs),
    ]);
    renderKpiDashboard(summary, alerts, employees);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error al cargar el Tablero KPIs.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function initKpiDashboard() {
  if (state.userRole !== 'admin') {
    const denied = document.getElementById('kpis-access-denied');
    const dashboard = document.getElementById('kpis-dashboard');
    if (denied) denied.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    return;
  }
  loadKpiDashboard();
}


function bindKpiModalBackdropClose(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay || overlay.dataset.kpiBackdropBound === '1') return;
  overlay.dataset.kpiBackdropBound = '1';
  let downOnBackdrop = false;
  overlay.addEventListener('mousedown', function(ev) {
    downOnBackdrop = ev.target === overlay;
  });
  overlay.addEventListener('click', function(ev) {
    if (downOnBackdrop && ev.target === overlay) {
      overlay.classList.add('hidden');
      if (overlayId === 'kpi-reauth-modal') {
        const resolve = closeKpiReauthModal();
        if (resolve) resolve(false);
      }
    }
    downOnBackdrop = false;
  });
}

(function initKpiModule() {
  bindKpiModalBackdropClose('kpi-reauth-modal');
  bindKpiModalBackdropClose('kpi-manual-quotes-modal');
  bindKpiModalBackdropClose('kpi-config-modal');
  setupKpiEmployeeConfigHandlersOnce();
  const kpiTab = document.getElementById('kpis-tab');
  if (kpiTab) {
    kpiTab.addEventListener('click', function() { switchView('kpis'); });
  }
  const kpiForm = document.getElementById('kpi-filter-form');
  if (kpiForm) {
    kpiForm.addEventListener('submit', function(e) {
      e.preventDefault();
      loadKpiDashboard();
    });
    const periodSel = document.getElementById('kpi-period-type');
    if (periodSel) {
      periodSel.addEventListener('change', function() {
        const custom = periodSel.value === 'custom';
        const startLbl = document.getElementById('kpi-start-label');
        const endLbl = document.getElementById('kpi-end-label');
        if (startLbl) startLbl.style.display = custom ? 'flex' : 'none';
        if (endLbl) endLbl.style.display = custom ? 'flex' : 'none';
      });
    }
  }

  const btnMq = document.getElementById('kpi-btn-manual-quotes');
  if (btnMq) btnMq.addEventListener('click', openKpiManualQuotesModal);
  const btnCfg = document.getElementById('kpi-btn-config');
  if (btnCfg) {
    btnCfg.addEventListener('click', function() {
      openKpiConfigModal().catch(function(err) {
        console.error('KPI config button error:', err);
        alert(err.message || 'No se pudo abrir la configuracion KPI.');
      });
    });
  }
  const btnPdf = document.getElementById('kpi-btn-export-pdf');
  if (btnPdf) btnPdf.addEventListener('click', exportKpiPdf);
  const btnXls = document.getElementById('kpi-btn-export-excel');
  if (btnXls) btnXls.addEventListener('click', exportKpiExcel);
  const mqForm = document.getElementById('kpi-manual-quotes-form');
  if (mqForm) {
    mqForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const msg = document.getElementById('kpi-mq-message');
      const empVal = document.getElementById('kpi-mq-employee').value;
      if (!empVal) {
        if (msg) { msg.textContent = 'Seleccione una vendedora.'; msg.classList.remove('hidden'); }
        return;
      }
      const currency = document.getElementById('kpi-mq-currency').value;
      const quotedOriginal = parsePlainAmount(document.getElementById('kpi-mq-amount').value);
      const exchangeRate = currency === 'MXN' ? 1 : (Number(document.getElementById('kpi-mq-rate').value) || 0);
      if (currency !== 'MXN' && exchangeRate <= 0) {
        if (msg) { msg.textContent = 'Tipo de cambio debe ser mayor a cero.'; msg.classList.remove('hidden'); }
        return;
      }
      const quotedMxn = currency === 'MXN' ? quotedOriginal : quotedOriginal * exchangeRate;
      const id = document.getElementById('kpi-mq-id').value;
      const body = {
        year: Number(document.getElementById('kpi-mq-year').value),
        month: Number(document.getElementById('kpi-mq-month').value),
        department: 'Ventas',
        employee_id: Number(empVal),
        quotes_sent_count: Number(document.getElementById('kpi-mq-count').value),
        quoted_amount_original: quotedOriginal,
        currency: currency,
        exchange_rate_to_mxn: exchangeRate,
        quoted_amount_mxn: Math.round(quotedMxn * 100) / 100,
        notes: document.getElementById('kpi-mq-notes').value,
      };
      if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
      try {
        if (id) await api('/api/kpis/manual-quotes/' + id, { method: 'PUT', body: body });
        else await api('/api/kpis/manual-quotes', { method: 'POST', body: body });
        resetKpiManualQuoteForm();
        await refreshKpiManualQuotesList();
        await loadKpiDashboard();
      } catch (err) {
        if (msg) { msg.textContent = err.message || 'No se pudo guardar la captura.'; msg.classList.remove('hidden'); }
      }
    });
    ['kpi-mq-amount', 'kpi-mq-currency', 'kpi-mq-rate'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', syncKpiQuoteAmountFields);
    });
    document.getElementById('kpi-mq-year')?.addEventListener('change', refreshKpiManualQuotesList);
    document.getElementById('kpi-mq-month')?.addEventListener('change', refreshKpiManualQuotesList);
  }
  document.getElementById('kpi-mq-cancel')?.addEventListener('click', function() {
    document.getElementById('kpi-manual-quotes-modal').classList.add('hidden');
  });
  document.getElementById('kpi-config-close')?.addEventListener('click', function() {
    document.getElementById('kpi-config-modal').classList.add('hidden');
  });
  const settingsForm = document.getElementById('kpi-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const ok = await ensureKpiReauth();
      if (!ok) return;
      const body = {
        margin_green_percent: Number(document.getElementById('kpi-set-margin-green').value),
        margin_yellow_percent: Number(document.getElementById('kpi-set-margin-yellow').value),
        margin_red_percent: Number(document.getElementById('kpi-set-margin-red').value),
        receivable_bucket1_days: Number(document.getElementById('kpi-set-bucket1').value),
        receivable_bucket2_days: Number(document.getElementById('kpi-set-bucket2').value),
        receivable_bucket3_days: Number(document.getElementById('kpi-set-bucket3').value),
        receivable_critical_days: Number(document.getElementById('kpi-set-bucket-crit').value),
        report_missing_critical_days: Number(document.getElementById('kpi-set-report-days').value),
        require_manual_quote_capture: document.getElementById('kpi-set-require-capture').checked,
      };
      await api('/api/kpis/settings', { method: 'PUT', body: body });
      await loadKpiDashboard();
      alert('Parametros KPI guardados.');
    });
  }

})();


```
