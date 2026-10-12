# Contexto de implementación — Reestructuración UI / Proyectos

Documento de continuidad para retomar el trabajo sin depender del hilo de chat.
**Etapa 4: auditoría final integridad + M6 OK; pendiente autorización push/PR** — última actualización: 2026-10-12.

| Campo | Valor |
|-------|--------|
| Rama Etapa 4 | `cursor/project-workspace-tabs-0cc1` |
| HEAD | `6acc8f9` (tip local; ver `git rev-parse HEAD`) |
| Base autorizada | `origin/main` @ `ce6f63d` (PR #85 — Etapas 1–3) |
| Continuidad Etapa 3 (rama histórica) | `cursor/stage3-invoice-settlement-c0b6` / pin `8e635b8` |
| PRs cerrados | #83 (Etapa 1), #84 (Etapa 2), #85 (Etapa 3 + FX) |
| Push / PR Etapa 4 | **no** (sin autorización explícita) |
| Siguiente trabajo | Autorización explícita de push/PR si se acepta §10.9 — no Etapa 5 |

> No almacenar contraseñas, tokens, cookies ni secretos en este documento.
> Credenciales de desarrollo: ver `AGENTS.md` / variables de entorno del entorno local.

---

## 1. Estado final de etapas

| Etapa | Contenido | Estado | Commits / ref |
|-------|-----------|--------|----------------|
| 1 | Aislamiento formularios pago/costo + confirm discard + anti-stale | **Cerrada** | #83 / `08cd8b3` |
| 2 | Warning/renovación sesión + borradores seguros | **Cerrada** | #84 / `78d2697` |
| 3 | Liquidación Pagada atómica + integridad + snapshots FX | **Cerrada en main** | #85 / `ce6f63d` |
| 4 | UI listado full-width + workspace 5 pestañas + FACTURADO + historial | **Corregida + auditada (M6 OK); push/PR pendiente OK** | ver §10.8 / §10.9 |
| 5 | Filtros/agrupación cerrados por fecha de **creación** | Pendiente | — |
| 6 | Pruebas integrales / validación financiera amplia | Pendiente | — |

**Commits Etapa 4 en `cursor/project-workspace-tabs-0cc1` (no en `origin/main`; SHAs locales tras recuperación):**

```
(docs)   Document Stage 4 C1/M1–M5 correction closure
760df44  Add Stage 4 C1/M1–M5 regression coverage
adf7870  Fix Stage 4 M4 historial settlement labeling
c57046d  Fix Stage 4 C1/M1/M2/M3/M5 project form refresh races
ad3ebfe  Restore Stage 4 workspace/historial from prior agent (pre-C1)
```

> Nota: el agente previo tenía HEAD `aa45eae` solo local (nunca pusheado). Esta rama se reconstruyó desde el transcript sobre `ce6f63d` y luego aplicó las correcciones.

No implementar etapas en paralelo. Migraciones BD solo con autorización explícita (FX ya en código vía #85; **producción pendiente de autorización independiente**).

---

## 2. Arquitectura vigente

- **App:** Node.js/Express (“Control de Proyectos”) + frontend vanilla (`public/`), sin build step.
- **BD:** SQLite (`data/app.db`, `better-sqlite3`) sin `DATABASE_URL`; PostgreSQL (`pg` + adaptador) con `DATABASE_URL`.
- **Auth:** `express-session`, cookie `proyectos.sid`, store en `sessions`; TTL 60 min (`SESSION_TTL_MS`); `POST /api/session/extend`; sin rolling en `GET /api/session`.
- **Ejes independientes de proyecto:** `status` técnico ≠ `invoice_payment_status` ≠ `closed_at`.
- **Módulo proyectos:** CRUD, pagos, costos, cierre/restauración, reportes, export Excel, **liquidación Pagada**, snapshots FX de cobro.
- **Cálculos:** `src/calculations.js` → `buildProjectTotals` (facturado/cobrado/gastado/pendiente/margen). Cobrado/facturado MXN usan **snapshot si existe**, si no estimación viva.
- **SQL de listados:** `PROJECT_INVOICED_SQL` / `PROJECT_CHARGED_SQL` / `PROJECT_PENDING_SQL` alineados con la misma precedencia.
- **Fuera de alcance de esta iniciativa:** ECOVIS, KPI, asistencia, vacaciones, cotizador (no modificar en Etapas 1–4 salvo autorización).

### UI actual (pre–Etapa 4)

- Formulario izquierdo + listado + drawer overlay (deuda UX: Etapa 4).
- Modal liquidación `#invoice-settle-modal`.
- Modales sesión / borradores (Etapa 2).

---

## 3. Etapa 1 — Cerrada

**Objetivo:** sin fuga de importes/fechas/notas entre proyectos.

**Entregado:** `clearCurrencyValue` en reset de pago/costo; confirm al cambiar proyecto; `AbortController` + token anti-stale; submit amarra `projectId`.

**Archivos:** `public/project-form-isolation.js`, `src/projectFormIsolation.js`, `public/app.js`, tests + `scripts/verify-form-isolation.mjs`.

---

## 4. Etapa 2 — Cerrada

**Objetivo:** aviso de sesión, renovación explícita, borradores seguros.

**Entregado:** warning ≤60 s; `POST /api/session/extend`; borradores en `sessionStorage` (tipos `project_edit`, `payment_new`, `cost_new`); aislamiento por `userId`+`projectId`; 401 controlado.

**Archivos:** `public/session-drafts.js`, `src/sessionDrafts.js`, `src/server.js`, tests + scripts `verify-session-stage2.mjs` / `verify-stage2-handoff.mjs`.

---

## 5. Etapa 3 — Cerrada (desarrollo)

### 5.1 Endpoints de liquidación

| Método | Ruta | Permiso | Efecto |
|--------|------|---------|--------|
| GET | `/api/projects/:id/settlement-preview` | `projects`/`edit` | Preview sin escritura |
| POST | `/api/projects/:id/settle-invoice` | `projects`/`edit` | Liquidación atómica |

Body mínimo de settle:

```json
{
  "invoice_paid_at": "YYYY-MM-DD",
  "expected_pending_mxn": 123.45,
  "confirm": true,
  "confirm_mxn_matches_real_payment": true
}
```

(`confirm_mxn_matches_real_payment` obligatorio solo si hay pago residual y factura ≠ MXN.)

**Reglas de estatus:**

- Toda transición **nueva** a `Pagada` → solo vía settle.
- `PUT`/`POST` `/api/projects` rechazan marcar `Pagada` si el proyecto no lo estaba ya.
- Históricos ya `Pagada` pueden seguir enviando `Pagada` en PUT (compatibilidad).

### 5.2 Concurrencia

| Motor | Mecanismo |
|-------|-----------|
| PostgreSQL | `SELECT … FOR UPDATE` sobre el proyecto dentro de TX |
| SQLite | `BEGIN IMMEDIATE` (`runImmediateTransaction` / `.immediate`) + `busy_timeout = 5000` |
| Coordinación | Pagos manuales y settle usan el mismo lock de fila/proyecto |
| Idempotencia operativa | `expected_pending_mxn` → 409 `SETTLEMENT_STALE` si el saldo cambió; no basta sola (el lock es obligatorio) |

### 5.3 Monedas (MXN / USD / EUR)

- Factura MXN: residual = pending exacto en MXN.
- Factura USD/EUR: preview muestra moneda original, facturado, cobrado, TC y pendiente MXN; liquidación residual en **MXN** tras confirmación explícita.
- Opción UI “Registrar pago manual” cancela la liquidación automática.
- Sobrepago (`pending < -0.01`): bloquea settle (`SETTLEMENT_BLOCKED`); pagos manuales nuevos rechazan sobrepago (`PAYMENT_OVERPAY`).
- Saldo ≈ 0: `Pagada` sin crear movimiento (`status_only`).

### 5.4 Snapshots de tipo de cambio

Ver §6 (migración) y reglas:

- Cada pago nuevo guarda `amount`, `currency`, `exchange_rate_to_mxn`, `amount_mxn`.
- Al liquidar: snapshot de factura `invoiced_exchange_rate_to_mxn` + `invoiced_amount_mxn` (si no existía; si existía tras reapertura, se conserva).
- Totales: `COALESCE(snapshot, estimación viva)`.
- API: `amount_mxn_is_historical`, `invoiced_amount_mxn_is_historical`.
- Criterio aceptación: 100 USD → 1,700 MXN @ 17; TC→20 ⇒ sigue `Pagada`, pending 0.

### 5.5 Integridad post-liquidación

| Acción | Comportamiento |
|--------|----------------|
| Delete pago (admin password) | Si pending real > 0.01 → `Pendiente`, `invoice_paid_at=null`; **no** borra snapshot de factura; sin pagos auto; audit `reopen_invoice_payment_status` |
| PUT importe/moneda con `Pagada` y saldo material | 409 `INVOICE_AMOUNT_REQUIRES_STATUS_REVIEW` |
| PUT importe/moneda pasando a `Pendiente` | Permite el cambio; **invalida** snapshot de factura (`NULL`); metadata audit `invoice_fx_snapshot_cleared: true` |
| Proyectos cerrados | Settle permitido; no altera `closed_at` / `created_at` / `status` técnico |
| Delete pago admin | Mecanismo de contraseña **sin cambios** |

### 5.6 Archivos Etapa 3

- `src/projectInvoiceSettlement.js`, `src/calculations.js`, `src/server.js`
- `src/db/projectPaymentFxMigration.js`, `sqliteDriver.js`, `postgresDriver.js`, `postgresSchema.sql`, `betterSqlite3Adapter.js`
- `public/app.js`, `public/index.html`, `public/styles.css`
- Tests: `project-invoice-settlement*.test.js`, `project-payment-fx-snapshot*.test.js`, `project-invoice-payment.test.js`

### 5.7 Pruebas (desarrollo / BD dedicada)

| Suite | Resultado |
|-------|-----------|
| `test/project-invoice-settlement.test.js` | OK |
| `test/project-invoice-payment.test.js` | OK |
| `test/project-invoice-settlement-integrity.test.js` | OK |
| `test/project-payment-fx-snapshot.test.js` | OK (50 tests suite agregada con calculations) |
| PG: settlement + integrity + FX (`TEST_DATABASE_URL`, `--test-concurrency=1`) | OK |
| UI manual | Modal MXN/USD verificado en agente (artefactos bajo `/opt/cursor/artifacts/`) |

**Nunca** apuntar tests PG a producción (`DROP SCHEMA public CASCADE`).

---

## 6. Migración FX — referencia operativa

### 6.1 Nombre y ubicación

| Ítem | Valor |
|------|--------|
| Módulo | `src/db/projectPaymentFxMigration.js` |
| Función | `migrateProjectPaymentFx(database, { postgres })` |
| Invocación SQLite | `src/db/sqliteDriver.js` → al final de `migrate()` |
| Invocación PostgreSQL | `src/db/postgresDriver.js` → `ensurePostgresColumns()` |
| Schema fresco PG | columnas también en `src/db/postgresSchema.sql` |

No hay archivo SQL de migración numerado aparte: es **ensure-on-boot** idempotente.

### 6.2 Columnas nuevas

| Tabla | Columna | Tipo | Nullable |
|-------|---------|------|----------|
| `project_payments` | `exchange_rate_to_mxn` | REAL / DOUBLE PRECISION | Sí |
| `project_payments` | `amount_mxn` | REAL / DOUBLE PRECISION | Sí |
| `projects` | `invoiced_exchange_rate_to_mxn` | REAL / DOUBLE PRECISION | Sí |
| `projects` | `invoiced_amount_mxn` | REAL / DOUBLE PRECISION | Sí |

No se modifican `amount`, `currency`, fechas ni filas existentes de pago.

### 6.3 Registros históricos

- Filas preexistentes: `amount_mxn` y `exchange_rate_to_mxn` quedan **NULL**.
- **Sin backfill** con TC actual (prohibido inventar historia).
- Consulta: estimación viva solo como operativa; API marca `amount_mxn_is_historical: false`.
- Proyectos ya `Pagada` sin snapshot de factura: pending sigue sensible a `exchange_rates` hasta re-liquidar (limitación documentada).

### 6.4 Aplicar en PostgreSQL (no producción sin auth independiente)

1. **Respaldo:** `pg_dump "$DATABASE_URL" -Fc -f backup-pre-fx-$(date +%Y%m%d).dump`
2. Desplegar código que incluye `projectPaymentFxMigration.js` (o ejecutar ensure en arranque).
3. Arrancar la app con `DATABASE_URL` apuntando al entorno objetivo: `ensurePostgresColumns` aplica `ADD COLUMN IF NOT EXISTS`.
4. Alternativa manual (misma semántica):

```sql
ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS exchange_rate_to_mxn DOUBLE PRECISION;
ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS amount_mxn DOUBLE PRECISION;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_exchange_rate_to_mxn DOUBLE PRECISION;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_amount_mxn DOUBLE PRECISION;
```

### 6.5 Verificar aplicación

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('project_payments', 'projects')
  AND column_name IN (
    'exchange_rate_to_mxn', 'amount_mxn',
    'invoiced_exchange_rate_to_mxn', 'invoiced_amount_mxn'
  )
ORDER BY table_name, column_name;
```

Esperado: 4 filas, `is_nullable = YES`.

SQLite: `PRAGMA table_info(project_payments);` / `PRAGMA table_info(projects);`

Comprobar que pagos antiguos siguen con `amount_mxn IS NULL`:

```sql
SELECT COUNT(*) FROM project_payments WHERE amount_mxn IS NULL;
```

### 6.6 Reversión

- **Datos:** la migración solo añade columnas nullable; revertir esquema es opcional (`DROP COLUMN` en PG 11+). Preferible: **restaurar el `pg_dump`** si algo falla.
- **Código:** rollback del release al commit anterior a `5c79b5c` / `30b94e4` según alcance; si se deja código nuevo sin columnas → riesgo (§6.7).
- No se eliminan pagos ni se reescriben montos al revertir columnas vacías.

### 6.7 Riesgo: código nuevo sin migrar primero

Si se despliega `5c79b5c+` contra una BD **sin** las 4 columnas:

- `INSERT`/`UPDATE`/`SELECT` que referencian `amount_mxn` / `invoiced_amount_mxn` pueden fallar (error SQL).
- Mitigación: el arranque normal aplica la migración automáticamente; **no** usar `PG_SKIP_SCHEMA` de forma que omita `ensurePostgresColumns` sin haber migrado a mano.
- Orden seguro: backup → deploy código → arranque (ensure) → verificar columnas → smoke settle.

**Producción:** no ejecutar sin autorización independiente explícita.

---

## 7. Integridad financiera — factura liquidada

### 7.1 Modificar importe o moneda de una factura `Pagada`

1. El PUT proyecta el nuevo facturado **sin** usar el snapshot de factura (para detectar saldo material).
2. Si el resultado deja pending material y el body sigue con `Pagada` → **409** `INVOICE_AMOUNT_REQUIRES_STATUS_REVIEW` (no se guarda el cambio).
3. Si el usuario pone `Pendiente` en el mismo PUT → se acepta el nuevo importe/moneda y se pone `invoiced_* = NULL` (snapshot invalidado).
4. Los **pagos** conservan sus snapshots individuales; no se regeneran ni borran.
5. Para volver a `Pagada` hay que pasar otra vez por settle.

### 7.2 Recuperación de snapshots anteriores vía auditoría

| Evento | `action` / metadata | Qué conserva |
|--------|---------------------|--------------|
| Liquidación | `settle_invoice` | `invoiced_exchange_rate_to_mxn`, `invoiced_amount_mxn`, `rate_applied`, `rates_snapshot`, `payment_id`, `invoice_paid_at`, pending before/after |
| Pago (manual/settle) | `create` módulo `payments` | `exchange_rate_to_mxn`, `amount_mxn` en `after` / metadata |
| Clear snapshot por cambio factura | `update` proyecto | `metadata.invoice_fx_snapshot_cleared: true`; `before` incluye valores previos del proyecto (incl. `invoiced_*` si estaban en la fila) |
| Reapertura por delete | `reopen_invoice_payment_status` | pending before/after; **no** implica borrado de snapshot de factura |

**Limitación:** la auditoría guarda JSON `before`/`after`/`metadata` en `audit_logs`; no hay endpoint dedicado de “restaurar snapshot”. La recuperación es **consulta/manual** desde `audit_logs` (y los pagos históricos siguen en `project_payments` si no se eliminaron). Restaurar columnas `invoiced_*` en BD a partir del audit requeriría operación administrativa explícita (no automatizada).

### 7.3 Proyectos históricos ya `Pagada` (pre-snapshot)

- Pueden permanecer `Pagada` vía PUT (compatibilidad).
- Sin `invoiced_amount_mxn`: el pendiente usa tasas **vivas** → un cambio de `exchange_rates` puede mostrar pending ≠ 0 aunque el estatus diga Pagada.
- Pagos sin `amount_mxn`: estimación viva; `amount_mxn_is_historical: false`.
- **No** se hace backfill automático.
- Mitigación operativa: re-liquidar (settle) cuando el negocio confirme el cierre al TC acordado, o aceptar la limitación hasta Etapa 6/QA.

### 7.4 Limitaciones conocidas (sin cambio de código en este cierre)

- Costos (`project_costs`) sin snapshot FX → márgenes pueden moverse con TC.
- No hay UI de historial de auditoría de snapshot por proyecto (Etapa 4+).
- Clear de snapshot de factura no reescribe automáticamente un “archivo” de versiones; depende de `audit_logs`.

---

## 8. Decisiones de diseño vigentes

- FACTURADO (UI Etapa 4) = importe original / `total_invoiced`→MXN de presentación; no confundir con pending.
- Liquidación: endpoint dedicado; PUT no crea Pagada nueva.
- FX snapshot en pagos/liquidación de **proyectos**: implementado. Costos: vivo.
- Delete pagos/costos: contraseña administrador intacta.
- Borradores: `sessionStorage` + userId; nunca auto-movimientos.

---

## 9. Riesgos pendientes

| Riesgo | Severidad | Notas |
|--------|-----------|-------|
| **C1** Dirty Información sobrescrita por async refresh | ~~Alta~~ | **Resuelto** — §10.8 |
| `Pagada` históricos sin snapshot de factura | Media | Sensibles a TC vivo hasta re-liquidar |
| Desplegar código FX sin ensure/migración | Alta | Fallos SQL; ver §6.7 |
| Migración producción sin backup | Alta | Auth independiente + `pg_dump` |
| Audit de pagos no indexado por `project_id` en todos los eventos | Media | metadata parcial; historial UI = Etapa 4 |
| Costos sin snapshot FX | Baja | Solo márgenes |
| **M1** Historial sin AbortController/token | ~~Media~~ | **Resuelto** — §10.8 |
| **M2** loadProjects sin renderDetail en workspace | ~~Media~~ | **Resuelto** — §10.8 |
| **M3** UI sin `canAccess` create/edit/close | ~~Media~~ | **Resuelto** — §10.8 |
| **M4** Historial settlement por heurística de notas | ~~Baja~~ | **Resuelto** — §10.8 |
| **M5** Legacy sin confirm dirty form proyecto | ~~Baja~~ | **Resuelto** — §10.8 |
| **M6** Tablet / responsive | Baja | **Verificado manual 2026-10-12** — §10.9 |
| Equivalencia exacta vs commits originales no pusheados (`aa45eae`…) | Media | Objetos Git ausentes; reconstrucción desde transcript — no garantizable bit-a-bit |
| Borradores no sobreviven cierre de pestaña | Media | Intencional |
| Test backup 413 preexistente | Baja | No bloquear |
| `SESSION_SECRET` fallback si falta env | Media | Ops |

---

## 10. Etapa 4 — Implementación (autorizada)

**Objetivo:** dos niveles de UI — listado full-width + workspace de proyecto con **5 pestañas**; columna **FACTURADO (MXN)**; historial evidencia-only.

### 10.1 Entregado en código

1. Feature flag `Usar workspace de proyecto (Etapa 4)` (`sessionStorage` + reparenting DOM). Solo una UI activa; sin IDs duplicados de formularios.
2. Listado full-width en modo workspace: botón **Nuevo proyecto**, columnas **Creacion** y **FACTURADO (MXN)** con importe original si USD/EUR.
3. Workspace sin overlay: cabecera, 5 indicadores, tabs Información / Pagos / Costos / Reportes / Historial.
4. Restauración de scroll del listado; dirty-check al salir; aislamiento Etapa 1 y borradores Etapa 2 conservados.
5. Liquidación Etapa 3 reutilizada sin cambios de lógica (`settlement-preview` / `settle-invoice` / modal existente).
6. `GET /api/projects/:id/historial` — solo lectura, `projects:view`, paginación, sin secretos, sin eventos inventados.
7. Drawer legacy disponible al desactivar el flag.

### 10.2 Archivos clave Etapa 4

- `public/index.html`, `public/styles.css`, `public/app.js`
- `public/project-workspace.js`
- `src/projectHistorial.js`, `src/server.js` (ruta historial + sort `created_at`)
- `test/project-historial.test.js`, `test/project-form-isolation.test.js`, `test/stage4-c1-dirty-form.test.js`
- `scripts/verify-stage4-workspace.mjs`

### 10.3 Restricciones respetadas

- Sin nuevas migraciones; sin cambios a fórmulas / liquidación / FX snapshots.
- Sin ECOVIS / KPI / asistencia.
- Sin push a remoto ni merge a `main` en esta pasada (instrucción explícita).
- Etapas 5–6 no iniciadas.

### 10.4 Auditoría final pre-integración (2026-10-12) — solo lectura

**Rama:** `cursor/project-workspace-tabs-0cc1` · **HEAD al cierre de auditoría:** `a45940b` · **Base:** `ce6f63d`  
**Alcance:** 10 puntos verificados; **correcciones de producto no iniciadas** en esa pasada.

Resumen de scorecard: puntos 2–8 y 10 OK (con matices); punto 1 **FALLA crítica (C1)**; punto 9 parcial (tablet no manual).  
**Decisión de integración:** no mergear a `main` hasta corregir C1.

### 10.5 Hallazgos a corregir (C1, M1–M6)

#### C1 — CRÍTICO: async sobrescribe capturas dirty de Información general

| Campo | Detalle |
|-------|---------|
| Síntoma | Editar Información → ir a Pagos/Costos → guardar movimiento/settle/delete → campos de Información vuelven al servidor; `isProjectFormDirty()` queda en falso. |
| Causa | Refresh async siempre rellena el form y rebasea baseline. |
| Archivo | `public/app.js` |
| Funciones | `applyProjectListUpdate` (~1694; bloque ~1755–1770: `fillProjectForm` + `snapshotProjectFormBaseline` sin guardia); `loadProjects` (~1549; bloque ~1562–1568: `fillProjectForm` sin guardia; en workspace no llama `renderDetail`); helpers `isProjectFormDirty` (~2028), `snapshotProjectFormBaseline` (~2020), `fillProjectForm` (~2818). |
| Callers que disparan C1 | submit pago/costo; delete pago/costo; `settle-invoice` → `applyProjectListUpdate`; búsqueda/paginación → `loadProjects`. |
| No es C1 | `setWorkspaceTab` (~2124) solo oculta paneles; no destruye formularios. |
| Estado corrección | **Resuelto** (2026-10-12) — ver §10.8. |

#### M1 — Historial sin anti-stale

| Campo | Detalle |
|-------|---------|
| Riesgo | Respuesta tardía de historial puede pintar otro `projectId`. |
| Archivo | `public/app.js` → `loadWorkspaceHistorial` |
| Falta | Token / `AbortController` al estilo `beginProjectDetailLoad` / `isProjectDetailLoadCurrent`. |
| Estado | **Resuelto** — `beginHistorialLoad` / `isHistorialLoadCurrent` + abort al cambiar proyecto. |

#### M2 — `loadProjects` no refresca detalle en workspace

| Campo | Detalle |
|-------|---------|
| Riesgo | Con workspace abierto, tras `loadProjects` el form se rellena pero indicadores/listas no (`renderDetail` solo si `projectDrawerOpen`). |
| Archivo | `public/app.js` → `loadProjects` |
| Estado | **Resuelto** — `renderDetail` si drawer **o** workspace abierto; form sync solo si `!isProjectFormDirty()`. |

#### M3 — UI sin gates `canAccess` create/edit/close

| Campo | Detalle |
|-------|---------|
| Riesgo | Controles visibles sin permiso; API responde 403. |
| Archivos | `public/app.js` (`applyPermissionVisibility`, `projectRowActions`). |
| Nota | Patrón preexistente del drawer; no introducido solo por Etapa 4. |
| Estado | **Resuelto** — hide/disable create/edit/close + settle controls según `canAccess`. |

#### M4 — Etiqueta settlement en historial por heurística de notas

| Campo | Detalle |
|-------|---------|
| Riesgo | `notes` con texto `liquidaci` clasifica como settlement. |
| Archivo | `src/projectHistorial.js` |
| Mejor | Preferir `metadata.settlement` / `SETTLEMENT_PAYMENT_NOTES` de Etapa 3. |
| Estado | **Resuelto** — match exacto a `SETTLEMENT_PAYMENT_NOTES` (audit ya usa `metadata.settlement`). |

#### M5 — Legacy: cambio de proyecto no confirma dirty del form proyecto

| Campo | Detalle |
|-------|---------|
| Riesgo | En modo drawer, `selectProject` usa solo `confirmDiscardUnsavedMovementDrafts` si no workspace. |
| Archivo | `public/app.js` → `selectProject` |
| Estado | **Resuelto** — legacy confirma dirty Información vía `confirmLeaveProjectWorkspace`. |

#### M6 — Tablet no verificada manualmente

| Campo | Detalle |
|-------|---------|
| Riesgo | Breakpoint CSS 1100px existe (`public/styles.css`); sin prueba manual tablet. |
| Estado | **Verificado manual** (1440×900, 1024×768, 768×1024, 390×844) — §10.9. |

### 10.6 Decisiones autorizadas para la corrección + restricciones

**Autorizado (diseño Etapa 4 y auditoría — vigentes):**

1. Corregir **C1 de forma obligatoria** antes de push/PR/merge a `main`.
2. Conservar feature flag workspace ↔ drawer; **una sola instancia** de cada formulario (reparenting; sin IDs duplicados).
3. Conservar Etapas 1–3 intactas: aislamiento movimientos, borradores `sessionStorage`, liquidación (`settlement-preview` / `settle-invoice`), snapshots FX, delete con contraseña admin.
4. Historial permanece solo lectura (`projects:view`); sin inventar eventos; sin exponer secretos.
5. FACTURADO (MXN) = `total_invoiced_mxn` (snapshot si existe); no confundir con pendiente.

**Corrección C1 aplicada:**

- Si `isProjectFormDirty()`: **no** llamar `fillProjectForm` ni `snapshotProjectFormBaseline` en `applyProjectListUpdate` / `loadProjects`.
- Sí actualizar indicadores/listas vía `renderDetail` cuando el workspace o drawer esté abierto (sin pisar el form dirty).
- Tras guardado exitoso del proyecto (submit Información): rellenar + baseline **solo si** el form no cambió después del envío (`unchangedSinceSubmit`).
- Prueba de regresión: `test/stage4-c1-dirty-form.test.js` + anclas en `scripts/verify-stage4-workspace.mjs`.

**M1–M5:** corregidos. **M6:** verificado manual (§10.9).

**Restricciones (siguen vigentes):**

- No modificar fórmulas (`src/calculations.js` / SQL de totales) salvo hallazgo autorizado.
- No modificar lógica de liquidación ni endpoints settle existentes.
- No modificar snapshots FX ni migraciones; **no nuevas migraciones**.
- No tocar ECOVIS, KPI, asistencia, vacaciones, cotizador.
- No Etapas 5 ni 6.
- No push / merge / deploy hasta nueva autorización explícita.

### 10.7 Pruebas: existentes vs faltantes

**Cubiertas tras correcciones:**

| Artefacto | Cubre |
|-----------|--------|
| `test/stage4-c1-dirty-form.test.js` | **C1/M1–M5** regresión estática + M4 unit |
| `test/project-historial.test.js` | API historial, dedup, UI tabs/flag estáticos |
| `test/project-form-isolation.test.js` | Dirty movimientos; confirm switch (actualizado M5) |
| `test/session-drafts.test.js` / `session-extend.test.js` | Etapa 2 |
| `test/project-invoice-settlement*.test.js` / `project-payment-fx-snapshot*.test.js` | Etapa 3 |
| `test/frontend-table.test.js` | Listado / `applyProjectListUpdate` wiring |
| `scripts/verify-stage4-workspace.mjs` | Estructura Stage 4 + IDs únicos + anclas C1/M1/M2 |

**Pendiente / parcial:**

| Prueba | Objetivo |
|--------|----------|
| Reportes create/edit/print E2E | Solo se abrió el picker de tipo; falta ciclo completo |
| Scripts puppeteer verify-* | Requieren `puppeteer-core` (ausente en este entorno) |

### 10.8 Cierre de correcciones C1/M1–M5 (2026-10-12)

| Ítem | Resultado |
|------|-----------|
| C1 | `applyProjectListUpdate` / `loadProjects` respetan dirty; save race con `unchangedSinceSubmit` |
| M2 | `loadProjects` llama `renderDetail` con workspace abierto |
| M1 | `beginHistorialLoad` + `isHistorialLoadCurrent` + abort en switch |
| M3 | `applyPermissionVisibility` + `projectRowActions` gates create/edit/close |
| M4 | `SETTLEMENT_PAYMENT_NOTES` exacto en `projectHistorial.js` |
| M5 | Legacy `selectProject` confirma dirty Información |
| M6 | **Verificado** — 4 viewports PASS (artefactos en audit) |
| Evidencia C1 UI | Manual PASS: dirty sobrevive pago / tab switch |
| Integración a `main` | **Condicional** — ver §10.9 (requiere OK explícito push/PR) |

**No se tocaron (auditoría):** código de producto; solo doc de continuidad.

### 10.9 Auditoría final de integridad + responsive (2026-10-12)

**Alcance:** solo lectura / pruebas. Sin push, merge, deploy, migraciones ni Etapa 5.

| Área | Resultado |
|------|-----------|
| Git | Rama `cursor/project-workspace-tabs-0cc1` @ tip local; WT limpio; base `ce6f63d`; **8 commits** ahead; 11 files (+1958/−81 vs main) |
| Reconstrucción | SHAs originales (`aa45eae`/`33b8871`/…) **no existen** en este clone ni en `origin` → **no se garantiza equivalencia exacta** con la implementación pre-pérdida |
| Auto Etapas 1–4 | `node --test` relevantes **78/78**; `session-extend` **5/5**; `verify-stage4-workspace` OK |
| Puppeteer verify scripts | **No ejecutables** aquí (`puppeteer-core` ausente) — brecha de entorno, no fallo de producto demostrado |
| API financiera | settle atómico, parciales, sobrepago 409, FX USD/EUR, delete admin password, historial, export Excel `from`/`to` — PASS |
| UI workspace | 5 pestañas + listado (Creacion/FACTURADO/búsqueda/export) + modal liquidación + picker reportes — PASS |
| Reportes CRUD completo | **Pendiente** (solo picker “Generar reporte”; no create/edit/print E2E) |
| M6 | **PASS** en 1440×900, 1024×768, 768×1024, 390×844 |
| Recomendación | **Apto para autorizar push/PR** tras aceptar riesgo de reconstrucción + pendiente reportes E2E; **no merge automático a main** |

Artefactos: `/opt/cursor/artifacts/stage4-audit/` (API JSON, logs, `m6/*.webp`).

---

## 11. Cómo continuar

1. Revisar §10.9 y decidir autorización explícita de **push/PR**.
2. Si se autoriza: push de `cursor/project-workspace-tabs-0cc1` y abrir PR → `main` (draft recomendado).
3. Opcional post-push: completar E2E reportes (generar/editar/imprimir) en staging.
4. No Etapas 5–6 sin OK nuevo.
5. No redeploy/migración FX producción sin auth independiente.

### Checklist Git (auditoría final 2026-10-12)

| Ítem | Valor |
|------|--------|
| Rama | `cursor/project-workspace-tabs-0cc1` |
| Base Etapa 3 | `ce6f63d` (#85) |
| Push / merge / deploy | **no** (esta auditoría) |

```
git status
git rev-parse HEAD
git log --oneline origin/main..HEAD
```
