/**
 * Ronde terrain — saisie index + consos générales (GS_Readings + GS_GeneralConsumptions)
 */
import { store } from './store.js';
import {
  loadEnergyData,
  apiUpsertReading,
  apiUpsertGeneralConsumption,
  findGeneralConsumption,
} from './api.js';
import { getUserClients } from './user-access.js';
import { showToast, goTo } from './ui.js';
import { clearElement, createTextEl, fillSelect } from './dom.js';
import { ENERGY_TYPE_LABELS } from './energy-constants.js';
import { formatPeriodLabel } from './energy-dates.js';
import {
  getPreviousPeriod,
  periodFromMonthInput,
  monthInputFromPeriod,
  getIndexValue,
  calculateConsumption,
  formatConsumption,
  computeGeneralConsumptionFromLinked,
  isMeterCalculated,
  getEffectiveLinkedMeterIds,
  getStoredGeneralConsumption,
} from './energy-calc.js';
import { renderEnergyAccordions } from './meter-accordion.js';
import { renderMeterTreeInContainer } from './meter-tree-hierarchy.js';

var selectedClientId = '';
var selectedPeriod = '';

function allowedClients() {
  if (!store.currentUser) return [];
  return getUserClients(store.currentUser.id);
}

function metersForClient(clientId) {
  return store.meters.filter(function (m) {
    return m.clientId === clientId;
  });
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
  var sel = document.getElementById('readingClientFilter');
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
  var inp = document.getElementById('readingPeriodMonth');
  if (!inp) return;
  if (!selectedPeriod) selectedPeriod = defaultPeriod();
  inp.value = monthInputFromPeriod(selectedPeriod);
  var lbl = document.getElementById('readingPeriodLabel');
  if (lbl) lbl.textContent = formatPeriodLabel(selectedPeriod);
}

function collectLiveIndexesFromDom() {
  var live = {};
  document.querySelectorAll('#readingMeterList .reading-row[data-meter-id]').forEach(function (row) {
    var id = row.dataset.meterId;
    var input = row.querySelector('.reading-index-input');
    if (!input) return;
    var raw = input.value.trim().replace(',', '.');
    if (raw === '') return;
    var n = Number(raw);
    if (!isNaN(n)) live[id] = n;
  });
  return live;
}

function isCalculatedGeneral(meter) {
  return isMeterCalculated(meter, store.meters);
}

function graphErrorMessage(err) {
  var raw = err && err.message ? err.message : String(err);
  try {
    var j = JSON.parse(raw);
    if (j.error && j.error.message) return j.error.message;
  } catch (e) {
    /* ignore */
  }
  return raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
}

function refreshAllCalculatedGenerals() {
  store.meters.forEach(function (g) {
    if (g.clientId !== selectedClientId || !isCalculatedGeneral(g)) return;
    var row = document.querySelector(
      '#readingMeterList .reading-row[data-meter-id="' + g.id + '"]'
    );
    if (row) updateRowConsumption(row, g);
  });
}

function refreshParentGeneralRows(changedMeterId) {
  store.meters.forEach(function (g) {
    if (g.clientId !== selectedClientId || !isCalculatedGeneral(g)) return;
    var linked = getEffectiveLinkedMeterIds(g);
    if (linked.indexOf(changedMeterId) === -1) return;
    var parentRow = document.querySelector(
      '#readingMeterList .reading-row[data-meter-id="' + g.id + '"]'
    );
    if (parentRow) updateRowConsumption(parentRow, g);
  });
}

