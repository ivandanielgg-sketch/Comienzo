# Contexto de implementación — Reestructuración UI / Proyectos

Documento de continuidad para retomar el trabajo sin depender del hilo de chat.
Última actualización: 2026-10-10 (Etapas 1–2 cerradas en código; Etapa 3 no iniciada).

**Rama de trabajo:** `cursor/session-renewal-drafts-3848` (incluye commits de Etapas 1 y 2).
**PRs relacionados:** #83 (Etapa 1), #84 (Etapa 2 + continuidad).

> No almacenar contraseñas, tokens, cookies ni secretos en este documento.
> Credenciales de desarrollo: ver `AGENTS.md` / variables de entorno del entorno local (no repetir aquí).

## 1. Arquitectura del sistema

- **App:** Node.js/Express (“Control de Proyectos”) + frontend vanilla (`public/`).
- **BD:** SQLite local (`data/app.db`) o PostgreSQL si `DATABASE_URL` está definido.
- **Auth:** `express-session`, cookie `proyectos.sid`, store en tabla `sessions`.
- **TTL sesión:** 60 minutos absolutos por defecto (`SESSION_TTL_MS` env override). Sin rolling en `GET /api/session`.
- **Módulo proyectos:** CRUD + pagos (`project_payments`) + costos (`project_costs`) + cierre/restauración + reportes + export Excel.
- **Cálculos de proyecto:** `src/calculations.js` → `buildProjectTotals` (facturado/cobrado/gastado/pendiente/margen **sin IVA**).
- **Fuera de alcance de esta iniciativa:** ECOVIS, KPI, asistencia, vacaciones, cotizador (no modificar).

## 2. Auditoría Fase 1 (resumen)

- UI actual: formulario izquierdo + listado + **drawer overlay** con oscurecimiento.
- Contaminación de formularios pago/costo confirmada (`rawValue` de moneda + forms DOM globales).
- `invoice_payment_status = Pagada` no liquida saldo automáticamente.
- Pre-Etapa 2: sin warning de sesión ni `/extend`; frontend sin manejo especial de 401.
- Cerrados: filtros por `closed_at`, no por `created_at`; sin agrupación año/mes de creación.
- Historial por proyecto: `audit_logs` existe; pagos/costos usan `entity_id` del movimiento (no del proyecto).
- FX: tasas actuales en lectura; cambiar `exchange_rates` recalcula históricos en MXN (no modificar ahora).

## 3. Plan Fase 2 aprobado (orden)

| Etapa | Contenido | Estado |
|-------|-----------|--------|
| 1 | Aislamiento formularios pago/costo + confirm discard + anti-stale | **Hecha** |
| 2 | Warning/renovación sesión + borradores seguros | **Hecha** |
| 3 | Liquidación automática “Pagada” (atómica) | Pendiente (no iniciar sin OK) |
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

**Commit principal:** `c3e45fe` (+ actualización de este documento).

### 6.1 Decisiones aprobadas aplicadas

- Renovación de sesión solo con acción explícita del usuario (no rolling silencioso).
- Advertencia única a ≤60 s con countdown.
- Borradores **sin `localStorage`** comercial; `sessionStorage` de pestaña + sanitización.
- Tres tipos: `project_edit`, `payment_new`, `cost_new`.
- Restore solo tras confirmación; clear tras guardado; no auto-movimientos.
- Aislamiento por `userId` + `projectId`; `clearForeignDrafts` al entrar otro usuario.
- Sin migraciones de BD en Etapa 2.

### 6.2 Cambios implementados

**Backend (`src/server.js`):**
- `SESSION_TTL_MS` desde env (default 3_600_000).
- `refreshSessionExpiry` / `sessionExpiryPayload`.
- `expires_at`, `expires_in_ms`, `session_ttl_ms` en login y `GET /api/session`.
- `POST /api/session/extend` (`requireAuth`) actualiza cookie + `expiresAtMs` en store.

**Frontend:**
- Modal `#session-expiry-modal` (Ampliar / Cerrar sesión).
- Modal `#session-draft-restore-modal` (Restaurar / Descartar).
- Monitor 1 s; un solo warning (`sessionWarningVisible`).
- `api()`: 401 → `handleAuthenticatedSessionLoss` una vez.
- Autosnapshot debounce de borradores; clear por tipo al guardar.

**Módulo borradores:** `public/session-drafts.js` (+ reexport `src/sessionDrafts.js`).

### 6.3 Archivos Etapa 2

