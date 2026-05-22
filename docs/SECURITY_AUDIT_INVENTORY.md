# Inventario Técnico y Auditoría de Seguridad — REVRAM

**Fecha de auditoría:** 2026-05-22  
**Rama:** `cursor/security-backup-permissions-audit-1490`  
**Estado:** Diagnóstico inicial (sin modificaciones a lógica de negocio)

---

## 1. Estado Actual del Login

| Aspecto | Estado Actual |
|---------|---------------|
| Mecanismo | Autenticación por sesión con `express-session` |
| Hash de contraseñas | `bcryptjs` (cost factor 12) |
| Cookie | `proyectos.sid`, httpOnly, sameSite=lax, secure en producción |
| TTL de sesión | 1 hora (3600000 ms) |
| Almacén de sesiones | SQLite (tabla `sessions`) |
| Endpoint login | `POST /api/login` |
| Endpoint logout | `POST /api/logout` |
| Endpoint sesión | `GET /api/session` |
| Endpoint verificación admin | `POST /api/admin/verify` |
| Trust proxy | Activado si `NODE_ENV=production` o `TRUST_PROXY=true` |

### Flujo de autenticación

1. El usuario envía `username` + `password` a `POST /api/login`.
2. Se busca en tabla `users` por username.
3. Se compara con `bcrypt.compareSync`.
4. Se crean propiedades de sesión: `userId`, `username`, `role`.
5. Para acciones destructivas, se requiere `POST /api/admin/verify` con campo `password` (establece `adminVerified=true` en sesión).

---

## 2. Estado Actual de Usuarios y Roles

### Roles existentes

| Rol | Descripción | Creación |
|-----|-------------|----------|
| `admin` | Acceso total, módulos ECOVIS, vacaciones, respaldos, gestión de usuarios | Se asigna al usuario seed y se puede asignar via API |
| `user` | Acceso a proyectos, reportes, costos, pagos. No accede a vacaciones/ECOVIS/respaldos | Rol por defecto al crear usuario |
| `tecnico` | Solo accede a Reportes y Archivo Reportes. Bloqueado de proyectos, costos, pagos | Se asigna via API |

### Usuario admin activo

- **SÍ** — se crea automáticamente en `seedAdmin()` con username `admin` y contraseña `admin123` (o variables de entorno `ADMIN_USER`/`ADMIN_PASSWORD`).
- El rol se fuerza a `'admin'` en seed si el usuario existe pero tiene otro rol.

### Usuario técnico

- **No existe por defecto** — debe crearse manualmente con rol `tecnico` vía el panel de Usuarios.

### Middlewares de protección

| Middleware | Función |
|------------|---------|
| `requireAuth` | Verifica `req.session.userId` existe |
| `requireAdmin` | Verifica `req.session.role === 'admin'` |
| `requireAdminVerified` | Verifica `req.session.adminVerified === true` |
| `requireNotTecnico` | Bloquea si `req.session.role === 'tecnico'` |

---

## 3. Inventario de Tablas/Modelos de Base de Datos

| # | Tabla | Descripción | FK/Relaciones |
|---|-------|-------------|---------------|
| 1 | `users` | Usuarios del sistema (id, username, password_hash, role, created_at) | — |
| 2 | `sessions` | Sesiones activas (sid, sess JSON, expires) | — |
| 3 | `exchange_rates` | Tipos de cambio (currency PK, rate_to_mxn, updated_at) | — |
| 4 | `projects` | Proyectos activos y cerrados (closed_at distingue) | — |
| 5 | `project_payments` | Pagos de proyectos | FK → projects(id) ON DELETE CASCADE |
| 6 | `project_costs` | Gastos de proyectos | FK → projects(id) ON DELETE CASCADE |
| 7 | `project_reports` | Reportes de servicio (3 tipos) | FK → projects(id) ON DELETE CASCADE |
| 8 | `employees` | Empleados (vacaciones) | — |
| 9 | `vacation_requests` | Solicitudes de vacaciones | FK → employees(id) ON DELETE CASCADE |
| 10 | `ecovis_projects` | Proyectos cuenta ECOVIS | — |
| 11 | `ecovis_payments` | Pagos recibidos ECOVIS | — |
| 12 | `ecovis_payment_allocations` | Aplicación de pagos a proyectos | FK → ecovis_payments(id), FK → ecovis_projects(id) |
| 13 | `ecovis_movements` | Movimientos contables ECOVIS (incluye préstamos) | FK → ecovis_projects(id), FK → ecovis_payments(id) |

**Total:** 13 tablas

---

## 4. Inventario de Endpoints API

