(function(global) {
  'use strict';

  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  function formatCurrencyMXN(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$0.00';
    return money.format(n);
  }

  const VENTAS_CHART_COLORS = {
    quoted: '#2563eb',
    sold: '#0d9488',
    collected: '#eab308',
    quotedBg: 'rgba(37, 99, 235, 0.25)',
    soldBar: '#0d9488',
    marginPositive: '#22c55e',
    marginNegative: '#ef4444',
  };

  const KPI_CHART_COLORS = ['#2563eb', '#22c55e', '#eab308', '#f97316', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

  const kpiBarValueLabelsPlugin = {
    id: 'kpiBarValueLabelsPrint',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      chart.data.datasets.forEach(function(dataset, datasetIndex) {
        if (dataset._skipValueLabels) return;
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || meta.hidden) return;
        meta.data.forEach(function(bar, index) {
          const raw = dataset.data[index];
          if (raw == null || !Number.isFinite(Number(raw))) return;
          const value = Number(raw);
          const isPoints = dataset._valueFormat === 'points';
          const label = isPoints ? ((value >= 0 ? '+' : '') + value + ' pts') : formatCurrencyMXN(value);
          ctx.save();
          ctx.fillStyle = '#334155';
          ctx.font = '11px system-ui, sans-serif';
          ctx.textBaseline = 'middle';
          if (chart.options.indexAxis === 'y') {
            const xPos = value >= 0 ? bar.x + 6 : bar.x - 6;
            ctx.textAlign = value >= 0 ? 'left' : 'right';
            if (xPos > chartArea.left && xPos < chartArea.right - 4) ctx.fillText(label, xPos, bar.y);
          } else {
            ctx.textAlign = 'center';
            ctx.fillText(label, bar.x, bar.y - 6);
          }
          ctx.restore();
        });
      });
    },
  };

  function setCanvasHeight(canvas, rowCount, minHeight) {
    if (!canvas) return;
    const h = Math.max(minHeight || 180, (rowCount || 1) * 38 + 48);
    canvas.height = h;
    canvas.style.height = h + 'px';
  }

  function showEmpty(panel, message) {
    if (!panel) return;
    panel.innerHTML = '<p class="kpi-chart-empty muted">' + message + '</p>';
  }

  function renderReceivableChart(charts) {
    const panel = document.getElementById('kpi-print-chart-receivable');
    if (!panel) return;
    const buckets = (charts && charts.receivable_buckets) || [];
    if (!buckets.length || buckets.every(function(b) { return !b.amount && !b.count; })) {
      showEmpty(panel, 'Sin cartera pendiente con los filtros actuales.');
      return;
    }
    const canvas = document.createElement('canvas');
    panel.appendChild(canvas);
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: buckets.map(function(b) { return b.label; }),
        datasets: [{ label: 'Monto MXN', data: buckets.map(function(b) { return b.amount || 0; }), backgroundColor: ['#22c55e', '#ef4444'] }],
      },
      options: {
        animation: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(c) {
                const bucket = buckets[c.dataIndex];
                return formatCurrencyMXN(c.parsed.y) + ' (' + (bucket.count || 0) + ' proyectos)';
              },
            },
          },
        },
        scales: { y: { ticks: { callback: function(v) { return formatCurrencyMXN(v); } } } },
      },
      plugins: [kpiBarValueLabelsPlugin],
    });
  }

  function renderServicesChart(charts) {
    const panel = document.getElementById('kpi-print-chart-reports');
    if (!panel) return;
    const services = (charts && charts.services_by_month) || { labels: [], series: [] };
    const series = services.series || [];
    if (!series.length || !(services.labels || []).length) {
      showEmpty(panel, 'Sin servicios/reportes ejecutados en el periodo.');
      return;
    }
    const canvas = document.createElement('canvas');
    panel.appendChild(canvas);
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: services.labels,
        datasets: series.map(function(s, idx) {
          return {
            label: s.full_name,
            data: s.data || [],
            backgroundColor: KPI_CHART_COLORS[idx % KPI_CHART_COLORS.length],
          };
        }),
      },
      options: {
        animation: false,
        plugins: { tooltip: { mode: 'index', intersect: false } },
        scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function renderVentasCharts(ventas) {
    const charts = (ventas && ventas.charts) || {};

    const trendPanel = document.getElementById('kpi-print-chart-ventas-trend');
    const trend = charts.monthly_trend || [];
    if (trendPanel) {
      const hasTrendData = trend.some(function(t) {
        return (t.quoted_amount_mxn || 0) > 0 || (t.sold_amount_mxn || 0) > 0 || (t.collected_amount_mxn || 0) > 0;
      });
      if (!trend.length || !hasTrendData) {
        showEmpty(trendPanel, 'Sin datos en el periodo.');
      } else {
        const canvas = document.createElement('canvas');
        trendPanel.appendChild(canvas);
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: trend.map(function(t) { return t.label; }),
            datasets: [
              { label: 'Monto cotizado', data: trend.map(function(t) { return t.quoted_amount_mxn || 0; }), borderColor: VENTAS_CHART_COLORS.quoted, tension: 0.25 },
              { label: 'Monto vendido', data: trend.map(function(t) { return t.sold_amount_mxn || 0; }), borderColor: VENTAS_CHART_COLORS.sold, tension: 0.25 },
              { label: 'Monto cobrado', data: trend.map(function(t) { return t.collected_amount_mxn || 0; }), borderColor: VENTAS_CHART_COLORS.collected, tension: 0.25 },
            ],
          },
          options: {
            animation: false,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + formatCurrencyMXN(ctx.parsed.y); } } },
            },
            scales: { y: { beginAtZero: true, ticks: { callback: function(v) { return formatCurrencyMXN(v); } } } },
          },
        });
      }
    }

    const funnelPanel = document.getElementById('kpi-print-chart-ventas-funnel');
    const funnelStages = (charts.sales_funnel && charts.sales_funnel.stages) || [];
    if (funnelPanel) {
      if (!funnelStages.length) {
        showEmpty(funnelPanel, 'Sin datos en el periodo.');
      } else {
        const canvas = document.createElement('canvas');
        setCanvasHeight(canvas, funnelStages.length, 160);
        funnelPanel.appendChild(canvas);
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels: funnelStages.map(function(s) { return s.label; }),
            datasets: [{ label: 'Monto MXN', data: funnelStages.map(function(s) { return s.amount || 0; }), backgroundColor: funnelStages.map(function(s) { return s.color; }), borderRadius: 4 }],
          },
          options: {
            animation: false,
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return formatCurrencyMXN(ctx.parsed.x); } } } },
            scales: { x: { beginAtZero: true, ticks: { callback: function(v) { return formatCurrencyMXN(v); } } } },
          },
          plugins: [kpiBarValueLabelsPlugin],
        });
      }
    }

    const rankingPanel = document.getElementById('kpi-print-chart-ventas-ranking');
    const ranking = charts.seller_ranking || [];
    if (rankingPanel) {
      if (!ranking.length) {
        showEmpty(rankingPanel, 'Sin datos en el periodo.');
      } else {
        const canvas = document.createElement('canvas');
        setCanvasHeight(canvas, ranking.length, 200);
        rankingPanel.appendChild(canvas);
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels: ranking.map(function(r) { return r.label; }),
            datasets: [
              { label: 'Monto cotizado (referencia)', data: ranking.map(function(r) { return r.quoted_amount_mxn || 0; }), backgroundColor: VENTAS_CHART_COLORS.quotedBg, borderRadius: 4, order: 2, _skipValueLabels: true },
              { label: 'Monto vendido', data: ranking.map(function(r) { return r.sold_amount_mxn || 0; }), backgroundColor: VENTAS_CHART_COLORS.soldBar, borderRadius: 4, order: 1 },
            ],
          },
          options: {
            animation: false,
            indexAxis: 'y',
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + formatCurrencyMXN(ctx.parsed.x); } } },
            },
            scales: { x: { beginAtZero: true, ticks: { callback: function(v) { return formatCurrencyMXN(v); } } } },
          },
          plugins: [kpiBarValueLabelsPlugin],
        });
      }
    }

    const marginPanel = document.getElementById('kpi-print-chart-ventas-margin');
    const marginGap = charts.margin_gap_by_seller || [];
    if (marginPanel) {
      if (!marginGap.length) {
        showEmpty(marginPanel, 'Sin datos en el periodo.');
      } else {
        const canvas = document.createElement('canvas');
        setCanvasHeight(canvas, marginGap.length, 200);
        marginPanel.appendChild(canvas);
        const gapValues = marginGap.map(function(r) { return r.gap_points; });
        const maxAbs = Math.max.apply(null, gapValues.map(function(v) { return Math.abs(v); }).concat([5]));
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels: marginGap.map(function(r) { return r.label; }),
            datasets: [{
              label: 'Brecha margen (pts)',
              data: gapValues,
              backgroundColor: gapValues.map(function(v) { return v >= 0 ? VENTAS_CHART_COLORS.marginPositive : VENTAS_CHART_COLORS.marginNegative; }),
              borderRadius: 4,
              _valueFormat: 'points',
            }],
          },
          options: {
            animation: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: function(ctx) { const v = ctx.parsed.x; return 'Brecha: ' + (v >= 0 ? '+' : '') + v + ' pts'; } } },
            },
            scales: {
              x: {
                min: -maxAbs - 2,
                max: maxAbs + 2,
                ticks: { callback: function(v) { return v + ' pts'; } },
                grid: {
                  color: function(ctx) { return ctx.tick.value === 0 ? '#64748b' : 'rgba(148,163,184,0.25)'; },
                  lineWidth: function(ctx) { return ctx.tick.value === 0 ? 2 : 1; },
                },
              },
            },
          },
          plugins: [kpiBarValueLabelsPlugin],
        });
      }
    }
  }

  function renderPrintKpiCharts(summary) {
    if (typeof Chart === 'undefined') return;
    renderReceivableChart(summary.charts || {});
    renderServicesChart(summary.charts || {});
    renderVentasCharts(summary.ventas || {});
  }

  global.renderPrintKpiCharts = renderPrintKpiCharts;
})(window);
