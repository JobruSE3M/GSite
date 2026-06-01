/**
 * Planning sous-traitants (SST) — Phase 4
 */
import { store } from './store.js';
import { apiSaveAll, apiGet } from './api.js';
import { showToast } from './ui.js';
import { getUserClients } from './user-access.js';
import { fillSelect, clearElement, createTextEl } from './dom.js';

var SST_MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function getISOWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function getWeeksOfYear(year) {
  var weeks = [];
  var d = new Date(year, 0, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  while (d.getFullYear() <= year) {
    var num = getISOWeek(d);
    if (d.getFullYear() > year) break;
    weeks.push({ num: num, startDate: new Date(d) });
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

export function loadPlanningSSTData() {
  return apiGet('planningSst')
    .then(function (data) {
      store.planningSSTData = data || {};
    })
    .catch(function (err) {
      console.error('❌ Erreur load SST:', err);
      store.planningSSTData = {};
    });
}

export function getSSTSiteData(client) {
  if (!store.planningSSTData[client]) store.planningSSTData[client] = { ssts: [], cells: {} };
  return store.planningSSTData[client];
}

export function savePlanningSSTData() {
  apiSaveAll('planningSst', store.planningSSTData).catch(function (err) {
    console.error('❌ Erreur save SST:', err);
  });
}

export function getSSTClient() {
  var s = document.getElementById('sstClientSelect');
  return s ? s.value : '';
}

export function initScreenSST() {
  loadPlanningSSTData().then(function () {
    renderPlanningSST();
    renderSSTWidget();
  });

  var uc = getUserClients(store.currentUser.id);
  fillSelect(document.getElementById('sstClientSelect'), uc, {
    placeholder: '-- Choisir un client --',
    useValue: true,
  });
  document.getElementById('sstAnneeLabel').textContent = store.sstYear;
  renderPlanningSST();
}

export function prevYearSST() {
  store.sstYear--;
  document.getElementById('sstAnneeLabel').textContent = store.sstYear;
  renderPlanningSST();
}

export function nextYearSST() {
  store.sstYear++;
  document.getElementById('sstAnneeLabel').textContent = store.sstYear;
  renderPlanningSST();
}

export function addSST() {
  var client = getSSTClient();
  if (!client) return showToast('⚠️ Choisir un client');
  var name = document.getElementById('newSSTName').value.trim();
  if (!name) return showToast('⚠️ Entrer un nom');
  var site = getSSTSiteData(client);
  if (site.ssts.indexOf(name) !== -1) return showToast('⚠️ Existe déjà');
  site.ssts.push(name);
  savePlanningSSTData();
  document.getElementById('newSSTName').value = '';
  renderPlanningSST();
  showToast('✅ ' + name + ' ajouté');
}

function sstCellStyle(code) {
  if (code === 'P') return { bg: '#4CAF50', text: '#fff' };
  if (code === 'F') return { bg: '#2196F3', text: '#fff' };
  if (code === 'R') return { bg: '#FFC107', text: '#000' };
  return { bg: '', text: '' };
}

export function renderPlanningSST() {
  var client = getSSTClient();
  var table = document.getElementById('planningTableSST');
  clearElement(table);
  if (!client) return;

  var site = getSSTSiteData(client);
  var weeks = getWeeksOfYear(store.sstYear);

  var thead = document.createElement('thead');

  var monthRow = document.createElement('tr');
  var emptyTh = document.createElement('th');
  emptyTh.style.cssText =
    'min-width:140px;position:sticky;left:0;background:#1a1a2e;z-index:2;';
  monthRow.appendChild(emptyTh);

  var i = 0;
  while (i < weeks.length) {
    var monthIndex = weeks[i].startDate.getMonth();
    var count = 0;
    while (i + count < weeks.length && weeks[i + count].startDate.getMonth() === monthIndex) {
      count++;
    }
    var monthTh = document.createElement('th');
    monthTh.colSpan = count;
    monthTh.style.cssText =
      'background:#0f3460;color:#fff;font-size:11px;text-align:center;border-bottom:1px solid #333;';
    monthTh.textContent = SST_MONTH_NAMES[monthIndex];
    monthRow.appendChild(monthTh);
    i += count;
  }
  thead.appendChild(monthRow);

  var weekRow = document.createElement('tr');
  var labelTh = document.createElement('th');
  labelTh.style.cssText =
    'min-width:140px;position:sticky;left:0;background:#1a1a2e;z-index:2;';
  labelTh.textContent = 'Sous-Traitant';
  weekRow.appendChild(labelTh);

  weeks.forEach(function (w) {
    var th = document.createElement('th');
    th.style.cssText = 'min-width:38px;font-size:11px;';
    th.textContent = 'S' + w.num;
    weekRow.appendChild(th);
  });
  thead.appendChild(weekRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  site.ssts.forEach(function (sst, idx) {
    var tr = document.createElement('tr');

    var tdName = document.createElement('td');
    tdName.style.cssText = 'position:sticky;left:0;background:#1a1a2e;z-index:1;';
    var nameWrap = document.createElement('div');
    nameWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';

    var nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight:600;flex:1;';
    nameSpan.textContent = sst;

    var renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:14px;padding:2px;';
    renameBtn.textContent = '✏️';
    renameBtn.addEventListener('click', function () {
      renameSSTEntry(client, idx);
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:14px;padding:2px;';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', function () {
      deleteSSTEntry(client, idx);
    });

    nameWrap.appendChild(nameSpan);
    nameWrap.appendChild(renameBtn);
    nameWrap.appendChild(deleteBtn);
    tdName.appendChild(nameWrap);
    tr.appendChild(tdName);

    weeks.forEach(function (w) {
      var key = idx + '_' + store.sstYear + '_S' + w.num;
      var code = site.cells[key] || '';
      var style = sstCellStyle(code);
      var td = document.createElement('td');
      td.style.textAlign = 'center';
      td.style.cursor = 'pointer';
      if (style.bg) {
        td.style.background = style.bg;
        td.style.color = style.text;
      }
      td.textContent = code;
      td.addEventListener('click', function () {
        cycleSSTCell(client, idx, w.num);
      });
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

export function renameSSTEntry(client, idx) {
  var site = getSSTSiteData(client);
  var newName = prompt('Nouveau nom :', site.ssts[idx]);
  if (newName && newName.trim()) {
    site.ssts[idx] = newName.trim();
    savePlanningSSTData();
    renderPlanningSST();
  }
}

export function deleteSSTEntry(client, idx) {
  var site = getSSTSiteData(client);
  if (!confirm('Supprimer "' + site.ssts[idx] + '" ?')) return;
  Object.keys(site.cells).forEach(function (k) {
    if (k.startsWith(idx + '_')) delete site.cells[k];
  });
  site.ssts.splice(idx, 1);
  var newCells = {};
  Object.keys(site.cells).forEach(function (k) {
    var parts = k.split('_');
    var eIdx = parseInt(parts[0], 10);
    if (eIdx > idx) {
      parts[0] = String(eIdx - 1);
      newCells[parts.join('_')] = site.cells[k];
    } else {
      newCells[k] = site.cells[k];
    }
  });
  site.cells = newCells;
  savePlanningSSTData();
  renderPlanningSST();
}

export function cycleSSTCell(client, empIdx, weekNum) {
  var site = getSSTSiteData(client);
  var key = empIdx + '_' + store.sstYear + '_S' + weekNum;
  var current = site.cells[key] || '';
  var next = current === '' ? 'P' : current === 'P' ? 'F' : current === 'F' ? 'R' : '';

  if (next === '') delete site.cells[key];
  else site.cells[key] = next;

  savePlanningSSTData();
  renderPlanningSST();
}

export function renderSSTWidget() {
  var now = new Date();
  var weekNum = getISOWeek(now);
  var year = now.getFullYear();

  var label = document.getElementById('sst-week-label');
  if (label) label.textContent = ' — S' + weekNum + ' / ' + year;

  var container = document.getElementById('sst-list');
  if (!container) return;

  var isAdmin = store.currentUser && store.currentUser.role === 'admin';
  var allowedSites =
    store.accessMap && store.currentUser ? store.accessMap[store.currentUser.id] || [] : [];

  apiGet('planningSst').then(function (data) {
    clearElement(container);
    var results = [];

    Object.keys(data).forEach(function (clientName) {
      if (!isAdmin && allowedSites.indexOf(clientName) === -1) return;
      var site = data[clientName];
      if (!site.ssts || !site.cells) return;

      site.ssts.forEach(function (sst, i) {
        var key = i + '_' + year + '_S' + weekNum;
        var code = site.cells[key];
        if (code) results.push({ client: clientName, sst: sst, code: code });
      });
    });

    if (results.length === 0) {
      var empty = createTextEl('div', 'Aucun sous-traitant cette semaine');
      empty.style.cssText = 'color:#aaa;font-size:13px;text-align:center;padding:8px;';
      container.appendChild(empty);
      return;
    }

    var prevus = results.filter(function (r) {
      return r.code === 'P';
    });
    var faits = results.filter(function (r) {
      return r.code === 'F';
    });
    var replan = results.filter(function (r) {
      return r.code === 'R';
    });

    function appendSSTSection(title, items, titleColor, rowBg, borderColor, showReporte) {
      if (items.length === 0) return;
      var heading = document.createElement('div');
      heading.style.cssText =
        'font-weight:600;font-size:12px;color:' + titleColor + ';margin-bottom:4px;margin-top:8px;';
      heading.textContent = title;
      container.appendChild(heading);

      items.forEach(function (r) {
        var row = document.createElement('div');
        row.style.cssText =
          'display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin-bottom:5px;border-radius:8px;background:' +
          rowBg +
          ';border-left:4px solid ' +
          borderColor +
          ';';

        var name = document.createElement('span');
        name.style.cssText = 'font-size:13px;font-weight:600;color:#2c3e50;';
        name.textContent = '🔧 ' + r.sst;

        var clientEl = document.createElement('span');
        clientEl.style.cssText = 'font-size:11px;color:#666;';
        clientEl.textContent = r.client;

        row.appendChild(name);
        row.appendChild(clientEl);

        if (showReporte) {
          var badge = document.createElement('span');
          badge.style.cssText =
            'font-size:10px;background:#FFC107;color:#000;padding:2px 6px;border-radius:4px;font-weight:700;';
          badge.textContent = 'REPORTÉ';
          row.appendChild(badge);
        }

        container.appendChild(row);
      });
    }

    appendSSTSection('✅ PRÉVUS', prevus, '#4CAF50', '#f0fdf4', '#4CAF50', false);
    appendSSTSection('✔️ RÉALISÉS', faits, '#2196F3', '#f0f7ff', '#2196F3', false);
    appendSSTSection('⚠️ REPORTÉS', replan, '#F57C00', '#fffbea', '#FFC107', true);
  });
}

export function exportSSTExcel() {
  var client = getSSTClient();
  if (!client) {
    alert('Sélectionne un site d\'abord');
    return;
  }

  var site = getSSTSiteData(client);
  var weeks = getWeeksOfYear(store.sstYear);
  var wsData = [];
  var merges = [];

  var borderThin = {
    top: { style: 'thin', color: { rgb: 'BFBFBF' } },
    bottom: { style: 'thin', color: { rgb: 'BFBFBF' } },
    left: { style: 'thin', color: { rgb: 'BFBFBF' } },
    right: { style: 'thin', color: { rgb: 'BFBFBF' } },
  };
  var borderWhite = {
    top: { style: 'thin', color: { rgb: 'FFFFFF' } },
    bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
    left: { style: 'thin', color: { rgb: 'FFFFFF' } },
    right: { style: 'thin', color: { rgb: 'FFFFFF' } },
  };

  var monthRow = [
    { v: '', s: { fill: { fgColor: { rgb: '1F3864' } }, border: borderWhite } },
  ];
  var currentMonth = -1;
  var mergeStart = -1;
  var mergeCount = 0;

  weeks.forEach(function (w, wi) {
    var m = w.startDate.getMonth();
    if (m !== currentMonth) {
      if (currentMonth !== -1 && mergeCount > 1) {
        merges.push({ s: { r: 0, c: mergeStart }, e: { r: 0, c: mergeStart + mergeCount - 1 } });
      }
      currentMonth = m;
      mergeStart = wi + 1;
      mergeCount = 1;
      monthRow.push({
        v: SST_MONTH_NAMES[m],
        s: {
          fill: { fgColor: { rgb: '1F3864' } },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderWhite,
        },
      });
    } else {
      mergeCount++;
      monthRow.push({ v: '', s: { fill: { fgColor: { rgb: '1F3864' } }, border: borderWhite } });
    }
  });
  if (mergeCount > 1) {
    merges.push({ s: { r: 0, c: mergeStart }, e: { r: 0, c: mergeStart + mergeCount - 1 } });
  }

  var weekRow = [
    {
      v: 'Sous-Traitant',
      s: {
        fill: { fgColor: { rgb: '2E75B6' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderWhite,
      },
    },
  ];
  weeks.forEach(function (w) {
    weekRow.push({
      v: 'S' + w.num,
      s: {
        fill: { fgColor: { rgb: '2E75B6' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderWhite,
      },
    });
  });

  wsData.push(monthRow);
  wsData.push(weekRow);

  var rowBg = ['FFFFFF', 'EEF2F7'];
  site.ssts.forEach(function (sst, i) {
    var row = [
      {
        v: sst,
        s: {
          fill: { fgColor: { rgb: rowBg[i % 2] } },
          font: { sz: 9 },
          alignment: { vertical: 'center', wrapText: true },
          border: borderThin,
        },
      },
    ];

    weeks.forEach(function (w) {
      var key = i + '_' + store.sstYear + '_S' + w.num;
      var val = site.cells[key] || '';
      var bgColor = rowBg[i % 2];
      var fontColor = '000000';
      if (val === 'P') {
        bgColor = '70AD47';
        fontColor = 'FFFFFF';
      } else if (val === 'F') {
        bgColor = 'F4B942';
        fontColor = 'FFFFFF';
      } else if (val === 'R') {
        bgColor = 'FF4444';
        fontColor = 'FFFFFF';
      }
      row.push({
        v: val,
        s: {
          fill: { fgColor: { rgb: bgColor } },
          font: { bold: !!val, sz: 9, color: { rgb: fontColor } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderThin,
        },
      });
    });
    wsData.push(row);
  });

  var ws = window.XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;
  var cols = [{ wch: 35 }];
  weeks.forEach(function () {
    cols.push({ wch: 4.5 });
  });
  ws['!cols'] = cols;
  var rowHeights = [{ hpt: 18 }, { hpt: 18 }];
  site.ssts.forEach(function () {
    rowHeights.push({ hpt: 28 });
  });
  ws['!rows'] = rowHeights;

  var wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Planning SST ' + store.sstYear);
  window.XLSX.writeFile(wb, 'Planning_SST_' + client + '_' + store.sstYear + '.xlsx');
  showToast('📊 Export Excel terminé !');
}
