# Contexto de implementación — Reestructuración UI / Proyectos

Documento de continuidad para retomar el trabajo sin depender del hilo de chat.
Última actualización: 2026-10-10 (Etapas 1–3 cerradas en código; Etapa 4 no iniciada).

**Rama de trabajo Etapa 3:** `cursor/stage3-invoice-settlement-c0b6` (parte de `cursor/session-renewal-drafts-3848` + Etapa 3).
**PRs relacionados:** #83 (Etapa 1), #84 (Etapa 2 + continuidad), Etapa 3 en rama `cursor/stage3-invoice-settlement-c0b6`.

> No almacenar contraseñas, tokens, cookies ni secretos en este documento.
> Credenciales de desarrollo: ver `AGENTS.md` / variables de entorno del entorno local (no repetir aquí).

## 1. Arquitectura del sistema

- **App:** Node.js/Express (“Control de Proyectos”) + frontend vanilla (`public/`).
- **BD:** SQLite local (`data/app.db`) o PostgreSQL si `DATABASE_URL` está definido.
- **Auth:** `express-session`, cookie `proyectos.sid`, store en tabla `sessions`.
- **TTL sesión:** 60 minutos absolutos por defecto (`SESSION_TTL_MS` env override). Sin rolling en `GET /api/session`.
- **Módulo proyectos:** CRUD + pagos (`project_payments`) + costos (`project_costs`) + cierre/restauración + reportes + export Excel + **liquidación Pagada**.
- **Cálculos de proyecto:** `src/calculations.js` → `buildProjectTotals` (facturado/cobrado/gastado/pendiente/margen **sin IVA**) — **sin cambios** en Etapa 3.
- **Fuera de alcance de esta iniciativa:** ECOVIS, KPI, asistencia, vacaciones, cotizador (no modificar).

## 2. Auditoría Fase 1 (resumen)

- UI actual: formulario izquierdo + listado + **drawer overlay** con oscurecimiento.
- Contaminación de formularios pago/costo confirmada (`rawValue` de moneda + forms DOM globales).
- ~~`invoice_payment_status = Pagada` no liquida saldo automáticamente.~~ → resuelto en Etapa 3.
- Pre-Etapa 2: sin warning de sesión ni `/extend`; frontend sin manejo especial de 401.
- Cerrados: filtros por `closed_at`, no por `created_at`; sin agrupación año/mes de creación.
- Historial por proyecto: `audit_logs` existe; pagos/costos usan `entity_id` del movimiento (no del proyecto). Settle registra `project_id` en metadata.
- FX: tasas actuales en lectura; cambiar `exchange_rates` recalcula históricos en MXN (no modificar ahora).

## 3. Plan Fase 2 aprobado (orden)

| Etapa | Contenido | Estado |
|-------|-----------|--------|
| 1 | Aislamiento formularios pago/costo + confirm discard + anti-stale | **Hecha** |
| 2 | Warning/renovación sesión + borradores seguros | **Hecha** |
| 3 | Liquidación automática “Pagada” (atómica) | **Hecha** |
| 4 | UI listado full-width + workspace 5 pestañas + columna FACTURADO | Pendiente |
| 5 | Filtros/agrupación cerrados por **fecha de creación** | Pendiente |
| 6 | Pruebas integrales / validación financiera | Pendiente |

No implementar etapas en paralelo. Sin migraciones BD sin autorización explícita.

## 4. Objetivos por etapa

1. **Etapa 1:** Sin fuga de importes/fechas/notas entre proyectos; cancelar cambio conserva captura.
2. **Etapa 2:** Aviso T−60s, ampliar +60 min en servidor, 401 controlado, borradores recuperables sin crear movimientos.
3. **Etapa 3:** Confirmación + pago residual atómico al marcar Pagada; sin tocar delete-con-password.
4. **Etapa 4:** Dos niveles UI; FACTURADO = `total_invoiced_mxn` (no pendiente).
5. **Etapa 5:** Año/mes/`created_at`, totales de grupo, export alineado.
6. **Etapa 6:** QA completo; no cambiar fórmulas sin hallazgo autorizado.