- `docs/PROJECT_IMPLEMENTATION_CONTEXT.md`
- `src/server.js`
- `public/session-drafts.js`, `src/sessionDrafts.js`
- `public/app.js`, `public/index.html`, `public/styles.css`
- `test/session-drafts.test.js`, `test/session-extend.test.js`
- `scripts/verify-session-stage2.mjs`

### 6.4 Pruebas ejecutadas (Etapa 2)

| Suite / script | Resultado |
|----------------|-----------|
| `test/session-drafts.test.js` | OK (sanitize, aislamiento user/proyecto, TTL, clearForeign, wiring FE) |
| `test/session-extend.test.js` | OK (metadata, GET no-rolling, extend, expiry→401) |
| `scripts/verify-session-stage2.mjs` | OK (warning, extend, restore, clear al guardar, 401×3→1 handler) |
| Aislamiento UI usuario A→B misma pestaña | Ver sección 6.5 |
| Operaciones tras renew post-vencimiento original | Ver sección 6.5 |

Fallos abiertos de Etapa 2: **ninguno**.

### 6.5 Verificaciones de seguridad / continuidad (definitivas)

| Verificación | Resultado | Evidencia |
|--------------|-----------|-----------|
| Doc continuidad sin contraseñas/tokens/secretos embebidos | OK | Credenciales solo vía env / `AGENTS.md` |
| Borradores usuario A no restaurables por usuario B (misma pestaña) | OK | `scripts/verify-stage2-handoff.mjs` → `foreignCleared`, sin texto secreto en UI |
| Tras renew, operaciones autenticadas tras el vencimiento original | OK | Mismo script: extend + `GET /api/projects` → 200 |
| GET `/api/session` no hace rolling | OK | `test/session-extend.test.js` + handoff |

Artefactos: `/opt/cursor/artifacts/stage2-handoff-verification.json`, `session-stage2-verification.json`.

## 7. Decisiones de diseño vigentes

- Conservar ejes independientes: `status` técnico ≠ `invoice_payment_status` ≠ `closed_at`.
- FACTURADO = importe original (`total_invoiced`→MXN), no saldo pendiente.
- Liquidación (Etapa 3): endpoint dedicado + TX `db.transaction`; PUT no marcará Pagada con saldo &gt; 0.01.
- Idempotency column: **opcional, no iniciar**.
- FX snapshot en filas: **futuro**.
- Eliminación pagos/costos: sigue exigiendo contraseña de administrador (mecanismo existente).

## 8. Restricciones financieras

- No alterar `buildProjectTotals` / SQL de totales sin autorización.
- No inventar movimientos históricos.
- No auto-generar pagos fuera del flujo de liquidación (Etapa 3) o submit explícito.
- Borradores **nunca** llaman APIs de pago/costo por sí solos.

## 9. Borradores — nota de seguridad

**Por qué no `localStorage`:** en PCs compartidos, datos comerciales en texto plano son legibles por otro usuario del mismo perfil o vía XSS.

**Adoptado:** `sessionStorage` + userId; TTL 2 h; sanitize de campos sensibles; restore confirmado.

**Futuro (migración autorizada):** tabla `form_drafts` server-side por `user_id`.

## 10. Riesgos pendientes

| Riesgo | Severidad | Notas |
|--------|-----------|-------|
| Drawer overlay / UX tres paneles | Alta | Etapa 4 |
| Pagada ≠ cobrado (sin liquidación atómica) | Alta | Etapa 3 |
| Dirty-check UX del form proyecto vs solo movimientos | Media | Parcial vía borrador `project_edit`; confirm de cambio sigue centrado en pago/costo |
| FX sin snapshot histórico | Media | Solo documentado |
| Audit pagos sin `project_id` indexable | Media | Etapa 4 historial |
| `SESSION_SECRET` fallback en código si falta env | Media | Ops / env de producción |
| Borradores no sobreviven cierre de pestaña | Media | Intencional; server-side pendiente |
| Test backup 413 preexistente | Baja | No bloquear |

## 11. Cómo continuar desde una conversación nueva

1. `git fetch` y checkout `cursor/session-renewal-drafts-3848` (o la rama/PR aceptada más reciente).
2. Leer este archivo y `AGENTS.md`.
3. Confirmar que Etapas 1–2 están mergeadas o cherry-picked según el flujo del equipo.
4. Implementar **solo** la etapa autorizada (siguiente: **Etapa 3 — liquidación Pagada** cuando haya OK explícito).
5. Actualizar este documento al cerrar cada etapa.
6. No iniciar Etapa N+1 sin autorización explícita.
7. No hacer push automático salvo instrucción del usuario.
