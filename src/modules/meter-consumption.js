/**
 * Page Consommations — graphiques 12 mois, exports — Phase 4
 */
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { store } from './store.js';
import {
  loadEnergyData,
  apiUpsertEnergyCommentForMeter,
  findEnergyCommentForMeter,
} from './api.js';
import { getUserClients } from './user-access.js';
import { showToast } from './ui.js';
import { clearElement, createTextEl, fillSelect } from './dom.js';
import {
  ENERGY_TYPE_LABELS,
  ENERGY_CHART_COLORS,
  lightenEnergyColor,
} from './energy-constants.js';
import { formatPeriodLabel, formatMonthLabel } from './energy-dates.js';
import {
  periodFromMonthInput,
  monthInputFromPeriod,
  metersForClient,
  buildGeneralMeterChartSeries,
  formatConsumption,
  isMeterCalculated,
  consumptionForChartMeter,
} from './energy-calc.js';
import { exportIndexesExcel, exportConsumptionsExcel } from './excel-export-energy.js';

Chart.register(
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

var selectedClientId = '';
var selectedPeriod = '';
var evolutionCharts = [];

function allowedClients() {
  if (!store.currentUser) return [];
  return getUserClients(store.currentUser.id);
}

function defaultPeriod() {
  var now = new Date();
  return (
    String(now.getFullYear()) +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-01'
  );
}

function renderClientSelect() {
  var sel = document.getElementById('consoClientFilter');
  if (!sel) return;
  var clients = allowedClients();
  fillSelect(
    sel,
    clients.map(function (c) {
      return { value: c, label: c };
    }),
    { placeholder: '— Choisir un site —', placeholderValue: '' }
  );
  if (selectedClientId && clients.indexOf(selectedClientId) !== -1) {
    sel.value = selectedClientId;
  } else if (clients.length === 1) {
    selectedClientId = clients[0];
    sel.value = selectedClientId;
  }
}

function renderPeriodInput() {
  var inp = document.getElementById('consoPeriodMonth');
  if (!inp) return;
  if (!selectedPeriod) selectedPeriod = defaultPeriod();
  inp.value = monthInputFromPeriod(selectedPeriod);
}

function destroyAllCharts() {
  evolutionCharts.forEach(function (c) {
    c.destroy();
  });
  evolutionCharts = [];
}

function hasSeriesData(current, n1) {
  return (
    current.some(function (v) {
      return v != null;
    }) ||
    n1.some(function (v) {
      return v != null;
    })
  );
}

function getGeneralMetersSorted(clientId) {
  return metersForClient(store.meters, clientId)
    .filter(function (m) {
      return m.isGeneral;
    })
    .sort(function (a, b) {
      var t = (a.energyType || '').localeCompare(b.energyType || '');
      if (t !== 0) return t;
      return a.name.localeCompare(b.name, 'fr');
    });
}

function appendCommentBlockForGeneral(wrap, general, refYear) {
  var commentBlock = document.createElement('div');
  commentBlock.className = 'conso-comment-block';
  var textarea = document.createElement('textarea');
  textarea.className = 'conso-comment-input';
  textarea.rows = 2;
  textarea.placeholder = 'Commentaire — ' + general.name + ' — ' + refYear;
  var saved = findEnergyCommentForMeter(
    selectedClientId,
    general.id,
    parseInt(refYear, 10)
  );
  if (saved && saved.comment) textarea.value = saved.comment;

  var saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-secondary conso-comment-save';
  saveBtn.textContent = 'Sauvegarder';
  saveBtn.addEventListener('click', function () {
    saveBtn.disabled = true;
    apiUpsertEnergyCommentForMeter(
      selectedClientId,
      general.id,
      parseInt(refYear, 10),
      textarea.value.trim()
    )
      .then(function () {
        showToast('✅ Commentaire enregistré — ' + general.name);
      })
      .catch(function (err) {
        console.error(err);
        showToast('❌ Commentaire non enregistré (liste GS_EnergyComments ?)');
      })
      .finally(function () {
        saveBtn.disabled = false;
      });
  });

  commentBlock.appendChild(textarea);
  commentBlock.appendChild(saveBtn);
  wrap.appendChild(commentBlock);
}

function renderEvolutionCharts() {
  destroyAllCharts();
  var grid = document.getElementById('consoChartsGrid');
  if (!grid) return;
  clearElement(grid);

  if (!selectedClientId || !selectedPeriod) return;

  var refYear = selectedPeriod.slice(0, 4);
  var n1Year = String(parseInt(refYear, 10) - 1);
  var anyChart = false;

  var generals = getGeneralMetersSorted(selectedClientId);

  generals.forEach(function (general) {
    var type = general.energyType || 'ELECTRICITE';
    var data = buildGeneralMeterChartSeries(
      general,
      selectedPeriod,
      store.readings,
      store.meters,
      store.generalConsumptions
    );

    if (!hasSeriesData(data.current, data.n1)) return;

    anyChart = true;
    var color = ENERGY_CHART_COLORS[type] || '#666';
    var colorN1 = lightenEnergyColor(color, 0.5);
    var labels = data.periods.map(formatMonthLabel);

    var wrap = document.createElement('div');
    wrap.className = 'conso-pole-chart';
    wrap.style.borderLeftColor = color;

    wrap.appendChild(createTextEl('h4', general.name, 'conso-pole-title'));
    var metaText =
      (ENERGY_TYPE_LABELS[type] || type) +
      (isMeterCalculated(general, store.meters) ? ' · calculé (Σ liés)' : ' · index');
    wrap.appendChild(createTextEl('p', metaText, 'conso-pole-meta'));

    var chartWrap = document.createElement('div');
    chartWrap.className = 'conso-chart-canvas-wrap';
    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Graphique ' + general.name);
    chartWrap.appendChild(canvas);
    wrap.appendChild(chartWrap);

    appendCommentBlockForGeneral(wrap, general, refYear);
    grid.appendChild(wrap);

    var chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: refYear + ' (N)',
            data: data.current,
            borderColor: color,
            backgroundColor: color + '33',
            borderWidth: 2.5,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: color,
            tension: 0.25,
            fill: false,
            spanGaps: true,
          },
          {
            label: n1Year + ' (N-1)',
            data: data.n1,
            borderColor: colorN1,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [8, 5],
            pointRadius: 5,
            pointStyle: 'circle',
            pointBackgroundColor: colorN1,
            tension: 0.25,
            fill: false,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 9 }, padding: 6 },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.parsed.y;
                return ctx.dataset.label + ': ' + (v != null ? v.toLocaleString('fr-FR') : '—');
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 10 } },
          },
          x: {
            ticks: { font: { size: 10 }, maxRotation: 0 },
          },
        },
      },
    });

    evolutionCharts.push(chart);
  });

  if (!generals.length) {
    grid.appendChild(
      createTextEl(
        'p',
        'Aucun compteur « Général » configuré pour ce site (Admin → Compteurs).',
        'meter-empty'
      )
    );
  } else if (!anyChart) {
    grid.appendChild(
      createTextEl(
        'p',
        'Aucune donnée sur l\'année ' +
          refYear +
          ' — enregistrez la ronde (Index) puis rechargez cette page.',
        'meter-empty'
      )
    );
  }
}

