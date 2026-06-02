/**
 * Admin CRUD compteurs énergie — Phase 2
 */
import { store } from './store.js';
import {
  loadEnergyData,
  apiSaveMeter,
  apiDeleteMeter,
  apiUpsertReadingsBatch,
} from './api.js';
import { getUserClients } from './user-access.js';
import { showToast } from './ui.js';
import { clearElement, createTextEl, fillSelect } from './dom.js';
import {
  ENERGY_TYPES,
  ENERGY_TYPE_LABELS,
  UNITS,
  getUnitsForType,
  getDefaultUnit,
} from './energy-constants.js';
import { formatPeriodLabel } from './energy-dates.js';
import { parseMeterMatrixWorkbook, readExcelFile, summarizeImportReadings } from './excel-import-meters.js';
import {
  renderEnergyAccordions,
  captureOpenAccordionTypes,
} from './meter-accordion.js';
import { renderMeterTreeInContainer } from './meter-tree-hierarchy.js';

var inlineEditMeterId = null;
var advancedEditMeterId = null;
var selectedClientId = '';

function allowedClients() {
  if (!store.currentUser) return [];
  return getUserClients(store.currentUser.id);
}

function metersForClient(clientId) {
  return store.meters.filter(function (m) {
    return m.clientId === clientId;
  });
}

function hasChildren(meterId, clientId) {
  var meter = store.meters.find(function (m) {
    return m.id === meterId;
  });
  if (meter && meter.isGeneral && meter.linkedMeters && meter.linkedMeters.length) {
    return true;
  }
  return metersForClient(clientId).some(function (g) {
    return g.isGeneral && (g.linkedMeters || []).indexOf(meterId) !== -1;
  });
}

