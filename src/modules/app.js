/**
 * Logique métier application — Phase 4
 */
import { store } from './store.js';
import { apiSaveAll, spCreate } from './api.js';
import { showToast } from './ui.js';
import { getUserClients } from './user-access.js';
import { loadClientSelect, loadFilterClients } from './client-selects.js';
import { clearElement, appendTableEmptyRow, appendTableCell, createTextEl } from './dom.js';

// ========== ACCÈS CLIENTS ==========
function openAccessModal(uid) {
  store.accessEditUser = uid;
  document.getElementById('modal-access-user').textContent = uid;
  var allowed = store.accessMap[uid] || [];
  var list = document.getElementById('modal-access-list');
  clearElement(list);

  if (store.clients.length === 0) {
    var empty = createTextEl('p', 'Aucun client créé');
    empty.style.color = '#999';
    list.appendChild(empty);
  } else {
    store.clients.forEach(function (c) {
      var label = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = c;
      if (allowed.indexOf(c) !== -1) cb.checked = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + c));
      list.appendChild(label);
    });
  }

  updateToggleAllBtn();
  document.getElementById('modal-access').classList.add('active');
}

function closeAccessModal() {
  document.getElementById('modal-access').classList.remove('active');
  store.accessEditUser = '';
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
  store.accessMap[store.accessEditUser] = allowed;
  apiSaveAll('access', store.accessMap);
  closeAccessModal();
  showToast('✅ Accès mis à jour');
}

// ========== HISTORY ==========
function getFilteredData() {
  var uc = getUserClients(store.currentUser.id);
  var fClient = document.getElementById('filterClient').value;
  var fFrom = document.getElementById('filterFrom').value;
  var fTo = document.getElementById('filterTo').value;
  return store.entries.filter(function(d) {
    if (uc.indexOf(d.client) === -1) return false;
    if (fClient && d.client !== fClient) return false;
    if (fFrom && d.dateDebut < fFrom) return false;
    if (fTo && d.dateDebut > fTo) return false;
    return true;
  });
}

function renderHistory() {
  var filtered = getFilteredData();
  var isAdmin = store.currentUser.role === 'admin';
  var tbody = document.getElementById('history-tbody');
  clearElement(tbody);

  if (filtered.length === 0) {
    appendTableEmptyRow(tbody, 18, 'Aucune entrée');
    return;
  }

  filtered
    .slice()
    .reverse()
    .forEach(function (d) {
      var tr = document.createElement('tr');
      appendTableCell(tr, d.dateDebut);
      appendTableCell(tr, d.dateFin);
      appendTableCell(tr, d.client);
      appendTableCell(tr, d.localisation || '');
      appendTableCell(tr, d.type);
      appendTableCell(tr, d.operations || '');
      appendTableCell(tr, d.actions || '');
      appendTableCell(tr, d.commentaire || '');
      appendTableCell(tr, d.impact || '');
      appendTableCell(tr, d.cri || '');
      appendTableCell(tr, d.intervenant || '');
      appendTableCell(tr, d.lotTechnique || '');
      appendTableCell(tr, d.heureAppel || '');
      appendTableCell(tr, d.heureArrivee || '');
      appendTableCell(tr, d.heureDepart || '');
      appendTableCell(tr, d.societe || '');
      appendTableCell(tr, d.lot || '');

      var tdAction = document.createElement('td');
      if (isAdmin) {
        var btn = document.createElement('button');
        btn.className = 'hc-delete';
        btn.textContent = '🗑️';
        btn.type = 'button';
        btn.addEventListener('click', function () {
          deleteEntry(d.id);
        });
        tdAction.appendChild(btn);
      }
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
}

function deleteEntry(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  store.entries = store.entries.filter(function(e) { return e.id !== id; });
  apiSaveAll('entries', store.entries);
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

// ========== ADMIN ==========
function renderAdmin() {
  var ul = document.getElementById('userList');
  clearElement(ul);

  store.users.forEach(function (u) {
    var li = document.createElement('li');
    var left = document.createElement('span');
    left.appendChild(document.createTextNode(u.id + ' '));
    var badge = createTextEl(
      'span',
      u.role,
      'role-badge ' + (u.role === 'admin' ? 'role-admin' : 'role-user')
    );
    left.appendChild(badge);

    var right = document.createElement('span');
    if (u.role !== 'admin') {
      var accessBtn = document.createElement('button');
      accessBtn.className = 'access-btn';
      accessBtn.type = 'button';
      accessBtn.textContent = '🔑 Accès';
      accessBtn.addEventListener('click', function () {
        openAccessModal(u.id);
      });
      right.appendChild(accessBtn);
    }
    var delBtn = document.createElement('button');
    delBtn.className = 'hc-delete';
    delBtn.type = 'button';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', function () {
      deleteUser(u.id);
    });
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);
    ul.appendChild(li);
  });

  var cl = document.getElementById('clientList');
  clearElement(cl);
  store.clients.forEach(function (c) {
    var li = document.createElement('li');
    var name = createTextEl('span', c);
    var delBtn = document.createElement('button');
    delBtn.className = 'hc-delete';
    delBtn.type = 'button';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', function () {
      deleteClient(c);
    });
    li.appendChild(name);
    li.appendChild(delBtn);
    cl.appendChild(li);
  });
}

