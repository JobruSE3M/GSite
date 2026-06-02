/**
 * Registre des routes et hooks onEnter — Phase 5
 */
import { registerRoute } from './router.js';
import * as app from './app.js';
import { loadFilterClients, loadPlanningClients } from './client-selects.js';
import * as planningPresence from './planning-presence.js';
import * as planningSst from './planning-sst.js';
import * as loginDashboard from './login-dashboard.js';
import * as adminMeters from './admin-meters.js';
import * as meterReading from './meter-reading.js';
import * as meterConsumption from './meter-consumption.js';

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

  registerRoute('screen-admin-meters', function () {
    adminMeters.loadAdminMetersScreen();
  });

  registerRoute('screen-meter-reading', function () {
    meterReading.loadMeterReadingScreen();
  });

  registerRoute(
    'screen-meter-consumption',
    function () {
      meterConsumption.loadMeterConsumptionScreen();
    },
    meterConsumption.destroyMeterConsumptionCharts
  );

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
