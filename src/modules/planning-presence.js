/**
 * Planning présence — Phase 4
 */
import { store } from './store.js';
import { apiSaveAll } from './api.js';
import { showScreen, showToast } from './ui.js';
import { getUserClients } from './user-access.js';
import { loadPlanningClients } from './client-selects.js';
import { clearElement, createTextEl } from './dom.js';
import { CODES, MOIS_NOMS, JOURS_COURTS, PRESENT_CODES } from './planning-codes.js';

var dragListenersBound = false;

export function savePlanning() {
  apiSaveAll('planning', store.planningData);
}

export function getSiteData(client) {
  if (!store.planningData[client]) store.planningData[client] = { employees: [], cells: {} };
  return store.planningData[client];
}

export function getPlanningClient() {
  var sel = document.getElementById('planningClientSelect');
  return sel ? sel.value : '';
}

export function goToPlanning() {
  loadPlanningClients();
  updatePlanningLabel();
  renderPlanning();
  showScreen('screen-planning');
}

export function updatePlanningLabel() {
  document.getElementById('planningMoisLabel').textContent =
    MOIS_NOMS[store.planningMonth] + ' ' + store.planningYear;
}

export function prevMonth() {
  store.planningMonth--;
  if (store.planningMonth < 0) {
    store.planningMonth = 11;
    store.planningYear--;
  }
  updatePlanningLabel();
  renderPlanning();
}

export function nextMonth() {
  store.planningMonth++;
  if (store.planningMonth > 11) {
    store.planningMonth = 0;
    store.planningYear++;
  }
  updatePlanningLabel();
  renderPlanning();
}

export function addEmployee() {
  var client = getPlanningClient();
  if (!client) return showToast('⚠️ Choisir un client');
  var name = document.getElementById('newEmpName').value.trim();
  if (!name) return showToast('⚠️ Entrer un nom');
  var site = getSiteData(client);
  if (site.employees.indexOf(name) !== -1) return showToast('⚠️ Existe déjà');
  site.employees.push(name);
  savePlanning();
  document.getElementById('newEmpName').value = '';
  renderPlanning();
  showToast('✅ ' + name + ' ajouté');
}

export function removeEmployee(client, idx) {
  if (!confirm('Supprimer cet employé ?')) return;
  var site = getSiteData(client);
  var emp = site.employees[idx];
  site.employees.splice(idx, 1);
  Object.keys(site.cells).forEach(function (k) {
    if (k.indexOf(idx + '_') === 0) delete site.cells[k];
  });
  savePlanning();
  renderPlanning();
  showToast('🗑️ ' + emp + ' supprimé');
}

export function renameEmployee(client, idx) {
  var site = getSiteData(client);
  var oldName = site.employees[idx];
  var newName = prompt('Nouveau nom :', oldName);
  if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
  site.employees[idx] = newName.trim();
  savePlanning();
  renderPlanning();
  showToast('✏️ Renommé');
}

function renderPlanningLegend() {
  var legend = document.getElementById('planningLegend');
  clearElement(legend);
  Object.keys(CODES).forEach(function (code) {
    var item = document.createElement('div');
    item.className = 'legend-item';
    var color = document.createElement('div');
    color.className = 'legend-color';
    color.style.background = CODES[code].color;
    item.appendChild(color);
    item.appendChild(document.createTextNode(CODES[code].label + ' (' + code + ')'));
    legend.appendChild(item);
  });
}

function appendPlanningMessage(table, message, colSpan) {
  clearElement(table);
  var tr = document.createElement('tr');
  var td = document.createElement('td');
  td.colSpan = colSpan;
  td.style.textAlign = 'center';
  td.style.color = '#aaa';
  td.style.padding = '20px';
  td.textContent = message;
  tr.appendChild(td);
  table.appendChild(tr);
}

