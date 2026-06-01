/**
 * Tracking sessions utilisateur — Phase 5
 * Couplé au routeur : parcours écran par écran + durée totale.
 */
import { spCreate } from './api.js';
import { getToken } from './auth.js';

export var SCREEN_LABELS = {
  'screen-menu': 'Menu',
  'screen-home': 'Nouvel événement',
  'screen-history': 'Historique',
  'screen-planning': 'Planning présence',
  'screen-planning-sst': 'Planning SST',
  'screen-admin': 'Administration',
  'screen-login-history': 'Historique connexions',
  'screen-fait': 'Fait marquant',
  'screen-info': 'Information',
  'screen-astreinte': 'Astreinte',
  'screen-soustraitant': 'Sous-traitant',
};

var IGNORED_SCREENS = ['screen-loading', 'screen-login'];

/** @type {{ startedAt: string, email: string, role: string, screens: object[], currentScreen: string|null, currentEnteredAt: string|null }|null} */
var session = null;
var flushPromise = null;
var analyticsBound = false;

function getBrowserName() {
  var ua = navigator.userAgent;
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Autre';
}

function getScreenLabel(id) {
  return SCREEN_LABELS[id] || id;
}

function closeCurrentScreen(now) {
  if (!session || !session.currentScreen || !session.currentEnteredAt) return;
  var entered = new Date(session.currentEnteredAt);
  var durationSec = Math.max(0, Math.round((now.getTime() - entered.getTime()) / 1000));
  session.screens.push({
    id: session.currentScreen,
    label: getScreenLabel(session.currentScreen),
    enteredAt: session.currentEnteredAt,
    leftAt: now.toISOString(),
    durationSec: durationSec,
  });
  session.currentScreen = null;
  session.currentEnteredAt = null;
}

function buildParcoursPayload() {
  var summary = {};
  session.screens.forEach(function (s) {
    summary[s.id] = (summary[s.id] || 0) + s.durationSec;
  });
  var tempsTotal = session.screens.reduce(function (acc, s) {
    return acc + s.durationSec;
  }, 0);
  return {
    parcours: { screens: session.screens.slice(), summary: summary },
    tempsTotal: tempsTotal,
  };
}

/** Démarre le suivi après connexion réussie */
export function startAnalyticsSession(user) {
  if (!user || !user.id) return;
  session = {
    startedAt: new Date().toISOString(),
    email: user.id,
    role: user.role || 'user',
    screens: [],
    currentScreen: null,
    currentEnteredAt: null,
  };
  flushPromise = null;
}

/** Appelé par le routeur à chaque changement d'écran */
export function notifyRouteChange(fromId, toId) {
  if (!session) return;
  var now = new Date();
  closeCurrentScreen(now);

  if (!toId || IGNORED_SCREENS.indexOf(toId) !== -1) return;

  session.currentScreen = toId;
  session.currentEnteredAt = now.toISOString();
}

/** Enregistre la session dans GS_LoginHistory (fin de session) */
export function flushSession() {
  if (!session) return Promise.resolve();
  if (flushPromise) return flushPromise;

  flushPromise = (function () {
    closeCurrentScreen(new Date());
    var payload = buildParcoursPayload();
    var fields = {
      Title: session.email,
      DateConnexion: session.startedAt,
      Statut: 'Connecté',
      Navigateur: getBrowserName(),
      TempsTotal: payload.tempsTotal,
      ParcoursJSON: JSON.stringify(payload.parcours),
      Role: session.role,
    };

    session = null;

    return getToken()
      .then(function () {
        return spCreate('loginHistory', fields);
      })
      .catch(function (err) {
        console.error('[analytics] Erreur enregistrement session:', err);
      })
      .finally(function () {
        flushPromise = null;
      });
  })();

  return flushPromise;
}

/** Listeners fin de session (onglet fermé, etc.) */
export function initAnalytics() {
  if (analyticsBound) return;
  analyticsBound = true;

  window.addEventListener('pagehide', function () {
    if (!session) return;
    flushSession();
  });
}