## 5. Etapa 1 — Resultados definitivos

**Commits:** `31dee12` (aislamiento), `9df6fba` (script verify).

**Comportamiento entregado:**
- `resetPaymentForm` / `resetCostForm` con `clearCurrencyValue()`.
- Confirmación al cambiar de proyecto / limpiar selección si hay borrador de movimiento.
- `beginProjectDetailLoad` + `AbortController` + token; `renderDetailReports` ignora respuestas stale.
- Submit pago/costo: captura `projectId`; solo resetea form si sigue seleccionado.

**Archivos:**
- `public/app.js`, `public/index.html`
- `public/project-form-isolation.js`, `src/projectFormIsolation.js`
- `test/project-form-isolation.test.js`, `test/frontend-table.test.js`
- `scripts/verify-form-isolation.mjs`

**Pruebas:** unit/contrato OK; headless cancel/confirm/submit OK.

## 6. Etapa 2 — Resultados definitivos

**Commit principal:** `c3e45fe` (+ handoff `141a1d2`).

Ver secciones históricas 6.1–6.5 del historial de commits; resumen: sesión con warning/extend, borradores `sessionStorage`, sin migraciones.

## 7. Etapa 3 — Resultados definitivos

### 7.1 Decisiones aplicadas

- Toda transición a `Pagada` pasa por `POST /api/projects/:id/settle-invoice`.
- `PUT/POST /api/projects` **no** pueden establecer `Pagada` si el proyecto no lo estaba ya (históricos conservan compatibilidad).
- Pago residual automático siempre en **MXN** = `pending_collection` exacto (fórmulas intactas).
- Facturas USD/EUR: preview muestra moneda original, facturado, cobrado, TC y pendiente MXN; exige `confirm_mxn_matches_real_payment=true`.
- Usuario puede cancelar y registrar pago manual.
- Sobrepago (`pending < -0.01`): bloquea liquidación; API de pago manual también rechaza nuevos sobrepagos (`PAYMENT_OVERPAY`).
- Saldo ≈ 0: marca Pagada **sin** movimiento.
- Proyectos cerrados: liquidación permitida con permiso `projects/edit`; no altera `closed_at`, `created_at` ni `status` técnico.
- Concurrencia: PG `SELECT … FOR UPDATE` + TX; SQLite `BEGIN IMMEDIATE` + `busy_timeout`; pagos manuales usan el mismo locking.
- `expected_pending_mxn` obligatorio (stale → 409) **además** del bloqueo de fila.
- Sin migraciones; sin columna de idempotencia; sin snapshot FX en `project_payments`.
- Delete de pagos con contraseña admin: intacto.

### 7.2 Endpoints

| Método | Ruta | Rol |
|--------|------|-----|
| GET | `/api/projects/:id/settlement-preview` | Vista previa (sin efectos) |
| POST | `/api/projects/:id/settle-invoice` | Liquidación atómica |

Body settle (mínimo):

```json
{
  "invoice_paid_at": "YYYY-MM-DD",
  "expected_pending_mxn": 123.45,
  "confirm": true,
  "confirm_mxn_matches_real_payment": true
}
```

(`confirm_mxn_matches_real_payment` obligatorio solo si hay pago residual y factura ≠ MXN.)

### 7.3 Archivos Etapa 3

- `src/projectInvoiceSettlement.js` (plan puro)
- `src/server.js` (endpoints, bloqueo Pagada en normalize, pagos con lock)
- `src/db/betterSqlite3Adapter.js` (`.immediate` en TX)
- `src/db/sqliteDriver.js` (`busy_timeout = 5000`)
- `public/app.js`, `public/index.html`, `public/styles.css` (modal liquidación)
- `test/project-invoice-settlement.test.js`
- `test/project-invoice-settlement-pg.test.js`
- `test/project-invoice-payment.test.js` (ajustado)
- `docs/PROJECT_IMPLEMENTATION_CONTEXT.md`

