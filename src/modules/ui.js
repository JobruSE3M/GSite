/**
 * Navigation et utilitaires UI — Phase 3 (délègue au routeur)
 */
import { navigate } from './router.js';

export { showScreen } from './ui-core.js';

export function goTo(id) {
  navigate(id);
}

export function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () {
    t.classList.remove('show');
  }, 2500);
}

export function initUi() {
  document.addEventListener('click', function (e) {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
      document.activeElement.blur();
    }
  });
  goTo('screen-loading');
}