function updateRowConsumption(row, meter) {
  var input = row.querySelector('.reading-index-input');
  var consoEl = row.querySelector('.reading-conso-value');
  var prevVal = row.querySelector('.reading-prev-value');
  if (!consoEl) return;

  if (isCalculatedGeneral(meter)) {
    var liveSum = computeGeneralConsumptionFromLinked(
      meter,
      selectedPeriod,
      store.readings,
      store.meters,
      collectLiveIndexesFromDom()
    );
    var stored = findGeneralConsumption(meter.id, selectedPeriod);
    var storedVal = getStoredGeneralConsumption(
      meter.id,
      selectedPeriod,
      store.generalConsumptions
    );
    var displayVal = liveSum != null && !isNaN(liveSum) ? liveSum : storedVal;

    consoEl.textContent = formatConsumption(displayVal, meter.unit);
    consoEl.classList.add('reading-conso--sum');
    consoEl.classList.toggle('reading-conso--live', liveSum != null && !isNaN(liveSum));
    consoEl.classList.toggle('reading-conso--stored', storedVal != null);

    if (storedVal != null && liveSum != null && Math.abs(storedVal - liveSum) < 0.01) {
      consoEl.title = 'Conso enregistrée (GS_GeneralConsumptions)';
      row.classList.add('reading-row--saved');
    } else if (storedVal != null && (liveSum == null || isNaN(liveSum))) {
      consoEl.title = 'Dernière conso enregistrée — modifier les index des sous-compteurs puis Enregistrer';
      row.classList.add('reading-row--saved');
    } else {
      consoEl.title = 'Σ live des sous-compteurs — bouton Enregistrer pour écrire dans GS_GeneralConsumptions';
      row.classList.remove('reading-row--saved');
    }

    if (prevVal) {
      prevVal.textContent = 'Σ';
      prevVal.title = 'Compteur calculé — pas d\'index sur le général';
    }
    if (displayVal != null && displayVal < 0) {
      consoEl.classList.add('reading-conso--warn');
    } else {
      consoEl.classList.remove('reading-conso--warn');
    }
    return;
  }

  row.classList.remove('reading-row--saved');

  consoEl.classList.remove('reading-conso--sum', 'reading-conso--live');
  consoEl.removeAttribute('title');
  if (!input) return;

  var prevPeriod = getPreviousPeriod(selectedPeriod);
  var prevIndex = getIndexValue(meter.id, prevPeriod, store.readings);
  var raw = input.value.trim().replace(',', '.');
  var currentIndex = raw === '' ? null : Number(raw);

  var conso = calculateConsumption(currentIndex, prevIndex, meter.isDecreasing);
  consoEl.textContent = formatConsumption(conso, meter.unit);

  if (prevVal) {
    prevVal.textContent = prevIndex != null ? String(prevIndex) : '—';
    prevVal.removeAttribute('title');
  }

  if (conso != null && conso < 0) {
    consoEl.classList.add('reading-conso--warn');
  } else {
    consoEl.classList.remove('reading-conso--warn');
  }
}

function appendMeterRow(container, meter, treeCtx) {
  treeCtx = treeCtx || {};
  var prevPeriod = getPreviousPeriod(selectedPeriod);
  var prevIndex = getIndexValue(meter.id, prevPeriod, store.readings);
  var currentReading = store.readings.find(function (r) {
    return r.meterId === meter.id && r.period === selectedPeriod;
  });
  var calculated = isCalculatedGeneral(meter);
  var currentIndex =
    calculated || !currentReading ? '' : currentReading.indexValue;

  var row = document.createElement('div');
  row.className = 'reading-row';
  if (treeCtx.isChild) row.classList.add('sub-meter-row');
  if (treeCtx.isTreeParent) row.classList.add('reading-row--parent');
  row.dataset.meterId = meter.id;

  var nameCol = document.createElement('div');
  nameCol.className = 'reading-name-col';

  if (treeCtx.isTreeParent && treeCtx.isCollapsible) {
    var expand = document.createElement('span');
    expand.className = 'meter-tree-expand';
    expand.setAttribute('aria-hidden', 'true');
    nameCol.appendChild(expand);
  }
  if (treeCtx.isTreeParent) {
    var meterIcon = document.createElement('span');
    meterIcon.className = 'meter-tree-meter-icon';
    meterIcon.setAttribute('aria-hidden', 'true');
    nameCol.appendChild(meterIcon);
  }
  var nameEl = createTextEl('span', meter.name, 'reading-meter-name');
  var metaParts = ENERGY_TYPE_LABELS[meter.energyType] || meter.energyType;
  if (isCalculatedGeneral(meter)) metaParts += ' · Calculé (Σ sous-compteurs)';
  else if (meter.isGeneral) metaParts += ' · Général';
  if (meter.isDecreasing) metaParts += ' · ↓';
  var metaEl = createTextEl('span', metaParts, 'reading-meter-meta');
  nameCol.appendChild(nameEl);
  nameCol.appendChild(metaEl);

  var prevCol = document.createElement('div');
  prevCol.className = 'reading-prev-col';
  var prevLbl = createTextEl('span', 'M-1', 'reading-col-label');
  var prevVal = createTextEl(
    'span',
    prevIndex != null ? String(prevIndex) : '—',
    'reading-prev-value'
  );
  prevCol.appendChild(prevLbl);
  prevCol.appendChild(prevVal);

  var inputCol = document.createElement('div');
  inputCol.className = 'reading-input-col';
  var inputLbl = createTextEl('span', 'Index', 'reading-col-label');
  var input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.className = 'reading-index-input';
  input.placeholder = 'Saisir…';
  input.inputMode = 'decimal';
  if (calculated) {
    input.disabled = true;
    input.readOnly = true;
    input.placeholder = '— (Σ sous-compteurs)';
    input.title =
      'Index non requis : la conso est calculée en direct puis enregistrée via GS_GeneralConsumptions.';
  }
  if (currentIndex !== '' && currentIndex != null) {
    input.value = String(currentIndex);
  }
  input.addEventListener('input', function () {
    updateRowConsumption(row, meter);
    if (!isCalculatedGeneral(meter)) {
      refreshParentGeneralRows(meter.id);
    }
    refreshAllCalculatedGenerals();
  });
  inputCol.appendChild(inputLbl);
  inputCol.appendChild(input);

  var consoCol = document.createElement('div');
  consoCol.className = 'reading-conso-col';
  var consoLbl = createTextEl('span', 'Conso', 'reading-col-label');
  var consoVal = createTextEl('span', '—', 'reading-conso-value');
  consoCol.appendChild(consoLbl);
  consoCol.appendChild(consoVal);

  if (currentReading && !calculated) {
    row.classList.add('reading-row--saved');
  }

  row.appendChild(nameCol);
  row.appendChild(prevCol);
  row.appendChild(inputCol);
  row.appendChild(consoCol);
  container.appendChild(row);

  updateRowConsumption(row, meter);
}