### Autenticación y Sesión

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/session` | Ninguna | Estado de sesión |
| POST | `/api/login` | Ninguna | Iniciar sesión |
| POST | `/api/logout` | requireAuth | Cerrar sesión |
| POST | `/api/admin/verify` | requireAuth | Verificar contraseña admin |

### Gestión de Usuarios

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/users` | requireAuth + requireAdminVerified | Listar usuarios |
| POST | `/api/users` | requireAuth + requireAdminVerified | Crear usuario |
| PUT | `/api/users/:id` | requireAuth + requireAdminVerified | Editar usuario |

### Tipos de Cambio

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/exchange-rates` | requireAuth | Obtener tipos de cambio |
| PUT | `/api/exchange-rates` | requireAuth | Actualizar tipos de cambio |

### Proyectos

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/projects` | requireAuth + requireNotTecnico | Listar proyectos activos |
| GET | `/api/projects/:id` | requireAuth | Obtener detalle de proyecto |
| POST | `/api/projects` | requireAuth + requireNotTecnico | Crear proyecto |
| PUT | `/api/projects/:id` | requireAuth + requireNotTecnico | Editar proyecto |
| DELETE | `/api/projects/:id` | requireAuth + requireNotTecnico | Cerrar proyecto (soft delete → closed_at) |

### Proyectos Cerrados

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/closed-projects` | requireAuth + requireNotTecnico | Listar cerrados |
| DELETE | `/api/closed-projects/:id` | requireAuth | Borrar definitivamente |
| GET | `/api/closed-projects/by-client` | requireAuth | Cerrados agrupados por cliente |
| GET | `/api/closed-projects/client/:clientName` | requireAuth | Cerrados de un cliente |
| GET | `/api/closed-projects/date-range` | requireAuth | Cerrados por rango de fecha |

### Pagos y Costos

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| POST | `/api/projects/:id/payments` | requireAuth | Registrar pago |
| DELETE | `/api/projects/:projectId/payments/:paymentId` | requireAuth | Eliminar pago |
| POST | `/api/projects/:id/costs` | requireAuth | Registrar costo |
| DELETE | `/api/projects/:projectId/costs/:costId` | requireAuth | Eliminar costo |

### Reportes

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/reports/projects` | requireAuth | Proyectos para reportes |
| GET | `/api/reports` | requireAuth | Listar reportes |
| GET | `/api/reports/active` | requireAuth | Reportes activos |
| GET | `/api/reports/:id` | requireAuth | Detalle de reporte |
| GET | `/api/projects/:id/reports` | requireAuth | Reportes de un proyecto |
| POST | `/api/reports` | requireAuth | Crear reporte |
| PUT | `/api/reports/:id` | requireAuth | Editar reporte |
| DELETE | `/api/reports/:id` | requireAuth | Archivar (soft delete) reporte |
| GET | `/api/report-types` | requireAuth | Tipos de reporte válidos |
| GET | `/api/reports/archive/clients` | requireAuth | Clientes con reportes archivados |
| GET | `/api/reports/archive/client/:clientName` | requireAuth | Reportes archivados por cliente |

### Vacaciones (solo admin)

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/employees` | requireAuth + requireAdmin | Listar empleados |
| GET | `/api/employees/:id` | requireAuth + requireAdmin | Detalle empleado |
| POST | `/api/employees` | requireAuth + requireAdmin | Crear empleado |
| PUT | `/api/employees/:id` | requireAuth + requireAdmin | Editar empleado |
| GET | `/api/employees/:id/vacation-requests` | requireAuth + requireAdmin | Vacaciones de empleado |
| POST | `/api/employees/:id/vacation-requests` | requireAuth + requireAdmin | Crear solicitud vacaciones |
| PUT | `/api/vacation-requests/:id` | requireAuth + requireAdmin | Editar solicitud |
| PATCH | `/api/vacation-requests/:id/cancel` | requireAuth + requireAdmin | Cancelar solicitud |
| GET | `/api/vacation-requests/:id` | requireAuth + requireAdmin | Detalle solicitud |

### ECOVIS (solo admin)

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/ecovis/summary` | requireAuth + requireAdmin | Resumen de cuenta |
| GET | `/api/ecovis/projects` | requireAuth + requireAdmin | Listar proyectos ECOVIS |
| POST | `/api/ecovis/projects` | requireAuth + requireAdmin | Crear proyecto ECOVIS |
| PUT | `/api/ecovis/projects/:id` | requireAuth + requireAdmin | Editar proyecto ECOVIS |
| POST | `/api/ecovis/projects/:id/cancel` | requireAuth + requireAdmin | Cancelar proyecto ECOVIS |
| GET | `/api/ecovis/payments` | requireAuth + requireAdmin | Listar pagos ECOVIS |
| POST | `/api/ecovis/payments` | requireAuth + requireAdmin | Registrar pago ECOVIS |
| POST | `/api/ecovis/payments/:id/allocations` | requireAuth + requireAdmin | Aplicar pago a proyecto |
| GET | `/api/ecovis/loans` | requireAuth + requireAdmin | Listar préstamos |
| POST | `/api/ecovis/loans` | requireAuth + requireAdmin | Crear préstamo |
| POST | `/api/ecovis/loans/:id/repayment` | requireAuth + requireAdmin | Registrar devolución |
| GET | `/api/ecovis/movements` | requireAuth + requireAdmin | Listar movimientos |
| POST | `/api/ecovis/adjustments` | requireAuth + requireAdmin | Crear ajuste |
| POST | `/api/ecovis/apply-credit` | requireAuth + requireAdmin | Aplicar saldo a favor |

