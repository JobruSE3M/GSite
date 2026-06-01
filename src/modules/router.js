/**
 * Routeur SPA — Phase 3
 * Remplace la logique dispersée dans goTo() par un registre centralisé.
 */
import { showScreen } from './ui-core.js';
import { notifyRouteChange } from './analytics.js';

/** @type {Record<string, { onEnter?: () => void, onLeave?: () => void }>} */
const routes = {};

let currentRoute = null;

/**
 * Enregistre les hooks d'un écran
 * @param {string} id - ex. 'screen-menu'
 * @param {() => void} [onEnter]
 * @param {() => void} [onLeave]
 */
export function registerRoute(id, onEnter, onLeave) {
  routes[id] = { onEnter: onEnter || null, onLeave: onLeave || null };
}

/** @returns {string|null} */
export function getCurrentRoute() {
  return currentRoute;
}

/**
 * Navigue vers un écran
 * @param {string} id
 */
export function navigate(id) {
  if (!id) {
    console.warn('[router] id vide');
    return;
  }

  var prev = currentRoute;
  if (prev && routes[prev] && routes[prev].onLeave) {
    routes[prev].onLeave();
  }

  notifyRouteChange(prev, id);

  showScreen(id);

  if (routes[id] && routes[id].onEnter) {
    routes[id].onEnter();
  }

  currentRoute = id;

  if (import.meta.env.DEV) {
    console.debug('[router]', prev || '(boot)', '→', id);
  }
}