function renderClientSelect() {
  var sel = document.getElementById('meterClientFilter');
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

function appendGeneralRowChrome(row, treeCtx) {
  if (!treeCtx.isTreeParent) return;
  if (treeCtx.isCollapsible) {
    var expand = document.createElement('span');
    expand.className = 'meter-tree-expand';
    expand.setAttribute('aria-hidden', 'true');
    row.appendChild(expand);
  }
  var meterIcon = document.createElement('span');
  meterIcon.className = 'meter-tree-meter-icon';
  meterIcon.title = 'Compteur général';
  meterIcon.setAttribute('aria-hidden', 'true');
  row.appendChild(meterIcon);
}

function ensureAccordionOpenForMeter(openTypes, meterId) {
  if (!meterId) return;
  var meter = store.meters.find(function (m) {
    return m.id === meterId;
  });
  if (meter && meter.energyType) openTypes[meter.energyType] = true;
}

function getAdminMetersScrollEl(container) {
  return (
    (container && container.closest('.content')) ||
    document.querySelector('#screen-admin-meters .content')
  );
}

function restoreMeterTreeScrollFocus(container) {
  requestAnimationFrame(function () {
    var focusId = inlineEditMeterId || advancedEditMeterId;
    if (!focusId) return;
    var row = container.querySelector('[data-meter-id="' + focusId + '"]');
    if (!row) return;
    row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    var input = row.querySelector('.meter-inline-input');
    if (input) input.focus({ preventScroll: true });
  });
}

function renderMeterTree() {
  var container = document.getElementById('meterTreeList');
  if (!container) return;

  var openTypes = captureOpenAccordionTypes(container);
  ensureAccordionOpenForMeter(openTypes, inlineEditMeterId);
  ensureAccordionOpenForMeter(openTypes, advancedEditMeterId);

  var scrollEl = getAdminMetersScrollEl(container);
  var scrollTop = scrollEl ? scrollEl.scrollTop : window.scrollY;

  function appendNode(parentEl, meter, treeCtx) {
    treeCtx = treeCtx || {};
    var isInline = inlineEditMeterId === meter.id;
    var row = document.createElement('div');
    row.className = 'meter-tree-row';
    if (treeCtx.isChild) row.classList.add('sub-meter-row');
    if (treeCtx.isTreeParent) row.classList.add('meter-tree-row--parent');
    if (isInline) row.classList.add('meter-tree-row--editing');
    if (advancedEditMeterId === meter.id) row.classList.add('meter-tree-row--active');
    row.dataset.meterId = meter.id;

    if (isInline) {
      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'meter-inline-input';
      nameInput.value = meter.name;

      var typeSel = document.createElement('select');
      typeSel.className = 'meter-inline-select';
      fillEnergyTypeSelect(typeSel, meter.energyType);

      var unitSel = document.createElement('select');
      unitSel.className = 'meter-inline-select';
      fillAllUnitsSelect(unitSel, meter.unit);

      typeSel.addEventListener('change', function () {
        var units = getUnitsForType(typeSel.value);
        if (units.indexOf(unitSel.value) === -1) {
          unitSel.value = getDefaultUnit(typeSel.value);
        }
      });

      var generalLbl = document.createElement('label');
      generalLbl.className = 'meter-inline-general-lbl';
      var generalCb = document.createElement('input');
      generalCb.type = 'checkbox';
      generalCb.className = 'meter-inline-general';
      generalCb.checked = !!meter.isGeneral;
      generalLbl.appendChild(generalCb);
      generalLbl.appendChild(document.createTextNode(' Général'));

      var badges = createTextEl('span', meter.isDecreasing ? '↓' : '', 'meter-tree-meta');

      var actions = document.createElement('span');
      actions.className = 'meter-tree-actions';

      var saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn-icon btn-icon--save';
      saveBtn.textContent = '✓';
      saveBtn.title = 'Enregistrer';
      saveBtn.addEventListener('click', function () {
        saveInlineMeter(meter.id, nameInput, typeSel, unitSel, generalCb);
      });

      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-icon';
      cancelBtn.textContent = '✕';
      cancelBtn.title = 'Annuler';
      cancelBtn.addEventListener('click', function () {
        inlineEditMeterId = null;
        renderMeterTree();
      });

      row.appendChild(nameInput);
      row.appendChild(typeSel);
      row.appendChild(unitSel);
      row.appendChild(generalLbl);
      row.appendChild(badges);
      row.appendChild(actions);
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
    } else {
      appendGeneralRowChrome(row, treeCtx);
      var label = createTextEl('span', meter.name, 'meter-tree-name');
      var meta = createTextEl(
        'span',
        (ENERGY_TYPE_LABELS[meter.energyType] || meter.energyType) +
          ' · ' +
          meter.unit +
          (meter.isGeneral ? ' · Général' : '') +
          (meter.isDecreasing ? ' · ↓' : ''),
        'meter-tree-meta'
      );

      var actions = document.createElement('span');
      actions.className = 'meter-tree-actions';

      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-icon';
      editBtn.textContent = '✏️';
      editBtn.title = 'Modifier';
      editBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        startInlineEdit(meter.id);
      });

      var advBtn = document.createElement('button');
      advBtn.type = 'button';
      advBtn.className = 'btn-icon';
      advBtn.textContent = '⚙️';
      advBtn.title = 'Options (sous-compteurs liés, calculé, suppression…)';
      advBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        startAdvancedEdit(meter.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(advBtn);

      row.appendChild(label);
      row.appendChild(meta);
      row.appendChild(actions);
    }

    parentEl.appendChild(row);
  }

  renderEnergyAccordions(container, {
    clientId: selectedClientId,
    meters: store.meters,
    emptyMessage: 'Aucun compteur pour ce site.',
    openTypes: openTypes,
    openFirst: Object.keys(openTypes).length === 0,
    renderTypeBody: function (bodyEl, energyType) {
      renderMeterTreeInContainer(bodyEl, store.meters, selectedClientId, energyType, appendNode);
    },
  });

  if (scrollEl) scrollEl.scrollTop = scrollTop;
  restoreMeterTreeScrollFocus(container);
}

function fillEnergyTypeSelect(select, selected) {
  if (!select) return;
  clearElement(select);
  ENERGY_TYPES.forEach(function (t) {
    var opt = document.createElement('option');
    opt.value = t;
    opt.textContent = ENERGY_TYPE_LABELS[t] || t;
    if (t === selected) opt.selected = true;
    select.appendChild(opt);
  });
}

function fillUnitSelect(select, energyType, selected) {
  if (!select) return;
  var units = getUnitsForType(energyType);
  clearElement(select);
  units.forEach(function (u) {
    var opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    if (u === selected) opt.selected = true;
    select.appendChild(opt);
  });
  if (!selected || units.indexOf(selected) === -1) {
    select.value = getDefaultUnit(energyType);
  }
}