### Respaldo e Importación (solo admin)

| Método | Ruta | Protección | Descripción |
|--------|------|------------|-------------|
| GET | `/api/admin/backup` | requireAuth + requireAdmin | Generar respaldo completo (JSON) |
| POST | `/api/admin/backup/preview` | requireAuth + requireAdmin | Vista previa de importación |
| POST | `/api/admin/backup/import` | requireAuth + requireAdmin | Ejecutar importación |

**Total de endpoints:** 53

---

## 5. Inventario de Rutas Frontend

### Páginas HTML

| Archivo | Ruta | Propósito |
|---------|------|-----------|
| `public/index.html` | `/` | SPA principal (login + todas las vistas) |
| `public/report-print.html` | `/report-print.html?id=X` | Impresión reporte caldera |
| `public/report-print-autoflame.html` | `/report-print-autoflame.html?id=X` | Impresión reporte Autoflame |
| `public/report-print-general.html` | `/report-print-general.html?id=X` | Impresión reporte general |
| `public/vacation-print.html` | `/vacation-print.html?id=X` | Impresión carta vacaciones |

### Vistas/Tabs en el SPA (index.html)

| Vista | ID | Visibilidad |
|-------|-----|-------------|
| Login | `login-view` | Solo sin sesión |
| Proyectos | `projects-view` | admin, user |
| Proyectos Cerrados | `closed-projects-view` | admin, user |
| Reportes | `reports-view` | admin, user, tecnico |
| Archivo Reportes | `report-archive-tab` | admin, user, tecnico |
| Vacaciones | `vacations-view` | solo admin |
| Cuenta ECOVIS | `ecovis-view` | solo admin |
| Usuarios | `users-view` | admin (requiere verificación) |
| Crear respaldo | botón `backup-create-btn` | solo admin |
| Importar respaldo | botón `backup-import-btn` | solo admin |

---

## 6. Inventario de Módulos del Sistema

| # | Módulo | Archivos Backend | Descripción |
|---|--------|------------------|-------------|
| 1 | Autenticación | `src/server.js` (login/logout/session) | Login, logout, verificación admin |
| 2 | Usuarios | `src/server.js` (CRUD users) | Alta, edición de usuarios |
| 3 | Proyectos | `src/server.js`, `src/calculations.js` | CRUD proyectos, cálculos financieros |
| 4 | Pagos | `src/server.js` | Registro/eliminación de pagos por proyecto |
| 5 | Costos | `src/server.js` | Registro/eliminación de gastos por proyecto |
| 6 | Proyectos Cerrados | `src/server.js` | Cierre y borrado definitivo |
| 7 | Reportes | `src/server.js` | CRUD reportes de servicio (3 tipos) |
| 8 | Vacaciones | `src/server.js`, `src/vacations.js` | Empleados, solicitudes, cálculos LFT |
| 9 | ECOVIS | `src/server.js`, `src/ecovis.js` | Proyectos, pagos, préstamos, movimientos |
| 10 | Tipos de Cambio | `src/server.js`, `src/calculations.js` | Gestión de divisas MXN/USD/EUR |
| 11 | Respaldo/Importación | `src/server.js` (backup module) | Export JSON / Import con preview |
| 12 | Exportar Excel | `public/app.js` (client-side) | Generación XML SpreadsheetML en frontend |
| 13 | Paginación | `src/pagination.js` | Utilidades de paginado, filtros, sort |
| 14 | Sesiones | `src/sessionStore.js` | Store SQLite para express-session |

---

## 7. Estado Actual del Sistema de Respaldo

### Crear Respaldo (`GET /api/admin/backup`)