function renderConsumptionTable() {
  var tbody = document.getElementById('consoMeterTable');
  if (!tbody) return;
  clearElement(tbody);

  if (!selectedClientId || !selectedPeriod) return;

  var meters = metersForClient(store.meters, selectedClientId)
    .filter(function (m) {
      return m.isGeneral;
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name, 'fr');
    });

  if (!meters.length) {
    var tr0 = document.createElement('tr');
    var td0 = document.createElement('td');
    td0.colSpan = 4;
    td0.style.textAlign = 'center';
    td0.style.color = '#aaa';
    td0.textContent = 'Aucun compteur général';
    tr0.appendChild(td0);
    tbody.appendChild(tr0);
    return;
  }

  meters.forEach(function (meter) {
    var conso = consumptionForChartMeter(
      meter,
      selectedPeriod,
      store.readings,
      store.meters,
      store.generalConsumptions
    );
    var tr = document.createElement('tr');
    var tdName = document.createElement('td');
    tdName.textContent = meter.name;
    var tdType = document.createElement('td');
    tdType.textContent = ENERGY_TYPE_LABELS[meter.energyType] || meter.energyType;
    var tdConso = document.createElement('td');
    tdConso.textContent = conso != null ? formatConsumption(conso, meter.unit) : '—';
    var tdFlag = document.createElement('td');
    if (meter.isGeneral) tdFlag.textContent = 'Général';
    else if (meter.isDecreasing) tdFlag.textContent = '↓';
    else tdFlag.textContent = '—';
    tr.appendChild(tdName);
    tr.appendChild(tdType);
    tr.appendChild(tdConso);
    tr.appendChild(tdFlag);
    tbody.appendChild(tr);
  });
}

