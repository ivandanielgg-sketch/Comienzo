# Contexto de implementación — Reestructuración UI / Proyectos

Documento de continuidad para retomar el trabajo sin depender del hilo de chat.
Última actualización: 2026-10-10 (Etapa 2 implementada; Etapa 3 no iniciada).

## 1. Arquitectura del sistema

- **App:** Node.js/Express (“Control de Proyectos”) + frontend vanilla (`public/`).
- **BD:** SQLite local (`data/app.db`) o PostgreSQL si `DATABASE_URL` está definido.
- **Auth:** `express-session`, cookie `proyectos.sid`, store en tabla `sessions`, TTL fijo **60 minutos** (no rolling por defecto).
- **Módulo proyectos:** CRUD + pagos (`project_payments`) + costos (`project_costs`) + cierre/restauración + reportes + export Excel.
- **Cálculos de proyecto:** `src/calculations.js` → `buildProjectTotals` (facturado/cobrado/gastado/pendiente/margen **sin IVA**).
- **Fuera de alcance de esta iniciativa:** ECOVIS, KPI, asistencia, vacaciones, cotizador (no modificar).

Admin por defecto (dev): `admin` / `admin123`.

## 2. Auditoría Fase 1 (resumen)

- UI actual: formulario izquierdo + listado + **drawer overlay** con oscurecimiento.
- Contaminación de formularios pago/costo confirmada (`rawValue` de moneda + forms DOM globales).
- `invoice_payment_status = Pagada` no liquida saldo automáticamente.
- Sesión: 60 min absolutos; sin warning ni `/extend`; frontend no trata 401 de forma especial.
- Cerrados: filtros por `closed_at`, no por `created_at`; sin agrupación año/mes de creación.
- Historial por proyecto: `audit_logs` existe; pagos/costos usan `entity_id` del movimiento (no del proyecto).
- FX: tasas actuales en lectura; cambiar `exchange_rates` recalcula históricos en MXN (no modificar ahora).

## 3. Plan Fase 2 aprobado (orden)

| Etapa | Contenido |
|-------|-----------|
| 1 | Aislamiento formularios pago/costo + confirm discard + anti-stale |
| 2 | Warning/renovación sesión + borradores seguros |
| 3 | Liquidación automática “Pagada” (atómica) |
| 4 | UI listado full-width + workspace 5 pestañas + columna FACTURADO |
| 5 | Filtros/agrupación cerrados por **fecha de creación** |
| 6 | Pruebas integrales / validación financiera |

No implementar etapas en paralelo. Sin migraciones BD sin autorización explícita.

## 4. Objetivos por etapa

1. **Etapa 1:** Sin fuga de importes/fechas/notas entre proyectos; cancelar cambio conserva captura.
2. **Etapa 2:** Aviso T−60s, ampliar +60 min en servidor, 401 controlado, borradores recuperables sin crear movimientos.
3. **Etapa 3:** Confirmación + pago residual atómico al marcar Pagada; sin tocar delete-con-password.
4. **Etapa 4:** Dos niveles UI; FACTURADO = `total_invoiced_mxn` (no pendiente).
5. **Etapa 5:** Año/mes/`created_at`, totales de grupo, export alineado.
6. **Etapa 6:** QA completo; no cambiar fórmulas sin hallazgo autorizado.

## 5. Etapa 1 — Implementación (hecha)

**Rama/PR:** `cursor/project-form-isolation-3848` → PR #83.

**Comportamiento:**
- `resetPaymentForm` / `resetCostForm` con `clearCurrencyValue()`.
- Confirmación al cambiar de proyecto / limpiar selección si hay borrador.
- `beginProjectDetailLoad` + `AbortController` + token; `renderDetailReports` ignora respuestas stale.
- Submit pago/costo: captura `projectId`; solo resetea form si sigue seleccionado.

**Archivos Etapa 1:**
- `public/app.js`, `public/index.html`
- `public/project-form-isolation.js`, `src/projectFormIsolation.js`
- `test/project-form-isolation.test.js`, `test/frontend-table.test.js`
- `scripts/verify-form-isolation.mjs`

**Pruebas Etapa 1:** unit/contrato 16/16; headless Chrome escenarios cancel/confirm/submit OK.

## 6. Decisiones de diseño vigentes

- Conservar ejes independientes: `status` técnico ≠ `invoice_payment_status` ≠ `closed_at`.
- FACTURADO = importe original (`total_invoiced`→MXN), no saldo pendiente.
- Liquidación: endpoint dedicado + TX `db.transaction` (SQLite y adapter PG); PUT no podrá marcar Pagada con saldo &gt; 0.01.
- Idempotency column: **opcional, no iniciar** (idempotencia lógica por estado Pagada).
- FX snapshot en filas: **futuro**, no en este plan.
- Eliminación pagos/costos: sigue exigiendo password admin.

## 7. Restricciones financieras

- No alterar `buildProjectTotals` / SQL de totales sin autorización.
- No inventar movimientos históricos.
- No auto-generar pagos fuera del flujo de liquidación (Etapa 3) o submit explícito del usuario.
- Borradores **nunca** llaman APIs de pago/costo por sí solos.

## 8. Borradores (decisión de seguridad — Etapa 2)

**Riesgo `localStorage` en PCs compartidas:** datos comerciales (importes, notas, cliente) en texto plano son legibles por otro usuario del mismo perfil de navegador o vía XSS. **No se considera protección adecuada.**

**Enfoque adoptado:**
- Persistencia de borradores en **memoria de página + `sessionStorage`** (ámbito de pestaña), ligada a `userId` + `projectId` + tipo (`project_edit` | `payment_new` | `cost_new`).
- TTL definido; sin passwords/tokens; restore solo con confirmación; borrado tras guardado OK / logout / usuario distinto.
- **No** usar `localStorage` de larga duración para borradores comerciales.

**Alternativa futura (requiere autorización de migración):** tabla `form_drafts` server-side cifrada o en claro solo para el `user_id` autenticado.

## 9. Riesgos pendientes

| Riesgo | Severidad | Notas |
|--------|-----------|-------|
| Dirty-check del formulario de proyecto (no solo pago/costo) | Media | Ampliar en Etapa 2/4 |
| Drawer overlay / UX tres paneles | Alta | Etapa 4 |
| Pagada ≠ cobrado | Alta | Etapa 3 |
| FX sin snapshot histórico | Media | Solo documentado |
| Audit pagos sin `project_id` indexable | Media | Etapa 4 historial |
| Fallback secret de sesión en código | Media | Ops / env |
| Test backup 413 preexistente | Baja | No bloquear |

## 10. Cómo continuar

1. Partir de la rama/PR de la última etapa aceptada.
2. Leer este archivo y `AGENTS.md`.
3. Implementar **solo** la etapa autorizada.
4. Actualizar la sección de estado al cerrar cada etapa.
5. No iniciar Etapa N+1 sin autorización explícita.