- **Formato:** JSON con metadatos + datos de todas las entidades.
- **Schema version:** `1.0.0`
- **Entidades incluidas:** projects, closedProjects, projectPayments, projectCosts, projectReports, employees, vacationRequests, exchangeRates, ecovisProjects, ecovisPayments, ecovisPaymentAllocations, ecovisMovements, usersSafe.
- **Entidades excluidas:** sessions (datos sensibles), password_hash (credenciales).
- **Descarga:** El frontend consume el endpoint y genera descarga `.json` via Blob URL.
- **Acceso:** Solo rol `admin`.

### Importar Respaldo (`POST /api/admin/backup/preview` + `POST /api/admin/backup/import`)

- **Modo:** No destructivo (additive). No reemplaza datos existentes.
- **Flujo:** Preview → Confirmar → Importar.
- **Detección de duplicados:** Por claves estables (`stableKeys`) definidas por entidad.
- **Conflictos:** Se reportan pero no se sobreescriben registros existentes.
- **Transaccional:** Importación ejecutada en una transacción SQLite (rollback en error crítico).
- **Orden de importación:** exchangeRates → usersSafe → projects → closedProjects → payments → costs → employees → vacations → reports → ecovis*.
- **Nota:** `usersSafe` y `exchangeRates` se incluyen en el respaldo pero **no se importan** (skip en import).

### Exportar Excel (client-side)

- **Tipo:** XML SpreadsheetML generado completamente en el frontend (`public/app.js`).
- **Acceso:** Botones visibles para admin y user (no tecnico).
- **Contenido:** Una hoja de listado general + una hoja por proyecto con sus pagos y gastos.
- **Aplica a:** Proyectos activos y Proyectos Cerrados (botones separados).

---

## 8. Entidades que Deben Entrar al Respaldo

| Entidad | Clave estable | Incluida actualmente |
|---------|---------------|---------------------|
| projects (activos) | quote_number | ✅ |
| projects (cerrados) | quote_number | ✅ |
| project_payments | project_id + payment_date + amount + currency | ✅ |
| project_costs | project_id + cost_date + amount + category + description | ✅ |
| project_reports | report_folio | ✅ |
| employees | employee_number | ✅ |
| vacation_requests | employee_id + start_date + end_date + requested_days | ✅ |
| exchange_rates | currency | ✅ |
| ecovis_projects | project_name + project_date + total_amount | ✅ |
| ecovis_payments | payment_date + amount + bank_reference | ✅ |
| ecovis_payment_allocations | payment_id + amount + allocation_type | ✅ |
| ecovis_movements | movement_date + movement_type + amount + description | ✅ |
| users (solo metadata) | username | ✅ (sin password_hash) |

---

## 9. Entidades Sensibles que NO Deben Respaldarse Completas

| Entidad/Campo | Razón | Estado actual |
|---------------|-------|---------------|
| `sessions` (tabla completa) | Tokens de sesión activos | ✅ Excluida correctamente |
| `users.password_hash` | Credenciales hasheadas | ✅ Excluido (se usa `usersSafe` sin hash) |
| `SESSION_SECRET` (env) | Secreto de firma de cookies | N/A (variable de entorno, no en DB) |
| Admin password (env) | Contraseña admin original | N/A (variable de entorno) |

---

## 10. Despliegue en Render

| Configuración | Valor |
|---------------|-------|
| Comando de inicio | `npm start` |
| Puerto | `PORT` (env variable, default 3000) |
| Base de datos | SQLite en disco persistente (`DB_PATH=/var/data/app.db`) |
| Variables de entorno requeridas | `NODE_ENV=production`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `TRUST_PROXY=true` |
| Disco persistente | Mount path `/var/data` para conservar `app.db` entre deploys |
| Proxy | Express trust proxy habilitado para HTTPS detrás de Render proxy |

---

## 11. Confirmaciones de Funcionalidad Existente

| Funcionalidad | ¿Existe? | Notas |
|---------------|----------|-------|
| Usuario admin activo | ✅ SÍ | Creado automáticamente por `seedAdmin()` |
| Usuario tecnico | ❌ NO por defecto | Debe crearse manualmente asignando rol `tecnico` |
| Rol admin | ✅ SÍ | Funcional con middleware `requireAdmin` |
| Rol user | ✅ SÍ | Rol por defecto |
| Rol tecnico | ✅ SÍ | Funcional con middleware `requireNotTecnico` |
| Botón Crear respaldo | ✅ SÍ | Visible solo para admin |
| Botón Importar respaldo | ✅ SÍ | Visible solo para admin, con modal de preview |
| Exportar Excel General | ✅ SÍ | Botón en vista Proyectos y Proyectos Cerrados |