function onClientChange() {
  var sel = document.getElementById('consoClientFilter');
  selectedClientId = sel ? sel.value : '';
  renderAll();
}

function onPeriodChange() {
  var inp = document.getElementById('consoPeriodMonth');
  selectedPeriod = periodFromMonthInput(inp ? inp.value : '');
  renderAll();
}

function renderAll() {
  renderEvolutionCharts();
  renderConsumptionTable();
  var summary = document.getElementById('consoSummary');
  if (summary && selectedClientId && selectedPeriod) {
    summary.textContent =
      'Analyse · ' +
      selectedClientId +
      ' · ' +
      formatPeriodLabel(selectedPeriod) +
      ' · année civile ' + selectedPeriod.slice(0, 4) + ' (janv.–déc.) · N vs N-1';
  }
}

function bindOnce() {
  var clientSel = document.getElementById('consoClientFilter');
  var periodInp = document.getElementById('consoPeriodMonth');
  if (!clientSel || clientSel.dataset.bound) return;
  clientSel.dataset.bound = '1';
  clientSel.addEventListener('change', onClientChange);
  if (periodInp) periodInp.addEventListener('change', onPeriodChange);
}

export function initMeterConsumption() {
  bindOnce();
  if (!selectedPeriod) selectedPeriod = defaultPeriod();
}

export function renderMeterConsumption() {
  renderClientSelect();
  renderPeriodInput();
  renderAll();
}

export function loadMeterConsumptionScreen() {
  initMeterConsumption();
  return loadEnergyData()
    .then(renderMeterConsumption)
    .catch(function (err) {
      console.warn('[meter-consumption]', err);
      showToast('⚠️ Données énergie non chargées');
      renderMeterConsumption();
    });
}

export function exportConsoIndexes() {
  if (!selectedClientId) return showToast('⚠️ Sélectionnez un site');
  try {
    exportIndexesExcel(
      selectedClientId,
      store.meters,
      store.readings,
      selectedPeriod || defaultPeriod()
    );
    showToast('📤 Index exportés (janv.–déc. ' + (selectedPeriod || defaultPeriod()).slice(0, 4) + ')');
  } catch (err) {
    showToast('❌ ' + (err.message || 'Export impossible'));
  }
}

export function exportConsoCalculated() {
  if (!selectedClientId) return showToast('⚠️ Sélectionnez un site');
  try {
    exportConsumptionsExcel(
      selectedClientId,
      store.meters,
      store.readings,
      selectedPeriod || defaultPeriod(),
      store.generalConsumptions
    );
    showToast(
      '📤 Consommations exportées (format ERIA · janv.–déc. ' +
        (selectedPeriod || defaultPeriod()).slice(0, 4) +
        ')'
    );
  } catch (err) {
    showToast('❌ ' + (err.message || 'Export impossible'));
  }
}

export function destroyMeterConsumptionCharts() {
  destroyAllCharts();
}
