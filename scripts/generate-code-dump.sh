#!/usr/bin/env bash
# Genera docs/CODIGO_COMPLETO_PARA_ANALISIS.txt con todo el código fuente del proyecto.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/CODIGO_COMPLETO_PARA_ANALISIS.txt"

mkdir -p "$ROOT/docs"

{
  echo "================================================================================"
  echo "CONTROL DE PROYECTOS - CÓDIGO COMPLETO PARA ANÁLISIS"
  echo "Generado: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "================================================================================"
  echo ""
  echo "ÍNDICE DE ARCHIVOS:"
  echo "-------------------"
  find "$ROOT" -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.sql" -o -name "*.json" -o -name "*.md" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/data/*" ! -name "package-lock.json" \
    | sed "s|^$ROOT/||" | sort | nl -w3 -s'. '
  echo ""
  echo "================================================================================"
  echo ""

  find "$ROOT" -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.sql" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/data/*" \
    | sort | while read -r file; do
    rel="${file#$ROOT/}"
    echo ""
    echo "################################################################################"
    echo "# ARCHIVO: $rel"
    echo "################################################################################"
    echo ""
    cat "$file"
    echo ""
  done

  echo ""
  echo "================================================================================"
  echo "ARCHIVOS DE CONFIGURACIÓN Y DOCUMENTACIÓN"
  echo "================================================================================"
  echo ""

  for file in package.json .env.example README.md AGENTS.md RENDER_DEPLOY.md docs/SECURITY_AUDIT_INVENTORY.md; do
    if [ -f "$ROOT/$file" ]; then
      echo ""
      echo "################################################################################"
      echo "# ARCHIVO: $file"
      echo "################################################################################"
      echo ""
      cat "$ROOT/$file"
      echo ""
    fi
  done
} > "$OUT"

echo "Generado: $OUT ($(wc -l < "$OUT") líneas, $(du -h "$OUT" | cut -f1))"