---

## 12. Riesgos Detectados Antes de Modificar

### Riesgos de Seguridad

| # | Riesgo | Severidad | Detalle |
|---|--------|-----------|---------|
| 1 | **SESSION_SECRET por defecto en código** | ALTA | `'change-this-session-secret'` hardcoded como fallback si no hay variable de entorno |
| 2 | **Contraseña admin por defecto** | ALTA | `admin123` si no se configura `ADMIN_PASSWORD` |
| 3 | **Sin rate limiting en login** | MEDIA | No hay protección contra fuerza bruta |
| 4 | **Sin auditoría de acciones** | MEDIA | No hay log de quién hizo qué ni cuándo (excepto `created_by`/`updated_by` en algunos módulos) |
| 5 | **adminVerified persiste en sesión** | MEDIA | Una vez verificado, el admin mantiene acceso elevado toda la hora de sesión sin re-autenticar |
| 6 | **DELETE de proyectos cerrados sin requireAdmin** | MEDIA | `DELETE /api/closed-projects/:id` solo requiere `requireAuth`, cualquier user puede borrar |
| 7 | **Pagos/costos sin requireNotTecnico completo** | BAJA | Los endpoints de pagos y costos solo requieren `requireAuth`, un técnico podría registrar pagos vía API directa |
| 8 | **Sin CSRF protection** | BAJA | Mitigado parcialmente por `sameSite=lax` pero no hay token CSRF explícito |
| 9 | **Sin HTTPS enforcement en dev** | BAJA | Cookie `secure` solo en producción; esperado para desarrollo |
| 10 | **Query GET /api/users no retorna el campo role** | BAJA | Bug: el SQL `SELECT id, username, created_at` no incluye `role`, siempre muestra 'user' en la lista |

### Riesgos Operativos

| # | Riesgo | Severidad | Detalle |
|---|--------|-----------|---------|
| 1 | **Sin respaldo externo automático** | ALTA | No hay cron, webhook ni mecanismo externo que respalde `app.db` periódicamente |
| 2 | **Importación no restaura usuarios ni tipos de cambio** | MEDIA | `usersSafe` y `exchangeRates` se extraen pero el import los ignora |
| 3 | **Sin versionado de schema en migración** | MEDIA | Si se cambia el schema, se debe borrar la DB manualmente |
| 4 | **Sin validación de integridad post-import** | BAJA | Después de importar no se valida que los totales cuadren |
| 5 | **Excel generado en frontend (no en servidor)** | BAJA | Si el navegador cierra durante generación de miles de registros, se pierde |

---

## 13. Nota Pre-Migración: Respaldo Externo

> **⚠️ ANTES DE CUALQUIER MIGRACIÓN FUTURA**, se debe implementar o configurar un respaldo externo de la base de datos (`data/app.db` o `DB_PATH`).
>
> Opciones recomendadas:
> 1. Script `cron` que copie `app.db` a almacenamiento externo (S3, GCS, etc.)
> 2. Configurar Litestream para replicación continua de SQLite
> 3. Endpoint o script que genere copia de seguridad binaria (no solo JSON lógico)
> 4. Disco persistente con snapshots automáticos (si el hosting lo soporta)
>
> El respaldo JSON actual (`GET /api/admin/backup`) es un respaldo **lógico** que no incluye sesiones ni hashes de contraseña, y es útil para migrar datos entre instancias, pero **no es un respaldo completo de disaster recovery**.

---

## 14. Resumen de Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `src/server.js` | Servidor Express: todos los endpoints, middlewares, lógica de negocio (~2997 líneas) |
| `src/db.js` | Inicialización SQLite, migraciones, seeders |
| `src/calculations.js` | Cálculos financieros (totales, márgenes, conversión de moneda) |
| `src/ecovis.js` | Cálculos ECOVIS (resumen de cuenta, estado de proyecto, pagos) |
| `src/vacations.js` | Cálculos de vacaciones según LFT mexicana |
| `src/pagination.js` | Utilidades de paginación, filtrado y ordenamiento |
| `src/sessionStore.js` | Store SQLite para express-session |
| `public/index.html` | SPA frontend (HTML) |
| `public/app.js` | Lógica frontend JavaScript (~3500+ líneas) |
| `public/report-print.html` | Vista impresión reporte caldera |
| `public/report-print-autoflame.html` | Vista impresión reporte Autoflame |
| `public/report-print-general.html` | Vista impresión reporte general |
| `public/vacation-print.html` | Vista impresión carta vacaciones |

---

*Documento generado como parte del diagnóstico inicial de seguridad. No se han modificado permisos, login, auditoría ni modelos.*
