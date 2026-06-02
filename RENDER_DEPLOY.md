# Render deploy

Última actualización para migración PostgreSQL: commit con `SCHEMA_TABLE_ORDER` en `scripts/apply-postgres-schema.js`.

En Shell de Render (después del deploy):

```bash
cd /opt/render/project/src
SCHEMA_RESET=true npm run db:apply-schema
npm run migrate:data
```
