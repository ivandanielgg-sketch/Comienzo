# Contexto de implementación — Reestructuración UI / Proyectos

Documento de continuidad para retomar el trabajo sin depender del hilo de chat.
**Cierre definitivo Etapa 3** — última actualización: 2026-10-11.

| Campo | Valor |
|-------|--------|
| Rama | `cursor/stage3-invoice-settlement-c0b6` |
| HEAD código Etapa 3 | `5c79b5c` — *Add project payment FX snapshots so settled invoices stay Pagada* |
| Commit continuidad | *Document Stage 3 definitive closure for Stage 4 handoff* (este archivo; ver `git log -1`) |
| Base histórica Etapas 1–2 | `cursor/session-renewal-drafts-3848` (mergeada en esta rama) |
| PRs | #83 (Etapa 1), #84 (Etapa 2), **#85** (Etapa 3 + FX) |
| Siguiente etapa | **4 — UI workspace** (no iniciada; requiere OK explícito) |

> No almacenar contraseñas, tokens, cookies ni secretos en este documento.
> Credenciales de desarrollo: ver `AGENTS.md` / variables de entorno del entorno local.

---

## 1. Estado final de etapas

| Etapa | Contenido | Estado | Commits clave |
|-------|-----------|--------|----------------|
| 1 | Aislamiento formularios pago/costo + confirm discard + anti-stale | **Cerrada** | `31dee12`, `9df6fba` (también en main vía #83 / `08cd8b3`) |
| 2 | Warning/renovación sesión + borradores seguros | **Cerrada** | `c3e45fe`, handoff `141a1d2` |
| 3 | Liquidación Pagada atómica + integridad + snapshots FX | **Cerrada (desarrollo)** | `30b94e4` → `38ff859` → `5c79b5c` |
| 4 | UI listado full-width + workspace 5 pestañas + columna FACTURADO | **Pendiente** | — |
| 5 | Filtros/agrupación cerrados por fecha de **creación** | Pendiente | — |
| 6 | Pruebas integrales / validación financiera amplia | Pendiente | — |

**Commits de esta rama no presentes en `origin/main` (al cierre documental):**

```
<sha continuidad> Document Stage 3 definitive closure for Stage 4 handoff
5c79b5c Add project payment FX snapshots so settled invoices stay Pagada
38ff859 Harden Stage 3 post-settlement financial integrity checks
30b94e4 Implement Stage 3 atomic invoice settlement for Pagada status
7007072 Merge origin/main into session-renewal-drafts branch
141a1d2 Document Stage 2 handoff results and add cross-user draft checks
c3e45fe Add session expiry warning, renew endpoint, and safe drafts
9df6fba Add headless verification script for project form isolation
31dee12 Isolate project payment/cost forms when switching projects
```

Tras el commit de continuidad, reemplazar `<sha continuidad>` con `git rev-parse --short HEAD`.

No implementar etapas en paralelo. Migraciones BD solo con autorización explícita (la de FX ya fue autorizada e implementada en código; **producción pendiente de autorización independiente**).

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
| Drawer overlay / UX tres paneles | Alta | **Etapa 4** |
| `Pagada` históricos sin snapshot de factura | Media | Sensibles a TC vivo hasta re-liquidar |
| Desplegar código FX sin ensure/migración | Alta | Fallos SQL; ver §6.7 |
| Migración producción sin backup | Alta | Auth independiente + `pg_dump` |
| Audit de pagos no indexado por `project_id` en todos los eventos | Media | metadata parcial; historial UI = Etapa 4 |
| Costos sin snapshot FX | Baja | Solo márgenes |
| Borradores no sobreviven cierre de pestaña | Media | Intencional |
| Test backup 413 preexistente | Baja | No bloquear |
| `SESSION_SECRET` fallback si falta env | Media | Ops |

---

## 10. Plan Etapa 4 (no iniciar sin OK)

**Objetivo:** dos niveles de UI — listado full-width + workspace de proyecto con **5 pestañas**; columna **FACTURADO** = importe original (`total_invoiced` / equivalente MXN de presentación), **no** saldo pendiente.

**Alcance previsto (borrador; confirmar al autorizar):**

1. Listado de proyectos a ancho completo (eliminar dependencia del panel izquierdo permanente / drawer overlay opaco).
2. Workspace al seleccionar proyecto: pestañas (definición exacta a acordar; típico: Datos, Facturación/Cobranza, Costos, Reportes, Historial).
3. Columna FACTURADO visible y correcta (no pending).
4. Historial/auditoría del proyecto más usable (aprovechar `audit_logs` + `project_id` en metadata de settle).
5. No tocar ECOVIS/KPI/asistencia; no nuevas migraciones sin auth; no cambiar fórmulas de totales salvo hallazgo.

**Dependencias previas a Etapa 4 en producción:** merge/deploy de esta rama + migración FX aplicada y verificada en el entorno destino.

---

## 11. Cómo continuar desde una conversación nueva (Etapa 4)

1. `git fetch origin` y checkout `cursor/stage3-invoice-settlement-c0b6` (o la rama/PR #85 mergeada).
2. Verificar HEAD ≥ `5c79b5c` y leer **este archivo** completo + `AGENTS.md`.
3. Confirmar en BD de destino las 4 columnas FX (§6.5) si se va a probar cobranzas.
4. Pedir / esperar **autorización explícita** de Etapa 4.
5. Implementar solo Etapa 4; actualizar este documento al cerrarla.
6. No iniciar Etapa 5/6 en paralelo.
7. No push/merge a producción de migración FX sin autorización independiente.

### Checklist rápido Git (estado al cierre documental)

| Ítem | Valor |
|------|--------|
| Rama | `cursor/stage3-invoice-settlement-c0b6` |
| HEAD código FX | `5c79b5c` |
| Working tree antes del commit de continuidad | solo `docs/PROJECT_IMPLEMENTATION_CONTEXT.md` modificado |
| Sync remote (código) | `origin/cursor/stage3-invoice-settlement-c0b6` en `5c79b5c` |
| vs `origin/main` | 8 commits de código + 1 de continuidad documental (tras commit local) |
| Push / merge / rebase | **no** ejecutados en este cierre (instrucción explícita) |
| PR | https://github.com/ivandanielgg-sketch/Comienzo/pull/85 (código FX ya en PR; continuidad puede quedar solo local hasta push autorizado) |

### Comando de verificación Git (ejecutado al cierre)

```
git status
git branch -vv
git rev-parse HEAD
git log --oneline origin/main..HEAD
```