function fillAllUnitsSelect(select, selected) {
  if (!select) return;
  clearElement(select);
  UNITS.forEach(function (u) {
    var opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    if (u === selected) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderLinkedMetersCheckboxes(clientId, excludeId, selectedIds) {
  var box = document.getElementById('meterLinkedList');
  if (!box) return;
  clearElement(box);
  selectedIds = selectedIds || [];

  metersForClient(clientId).forEach(function (m) {
    if (m.id === excludeId) return;
    var lbl = document.createElement('label');
    lbl.className = 'meter-linked-item';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = m.id;
    cb.checked = selectedIds.indexOf(m.id) !== -1;
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' ' + m.name));
    box.appendChild(lbl);
  });

  if (!box.childNodes.length) {
    box.appendChild(createTextEl('span', 'Aucun autre compteur sur ce site.', 'meter-empty'));
  }
}

function toggleGeneralFields(show) {
  var wrap = document.getElementById('meterGeneralFields');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
  var calcCb = document.getElementById('meterIsCalculated');
  if (calcCb && show && advancedEditMeterId) {
    var m = store.meters.find(function (x) {
      return x.id === advancedEditMeterId;
    });
    if (m) calcCb.checked = m.isCalculated !== false;
  }
}

function resetMeterForm() {
  inlineEditMeterId = null;
  advancedEditMeterId = null;
  var form = document.getElementById('meterForm');
  if (form) form.reset();
  document.getElementById('meterFormTitle').textContent = 'Nouveau compteur';
  document.getElementById('btnDeleteMeter').style.display = 'none';
  toggleGeneralFields(false);
  renderMeterTree();
}

function startInlineEdit(meterId) {
  inlineEditMeterId = meterId;
  advancedEditMeterId = null;
  renderMeterTree();
}

function startAdvancedEdit(meterId) {
  var meter = store.meters.find(function (m) {
    return m.id === meterId;
  });
  if (!meter) return;

  inlineEditMeterId = null;
  advancedEditMeterId = meter.id;
  document.getElementById('meterFormTitle').textContent = 'Options — ' + meter.name;
  document.getElementById('meterName').value = meter.name;

  var typeSel = document.getElementById('meterEnergyType');
  fillEnergyTypeSelect(typeSel, meter.energyType);
  fillUnitSelect(document.getElementById('meterUnit'), meter.energyType, meter.unit);
  document.getElementById('meterIsGeneral').checked = !!meter.isGeneral;
  document.getElementById('meterIsDecreasing').checked = !!meter.isDecreasing;
  var calcCb = document.getElementById('meterIsCalculated');
  if (calcCb) {
    calcCb.checked = meter.isCalculated !== false && !!(meter.linkedMeters && meter.linkedMeters.length);
  }
  toggleGeneralFields(meter.isGeneral);
  renderLinkedMetersCheckboxes(meter.clientId, meter.id, meter.linkedMeters || []);

  document.getElementById('btnDeleteMeter').style.display = 'inline-block';
  renderMeterTree();

  var panel = document.getElementById('meterOptionsPanel');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveInlineMeter(meterId, nameInput, typeSel, unitSel, generalCb) {
  var meter = store.meters.find(function (m) {
    return m.id === meterId;
  });
  if (!meter) return;

  var name = nameInput.value.trim();
  if (!name) return showToast('⚠️ Nom du compteur requis');

  meter.name = name;
  meter.energyType = typeSel.value;
  meter.unit = unitSel.value;
  meter.isGeneral = generalCb ? !!generalCb.checked : !!meter.isGeneral;
  if (!meter.isGeneral) {
    meter.linkedMeters = [];
    meter.isCalculated = false;
  } else if (meter.isCalculated === undefined) {
    meter.isCalculated = !!(meter.linkedMeters && meter.linkedMeters.length);
  }

  apiSaveMeter(meter)
    .then(function () {
      showToast('✅ Compteur mis à jour');
      inlineEditMeterId = null;
      renderMeterTree();
    })
    .catch(function (err) {
      console.error(err);
      showToast('❌ ' + graphErrorMessage(err));
    });
}


function collectLinkedMeters() {
  var ids = [];
  var box = document.getElementById('meterLinkedList');
  if (!box) return ids;
  box.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
    ids.push(cb.value);
  });
  return ids;
}

function onClientFilterChange() {
  var sel = document.getElementById('meterClientFilter');
  selectedClientId = sel ? sel.value : '';
  resetMeterForm();
  renderLinkedMetersCheckboxes(selectedClientId, '', []);
  renderMeterTree();
}

function onEnergyTypeChange() {
  var type = document.getElementById('meterEnergyType').value;
  fillUnitSelect(document.getElementById('meterUnit'), type, getDefaultUnit(type));
}

