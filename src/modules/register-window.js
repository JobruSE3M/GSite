/**
 * Pont onclick HTML — Phase 5
 */
import { doLogin, doLogout as msalLogout } from './auth.js';
import { goTo, showToast } from './ui.js';
import { setupRoutes } from './routes.js';
import { getUserClients } from './user-access.js';
import { flushSession, initAnalytics } from './analytics.js';
import * as app from './app.js';
import * as forms from './forms.js';
import * as clientSelects from './client-selects.js';
import * as planningPresence from './planning-presence.js';
import * as planningSst from './planning-sst.js';
import * as loginDashboard from './login-dashboard.js';
import * as adminMeters from './admin-meters.js';
import * as meterReading from './meter-reading.js';
import * as meterConsumption from './meter-consumption.js';

function exposeModuleExports(moduleExports) {
  Object.entries(moduleExports).forEach(function ([name, fn]) {
    if (typeof fn === 'function') {
      window[name] = fn;
    }
  });
}

export function registerWindowHandlers() {
  setupRoutes();
  initAnalytics();

  window.doLogin = doLogin;
  window.doLogout = function () {
    flushSession().finally(function () {
      msalLogout();
    });
  };
  window.goTo = goTo;
  window.showToast = showToast;
  window.getUserClients = getUserClients;

  exposeModuleExports(app);
  exposeModuleExports(forms);
  exposeModuleExports(clientSelects);
  exposeModuleExports(planningPresence);
  exposeModuleExports(planningSst);
  exposeModuleExports(loginDashboard);
  exposeModuleExports(adminMeters);
  exposeModuleExports(meterReading);
  exposeModuleExports(meterConsumption);

  planningPresence.initPlanningDomListeners();
}