### 7.4 Pruebas ejecutadas (Etapa 3)

| Suite | Resultado |
|-------|-----------|
| `test/project-invoice-settlement.test.js` | OK (helpers + API SQLite + concurrencia) |
| `test/project-invoice-payment.test.js` | OK (PUT a Pagada rechazado) |
| `test/project-invoice-settlement-pg.test.js` | OK con BD local dedicada `TEST_DATABASE_URL` (doble settle + settle vs pago manual) |

**PostgreSQL de pruebas:** usar solo BD dedicada vía `TEST_DATABASE_URL` (el test hace `DROP SCHEMA public CASCADE`). Nunca apuntar a producción. Sin `TEST_DATABASE_URL`, el archivo se omite (`t.skip`) con mensaje claro.

### 7.5 UI

- Modal `#invoice-settle-modal` al elegir Pagada (si no estaba ya Pagada).
- Muestra resumen financiero; fecha real obligatoria; checkbox MXN para USD/EUR.
- Botones: Confirmar / Registrar pago manual / Cancelar.
- Guardar proyecto no puede “colarse” a Pagada sin liquidación.

## 8. Decisiones de diseño vigentes

- Conservar ejes independientes: `status` técnico ≠ `invoice_payment_status` ≠ `closed_at`.
- FACTURADO = importe original (`total_invoiced`→MXN), no saldo pendiente.
- Liquidación: endpoint dedicado + TX inmediata; PUT no marca Pagada nueva.
- Idempotency column: **no iniciada**.
- FX snapshot en filas de proyecto: **futuro**.
- Eliminación pagos/costos: sigue exigiendo contraseña de administrador.

## 9. Restricciones financieras

- No alterar `buildProjectTotals` / SQL de totales sin autorización.
- No inventar movimientos históricos.
- No auto-generar pagos fuera del flujo de liquidación o submit explícito.
- Borradores **nunca** llaman APIs de pago/costo por sí solos.

## 10. Borradores — nota de seguridad

**Por qué no `localStorage`:** en PCs compartidos, datos comerciales en texto plano son legibles por otro usuario del mismo perfil o vía XSS.

**Adoptado:** `sessionStorage` + userId; TTL 2 h; sanitize de campos sensibles; restore confirmado.

**Futuro (migración autorizada):** tabla `form_drafts` server-side por `user_id`.

## 11. Riesgos pendientes

| Riesgo | Severidad | Notas |
|--------|-----------|-------|
| Drawer overlay / UX tres paneles | Alta | Etapa 4 |
| FX sin snapshot histórico en pagos de proyecto | Media | Solo documentado; residual settle en MXN |
| Audit pagos sin `project_id` indexable en todos los eventos | Media | Settle ya pone `project_id` en metadata; Etapa 4 historial |
| `SESSION_SECRET` fallback en código si falta env | Media | Ops / env de producción |
| Borradores no sobreviven cierre de pestaña | Media | Intencional; server-side pendiente |
| Test backup 413 preexistente | Baja | No bloquear |
| Proyectos históricos Pagada con saldo > 0 | Baja | Se pueden liquidar (crea residual) vía settle |

## 12. Cómo continuar desde una conversación nueva

1. `git fetch` y checkout la rama/PR de Etapa 3 aceptada (o `cursor/stage3-invoice-settlement-c0b6`).
2. Leer este archivo y `AGENTS.md`.
3. Confirmar que Etapas 1–3 están mergeadas o cherry-picked según el flujo del equipo.
4. Implementar **solo** la etapa autorizada (siguiente: **Etapa 4 — UI workspace** cuando haya OK explícito).
5. Actualizar este documento al cerrar cada etapa.
6. No iniciar Etapa N+1 sin autorización explícita.
7. No hacer push automático salvo instrucción del usuario / agente cloud.