function onIsGeneralChange() {
  var checked = document.getElementById('meterIsGeneral').checked;
  toggleGeneralFields(checked);
  if (checked && selectedClientId) {
    renderLinkedMetersCheckboxes(selectedClientId, advancedEditMeterId || '', collectLinkedMeters());
  }
}

function graphErrorMessage(err) {
  var raw = err && err.message ? err.message : String(err);
  try {
    var j = JSON.parse(raw);
    if (j.error && j.error.message) return j.error.message;
  } catch (e) {
    /* ignore */
  }
  return raw;
}

function saveMeterForm() {
  if (!selectedClientId) return showToast('⚠️ Sélectionnez un client');

  var name = document.getElementById('meterName').value.trim();
  if (!name) return showToast('⚠️ Nom du compteur requis');

  var energyType = document.getElementById('meterEnergyType').value;
  var unit = document.getElementById('meterUnit').value;
  var isGeneral = document.getElementById('meterIsGeneral').checked;
  var isDecreasing = document.getElementById('meterIsDecreasing').checked;
  var calcCb = document.getElementById('meterIsCalculated');
  var isCalculated = isGeneral && calcCb ? calcCb.checked : false;
  var linkedMeters = isGeneral ? collectLinkedMeters() : [];

  var meter;
  if (advancedEditMeterId) {
    meter = store.meters.find(function (m) {
      return m.id === advancedEditMeterId;
    });
    if (!meter) return showToast('⚠️ Compteur introuvable');
    meter.name = name;
    meter.energyType = energyType;
    meter.unit = unit;
    meter.parentId = '';
    meter.isGeneral = isGeneral;
    meter.isDecreasing = isDecreasing;
    meter.isCalculated = isCalculated;
    meter.linkedMeters = linkedMeters;
  } else {
    meter = {
      clientId: selectedClientId,
      name: name,
      energyType: energyType,
      unit: unit,
      parentId: '',
      isGeneral: isGeneral,
      isDecreasing: isDecreasing,
      isCalculated: isCalculated,
      linkedMeters: linkedMeters,
    };
  }

  apiSaveMeter(meter)
    .then(function (saved) {
      if (!advancedEditMeterId) {
        var existing = store.meters.find(function (m) {
          return m.id === saved.id;
        });
        if (!existing) store.meters.push(saved);
      }
      return saved;
    })
    .then(function () {
      showToast('✅ Compteur enregistré');
      resetMeterForm();
      renderMeterTree();
    })
    .catch(function (err) {
      console.error(err);
      showToast('❌ ' + graphErrorMessage(err));
    });
}

function deleteMeterForm() {
  if (!advancedEditMeterId) return;
  var meter = store.meters.find(function (m) {
    return m.id === advancedEditMeterId;
  });
  if (!meter) return;

  if (hasChildren(meter.id, meter.clientId)) {
    return showToast('⚠️ Déliez d\'abord les sous-compteurs (ou supprimez le général après les avoir décochés)');
  }
  if (!confirm('Supprimer le compteur « ' + meter.name + ' » et ses relevés ?')) return;

  apiDeleteMeter(meter)
    .then(function () {
      showToast('🗑️ Compteur supprimé');
      resetMeterForm();
    })
    .catch(function (err) {
      console.error(err);
      showToast('❌ Erreur suppression');
    });
}

function triggerImportFile() {
  if (!selectedClientId) return showToast('⚠️ Sélectionnez un client avant import');
  document.getElementById('meterImportFile').click();
}