function renderReadingList() {
  var container = document.getElementById('readingMeterList');
  var summary = document.getElementById('readingSummary');
  if (!container) return;
  clearElement(container);

  if (!selectedClientId || !selectedPeriod) {
    container.appendChild(createTextEl('p', 'Sélectionnez un site et un mois.', 'meter-empty'));
    if (summary) summary.textContent = '';
    return;
  }

  var header = document.createElement('div');
  header.className = 'reading-row reading-row--header';
  header.appendChild(createTextEl('div', 'Compteur', 'reading-name-col'));
  header.appendChild(createTextEl('div', 'Index précédent', 'reading-prev-col'));
  header.appendChild(createTextEl('div', 'Nouvel index', 'reading-input-col'));
  header.appendChild(createTextEl('div', 'Consommation', 'reading-conso-col'));
  container.appendChild(header);

  var accWrap = document.createElement('div');
  accWrap.className = 'energy-accordions-wrap';
  container.appendChild(accWrap);

  renderEnergyAccordions(accWrap, {
    clientId: selectedClientId,
    meters: store.meters,
    emptyMessage: 'Aucun compteur configuré pour ce site.',
    renderTypeBody: function (bodyEl, energyType) {
      renderMeterTreeInContainer(
        bodyEl,
        store.meters,
        selectedClientId,
        energyType,
        appendMeterRow
      );
    },
  });

  refreshAllCalculatedGenerals();

  if (summary) {
    var prevLbl = formatPeriodLabel(getPreviousPeriod(selectedPeriod));
    var siteMeters = store.meters.filter(function (m) {
      return m.clientId === selectedClientId;
    });
    var calcCount = siteMeters.filter(function (m) {
      return isCalculatedGeneral(m);
    }).length;
    var storedCount = calcCount
      ? siteMeters.filter(function (m) {
          return (
            isCalculatedGeneral(m) &&
            findGeneralConsumption(m.id, selectedPeriod)
          );
        }).length
      : 0;
    summary.textContent =
      siteMeters.length +
      ' compteur(s) · ' +
      formatPeriodLabel(selectedPeriod) +
      ' (M-1 : ' +
      prevLbl +
      ')' +
      (calcCount
        ? ' · ' + calcCount + ' général(aux) calculé(s)' +
          (storedCount ? ', ' + storedCount + ' déjà enregistré(s) ce mois' : '')
        : '');
  }
}

function onClientChange() {
  var sel = document.getElementById('readingClientFilter');
  selectedClientId = sel ? sel.value : '';
  renderReadingList();
}

