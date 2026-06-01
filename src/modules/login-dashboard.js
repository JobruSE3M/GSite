/**
 * Dashboard historique connexions — Phase 5
 * Onglets Utilisateurs / Admins / Total + graphiques Chart.js
 */
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController } from 'chart.js';
import { spGetItems } from './api.js';
import { store } from './store.js';
import { SCREEN_LABELS } from './analytics.js';
import { clearElement, appendTableEmptyRow, createTextEl } from './dom.js';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController);

var activeTab = 'users';
var pagesChart = null;
var durationChart = null;
var tabsBound = false;

function parseLoginItem(fields) {
  var parcours = null;
  try {
    parcours = JSON.parse(fields.ParcoursJSON || '{}');
  } catch (e) {
    parcours = null;
  }
  return {
    email: fields.Title || '',
    dateConnexion: fields.DateConnexion || '',
    statut: fields.Statut || '',
    navigateur: fields.Navigateur || '',
    tempsTotal: Number(fields.TempsTotal) || 0,
    parcours: parcours,
    role: fields.Role || 'user',
  };
}

function formatDuration(totalSec) {
  if (!totalSec) return '-';
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'min';
  if (m > 0) return m + 'min ' + String(s).padStart(2, '0') + 's';
  return s + 's';
}

function formatDateTime24(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  return (
    d.toLocaleDateString('fr-FR') +
    ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}

function filterByTab(items, tab) {
  if (tab === 'admins') {
    return items.filter(function (l) {
      return l.role === 'admin';
    });
  }
  if (tab === 'users') {
    return items.filter(function (l) {
      return l.role !== 'admin';
    });
  }
  return items.slice();
}

function getSearchFiltered(items) {
  var search = (document.getElementById('lh-search').value || '').toLowerCase();
  var from = document.getElementById('lh-from').value;
  var to = document.getElementById('lh-to').value;

  return items.filter(function (l) {
    if (search && !l.email.toLowerCase().includes(search)) return false;
    if (from && new Date(l.dateConnexion) < new Date(from)) return false;
    if (to && new Date(l.dateConnexion) > new Date(to + 'T23:59:59')) return false;
    return true;
  });
}

function destroyCharts() {
  if (pagesChart) {
    pagesChart.destroy();
    pagesChart = null;
  }
  if (durationChart) {
    durationChart.destroy();
    durationChart = null;
  }
}

function renderCharts(items) {
  destroyCharts();

  var pagesCanvas = document.getElementById('chart-pages');
  var durationCanvas = document.getElementById('chart-duration');
  if (!pagesCanvas || !durationCanvas) return;

  var pageTotals = {};
  items.forEach(function (l) {
    if (!l.parcours || !l.parcours.summary) return;
    Object.keys(l.parcours.summary).forEach(function (id) {
      pageTotals[id] = (pageTotals[id] || 0) + l.parcours.summary[id];
    });
  });

  var pageIds = Object.keys(pageTotals).sort(function (a, b) {
    return pageTotals[b] - pageTotals[a];
  });
  var pageLabels = pageIds.map(function (id) {
    return SCREEN_LABELS[id] || id;
  });
  var pageValues = pageIds.map(function (id) {
    return pageTotals[id];
  });

  if (pageIds.length === 0) {
    pageLabels.push('Aucune donnée');
    pageValues.push(1);
  }

  pagesChart = new Chart(pagesCanvas, {
    type: 'doughnut',
    data: {
      labels: pageLabels,
      datasets: [
        {
          data: pageValues,
          backgroundColor: ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#795548', '#607D8B', '#E91E63'],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        title: { display: true, text: 'Pages les plus consultées (temps cumulé)' },
      },
    },
  });

  var byUser = {};
  items.forEach(function (l) {
    if (!byUser[l.email]) byUser[l.email] = { total: 0, count: 0 };
    byUser[l.email].total += l.tempsTotal || 0;
    byUser[l.email].count += 1;
  });

  var userStats = Object.keys(byUser)
    .map(function (email) {
      return {
        email: email,
        avg: Math.round(byUser[email].total / byUser[email].count),
      };
    })
    .sort(function (a, b) {
      return b.avg - a.avg;
    })
    .slice(0, 8);

  var userLabels = userStats.length
    ? userStats.map(function (u) {
        return u.email.split('@')[0];
      })
    : ['Aucune donnée'];
  var userAvgs = userStats.length
    ? userStats.map(function (u) {
        return u.avg;
      })
    : [0];

  durationChart = new Chart(durationCanvas, {
    type: 'bar',
    data: {
      labels: userLabels,
      datasets: [
        {
          label: 'Durée moyenne (secondes)',
          data: userAvgs,
          backgroundColor: '#2196F3',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Temps moyen par session (top utilisateurs)' },
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Secondes' } },
      },
    },
  });
}

export function setLoginHistoryTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.lh-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  refreshLoginHistoryView();
}

function bindTabButtons() {
  if (tabsBound) return;
  tabsBound = true;
  document.querySelectorAll('.lh-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setLoginHistoryTab(btn.dataset.tab);
    });
  });
}

