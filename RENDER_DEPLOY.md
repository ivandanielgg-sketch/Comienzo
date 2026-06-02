# Render deploy

## Si el deploy está viejo (grep SCHEMA_TABLE_ORDER vacío)

Actualiza el script desde GitHub sin esperar redeploy:

```bash
cd /opt/render/project/src
curl -sL "https://raw.githubusercontent.com/ivandanielgg-sketch/Comienzo/main/scripts/apply-postgres-schema.js" -o scripts/apply-postgres-schema.js
grep SCHEMA_TABLE_ORDER scripts/apply-postgres-schema.js
SCHEMA_RESET=true npm run db:apply-schema
npm run migrate:data
```

## Con deploy actualizado (commit 8b9c5c7+)

```bash
cd /opt/render/project/src
SCHEMA_RESET=true npm run db:apply-schema
npm run migrate:data
```
