/**
 * Registre des routes et hooks onEnter — Phase 5
 */
import { registerRoute } from './router.js';
import * as app from './app.js';
import { loadFilterClients, loadPlanningClients } from './client-selects.js';
import * as planningPresence from './planning-presence.js';
import * as planningSst from './planning-sst.js';
import * as loginDashboard from './login-dashboard.js';

/** Configure toutes les routes métier (appelé au boot) */
export function setupRoutes() {
  registerRoute('screen-history', function () {
    loadFilterClients();
    app.renderHistory();
  });

  registerRoute('screen-admin', function () {
    app.renderAdmin();
  });

  registerRoute('screen-planning', function () {
    loadPlanningClients();
    planningPresence.renderPlanning();
  });

  registerRoute('screen-menu', function () {
    planningPresence.renderTodayWidget();
    planningSst.renderSSTWidget();
  });

  registerRoute('screen-planning-sst', function () {
    planningSst.initScreenSST();
  });

  registerRoute('screen-login-history', function () {
    loginDashboard.loadLoginHistory();
  });

  [
    'screen-loading',
    'screen-login',
    'screen-home',
    'screen-fait',
    'screen-info',
    'screen-astreinte',
    'screen-soustraitant',
  ].forEach(function (id) {
    registerRoute(id);
  });
}