export function computeLoginStats() {
  var tabItems = filterByTab(store.allLoginHistory, activeTab);
  var total = tabItems.length;
  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);
  var today = tabItems.filter(function (l) {
    return l.dateConnexion && l.dateConnexion.slice(0, 10) === todayStr;
  }).length;
  var weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  var week = tabItems.filter(function (l) {
    return new Date(l.dateConnexion) >= weekAgo;
  }).length;
  var uniques = new Set(tabItems.map(function (l) {
    return l.email;
  })).size;

  if (!document.getElementById('stat-total')) return;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-today').textContent = today;
  document.getElementById('stat-week').textContent = week;
  document.getElementById('stat-unique').textContent = uniques;

  var counts = {};
  tabItems.forEach(function (l) {
    counts[l.email] = (counts[l.email] || 0) + 1;
  });
  var top = Object.keys(counts)
    .map(function (e) {
      return { email: e, count: counts[e] };
    })
    .sort(function (a, b) {
      return b.count - a.count;
    })
    .slice(0, 5);

  var topBox = document.getElementById('stat-top-users');
  clearElement(topBox);

  if (top.length === 0) {
    var empty = createTextEl('p', 'Aucune donnée');
    empty.style.color = '#aaa';
    empty.style.fontSize = '12px';
    topBox.appendChild(empty);
  } else {
    var medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    top.forEach(function (t, idx) {
      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.padding = '6px 0';
      row.style.borderBottom = '1px solid #f0f0f0';
      row.style.fontSize = '13px';
      row.appendChild(createTextEl('span', medals[idx] + ' ' + t.email));
      var count = createTextEl('span', String(t.count));
      count.style.fontWeight = '700';
      count.style.color = '#2196F3';
      row.appendChild(count);
      topBox.appendChild(row);
    });
  }

  renderCharts(tabItems);
}

export function renderLoginHistory() {
  var tabItems = filterByTab(store.allLoginHistory, activeTab);
  var filtered = getSearchFiltered(tabItems);
  var tbody = document.getElementById('login-history-tbody');
  clearElement(tbody);

  if (!filtered.length) {
    appendTableEmptyRow(tbody, 5, 'Aucun résultat');
    return;
  }

  filtered.forEach(function (l) {
    var tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f0f0f0';

    var tdEmail = document.createElement('td');
    tdEmail.style.padding = '10px';
    tdEmail.style.fontSize = '12px';
    tdEmail.textContent = l.email;

    var tdDate = document.createElement('td');
    tdDate.style.padding = '10px';
    tdDate.style.fontSize = '12px';
    tdDate.textContent = formatDateTime24(l.dateConnexion);

    var tdDuration = document.createElement('td');
    tdDuration.style.padding = '10px';
    tdDuration.style.fontSize = '12px';
    tdDuration.textContent = formatDuration(l.tempsTotal);

    var tdRole = document.createElement('td');
    tdRole.style.padding = '10px';
    tdRole.style.fontSize = '12px';
    tdRole.textContent = l.role === 'admin' ? 'Admin' : 'Utilisateur';

    var tdNav = document.createElement('td');
    tdNav.style.padding = '10px';
    tdNav.style.fontSize = '12px';
    tdNav.style.color = '#999';
    tdNav.textContent = l.navigateur || '-';

    tr.appendChild(tdEmail);
    tr.appendChild(tdDate);
    tr.appendChild(tdDuration);
    tr.appendChild(tdRole);
    tr.appendChild(tdNav);
    tbody.appendChild(tr);
  });
}

export function loadLoginHistory() {
  return spGetItems('loginHistory')
    .then(function (items) {
      store.allLoginHistory = items.map(function (i) {
        return parseLoginItem(i.fields);
      });

      store.allLoginHistory.sort(function (a, b) {
        return new Date(b.dateConnexion) - new Date(a.dateConnexion);
      });

      var ecran = document.getElementById('screen-login-history');
      if (ecran && ecran.style.display !== 'none') {
        refreshLoginHistoryView();
      }
    })
    .catch(function (e) {
      console.error('Erreur chargement loginHistory:', e);
    });
}

export function refreshLoginHistoryView() {
  bindTabButtons();
  computeLoginStats();
  renderLoginHistory();
}

export function exportLoginHistory() {
  var tabItems = filterByTab(store.allLoginHistory, activeTab);
  var csv = 'Email,Date,Statut,Role,TempsTotal(s),Navigateur\n';
  tabItems.forEach(function (l) {
    var date = l.dateConnexion ? formatDateTime24(l.dateConnexion) : '';
    csv +=
      '"' +
      l.email +
      '","' +
      date +
      '","' +
      l.statut +
      '","' +
      l.role +
      '","' +
      (l.tempsTotal || 0) +
      '","' +
      l.navigateur +
      '"\n';
  });
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'LoginHistory_' + activeTab + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
}
