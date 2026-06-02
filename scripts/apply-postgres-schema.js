#!/usr/bin/env node
'use strict';

/**
 * Aplica src/db/postgresSchema.sql usando DATABASE_URL del .env (External URL desde tu PC).
 */
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'postgresSchema.sql');

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL está vacía. Pega la External URL de Render en .env');
    process.exit(1);
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`Error: no se encontró ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('Conectando a PostgreSQL...');
  await client.connect();

  try {
    console.log(`Aplicando schema (${SCHEMA_PATH})...`);
    await client.query(sql);

    const result = await client.query(`
      SELECT COUNT(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    console.log(`OK: ${result.rows[0].table_count} tablas en schema public.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error aplicando schema:', error.message);
  process.exit(1);
});
