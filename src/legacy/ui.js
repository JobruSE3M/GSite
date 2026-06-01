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