function onPeriodChange() {
  var inp = document.getElementById('readingPeriodMonth');
  selectedPeriod = periodFromMonthInput(inp ? inp.value : '');
  renderPeriodInput();
  renderReadingList();
}

function collectReadingsToSave() {
  var rows = document.querySelectorAll('#readingMeterList .reading-row[data-meter-id]');
  var toSave = [];
  var userId = store.currentUser ? store.currentUser.id : '';

  rows.forEach(function (row) {
    var meterId = row.dataset.meterId;
    var meter = store.meters.find(function (m) {
      return m.id === meterId;
    });
    if (!meter) return;
    if (isCalculatedGeneral(meter)) return;

    var input = row.querySelector('.reading-index-input');
    if (!input) return;
    var raw = input.value.trim().replace(',', '.');
    if (raw === '') return;

    var indexValue = Number(raw);
    if (isNaN(indexValue)) return;

    toSave.push({
      meterId: meterId,
      period: selectedPeriod,
      indexValue: indexValue,
      userId: userId,
    });
  });

  return toSave;
}

function collectGeneralConsumptionsToSave() {
  var live = collectLiveIndexesFromDom();
  var list = [];

  metersForClient(selectedClientId).forEach(function (meter) {
    if (!isCalculatedGeneral(meter)) return;
    var val = computeGeneralConsumptionFromLinked(
      meter,
      selectedPeriod,
      store.readings,
      store.meters,
      live
    );
    if (val == null || isNaN(val)) return;
    list.push({
      meterId: meter.id,
      clientId: meter.clientId,
      period: selectedPeriod,
      consumptionValue: val,
    });
  });

  return list;
}

function persistGeneralConsumptions(records) {
  var chain = Promise.resolve();
  records.forEach(function (rec) {
    chain = chain.then(function () {
      return apiUpsertGeneralConsumption(rec);
    });
  });
  return chain.then(function () {
    return records.length;
  });
}

/** Index (GS_Readings) + consos générales (GS_GeneralConsumptions), puis retour accueil */
function saveAllReadings() {
  if (!selectedClientId) return showToast('⚠️ Sélectionnez un site');
  if (!selectedPeriod) return showToast('⚠️ Sélectionnez un mois');

  var readings = collectReadingsToSave();
  var generalPreview = collectGeneralConsumptionsToSave();

  if (!readings.length && !generalPreview.length) {
    return showToast('⚠️ Saisissez au moins un index (ou complétez les sous-compteurs liés)');
  }

  showToast('⏳ Enregistrement…');

  var chain = Promise.resolve();
  readings.forEach(function (r) {
    chain = chain.then(function () {
      return apiUpsertReading(r);
    });
  });

  chain
    .then(function () {
      var records = collectGeneralConsumptionsToSave();
      if (!records.length) return { indexCount: readings.length, generalCount: 0 };
      return persistGeneralConsumptions(records).then(function (n) {
        return { indexCount: readings.length, generalCount: n };
      });
    })
    .then(function (result) {
      var parts = [];
      if (result.indexCount) parts.push(result.indexCount + ' index');
      if (result.generalCount) parts.push(result.generalCount + ' conso générale(s)');
      showToast('✅ Enregistré : ' + (parts.length ? parts.join(', ') : 'données à jour'));
      goTo('screen-menu');
    })
    .catch(function (err) {
      console.error(err);
      showToast('❌ ' + graphErrorMessage(err));
    });
}

function bindReadingScreenOnce() {
  var clientSel = document.getElementById('readingClientFilter');
  var periodInp = document.getElementById('readingPeriodMonth');
  if (!clientSel || clientSel.dataset.bound) return;
  clientSel.dataset.bound = '1';

  clientSel.addEventListener('change', onClientChange);
  if (periodInp) periodInp.addEventListener('change', onPeriodChange);
}

export function initMeterReading() {
  bindReadingScreenOnce();
  if (!selectedPeriod) selectedPeriod = defaultPeriod();
}

export function renderMeterReading() {
  renderClientSelect();
  renderPeriodInput();
  renderReadingList();
}

export function loadMeterReadingScreen() {
  initMeterReading();
  return loadEnergyData()
    .then(renderMeterReading)
    .catch(function (err) {
      console.warn('[meter-reading]', err);
      showToast('⚠️ Données énergie non chargées');
      renderMeterReading();
    });
}

export { saveAllReadings };
