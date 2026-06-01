// ========== UTILS UI ==========
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  else console.warn('⚠️ Écran introuvable :', id);
}

function goTo(id) {
  showScreen(id);
  if (id === 'screen-history') { loadFilterClients(); renderHistory(); }
  if (id === 'screen-admin') renderAdmin();
  if (id === 'screen-planning') { loadPlanningClients(); renderPlanning(); }
  if (id === 'screen-menu') { renderTodayWidget();renderSSTWidget(); }
  if (id === 'screen-planning-sst') {initScreenSST();}
  if (id === 'screen-login-history') {computeLoginStats();loadLoginHistory();}


}

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// Au démarrage : écran de chargement (le bloc du bas prendra le relais)
document.addEventListener('DOMContentLoaded', function() {
  goTo('screen-loading');
});

// ========== DATA ==========
var MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
var JOURS_COURTS = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
document.addEventListener('click', function(e) {
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
    document.activeElement.blur();
  }
});

var CODES = {
  '0':  { label: '0 — Présent',           color: '#3498db', text: '#fff' },
  '1':  { label: '1 — 10H-18H',           color: '#5dade2', text: '#fff' },
  '2':  { label: '2 — 8H-16H',            color: '#2e86c1', text: '#fff' },
  '3':  { label: '3 — 12H-20H',           color: '#1a5276', text: '#fff' },
  '4':  { label: '4 — 09H-17H',           color: '#5dade2', text: '#fff'},
  '5':  { label: '5 — 15H-22H',           color: '#1a5276', text: '#fff' },
  '6':  { label: '6 — 07H-15H',           color: '#1a5276', text: '#fff' },
  '7':  { label: '7 — 11H-19H',           color: '#1a5276', text: '#fff' },
  '8':  { label: '8 — 08H-12H',           color: '#2e86c1', text: '#fff' },
  '9':  { label: '9 — 08H-10H',           color: '#2e86c1', text: '#fff' },
  '10': { label: '10 — Formation',        color: '#f1c40f', text: '#333' },
  '20': { label: '20 — Congés',           color: '#e67e22', text: '#333' },
  '30': { label: '30 — Maladie',          color: '#27ae60', text: '#333' },
  '40': { label: '40 — Repos',            color: '#bdc3c7', text: '#333' }
};

var users = [];
var clients = [];
var entries = [];
var accessMap = {};
var planningData = {};
var currentUser = null;
var currentType = '';
var accessEditUser = '';
var planningMonth = new Date().getMonth();
var planningYear = new Date().getFullYear();
var pickerTarget = '';

// Drag planning
var isDragging = false;
var dragEmpIndex = null;
var dragStartDay = null;
var dragCurrentDay = null;
var dragSourceCode = null;





// ========== ACCÈS CLIENTS ==========
function getUserClients(uid) {
  var user = users.find(function(u) { return u.id === uid; });
  if (user && user.role === 'admin') return clients.slice();
  var allowed = accessMap[uid];
  if (!allowed || !Array.isArray(allowed)) return [];
  return allowed.filter(function(c) { return clients.indexOf(c) !== -1; });
}

function openAccessModal(uid) {
  accessEditUser = uid;
  document.getElementById('modal-access-user').textContent = uid;
  var allowed = accessMap[uid] || [];
  var html = '';
  clients.forEach(function(c) {
    var checked = allowed.indexOf(c) !== -1 ? ' checked' : '';
    html += '<label><input type="checkbox" value="' + c + '"' + checked + '> ' + c + '</label>';
  });
  if (clients.length === 0) html = '<p style="color:#999;">Aucun client créé</p>';
  document.getElementById('modal-access-list').innerHTML = html;
  updateToggleAllBtn();
  document.getElementById('modal-access').classList.add('active');
}

function closeAccessModal() {
  document.getElementById('modal-access').classList.remove('active');
  accessEditUser = '';
}

function toggleAllAccess() {
  var checks = document.querySelectorAll('#modal-access-list input[type="checkbox"]');
  if (checks.length === 0) return;
  var allChecked = true;
  checks.forEach(function(cb) { if (!cb.checked) allChecked = false; });
  checks.forEach(function(cb) { cb.checked = !allChecked; });
  updateToggleAllBtn();
}

function updateToggleAllBtn() {
  var checks = document.querySelectorAll('#modal-access-list input[type="checkbox"]');
  var allChecked = true;
  checks.forEach(function(cb) { if (!cb.checked) allChecked = false; });
  var btn = document.getElementById('toggleAllAccessBtn');
  if (checks.length === 0) {
    btn.style.display = 'none';
  } else {
    btn.style.display = '';
    btn.textContent = allChecked ? '☐ Tout désélectionner' : '☑ Tout sélectionner';
  }
}

function saveAccess() {
  var checks = document.querySelectorAll('#modal-access-list input[type="checkbox"]');
  var allowed = [];
  checks.forEach(function(cb) { if (cb.checked) allowed.push(cb.value); });
  accessMap[accessEditUser] = allowed;
  apiSaveAll('access', accessMap);
  closeAccessModal();
  showToast('✅ Accès mis à jour');
}

// ========== CLIENTS SELECT ==========
function loadAllClientSelects() {
    var uc = getUserClients(currentUser.id);
    
    // Select nouvel événement
    var sel1 = document.getElementById('client');
    if (sel1) {
        sel1.innerHTML = '<option value="">-- Choisir --</option>';
        uc.forEach(function(c) { sel1.innerHTML += '<option>' + c + '</option>'; });
    }
    
    // Select planning présence
    var sel2 = document.getElementById('planningClientSelect');
    if (sel2) {
        sel2.innerHTML = '<option value="">-- Choisir un client --</option>';
        uc.forEach(function(c) { sel2.innerHTML += '<option value="' + c + '">' + c + '</option>'; });
    }
    
    // Select filtre historique
    var sel3 = document.getElementById('filterClient');
    if (sel3) {
        sel3.innerHTML = '<option value="">Tous les clients</option>';
        uc.forEach(function(c) { sel3.innerHTML += '<option>' + c + '</option>'; });
    }

    // Select planning SST
    var sel4 = document.getElementById('sstClientSelect');
    if (sel4) {
        sel4.innerHTML = '<option value="">-- Choisir un client --</option>';
        uc.forEach(function(c) { sel4.innerHTML += '<option value="' + c + '">' + c + '</option>'; });
    }
}

function loadClientSelect() {
  var sel = document.getElementById('client');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Choisir --</option>';
  var uc = getUserClients(currentUser.id);
  uc.forEach(function(c) { sel.innerHTML += '<option>' + c + '</option>'; });
}


function loadFilterClients() {
  var sel = document.getElementById('filterClient');
  if (!sel) return;
  sel.innerHTML = '<option value="">Tous les clients</option>';
  var uc = getUserClients(currentUser.id);
  uc.forEach(function(c) { sel.innerHTML += '<option>' + c + '</option>'; });
}
  
function loadPlanningClients() {
  var sel = document.getElementById('planningClientSelect');
  if (!sel) return;
  
  sel.innerHTML = '<option value="">-- Choisir un client --</option>';
  var cls = getUserClients(currentUser.id);
  cls.forEach(function(c) {
    sel.innerHTML += '<option value="' + c + '">' + c + '</option>';
  });
}
  

// ========== EVENT TYPE ==========
function selectType(el, type) {
  document.querySelectorAll('.type-card').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
  currentType = type;
}

function goToNewEvent() {
  var uc = getUserClients(currentUser.id);
  if (uc.length === 0) return showToast('🔒 Aucun client assigné');
  loadAllClientSelects(); // ← AJOUTER CECI
  goTo('screen-home');
  
}


function goToForm() {
  if (!document.getElementById('client').value) return showToast('⚠️ Choisissez un client');
  if (!currentType) return showToast('⚠️ Choisissez un type');
  if (currentType === 'Fait marquant') goTo('screen-fait');
  else if (currentType === 'Information') goTo('screen-info');
  else if (currentType === 'Astreinte') goTo('screen-astreinte');
  else if (currentType === 'Sous-traitant') goTo('screen-soustraitant');
}