function onImportFileChange(event) {
  var file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  readExcelFile(file)
    .then(function (wb) {
      return loadEnergyData().then(function () {
        return parseMeterMatrixWorkbook(wb, selectedClientId);
      });
    })
    .then(function (result) {
      var stats = summarizeImportReadings(result.readings);
      var msg =
        stats.total +
        ' relevé(s) · ' +
        stats.periodCount +
        ' période(s)';
      if (stats.periodMin && stats.periodMax) {
        msg +=
          '\nDu ' +
          formatPeriodLabel(stats.periodMin) +
          ' au ' +
          formatPeriodLabel(stats.periodMax);
      }
      msg += '\n' + stats.updates + ' mise(s) à jour · ' + stats.creates + ' création(s)';
      msg += '\n\nLes dates déjà présentes seront écrasées (réimport historique complet).';
      if (result.metersToCreate.length) {
        msg += '\n' + result.metersToCreate.length + ' nouveau(x) compteur(s) seront créés';
      }
      if (result.warnings.length) {
        msg += '\n\n' + result.warnings.join('\n');
      }
      if (!confirm('Confirmer l\'import ?\n\n' + msg)) {
        loadEnergyData().then(renderAdminMeters);
        return;
      }

      showToast('⏳ Import en cours…');
      var chain = Promise.resolve();

      result.metersToCreate.forEach(function (m) {
        chain = chain.then(function () {
          return apiSaveMeter(m);
        });
      });

      chain
        .then(function () {
          return apiUpsertReadingsBatch(result.readings, function (done, total) {
            var el = document.getElementById('meterImportProgress');
            if (el) el.textContent = done + ' / ' + total;
          });
        })
        .then(function () {
          return loadEnergyData();
        })
        .then(function () {
          showToast('✅ Import terminé (' + result.readings.length + ' relevés)');
          var prog = document.getElementById('meterImportProgress');
          if (prog) prog.textContent = '';
          renderAdminMeters();
        })
        .catch(function (err) {
          console.error(err);
          showToast('❌ ' + graphErrorMessage(err));
          loadEnergyData().then(renderAdminMeters);
        });
    })
    .catch(function (err) {
      console.error(err);
      showToast('❌ ' + (err.message || 'Fichier Excel invalide'));
    });
}

function renderRecentReadings() {
  var tbody = document.getElementById('meterReadingsPreview');
  if (!tbody) return;
  clearElement(tbody);

  if (!selectedClientId) {
    appendTableEmptyRow(tbody, 4, '—');
    return;
  }

  var meterIds = {};
  metersForClient(selectedClientId).forEach(function (m) {
    meterIds[m.id] = m.name;
  });

  var rows = store.readings
    .filter(function (r) {
      return meterIds[r.meterId];
    })
    .sort(function (a, b) {
      return b.period.localeCompare(a.period) || a.meterId.localeCompare(b.meterId);
    })
    .slice(0, 15);

  if (!rows.length) {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 4;
    td.style.textAlign = 'center';
    td.style.color = '#aaa';
    td.textContent = 'Aucun relevé importé';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(function (r) {
    var tr = document.createElement('tr');
    var tdName = document.createElement('td');
    tdName.textContent = meterIds[r.meterId] || r.meterId;
    var tdPeriod = document.createElement('td');
    tdPeriod.textContent = formatPeriodLabel(r.period);
    var tdVal = document.createElement('td');
    tdVal.textContent = String(r.indexValue);
    var tdUser = document.createElement('td');
    tdUser.textContent = r.userId || '—';
    tr.appendChild(tdName);
    tr.appendChild(tdPeriod);
    tr.appendChild(tdVal);
    tr.appendChild(tdUser);
    tbody.appendChild(tr);
  });
}

function appendTableEmptyRow(tbody, colSpan, message) {
  var tr = document.createElement('tr');
  var td = document.createElement('td');
  td.colSpan = colSpan;
  td.style.textAlign = 'center';
  td.style.color = '#aaa';
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function bindMeterFormOnce() {
  var form = document.getElementById('meterForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';

  document.getElementById('meterClientFilter').addEventListener('change', onClientFilterChange);
  document.getElementById('meterEnergyType').addEventListener('change', onEnergyTypeChange);
  document.getElementById('meterIsGeneral').addEventListener('change', onIsGeneralChange);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    saveMeterForm();
  });
}

export function initAdminMeters() {
  bindMeterFormOnce();
  fillEnergyTypeSelect(document.getElementById('meterEnergyType'), 'ELECTRICITE');
  fillUnitSelect(document.getElementById('meterUnit'), 'ELECTRICITE', 'kWh');
}

export function renderAdminMeters() {
  renderClientSelect();
  if (selectedClientId) {
    if (document.getElementById('meterIsGeneral').checked) {
      renderLinkedMetersCheckboxes(
        selectedClientId,
        advancedEditMeterId || '',
        advancedEditMeterId
          ? (store.meters.find(function (m) { return m.id === advancedEditMeterId; }) || {}).linkedMeters || []
          : []
      );
    }
  }
  renderMeterTree();
  renderRecentReadings();
}

export function loadAdminMetersScreen() {
  initAdminMeters();
  return loadEnergyData()
    .then(renderAdminMeters)
    .catch(function (err) {
      console.warn('[admin-meters]', err);
      showToast('⚠️ Listes GS_Meters / GS_Readings introuvables');
      renderAdminMeters();
    });
}

export { triggerImportFile, onImportFileChange, resetMeterForm, deleteMeterForm };