function addUser() {
  var id = document.getElementById('newUserId').value.trim();
  var pass = document.getElementById('newUserPass').value.trim();
  var role = document.getElementById('newUserRole').value;
  if (!id || !pass) return showToast('⚠️ Remplissez tous les champs');
  if (store.users.find(function(u) { return u.id === id; })) return showToast('⚠️ ID déjà utilisé');
  store.users.push({ id: id, pass: pass, role: role });
  apiSaveAll('users', store.users);
  document.getElementById('newUserId').value = '';
  document.getElementById('newUserPass').value = '';
  renderAdmin();
  showToast('✅ Utilisateur ajouté');
}

function deleteUser(id) {
  if (id === 'admin') return showToast('⚠️ Impossible de supprimer admin');
  if (id === store.currentUser.id) return showToast('⚠️ Impossible de vous supprimer');
  if (!confirm('Supprimer ' + id + ' ?')) return;
  store.users = store.users.filter(function(u) { return u.id !== id; });
  apiSaveAll('users', store.users);
  renderAdmin();
  showToast('🗑️ Supprimé');
}
  
function addClient() {
  var name = document.getElementById('newClientName').value.trim();
  if (!name) return showToast('⚠️ Nom requis');
  if (store.clients.indexOf(name) !== -1) return showToast('⚠️ Client existant');
  
  store.clients.push(name);
  
  // Refresh AVANT le save pour que ce soit immédiat
  document.getElementById('newClientName').value = '';
  loadClientSelect();
  loadFilterClients();
  renderAdmin();
  showToast('✅ Client ajouté');
  
  // Save en arrière-plan
  apiSaveAll('clients', store.clients);
}




function deleteClient(c) {
  if (!confirm('Supprimer ' + c + ' ?')) return;
  store.clients = store.clients.filter(function(x) { return x !== c; });
  apiSaveAll('clients', store.clients);
  loadClientSelect();
  loadFilterClients();
  renderAdmin();
  showToast('🗑️ Supprimé');
}

function exportClients() {
  var csv = 'Client\n';
  store.clients.forEach(function(c) { csv += c + '\n'; });
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
      if (c && c !== 'Client' && store.clients.indexOf(c) === -1) {
        store.clients.push(c);
        count++;
      }
    });
    apiSaveAll('clients', store.clients);
    loadClientSelect();
    loadFilterClients();
    renderAdmin();
    showToast('📥 ' + count + ' clients importés');
  };
  reader.readAsText(file);
  event.target.value = '';
}

export {
  openAccessModal,
  closeAccessModal,
  toggleAllAccess,
  updateToggleAllBtn,
  saveAccess,
  getFilteredData,
  renderHistory,
  deleteEntry,
  resetFilters,
  exportExcel,
  renderAdmin,
  addUser,
  deleteUser,
  addClient,
  deleteClient,
  exportClients,
  importClients,
};