// ========== SUBMIT ===============================================================================================================================
function submitEvent() {
  var entry = {
    id: Date.now(),
    user: currentUser.id,
    client: document.getElementById('client').value,
    localisation: document.getElementById('localisation').value.trim(),
    type: currentType,
    dateDebut: document.getElementById('dateDebut').value,
    dateFin: document.getElementById('dateFin').value
  };

  if (!entry.dateDebut || !entry.dateFin) return showToast('⚠️ Dates requises');

  if (currentType === 'Fait marquant') {
    entry.operations = document.getElementById('fait-operations').value.trim();
    entry.actions = document.getElementById('fait-actions').value.trim();
    entry.commentaire = document.getElementById('fait-commentaire').value.trim();
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  if (currentType === 'Information') {
    entry.operations = document.getElementById('info-operations').value.trim();
    entry.actions = document.getElementById('info-actions').value.trim();
    entry.commentaire = document.getElementById('info-commentaire').value.trim();
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  if (currentType === 'Astreinte') {
    entry.operations = document.getElementById('astr-operations').value.trim();
    entry.actions = document.getElementById('astr-actions').value.trim();
    entry.commentaire = document.getElementById('astr-commentaire').value.trim();
    entry.impact = document.getElementById('astr-impact').checked ? 'Oui' : 'Non';
    entry.intervenant = document.getElementById('astr-intervenant').value.trim();
    entry.lotTechnique = document.getElementById('astr-lot-technique').value.trim();
    entry.heureAppel = document.getElementById('astr-heure-appel').value;
    entry.heureArrivee = document.getElementById('astr-heure-arrivee').value;
    entry.heureDepart = document.getElementById('astr-heure-depart').value;
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  if (currentType === 'Sous-traitant') {
    entry.operations = document.getElementById('st-operations').value.trim();
    entry.actions = document.getElementById('st-actions').value.trim();
    entry.commentaire = document.getElementById('st-commentaire').value.trim();
    entry.societe = document.getElementById('st-societe').value.trim();
    entry.lot = document.getElementById('st-lot').value.trim();
    entry.heureArrivee = document.getElementById('st-heure-arrivee').value;
    entry.heureDepart = document.getElementById('st-heure-depart').value;
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  entries.push(entry);
  apiSaveAll('entries', entries);
  showToast('✅ Enregistré !');
  goTo('screen-menu');
}

// ========== HISTORY ==========
function getFilteredData() {
  var uc = getUserClients(currentUser.id);
  var fClient = document.getElementById('filterClient').value;
  var fFrom = document.getElementById('filterFrom').value;
  var fTo = document.getElementById('filterTo').value;
  return entries.filter(function(d) {
    if (uc.indexOf(d.client) === -1) return false;
    if (fClient && d.client !== fClient) return false;
    if (fFrom && d.dateDebut < fFrom) return false;
    if (fTo && d.dateDebut > fTo) return false;
    return true;
  });
}

function renderHistory() {
  var filtered = getFilteredData();
  var isAdmin = currentUser.role === 'admin';
  var tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="18" style="text-align:center;color:#aaa;padding:20px;">Aucune entrée</td></tr>';
  } else {
    filtered.slice().reverse().forEach(function(d) {
      tbody.innerHTML += '<tr>' +
        '<td>' + d.dateDebut + '</td><td>' + d.dateFin + '</td><td>' + d.client + '</td>' +
        '<td>' + (d.localisation || '') + '</td><td>' + d.type + '</td>' +
        '<td>' + (d.operations || '') + '</td><td>' + (d.actions || '') + '</td>' +
        '<td>' + (d.commentaire || '') + '</td><td>' + (d.impact || '') + '</td>' +
        '<td>' + (d.cri || '') + '</td><td>' + (d.intervenant || '') + '</td>' +
        '<td>' + (d.lotTechnique || '') + '</td><td>' + (d.heureAppel || '') + '</td>' +
        '<td>' + (d.heureArrivee || '') + '</td><td>' + (d.heureDepart || '') + '</td>' +
        '<td>' + (d.societe || '') + '</td><td>' + (d.lot || '') + '</td>' +
        '<td>' + (isAdmin ? '<button class="hc-delete" onclick="deleteEntry(' + d.id + ')">🗑️</button>' : '') + '</td></tr>';
    });
  }
}

function deleteEntry(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  entries = entries.filter(function(e) { return e.id !== id; });
  apiSaveAll('entries', entries);
  renderHistory();
  showToast('🗑️ Supprimé');
}

function resetFilters() {
  document.getElementById('filterClient').value = '';
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  renderHistory();
}

// ========== EXPORT ==========
function exportExcel() {
  var data = getFilteredData();
  if (!data.length) return showToast('Aucune donnée');
  var html = '<table><tr><th>Date Début</th><th>Date Fin</th><th>Client</th><th>Localisation</th><th>Type</th><th>Opérations</th><th>Actions</th><th>Commentaire</th><th>Impact</th><th>CRI</th><th>Intervenant</th><th>Lot Tech.</th><th>H.Appel</th><th>H.Arrivée</th><th>H.Départ</th><th>Société</th><th>Lot ST</th><th>Utilisateur</th></tr>';
  data.forEach(function(d) {
    html += '<tr><td>' + d.dateDebut + '</td><td>' + d.dateFin + '</td><td>' + d.client + '</td><td>' + (d.localisation||'') + '</td><td>' + d.type + '</td><td>' + (d.operations||'') + '</td><td>' + (d.actions||'') + '</td><td>' + (d.commentaire||'') + '</td><td>' + (d.impact||'') + '</td><td>' + (d.cri||'') + '</td><td>' + (d.intervenant||'') + '</td><td>' + (d.lotTechnique||'') + '</td><td>' + (d.heureAppel||'') + '</td><td>' + (d.heureArrivee||'') + '</td><td>' + (d.heureDepart||'') + '</td><td>' + (d.societe||'') + '</td><td>' + (d.lot||'') + '</td><td>' + (d.user||'') + '</td></tr>';
  });
  html += '</table>';
  var blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'historique.xls';
  a.click();
  showToast('📊 Export terminé');
}
function exportSSTExcel() {
  var client = getSSTClient();
  if (!client) { alert('Sélectionne un site d\'abord'); return; }

  var site = getSSTSiteData(client);
  var weeks = getWeeksOfYear(sstYear);
  var monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  var wsData = [];
  var merges = [];

  // === STYLE HELPERS ===
  var borderThin = {
    top: { style: 'thin', color: { rgb: 'BFBFBF' } },
    bottom: { style: 'thin', color: { rgb: 'BFBFBF' } },
    left: { style: 'thin', color: { rgb: 'BFBFBF' } },
    right: { style: 'thin', color: { rgb: 'BFBFBF' } }
  };
  var borderWhite = {
    top: { style: 'thin', color: { rgb: 'FFFFFF' } },
    bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
    left: { style: 'thin', color: { rgb: 'FFFFFF' } },
    right: { style: 'thin', color: { rgb: 'FFFFFF' } }
  };

  // === LIGNE 1 : MOIS (fusionnés) ===
  var monthRow = [{
    v: '',
    s: { fill: { fgColor: { rgb: '1F3864' } }, border: borderWhite }
  }];

  var currentMonth = -1;
  var mergeStart = -1;
  var mergeCount = 0;

  weeks.forEach(function(w, i) {
    var m = w.startDate.getMonth();
    if (m !== currentMonth) {
      if (currentMonth !== -1 && mergeCount > 1) {
        merges.push({ s: { r: 0, c: mergeStart }, e: { r: 0, c: mergeStart + mergeCount - 1 } });
      }
      currentMonth = m;
      mergeStart = i + 1;
      mergeCount = 1;
      monthRow.push({
        v: monthNames[m],
        s: {
          fill: { fgColor: { rgb: '1F3864' } },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderWhite
        }
      });
    } else {
      mergeCount++;
      monthRow.push({
        v: '',
        s: { fill: { fgColor: { rgb: '1F3864' } }, border: borderWhite }
      });
    }
  });
  // Dernière fusion
  if (mergeCount > 1) {
    merges.push({ s: { r: 0, c: mergeStart }, e: { r: 0, c: mergeStart + mergeCount - 1 } });
  }

  // === LIGNE 2 : SEMAINES ===
  var weekRow = [{
    v: 'Sous-Traitant',
    s: {
      fill: { fgColor: { rgb: '2E75B6' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderWhite
    }
  }];

  weeks.forEach(function(w) {
    weekRow.push({
      v: 'S' + w.num,
      s: {
        fill: { fgColor: { rgb: '2E75B6' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderWhite
      }
    });
  });

  wsData.push(monthRow);
  wsData.push(weekRow);

  // === LIGNES DONNÉES ===
  var rowBg = ['FFFFFF', 'EEF2F7'];

  site.ssts.forEach(function(sst, i) {
    var row = [{
      v: sst,
      s: {
        fill: { fgColor: { rgb: rowBg[i % 2] } },
        font: { sz: 9 },
        alignment: { vertical: 'center', wrapText: true },
        border: borderThin
      }
    }];

    weeks.forEach(function(w) {
      var key = i + '_' + sstYear + '_S' + w.num;
      var val = site.cells[key] || '';
      var bgColor = rowBg[i % 2];
      var fontColor = '000000';

      if (val === 'P') { bgColor = '70AD47'; fontColor = 'FFFFFF'; }
      else if (val === 'F') { bgColor = 'F4B942'; fontColor = 'FFFFFF'; }
      else if (val === 'R') { bgColor = 'FF4444'; fontColor = 'FFFFFF'; }

      row.push({
        v: val,
        s: {
          fill: { fgColor: { rgb: bgColor } },
          font: { bold: !!val, sz: 9, color: { rgb: fontColor } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderThin
        }
      });
    });

    wsData.push(row);
  });

  // === CRÉATION FEUILLE ===
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;

  // === LARGEURS COLONNES ===
  var cols = [{ wch: 35 }];
  weeks.forEach(function() { cols.push({ wch: 4.5 }); });
  ws['!cols'] = cols;

  // === HAUTEURS LIGNES ===
  var rowHeights = [{ hpt: 18 }, { hpt: 18 }];
  site.ssts.forEach(function() { rowHeights.push({ hpt: 28 }); });
  ws['!rows'] = rowHeights;

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planning SST ' + sstYear);
  XLSX.writeFile(wb, 'Planning_SST_' + client + '_' + sstYear + '.xlsx');
  showToast('📊 Export Excel terminé !');
}




// ========== ADMIN ==========
function renderAdmin() {
  var ul = document.getElementById('userList');
  ul.innerHTML = '';
  users.forEach(function(u) {
    var li = document.createElement('li');
    li.innerHTML = '<span>' + u.id + ' <span class="role-badge ' + (u.role === 'admin' ? 'role-admin' : 'role-user') + '">' + u.role + '</span></span>' +
      '<span>' + (u.role !== 'admin' ? '<button class="access-btn" onclick="openAccessModal(\'' + u.id + '\')">🔑 Accès</button>' : '') +
      '<button class="hc-delete" onclick="deleteUser(\'' + u.id + '\')">🗑️</button></span>';
    ul.appendChild(li);
  });

  var cl = document.getElementById('clientList');
  cl.innerHTML = '';
  clients.forEach(function(c) {
    var li = document.createElement('li');
    li.innerHTML = '<span>' + c + '</span><button class="hc-delete" onclick="deleteClient(\'' + c + '\')">🗑️</button>';
    cl.appendChild(li);
  });
}

function addUser() {
  var id = document.getElementById('newUserId').value.trim();
  var pass = document.getElementById('newUserPass').value.trim();
  var role = document.getElementById('newUserRole').value;
  if (!id || !pass) return showToast('⚠️ Remplissez tous les champs');
  if (users.find(function(u) { return u.id === id; })) return showToast('⚠️ ID déjà utilisé');
  users.push({ id: id, pass: pass, role: role });
  apiSaveAll('users', users);
  document.getElementById('newUserId').value = '';
  document.getElementById('newUserPass').value = '';
  renderAdmin();
  showToast('✅ Utilisateur ajouté');
}

function deleteUser(id) {
  if (id === 'admin') return showToast('⚠️ Impossible de supprimer admin');
  if (id === currentUser.id) return showToast('⚠️ Impossible de vous supprimer');
  if (!confirm('Supprimer ' + id + ' ?')) return;
  users = users.filter(function(u) { return u.id !== id; });
  apiSaveAll('users', users);
  renderAdmin();
  showToast('🗑️ Supprimé');
}
  
function addClient() {
  var name = document.getElementById('newClientName').value.trim();
  if (!name) return showToast('⚠️ Nom requis');
  if (clients.indexOf(name) !== -1) return showToast('⚠️ Client existant');
  
  clients.push(name);
  
  // Refresh AVANT le save pour que ce soit immédiat
  document.getElementById('newClientName').value = '';
  loadClientSelect();
  loadFilterClients();
  renderAdmin();
  showToast('✅ Client ajouté');
  
  // Save en arrière-plan
  apiSaveAll('clients', clients);
}




function deleteClient(c) {
  if (!confirm('Supprimer ' + c + ' ?')) return;
  clients = clients.filter(function(x) { return x !== c; });
  apiSaveAll('clients', clients);
  loadClientSelect();
  loadFilterClients();
  renderAdmin();
  showToast('🗑️ Supprimé');
}

function exportClients() {
  var csv = 'Client\n';
  clients.forEach(function(c) { csv += c + '\n'; });
  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clients.csv';
  a.click();
  showToast('📤 Liste exportée');
}

function importClients(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var lines = e.target.result.split('\n');
    var count = 0;
    lines.forEach(function(line) {
      var c = line.trim();
      if (c && c !== 'Client' && clients.indexOf(c) === -1) {
        clients.push(c);
        count++;
      }
    });
    apiSaveAll('clients', clients);
    loadClientSelect();
    loadFilterClients();
    renderAdmin();
    showToast('📥 ' + count + ' clients importés');
  };
  reader.readAsText(file);
  event.target.value = '';
}


// ========== PLANNING ==========


function savePlanning() {
  apiSaveAll('planning', planningData);
}


function getSiteData(client) {
  if (!planningData[client]) planningData[client] = { employees: [], cells: {} };
  return planningData[client];
}

function getPlanningClient() {
  return document.getElementById('planningClientSelect').value;
}

function goToPlanning() {
    var sel = document.getElementById('planningClientSelect');
    if (!sel) return; 
    
    sel.innerHTML = '<option value="">-- Choisir un client --</option>';
    var cls = getUserClients(currentUser.id);
    cls.forEach(function(c) {
        sel.innerHTML += '<option value="' + c + '">' + c + '</option>';
    });
    
    updatePlanningLabel();
    renderPlanning(); // Affichera "Sélectionnez un client" par défaut
    showScreen('screen-planning');
}

function updatePlanningLabel() {
  document.getElementById('planningMoisLabel').textContent = MOIS_NOMS[planningMonth] + ' ' + planningYear;
}

function prevMonth() {
  planningMonth--;
  if (planningMonth < 0) { planningMonth = 11; planningYear--; }
  updatePlanningLabel();
  renderPlanning();
}

function nextMonth() {
  planningMonth++;
  if (planningMonth > 11) { planningMonth = 0; planningYear++; }
  updatePlanningLabel();
  renderPlanning();
}

function addEmployee() {
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


function removeEmployee(client, idx) {
  if (!confirm('Supprimer cet employé ?')) return;
  var site = getSiteData(client);
  var emp = site.employees[idx];
  site.employees.splice(idx, 1);
  // Nettoyer les cellules de cet employé
  Object.keys(site.cells).forEach(function(k) {
    if (k.indexOf(idx + '_') === 0) delete site.cells[k];
  });
  savePlanning();
  renderPlanning();
  showToast('🗑️ ' + emp + ' supprimé');
}

function renameEmployee(client, idx) {
  var site = getSiteData(client);
  var oldName = site.employees[idx];
  var newName = prompt('Nouveau nom :', oldName);
  if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
  site.employees[idx] = newName.trim();
  savePlanning();
  renderPlanning();
  showToast('✏️ Renommé');
}

function renderPlanning() {
  var client = getPlanningClient();

  // Légende
  var legHtml = '';
  Object.keys(CODES).forEach(function(code) {
    legHtml += '<div class="legend-item"><div class="legend-color" style="background:' + CODES[code].color + '"></div>' + CODES[code].label + ' (' + code + ')</div>';
  });
  document.getElementById('planningLegend').innerHTML = legHtml;

  if (!client) {
    document.getElementById('planningTable').innerHTML = '<tr><td style="text-align:center;color:#aaa;padding:20px;">Sélectionnez un client</td></tr>';
    return;
  }

  var site = getSiteData(client);
  var nbDays = new Date(planningYear, planningMonth + 1, 0).getDate();

  var html = '<thead><tr><th>Employé</th>';
  for (var d = 1; d <= nbDays; d++) {
    var dt = new Date(planningYear, planningMonth, d);
    var isWe = (dt.getDay() === 0 || dt.getDay() === 6);
    html += '<th class="' + (isWe ? 'weekend' : '') + '">' + JOURS_COURTS[dt.getDay()] + '<br>' + d + '</th>';

  }
  html += '</tr></thead><tbody>';

  if (site.employees.length === 0) {
    html += '<tr><td colspan="' + (nbDays + 1) + '" style="text-align:center;color:#aaa;padding:20px;">Aucun employé. Ajoutez-en un.</td></tr>';
  } else {
    site.employees.forEach(function(emp, i) {
      html += '<tr><td><div class="emp-name-cell">' + emp +
        ' <button class="emp-edit-btn" onclick="renameEmployee(\'' + client.replace(/'/g, "\\'") + '\',' + i + ')">✏️</button>' +
        '<button class="emp-edit-btn" onclick="removeEmployee(\'' + client.replace(/'/g, "\\'") + '\',' + i + ')">🗑️</button></div></td>';
      for (var d = 1; d <= nbDays; d++) {
        var dt = new Date(planningYear, planningMonth, d);
        var isWe = (dt.getDay() === 0 || dt.getDay() === 6);
        var key = i + '_' + planningYear + '-' + (planningMonth + 1) + '-' + d;
        var code = site.cells[key] || '';
        var bg = '';
        var fg = '';
        var label = '';
        if (code && CODES[code]) {
          bg = CODES[code].color;
          fg = CODES[code].text;
          label = code;
        }
        html += '<td data-key="' + key + '" data-emp="' + i + '" data-day="' + d + '"' +
            
          ' style="' + (bg ? 'background:' + bg + ';color:' + fg + ';font-weight:700;' : '') + '"' +
          ' onmousedown="onCellMouseDown(event,this)"' +
          ' onmouseenter="onCellMouseEnter(event,this)"' +
          ' ontouchstart="onCellTouchStart(event,this)"' +
          ' ontouchmove="onCellTouchMove(event,this)"' +
          '>' + label + '</td>';
      }
      html += '</tr>';
    });
  }
  html += '</tbody>';
  document.getElementById('planningTable').innerHTML = html;
}
var PRESENT_CODES = ['0','1','2','3','4','5','6','7','8','9']; // présents/travail/formation
var ABSENT_CODES  = ['20','30','40','10'];               // congés/maladie/repos
 function getTodayPresents() {
  var today = new Date();
  var year  = today.getFullYear();
  var month = today.getMonth();
  var day   = today.getDate();

  var results = { presents: [], absents: [] };

  var clientList = getUserClients(currentUser.id);
  clientList.forEach(function(client) {
    var site = getSiteData(client);
    if (!site || !site.employees || site.employees.length === 0) return;

    site.employees.forEach(function(emp, i) {
      var key  = i + '_' + year + '-' + (month + 1) + '-' + day;
      var code = site.cells[key] || '';

      if (!code || !CODES[code]) return; // pas de code = non planifié

      var entry = {
        client   : client,
        employee : emp,
        code     : code,
        label    : CODES[code].label,
        color    : CODES[code].color,
        textColor: CODES[code].text
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
function renderTodayWidget() {
  var today = new Date();
  document.getElementById('today-date').textContent =
    ' — ' + today.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  var data     = getTodayPresents();
  var el       = document.getElementById('today-list');
  var total    = data.presents.length + data.absents.length;

  if (total === 0) {
    el.innerHTML = '<span style="color:#aaa;font-size:13px;">Aucune planification pour aujourd\'hui</span>';
    return;
  }

  // Compteurs globaux
  var html = '<div style="display:flex;gap:10px;margin-bottom:10px;">' +
    '<span style="background:#3498db;color:#fff;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;">✅ ' + data.presents.length + ' présent(s)</span>' +
    '<span style="background:#e67e22;color:#fff;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;">❌ ' + data.absents.length + ' absent(s)</span>' +
    '</div>';

  // Grouper par client
  function renderGroup(list, title, icon) {
    if (list.length === 0) return '';
    var byClient = {};
    list.forEach(function(p) {
      if (!byClient[p.client]) byClient[p.client] = [];
      byClient[p.client].push(p);
    });

    var h = '<div style="margin-bottom:10px;">';
    h += '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">' + icon + ' ' + title + '</div>';
    Object.keys(byClient).forEach(function(client) {
      h += '<div style="margin-bottom:6px;">';
      h += '<span style="font-size:12px;color:#666;font-weight:600;">📍 ' + client + '</span><br>';
      byClient[client].forEach(function(p) {
        h += '<span style="display:inline-flex;align-items:center;gap:4px;background:' + p.color +
             ';color:' + p.textColor + ';border-radius:6px;padding:3px 9px;margin:2px;font-size:12px;font-weight:700;">' +
             p.employee +
             '<span style="opacity:0.8;font-size:10px;">(' + p.code + ')</span></span>';
      });
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  html += renderGroup(data.presents, 'Présents / En service', '🟢');
  html += renderGroup(data.absents,  'Absents',               '🔴');

  el.innerHTML = html;
}
 function getISOWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
 
function renderSSTWidget() {
  var now = new Date();
  var weekNum = getISOWeek(now);
  var year = now.getFullYear();

  var label = document.getElementById('sst-week-label');
  if (label) label.textContent = ' — S' + weekNum + ' / ' + year;

  var container = document.getElementById('sst-list');
  if (!container) return;

  // ✅ Droits de l'utilisateur courant
  var isAdmin = currentUser && currentUser.role === 'admin';
  var allowedSites = (accessMap && currentUser) ? (accessMap[currentUser.id] || []) : [];

  apiGet('planningSst').then(function(data) {
    var results = [];

    Object.keys(data).forEach(function(client) {

      // 🔒 Filtre par droits
      if (!isAdmin && allowedSites.indexOf(client) === -1) return;

      var site = data[client];
      if (!site.ssts || !site.cells) return;

      site.ssts.forEach(function(sst, i) {
        var key = i + '_' + year + '_S' + weekNum;
        var code = site.cells[key];
        if (code) {
          results.push({ client: client, sst: sst, code: code });
        }
      });
    });

    if (results.length === 0) {
      container.innerHTML = '<div style="color:#aaa;font-size:13px;text-align:center;padding:8px;">Aucun sous-traitant cette semaine</div>';
      return;
    }

    var prevus = results.filter(function(r) { return r.code === 'P'; });
    var faits  = results.filter(function(r) { return r.code === 'F'; });
    var replan = results.filter(function(r) { return r.code === 'R'; });

    var html = '';

    if (prevus.length > 0) {
      html += '<div style="font-weight:600;font-size:12px;color:#4CAF50;margin-bottom:4px;margin-top:4px;">✅ PRÉVUS</div>';
      prevus.forEach(function(r) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin-bottom:5px;border-radius:8px;background:#f0fdf4;border-left:4px solid #4CAF50;">'
              + '<span style="font-size:13px;font-weight:600;color:#2c3e50;">🔧 ' + r.sst + '</span>'
              + '<span style="font-size:11px;color:#666;">' + r.client + '</span>'
              + '</div>';
      });
    }

    if (faits.length > 0) {
      html += '<div style="font-weight:600;font-size:12px;color:#2196F3;margin-bottom:4px;margin-top:8px;">✔️ RÉALISÉS</div>';
      faits.forEach(function(r) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin-bottom:5px;border-radius:8px;background:#f0f7ff;border-left:4px solid #2196F3;">'
              + '<span style="font-size:13px;font-weight:600;color:#2c3e50;">🔧 ' + r.sst + '</span>'
              + '<span style="font-size:11px;color:#666;">' + r.client + '</span>'
              + '</div>';
      });
    }

    if (replan.length > 0) {
      html += '<div style="font-weight:600;font-size:12px;color:#F57C00;margin-bottom:4px;margin-top:8px;">⚠️ REPORTÉS</div>';
      replan.forEach(function(r) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin-bottom:5px;border-radius:8px;background:#fffbea;border-left:4px solid #FFC107;">'
              + '<span style="font-size:13px;font-weight:600;color:#2c3e50;">🔧 ' + r.sst + '</span>'
              + '<span style="font-size:11px;color:#666;">' + r.client + '</span>'
              + '<span style="font-size:10px;background:#FFC107;color:#000;padding:2px 6px;border-radius:4px;font-weight:700;">REPORTÉ</span>'
              + '</div>';
      });
    }

    container.innerHTML = html;
  });
}


// --- DRAG EXCEL-LIKE ---
function onCellMouseDown(e, td) {
  if (!td.dataset.key) return;
  e.preventDefault();
  var client = getPlanningClient();
  var site = getSiteData(client);
  dragSourceCode = site.cells[td.dataset.key] || '';
  isDragging = true;
  dragEmpIndex = parseInt(td.dataset.emp);
  dragStartDay = parseInt(td.dataset.day);
  dragCurrentDay = dragStartDay;
  highlightDrag();
}

function onCellMouseEnter(e, td) {
  if (!isDragging) return;
  if (parseInt(td.dataset.emp) !== dragEmpIndex) return;
  dragCurrentDay = parseInt(td.dataset.day);
  highlightDrag();
}

function onCellTouchStart(e, td) {
  if (!td.dataset.key) return;
  var client = getPlanningClient();
  var site = getSiteData(client);
  dragSourceCode = site.cells[td.dataset.key] || '';
  isDragging = true;
  dragEmpIndex = parseInt(td.dataset.emp);
  dragStartDay = parseInt(td.dataset.day);
  dragCurrentDay = dragStartDay;
  highlightDrag();
}

function onCellTouchMove(e, td) {
  if (!isDragging) return;
  var touch = e.touches[0];
  var el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el && el.dataset && el.dataset.emp !== undefined && parseInt(el.dataset.emp) === dragEmpIndex) {
    dragCurrentDay = parseInt(el.dataset.day);
    highlightDrag();
  }
}

function highlightDrag() {
  // Enlever les anciennes sélections
  document.querySelectorAll('.planning-table td.selected-drag').forEach(function(td) {
    td.classList.remove('selected-drag');
  });
  document.querySelectorAll('.planning-table td.drag-source').forEach(function(td) {
    td.classList.remove('drag-source');
  });

  var minD = Math.min(dragStartDay, dragCurrentDay);
  var maxD = Math.max(dragStartDay, dragCurrentDay);

  document.querySelectorAll('.planning-table td[data-emp="' + dragEmpIndex + '"]').forEach(function(td) {
    var day = parseInt(td.dataset.day);
    if (day >= minD && day <= maxD) {
      td.classList.add('selected-drag');
    }
    if (day === dragStartDay) {
      td.classList.add('drag-source');
    }
  });
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;

  var client = getPlanningClient();
  if (!client) return;
  var site = getSiteData(client);

  var minD = Math.min(dragStartDay, dragCurrentDay);
  var maxD = Math.max(dragStartDay, dragCurrentDay);

  // Si c'est un simple clic (pas de drag), ouvrir le picker
  if (minD === maxD) {
    var key = dragEmpIndex + '_' + planningYear + '-' + (planningMonth + 1) + '-' + minD;
    openCodePicker(key);
    clearDragHighlight();
    return;
  }

  // Sinon appliquer le code source sur toute la sélection
  for (var d = minD; d <= maxD; d++) {
    var key = dragEmpIndex + '_' + planningYear + '-' + (planningMonth + 1) + '-' + d;
    if (dragSourceCode) {
      site.cells[key] = dragSourceCode;
    } else {
      delete site.cells[key];
    }
  }
  savePlanning();
  clearDragHighlight();
  renderPlanning();
  showToast('✅ ' + (maxD - minD + 1) + ' jours remplis');
}

function clearDragHighlight() {
  document.querySelectorAll('.planning-table td.selected-drag').forEach(function(td) {
    td.classList.remove('selected-drag');
  });
  document.querySelectorAll('.planning-table td.drag-source').forEach(function(td) {
    td.classList.remove('drag-source');
  });
}

document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

// --- Code Picker ---
function openCodePicker(key) {
  pickerTarget = key;
  var grid = document.getElementById('codePickerGrid');
  var html = '';
  Object.keys(CODES).forEach(function(code) {
    html += '<div class="code-pick-btn" style="background:' + CODES[code].color + ';color:' + CODES[code].text + ';border-color:' + CODES[code].color + ';" onclick="pickCode(\'' + code + '\')">' + CODES[code].label + '</div>';
  });
  html += '<div class="code-pick-clear" onclick="pickCode(\'\')">✖ Effacer</div>';
  grid.innerHTML = html;
  document.getElementById('codePicker').classList.add('active');
}

function pickCode(code) {
  var client = getPlanningClient();
  var site = getSiteData(client);
  if (code === '') {
    delete site.cells[pickerTarget];
  } else {
    site.cells[pickerTarget] = code;
  }
  savePlanning();
  document.getElementById('codePicker').classList.remove('active');
  pickerTarget = null;
  renderPlanning();
}

document.getElementById('codePicker').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
    pickerTarget = null;
  }
});

// --- Export Planning ---
function exportPlanning() {
  var client = getPlanningClient();
  if (!client) return showToast('⚠️ Choisir un client');
  var site = getSiteData(client);
  if (site.employees.length === 0) return showToast('⚠️ Aucun employé');

  var nbDays = new Date(planningYear, planningMonth + 1, 0).getDate();
  var html = '<table><tr><th>Employé</th>';
  for (var d = 1; d <= nbDays; d++) {
    var dt = new Date(planningYear, planningMonth, d);
    html += '<th>' + JOURS_COURTS[dt.getDay()] + ' ' + d + '</th>';
  }
  html += '</tr>';
  site.employees.forEach(function(emp, i) {
    html += '<tr><td>' + emp + '</td>';
    for (var d = 1; d <= nbDays; d++) {
      var key = i + '_' + planningYear + '-' + (planningMonth + 1) + '-' + d;
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
  a.download = 'planning_' + client + '_' + MOIS_NOMS[planningMonth] + '_' + planningYear + '.xls';
  a.click();
  showToast('📊 Planning exporté');
}
// ===== PLANNING SST =====
var sstYear = new Date().getFullYear();
var planningSSTData = {};

function loadPlanningSSTData() {
  return apiGet('planningSst').then(function(data) {
    planningSSTData = data || {};
  }).catch(function(err) {
    console.error('❌ Erreur load SST:', err);
    planningSSTData = {};
  });
}



function getSSTSiteData(client) {
  if (!planningSSTData[client]) planningSSTData[client] = { ssts: [], cells: {} };
  return planningSSTData[client];
}

function getWeeksOfYear(year) {
  var weeks = [];
  var d = new Date(year, 0, 1);
  // Aller au premier lundi
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  while (d.getFullYear() <= year) {
    var num = getISOWeek(d);
    if (d.getFullYear() > year) break;
    weeks.push({ num: num, startDate: new Date(d) }); // ← startDate ajouté
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}


function initScreenSST() {
  loadPlanningSSTData().then(function() {
  renderPlanningSST();
  renderSSTWidget();
});

  var select = document.getElementById('sstClientSelect');
  select.innerHTML = '';
  var clients = getUserClients(currentUser.id);
  clients.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    select.appendChild(opt);
  });
  document.getElementById('sstAnneeLabel').textContent = sstYear;
  renderPlanningSST();
}

function prevYearSST() { sstYear--; document.getElementById('sstAnneeLabel').textContent = sstYear; renderPlanningSST(); }
function nextYearSST() { sstYear++; document.getElementById('sstAnneeLabel').textContent = sstYear; renderPlanningSST(); }

function getSSTClient() {
  var s = document.getElementById('sstClientSelect');
  return s ? s.value : '';
}

function addSST() {
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

function renderPlanningSST() {
  var client = getSSTClient();
  var table = document.getElementById('planningTableSST');
  if (!client) { table.innerHTML = ''; return; }

  var site = getSSTSiteData(client);
  var weeks = getWeeksOfYear(sstYear);

  var monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  // Ligne des mois
  var monthCells = '';
  var i = 0;
  while (i < weeks.length) {
    var monthIndex = weeks[i].startDate.getMonth();
    var count = 0;
    while (i + count < weeks.length && weeks[i + count].startDate.getMonth() === monthIndex) {
      count++;
    }
    monthCells += '<th colspan="' + count + '" style="background:#0f3460;color:#fff;font-size:11px;text-align:center;border-bottom:1px solid #333;">' + monthNames[monthIndex] + '</th>';
    i += count;
  }

  var html = '<thead>'
    + '<tr><th style="min-width:140px;position:sticky;left:0;background:#1a1a2e;z-index:2;"></th>' + monthCells + '</tr>'
    + '<tr><th style="min-width:140px;position:sticky;left:0;background:#1a1a2e;z-index:2;">Sous-Traitant</th>';

  weeks.forEach(function(w) {
    html += '<th style="min-width:38px;font-size:11px;">S' + w.num + '</th>';
  });
  html += '</tr></thead><tbody>';

  site.ssts.forEach(function(sst, i) {
    html += '<tr><td style="position:sticky;left:0;background:#1a1a2e;z-index:1;">'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<span style="font-weight:600;flex:1;">' + sst + '</span>'
      + '<button onclick="renameSSTEntry(\'' + client + '\',' + i + ')" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px;">✏️</button>'
      + '<button onclick="deleteSSTEntry(\'' + client + '\',' + i + ')" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px;">🗑️</button>'
      + '</div></td>';

    weeks.forEach(function(w) {
      var key = i + '_' + sstYear + '_S' + w.num;
      var code = site.cells[key] || '';

      var bg = code === 'P' ? '#4CAF50'
             : code === 'F' ? '#2196F3'
             : code === 'R' ? '#FFC107'
             : '';
      var textColor = code === 'R' ? '#000' : '#fff';
      var style = bg ? 'background:' + bg + ';color:' + textColor + ';' : '';

      html += '<td style="text-align:center;cursor:pointer;' + style + '" onclick="cycleSSTCell(\'' + client + '\',' + i + ',' + w.num + ')">' + code + '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody>';
  table.innerHTML = html;
}

function renameSSTEntry(client, idx) {
  var site = getSSTSiteData(client);
  var newName = prompt('Nouveau nom :', site.ssts[idx]);
  if (newName && newName.trim()) {
    site.ssts[idx] = newName.trim();
    savePlanningSSTData();
    renderPlanningSST();
  }
}

function deleteSSTEntry(client, idx) {
  var site = getSSTSiteData(client);
  if (!confirm('Supprimer "' + site.ssts[idx] + '" ?')) return;
  // Supprimer les cellules associées
  Object.keys(site.cells).forEach(function(k) {
    if (k.startsWith(idx + '_')) delete site.cells[k];
  });
  site.ssts.splice(idx, 1);
  // Réindexer les cellules
  var newCells = {};
  Object.keys(site.cells).forEach(function(k) {
    var parts = k.split('_');
    var eIdx = parseInt(parts[0]);
    if (eIdx > idx) {
      parts[0] = eIdx - 1;
      newCells[parts.join('_')] = site.cells[k];
    } else {
      newCells[k] = site.cells[k];
    }
  });
  site.cells = newCells;
  savePlanningSSTData();
  renderPlanningSST();
}


function cycleSSTCell(client, empIdx, weekNum) {
  var site = getSSTSiteData(client);
  var key = empIdx + '_' + sstYear + '_S' + weekNum;
  var current = site.cells[key] || '';
  
  // Cycle : Vide → P → F → R → Vide
  var next = current === '' ? 'P' 
           : current === 'P' ? 'F' 
           : current === 'F' ? 'R' 
           : '';
  
  if (next === '') delete site.cells[key];
  else site.cells[key] = next;
  
  savePlanningSSTData();
  renderPlanningSST();
}
function savePlanningSSTData() {
  apiSaveAll('planningSst', planningSSTData).catch(function(err) {
    console.error('❌ Erreur save SST:', err);
  });
}
  // ═══════════════════════════════════════════════════════════
// 🔐 LOGIN HISTORY
// ═══════════════════════════════════════════════════════════

var allLoginHistory = [];




// Charger l'historique (admin only)
function loadLoginHistory() {
  return spGetItems('loginHistory').then(function(items) {
    allLoginHistory = items.map(function(i) {
      return {
        email:         i.fields.Title        || '',
        dateConnexion: i.fields.DateConnexion || '',
        statut:        i.fields.Statut        || '',
        navigateur:    i.fields.Navigateur    || ''
      };
    });

    allLoginHistory.sort(function(a, b) {
      return new Date(b.dateConnexion) - new Date(a.dateConnexion);
    });

    // ✅ On ne met à jour le DOM que si l'écran est visible
    var ecran = document.getElementById('screen-login-history');
    if (ecran && ecran.style.display !== 'none') {
      computeLoginStats();
      renderLoginHistory();
    }

  }).catch(function(e) {
    console.error('Erreur chargement loginHistory:', e);
  });
}


// ─── Stats ───────────────────────────────────────────────
function computeLoginStats() {
  var total   = allLoginHistory.length;
  var now     = new Date();
  var todayStr = now.toISOString().slice(0, 10); // "2025-01-15"
  var today   = allLoginHistory.filter(function(l){
    return l.dateConnexion && l.dateConnexion.slice(0, 10) === todayStr;
  }).length;
  var weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
  var week    = allLoginHistory.filter(function(l){
    return new Date(l.dateConnexion) >= weekAgo;
  }).length;
  var uniques = [...new Set(allLoginHistory.map(function(l){ return l.email; }))].length;

  if (!document.getElementById('stat-total')) return;

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-today').textContent  = today;  // ✅ corrigé
  document.getElementById('stat-week').textContent   = week;
  document.getElementById('stat-unique').textContent = uniques;

  // Top 5 utilisateurs
  var counts = {};
  allLoginHistory.forEach(function(l){
    counts[l.email] = (counts[l.email] || 0) + 1;
  });
  var top = Object.keys(counts)
    .map(function(e){ return { email: e, count: counts[e] }; })
    .sort(function(a, b){ return b.count - a.count; })
    .slice(0, 5);

  var html = '';
  top.forEach(function(t, idx) {
    html += '<div style="display:flex;justify-content:space-between;padding:6px 0;'
          + 'border-bottom:1px solid #f0f0f0;font-size:13px;">'
          + '<span>' + ['🥇','🥈','🥉','4️⃣','5️⃣'][idx] + ' ' + t.email + '</span>'
          + '<span style="font-weight:700;color:#2196F3;">' + t.count + '</span>'
          + '</div>';
  });
  document.getElementById('stat-top-users').innerHTML = html || '<p style="color:#aaa;font-size:12px;">Aucune donnée</p>';
}


// ─── Rendu tableau ───────────────────────────────────────
function renderLoginHistory() {
  var search  = (document.getElementById('lh-search').value || '').toLowerCase();
  var from    = document.getElementById('lh-from').value;
  var to      = document.getElementById('lh-to').value;

  var filtered = allLoginHistory.filter(function(l) {
    if (search && !l.email.toLowerCase().includes(search)) return false;
    if (from && new Date(l.dateConnexion) < new Date(from)) return false;
    if (to   && new Date(l.dateConnexion) > new Date(to + 'T23:59:59')) return false;
    return true;
  });

  var tbody = document.getElementById('login-history-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#aaa;">Aucun résultat</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(l) {
    var d    = l.dateConnexion ? new Date(l.dateConnexion) : null;
    var date = d ? d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '-';
    var badge = l.statut === 'Succès'
      ? '<span style="background:#E8F5E9;color:#2E7D32;padding:3px 8px;border-radius:20px;font-size:11px;">✅ Succès</span>'
      : '<span style="background:#FFEBEE;color:#C62828;padding:3px 8px;border-radius:20px;font-size:11px;">❌ Échec</span>';
    return '<tr style="border-bottom:1px solid #f0f0f0;">'
      + '<td style="padding:10px;font-size:12px;">' + l.email + '</td>'
      + '<td style="padding:10px;font-size:12px;">' + date + '</td>'
      + '<td style="padding:10px;font-size:12px;color:#999;">' + (l.navigateur || '-') + '</td>'
      + '</tr>';
  }).join('');
}

// ─── Export CSV ───────────────────────────────────────────
function exportLoginHistory() {
  var csv = 'Email,Date,Statut,Navigateur\n';
  allLoginHistory.forEach(function(l) {
    var date = l.dateConnexion ? new Date(l.dateConnexion).toLocaleString('fr-FR') : '';
    csv += '"' + l.email + '","' + date + '","' + l.statut + '","' + l.navigateur + '"\n';
  });
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'LoginHistory_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
}

// ─── Helper navigateur ────────────────────────────────────
function getBrowserName() {
  var ua = navigator.userAgent;
  if (ua.includes('Edg'))     return 'Edge';
  if (ua.includes('Chrome'))  return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari'))  return 'Safari';
  return 'Autre';
}




// ========== INIT ==========
function initApp() {
  document.getElementById('welcomeUser').textContent = currentUser.id;
  if (currentUser.role === 'admin') {
    document.getElementById('menu-admin').style.display = '';
  } else {
    document.getElementById('menu-admin').style.display = 'none';
  }
  loadAllClientSelects();


  showScreen('screen-menu');
}
function trackLogin() {
  spCreate('loginHistory', {
    Title:         currentUser.id,
    DateConnexion: new Date().toISOString(),
    Statut:        'Connecté',
    Navigateur:    navigator.userAgent
  });
}

// ═══════════════════════════════════════════════════════════
// 🔐 CONFIGURATION SHAREPOINT / GRAPH
// ═══════════════════════════════════════════════════════════
var GRAPH_CONFIG = {
  clientId: 'a34965e3-9597-4cd7-9373-214086e8ec4c',
  tenantId: '2a9dfcb1-f2fd-4d8d-9046-00b1c3267d95',
  siteHost: 'se3m.sharepoint.com',
  sitePath: '/sites/GestionDeSite',
  lists: {
    users:    'GS_Users',
    clients:  'GS_Clients',
    entries:  'GS_Entries',
    planning: 'GS_Planning',
    access:   'GS_Access',
    planningSst: 'GS_PlanningSst',
    loginHistory: 'GS_LoginHistory'
  }
};
var GRAPH_SCOPES = ['Sites.ReadWrite.All', 'User.Read'];

var msalInstance = new msal.PublicClientApplication({
  auth: {
    clientId: GRAPH_CONFIG.clientId,
    authority: 'https://login.microsoftonline.com/' + GRAPH_CONFIG.tenantId,
    redirectUri: window.location.origin + window.location.pathname
  },
  cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false }
});

var _currentAccount = null;
var _siteId = null;
var _listIds = {};

// ═══════════════════════════════════════════════════════════
// 🔑 AUTH
// ═══════════════════════════════════════════════════════════
function doLogin()  { msalInstance.loginRedirect({ scopes: GRAPH_SCOPES }); }
function doLogout() { msalInstance.logoutRedirect(); }

function getToken() {
  var req = { scopes: GRAPH_SCOPES, account: _currentAccount };
  return msalInstance.acquireTokenSilent(req).catch(function() {
    return msalInstance.acquireTokenRedirect(req);
  });
}

function graphFetch(path, opts) {
  opts = opts || {};
  var body = undefined;
  if (opts.body) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  return getToken().then(function(t) {
    console.log('BODY:', body);  // ← ajoute cette ligne
    return fetch('https://graph.microsoft.com/v1.0' + path, {

      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + t.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body
    }).then(function(r) {
      if (r.status === 204) return null;
      if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
      return r.json();
    });
  });
}


function getSiteId() {
  if (_siteId) return Promise.resolve(_siteId);
  return graphFetch('/sites/' + GRAPH_CONFIG.siteHost + ':' + GRAPH_CONFIG.sitePath).then(function(s) {
    _siteId = s.id;
    return _siteId;
  });
}

function getListId(listKey) {
  if (_listIds[listKey]) return Promise.resolve(_listIds[listKey]);
  var listName = GRAPH_CONFIG.lists[listKey];
  return getSiteId().then(function(sid) {
    return graphFetch('/sites/' + sid + '/lists?$filter=displayName eq \'' + listName + '\'');
  }).then(function(res) {
    if (!res.value || !res.value.length) throw new Error('Liste introuvable: ' + listName);
    _listIds[listKey] = res.value[0].id;
    return _listIds[listKey];
  });
}

// ═══════════════════════════════════════════════════════════
// 🔄 CONVERTISSEURS
// ═══════════════════════════════════════════════════════════
function userFromSP(f) { return { id: f.Title, role: f.Role || 'user' }; }
function userToSP(u)   { return { Title: u.id, Role: u.role || 'user' }; }

function clientFromSP(f) { return f.Title; }
function clientToSP(c)   { return { Title: c }; }

function entryToSP(e) {
  return {
    Title: String(e.id || ('entry_' + Date.now())),
    DateDebut: e.dateDebut || null, DateFin: e.dateFin || null,
    Client: e.client || '', Localisation: e.localisation || '',
    EntryType: e.type || '', Operations: e.operations || '',
    Actions: e.actions || '', Commentaire: e.commentaire || '',
    Impact: e.impact ? 'Oui' : 'Non', CRI: e.cri || '',
    Intervenant: e.intervenant || '', LotTechnique: e.lotTechnique || '',
    HeureAppel: e.heureAppel || '', HeureArrivee: e.heureArrivee || '',
    HeureDepart: e.heureDepart || '', Societe: e.societe || '',
    Lot: e.lot || '', UserId: e.user || ''
  };
}

function entryFromSP(f) {
  return {
    id: f.Title || '',          // ← manquait
    dateDebut: f.DateDebut || '', dateFin: f.DateFin || '',
    client: f.Client || '', localisation: f.Localisation || '',
    type: f.EntryType || '',    // ← plus le fallback sur Title
    operations: f.Operations || '', actions: f.Actions || '',
    commentaire: f.Commentaire || '', impact: f.Impact === 'Oui',
    cri: f.CRI || '', intervenant: f.Intervenant || '',
    lotTechnique: f.LotTechnique || '',
    heureAppel: f.HeureAppel || '', heureArrivee: f.HeureArrivee || '',
    heureDepart: f.HeureDepart || '', societe: f.Societe || '',
    lot: f.Lot || '', user: f.UserId || ''
  };
}


// ═══════════════════════════════════════════════════════════
// 📥 LECTURE
// ═══════════════════════════════════════════════════════════
function spGetItems(listKey) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items?$expand=fields&$top=5000');
  }).then(function(res) {
    return (res.value || []).map(function(it) {
      return { id: it.id, fields: it.fields };
    });
  });
}

function apiGet(listKey) {
  return spGetItems(listKey).then(function(items) {
    if (listKey === 'users')    return items.map(function(i){ var u = userFromSP(i.fields); u._spId = i.id; return u; });
    if (listKey === 'clients')  return items.map(function(i){ return clientFromSP(i.fields); });
    if (listKey === 'entries')  return items.map(function(i){ var e = entryFromSP(i.fields); e._spId = i.id; return e; });
    if (listKey === 'access') {
      var map = {};
      items.forEach(function(i){
        try { map[i.fields.Title] = JSON.parse(i.fields.ClientsJSON || '[]'); }
        catch(e){ map[i.fields.Title] = []; }
      });
      return map;
    }
    if (listKey === 'planning') {
      var pl = {};
      items.forEach(function(i){
        try { pl[i.fields.Title] = JSON.parse(i.fields.DataJSON || '{}'); }
        catch(e){ pl[i.fields.Title] = { employees: [], cells: {} }; }
        pl[i.fields.Title]._spId = i.id;
      });
      return pl;
    }
    if (listKey === 'planningSst') {
      var ps = {};
      items.forEach(function(i){
        try { ps[i.fields.Title] = JSON.parse(i.fields.DataJSON || '{}'); }
        catch(e){ ps[i.fields.Title] = { ssts: [], cells: {} }; }
        ps[i.fields.Title]._spId = i.id;
      });
      return ps;
    }
    if (listKey === 'loginHistory') {
  return items.map(function(i) {
    return {
      id:            i.id,
      email:         i.fields.Title,
      dateConnexion: i.fields.DateConnexion,
      statut:        i.fields.Statut,
      navigateur:    i.fields.Navigateur
    };
  });
}
    return items;
  });
}

// ═══════════════════════════════════════════════════════════
// 📤 ÉCRITURE
// ═══════════════════════════════════════════════════════════
function spCreate(listKey, fields) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items', {
      method: 'POST', body: JSON.stringify({ fields: fields })
    });
  });
}
function spUpdate(listKey, itemId, fields) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items/' + itemId + '/fields', {
      method: 'PATCH', body: JSON.stringify(fields)
    });
  });
}
function spDelete(listKey, itemId) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items/' + itemId, { method: 'DELETE' });
  });
}

function apiSaveAll(listKey, data) {
  return spGetItems(listKey).then(function(existing) {
    var existingByTitle = {};
    existing.forEach(function(it){ existingByTitle[it.fields.Title] = it; });
    var ops = [];

    if (listKey === 'users') {
      var seen = {};
      data.forEach(function(u){
        seen[u.id] = true;
        var f = userToSP(u);
        if (existingByTitle[u.id]) ops.push(spUpdate('users', existingByTitle[u.id].id, f));
        else ops.push(spCreate('users', f));
      });
      existing.forEach(function(it){ if (!seen[it.fields.Title]) ops.push(spDelete('users', it.id)); });
    }
    else if (listKey === 'clients') {
      var seenC = {};
      data.forEach(function(c){
        seenC[c] = true;
        if (!existingByTitle[c]) ops.push(spCreate('clients', { Title: c }));
      });
      existing.forEach(function(it){ if (!seenC[it.fields.Title]) ops.push(spDelete('clients', it.id)); });
    }
    else if (listKey === 'access') {
      var seenA = {};
      Object.keys(data).forEach(function(uid){
        seenA[uid] = true;
        var f = { Title: uid, ClientsJSON: JSON.stringify(data[uid] || []) };
        if (existingByTitle[uid]) ops.push(spUpdate('access', existingByTitle[uid].id, f));
        else ops.push(spCreate('access', f));
      });
      existing.forEach(function(it){ if (!seenA[it.fields.Title]) ops.push(spDelete('access', it.id)); });
    }
    else if (listKey === 'planning') {
      var seenP = {};
      Object.keys(data).forEach(function(site){
        seenP[site] = true;
        var clean = Object.assign({}, data[site]); delete clean._spId;
        var f = { Title: site, DataJSON: JSON.stringify(clean) };
        if (existingByTitle[site]) ops.push(spUpdate('planning', existingByTitle[site].id, f));
        else ops.push(spCreate('planning', f));
      });
      existing.forEach(function(it){ if (!seenP[it.fields.Title]) ops.push(spDelete('planning', it.id)); });
    }
    else if (listKey === 'entries') {
      var seenE = {};
      data.forEach(function(e){
        var key = e.id || e.Title || '';
        seenE[key] = true;
        var f = entryToSP(e);
        if (existingByTitle[key]) ops.push(spUpdate('entries', existingByTitle[key].id, f));
        else ops.push(spCreate('entries', f));
      });
      existing.forEach(function(it){
        if (!seenE[it.fields.Title]) ops.push(spDelete('entries', it.id));
      });
    }
    else if (listKey === 'planningSst') {
      var seenPS = {};
      Object.keys(data).forEach(function(site){
        seenPS[site] = true;
        var clean = Object.assign({}, data[site]); delete clean._spId;
        var f = { Title: site, DataJSON: JSON.stringify(clean) };
        if (existingByTitle[site]) ops.push(spUpdate('planningSst', existingByTitle[site].id, f));
        else ops.push(spCreate('planningSst', f));
      });
      existing.forEach(function(it){ if (!seenPS[it.fields.Title]) ops.push(spDelete('planningSst', it.id)); });
    }

    return Promise.all(ops);  // ← ICI, après tous les else if
  });
}


function apiAddEntry(entry) {
  entry.id = entry.id || ('entry_' + Date.now() + '_' + Math.random().toString(36).slice(2));
  return spCreate('entries', entryToSP(entry)).then(function(res) {
    entry._spId = res.id;
    return entry;
  });
}

function apiDeleteEntry(entry) {
  if (!entry._spId) return Promise.resolve();
  return spDelete('entries', entry._spId);
}

// ═══════════════════════════════════════════════════════════
// 🚀 LOAD ALL
// ═══════════════════════════════════════════════════════════
function loadAllData() {
  return Promise.all([
    apiGet('users'), apiGet('clients'), apiGet('entries'),
    apiGet('planning'), apiGet('access'), apiGet('planningSst')  // ← ajouter
  ]).then(function(r) {
    users = r[0]; clients = r[1]; entries = r[2];
    planningData = r[3]; accessMap = r[4]; planningSSTData = r[5];  // ← ajouter
    console.log('✅ Data loaded', { users: users.length, clients: clients.length, entries: entries.length });
  });
}

// ═══════════════════════════════════════════════════════════
// 🎬 BOOTSTRAP
// ═══════════════════════════════════════════════════════════
window.addEventListener('load', function() {
  msalInstance.handleRedirectPromise().then(function(resp) {
    var account = (resp && resp.account) || msalInstance.getAllAccounts()[0];
    if (account) {
      _currentAccount = account;
      msalInstance.setActiveAccount(account);
      console.log('✅ Connecté:', account.username);

      loadAllData().then(function() {
        // 🔍 Trouver / créer l'utilisateur courant
        var email = account.username;
        var u = users.find(function(x){ return x.id === email; });
        if (!u) {
          u = { id: email, role: 'user' };
          users.push(u);
          apiSaveAll('users', users);
        }
        currentUser = u;
        console.log('👤 currentUser:', currentUser);
        if (currentUser.role !== 'admin') {
          trackLogin(currentUser.id);
        }


        // ✅ Affichage menu selon rôle
        var welcome = document.getElementById('welcomeUser');
        if (welcome) welcome.textContent = currentUser.id;

        var adminCard = document.getElementById('menu-admin');
        if (adminCard) {
          adminCard.style.display = (currentUser.role === 'admin') ? 'block' : 'none';
        }

        goTo('screen-menu');
      }).catch(function(err) {
        console.error('❌ Load error:', err);
        if (typeof showToast === 'function') showToast('Erreur chargement données');
        goTo('screen-login');
      });
    } else {
      goTo('screen-login');
    }
  }).catch(function(err) {
    console.error('❌ MSAL error:', err);
    goTo('screen-login');
  });
});