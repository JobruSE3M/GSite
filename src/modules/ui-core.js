/** Affichage des écrans (.screen) */
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) {
    s.classList.remove('active');
  });
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  else console.warn('⚠️ Écran introuvable :', id);
}