export function renderPlanning() {
  renderPlanningLegend();
  var client = getPlanningClient();
  var table = document.getElementById('planningTable');

  if (!client) {
    appendPlanningMessage(table, 'Sélectionnez un client', 1);
    return;
  }

  var site = getSiteData(client);
  var nbDays = new Date(store.planningYear, store.planningMonth + 1, 0).getDate();
  clearElement(table);

  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  var thEmp = document.createElement('th');
  thEmp.textContent = 'Employé';
  headRow.appendChild(thEmp);

  for (var d = 1; d <= nbDays; d++) {
    var dt = new Date(store.planningYear, store.planningMonth, d);
    var isWe = dt.getDay() === 0 || dt.getDay() === 6;
    var th = document.createElement('th');
    if (isWe) th.className = 'weekend';
    th.appendChild(document.createTextNode(JOURS_COURTS[dt.getDay()]));
    th.appendChild(document.createElement('br'));
    th.appendChild(document.createTextNode(String(d)));
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  if (site.employees.length === 0) {
    var emptyTr = document.createElement('tr');
    var emptyTd = document.createElement('td');
    emptyTd.colSpan = nbDays + 1;
    emptyTd.style.textAlign = 'center';
    emptyTd.style.color = '#aaa';
    emptyTd.style.padding = '20px';
    emptyTd.textContent = 'Aucun employé. Ajoutez-en un.';
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
  } else {
    site.employees.forEach(function (emp, i) {
      var tr = document.createElement('tr');
      var tdName = document.createElement('td');
      var nameCell = document.createElement('div');
      nameCell.className = 'emp-name-cell';
      nameCell.appendChild(document.createTextNode(emp + ' '));

      var renameBtn = document.createElement('button');
      renameBtn.className = 'emp-edit-btn';
      renameBtn.type = 'button';
      renameBtn.textContent = '✏️';
      renameBtn.addEventListener('click', function () {
        renameEmployee(client, i);
      });

      var removeBtn = document.createElement('button');
      removeBtn.className = 'emp-edit-btn';
      removeBtn.type = 'button';
      removeBtn.textContent = '🗑️';
      removeBtn.addEventListener('click', function () {
        removeEmployee(client, i);
      });

      nameCell.appendChild(renameBtn);
      nameCell.appendChild(removeBtn);
      tdName.appendChild(nameCell);
      tr.appendChild(tdName);

      for (var day = 1; day <= nbDays; day++) {
        var td = document.createElement('td');
        var key = i + '_' + store.planningYear + '-' + (store.planningMonth + 1) + '-' + day;
        td.dataset.key = key;
        td.dataset.emp = String(i);
        td.dataset.day = String(day);
        var code = site.cells[key] || '';
        if (code && CODES[code]) {
          td.style.background = CODES[code].color;
          td.style.color = CODES[code].text;
          td.style.fontWeight = '700';
          td.textContent = code;
        }
        td.addEventListener('mousedown', function (e) {
          onCellMouseDown(e, this);
        });
        td.addEventListener('mouseenter', function (e) {
          onCellMouseEnter(e, this);
        });
        td.addEventListener('touchstart', function (e) {
          onCellTouchStart(e, this);
        });
        td.addEventListener('touchmove', function (e) {
          onCellTouchMove(e, this);
        });
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
}

function getTodayPresents() {
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth();
  var day = today.getDate();
  var results = { presents: [], absents: [] };

  getUserClients(store.currentUser.id).forEach(function (client) {
    var site = getSiteData(client);
    if (!site || !site.employees || site.employees.length === 0) return;

    site.employees.forEach(function (emp, i) {
      var key = i + '_' + year + '-' + (month + 1) + '-' + day;
      var code = site.cells[key] || '';
      if (!code || !CODES[code]) return;

      var entry = {
        client: client,
        employee: emp,
        code: code,
        label: CODES[code].label,
        color: CODES[code].color,
        textColor: CODES[code].text,
      };

      if (PRESENT_CODES.indexOf(code) !== -1) {
        results.presents.push(entry);
      } else {
        results.absents.push(entry);
      }
    });
  });

  return results;
}

export function renderTodayWidget() {
  var today = new Date();
  document.getElementById('today-date').textContent =
    ' — ' +
    today.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  var data = getTodayPresents();
  var el = document.getElementById('today-list');
  clearElement(el);
  var total = data.presents.length + data.absents.length;

  if (total === 0) {
    var empty = createTextEl('span', 'Aucune planification pour aujourd\'hui');
    empty.style.color = '#aaa';
    empty.style.fontSize = '13px';
    el.appendChild(empty);
    return;
  }

  var counters = document.createElement('div');
  counters.style.display = 'flex';
  counters.style.gap = '10px';
  counters.style.marginBottom = '10px';

  var presentBadge = document.createElement('span');
  presentBadge.style.cssText =
    'background:#3498db;color:#fff;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;';
  presentBadge.textContent = '✅ ' + data.presents.length + ' présent(s)';

  var absentBadge = document.createElement('span');
  absentBadge.style.cssText =
    'background:#e67e22;color:#fff;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;';
  absentBadge.textContent = '❌ ' + data.absents.length + ' absent(s)';

  counters.appendChild(presentBadge);
  counters.appendChild(absentBadge);
  el.appendChild(counters);

  function appendGroup(list, title, icon) {
    if (list.length === 0) return;
    var byClient = {};
    list.forEach(function (p) {
      if (!byClient[p.client]) byClient[p.client] = [];
      byClient[p.client].push(p);
    });

    var group = document.createElement('div');
    group.style.marginBottom = '10px';

    var heading = document.createElement('div');
    heading.style.cssText = 'font-weight:700;font-size:13px;margin-bottom:6px;';
    heading.textContent = icon + ' ' + title;
    group.appendChild(heading);

    Object.keys(byClient).forEach(function (clientName) {
      var clientBlock = document.createElement('div');
      clientBlock.style.marginBottom = '6px';

      var clientLabel = document.createElement('span');
      clientLabel.style.cssText = 'font-size:12px;color:#666;font-weight:600;';
      clientLabel.textContent = '📍 ' + clientName;
      clientBlock.appendChild(clientLabel);
      clientBlock.appendChild(document.createElement('br'));

      byClient[clientName].forEach(function (p) {
        var chip = document.createElement('span');
        chip.style.cssText =
          'display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:3px 9px;margin:2px;font-size:12px;font-weight:700;';
        chip.style.background = p.color;
        chip.style.color = p.textColor;
        chip.appendChild(document.createTextNode(p.employee + ' '));
        var codeSpan = document.createElement('span');
        codeSpan.style.cssText = 'opacity:0.8;font-size:10px;';
        codeSpan.textContent = '(' + p.code + ')';
        chip.appendChild(codeSpan);
        clientBlock.appendChild(chip);
      });

      group.appendChild(clientBlock);
    });

    el.appendChild(group);
  }

  appendGroup(data.presents, 'Présents / En service', '🟢');
  appendGroup(data.absents, 'Absents', '🔴');
}

export function onCellMouseDown(e, td) {
  if (!td.dataset.key) return;
  e.preventDefault();
  var client = getPlanningClient();
  var site = getSiteData(client);
  store.dragSourceCode = site.cells[td.dataset.key] || '';
  store.isDragging = true;
  store.dragEmpIndex = parseInt(td.dataset.emp, 10);
  store.dragStartDay = parseInt(td.dataset.day, 10);
  store.dragCurrentDay = store.dragStartDay;
  highlightDrag();
}

export function onCellMouseEnter(e, td) {
  if (!store.isDragging) return;
  if (parseInt(td.dataset.emp, 10) !== store.dragEmpIndex) return;
  store.dragCurrentDay = parseInt(td.dataset.day, 10);
  highlightDrag();
}

export function onCellTouchStart(e, td) {
  if (!td.dataset.key) return;
  var client = getPlanningClient();
  var site = getSiteData(client);
  store.dragSourceCode = site.cells[td.dataset.key] || '';
  store.isDragging = true;
  store.dragEmpIndex = parseInt(td.dataset.emp, 10);
  store.dragStartDay = parseInt(td.dataset.day, 10);
  store.dragCurrentDay = store.dragStartDay;
  highlightDrag();
}

export function onCellTouchMove(e, td) {
  if (!store.isDragging) return;
  var touch = e.touches[0];
  var el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (
    el &&
    el.dataset &&
    el.dataset.emp !== undefined &&
    parseInt(el.dataset.emp, 10) === store.dragEmpIndex
  ) {
    store.dragCurrentDay = parseInt(el.dataset.day, 10);
    highlightDrag();
  }
}

export function highlightDrag() {
  document.querySelectorAll('.planning-table td.selected-drag').forEach(function (td) {
    td.classList.remove('selected-drag');
  });
  document.querySelectorAll('.planning-table td.drag-source').forEach(function (td) {
    td.classList.remove('drag-source');
  });

  var minD = Math.min(store.dragStartDay, store.dragCurrentDay);
  var maxD = Math.max(store.dragStartDay, store.dragCurrentDay);

  document
    .querySelectorAll('.planning-table td[data-emp="' + store.dragEmpIndex + '"]')
    .forEach(function (td) {
      var day = parseInt(td.dataset.day, 10);
      if (day >= minD && day <= maxD) td.classList.add('selected-drag');
      if (day === store.dragStartDay) td.classList.add('drag-source');
    });
}

export function endDrag() {
  if (!store.isDragging) return;
  store.isDragging = false;

  var client = getPlanningClient();
  if (!client) return;
  var site = getSiteData(client);

  var minD = Math.min(store.dragStartDay, store.dragCurrentDay);
  var maxD = Math.max(store.dragStartDay, store.dragCurrentDay);

  if (minD === maxD) {
    var key =
      store.dragEmpIndex +
      '_' +
      store.planningYear +
      '-' +
      (store.planningMonth + 1) +
      '-' +
      minD;
    openCodePicker(key);
    clearDragHighlight();
    return;
  }

  for (var d = minD; d <= maxD; d++) {
    var cellKey =
      store.dragEmpIndex +
      '_' +
      store.planningYear +
      '-' +
      (store.planningMonth + 1) +
      '-' +
      d;
    if (store.dragSourceCode) {
      site.cells[cellKey] = store.dragSourceCode;
    } else {
      delete site.cells[cellKey];
    }
  }
  savePlanning();
  clearDragHighlight();
  renderPlanning();
  showToast('✅ ' + (maxD - minD + 1) + ' jours remplis');
}

export function clearDragHighlight() {
  document.querySelectorAll('.planning-table td.selected-drag').forEach(function (td) {
    td.classList.remove('selected-drag');
  });
  document.querySelectorAll('.planning-table td.drag-source').forEach(function (td) {
    td.classList.remove('drag-source');
  });
}

export function openCodePicker(key) {
  store.pickerTarget = key;
  var grid = document.getElementById('codePickerGrid');
  clearElement(grid);

  Object.keys(CODES).forEach(function (code) {
    var btn = document.createElement('div');
    btn.className = 'code-pick-btn';
    btn.style.background = CODES[code].color;
    btn.style.color = CODES[code].text;
    btn.style.borderColor = CODES[code].color;
    btn.textContent = CODES[code].label;
    btn.addEventListener('click', function () {
      pickCode(code);
    });
    grid.appendChild(btn);
  });

  var clearBtn = document.createElement('div');
  clearBtn.className = 'code-pick-clear';
  clearBtn.textContent = '✖ Effacer';
  clearBtn.addEventListener('click', function () {
    pickCode('');
  });
  grid.appendChild(clearBtn);

  document.getElementById('codePicker').classList.add('active');
}

export function pickCode(code) {
  var client = getPlanningClient();
  var site = getSiteData(client);
  if (code === '') {
    delete site.cells[store.pickerTarget];
  } else {
    site.cells[store.pickerTarget] = code;
  }
  savePlanning();
  document.getElementById('codePicker').classList.remove('active');
  store.pickerTarget = null;
  renderPlanning();
}

export function initPlanningDomListeners() {
  var picker = document.getElementById('codePicker');
  if (picker && !picker.dataset.bound) {
    picker.dataset.bound = '1';
    picker.addEventListener('click', function (e) {
      if (e.target === this) {
        this.classList.remove('active');
        store.pickerTarget = null;
      }
    });
  }

  if (!dragListenersBound) {
    dragListenersBound = true;
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
  }
}

export function exportPlanning() {
  var client = getPlanningClient();
  if (!client) return showToast('⚠️ Choisir un client');
  var site = getSiteData(client);
  if (site.employees.length === 0) return showToast('⚠️ Aucun employé');

  var nbDays = new Date(store.planningYear, store.planningMonth + 1, 0).getDate();
  var html = '<table><tr><th>Employé</th>';
  for (var d = 1; d <= nbDays; d++) {
    var dt = new Date(store.planningYear, store.planningMonth, d);
    html += '<th>' + JOURS_COURTS[dt.getDay()] + ' ' + d + '</th>';
  }
  html += '</tr>';
  site.employees.forEach(function (emp, i) {
    html += '<tr><td>' + emp + '</td>';
    for (var day = 1; day <= nbDays; day++) {
      var key = i + '_' + store.planningYear + '-' + (store.planningMonth + 1) + '-' + day;
      var code = site.cells[key] || '';
      var bg = code && CODES[code] ? CODES[code].color : '';
      html += '<td style="background:' + bg + ';color:#fff;font-weight:bold;">' + code + '</td>';
    }
    html += '</tr>';
  });
  html += '</table>';

  var blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download =
    'planning_' + client + '_' + MOIS_NOMS[store.planningMonth] + '_' + store.planningYear + '.xls';
  a.click();
  showToast('📊 Planning exporté');
}
