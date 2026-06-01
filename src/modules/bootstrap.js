/**
 * Démarrage application — auth MSAL + chargement SharePoint
 */
import {
  initAuth,
  handleRedirectPromise,
  setCurrentAccount,
  getActiveAccountFromSession,
} from './auth.js';
import { loadAllData, apiSaveAll } from './api.js';
import { store } from './store.js';
import { goTo, showToast } from './ui.js';
import { startAnalyticsSession } from './analytics.js';

export function startApp() {
  initAuth();

  return handleRedirectPromise()
    .then(function (resp) {
      var account = (resp && resp.account) || getActiveAccountFromSession();
      if (!account) {
        goTo('screen-login');
        return;
      }

      setCurrentAccount(account);
      console.log('✅ Connecté:', account.username);

      return loadAllData()
        .then(function () {
          var email = account.username;
          var u = store.users.find(function (x) {
            return x.id === email;
          });
          if (!u) {
            u = { id: email, role: 'user' };
            store.users.push(u);
            return apiSaveAll('users', store.users).then(function () {
              return u;
            });
          }
          return u;
        })
        .then(function (u) {
          store.currentUser = u;
          startAnalyticsSession(store.currentUser);

          var welcome = document.getElementById('welcomeUser');
          if (welcome) welcome.textContent = store.currentUser.id;

          var adminCard = document.getElementById('menu-admin');
          if (adminCard) {
            adminCard.style.display = store.currentUser.role === 'admin' ? 'block' : 'none';
          }

          goTo('screen-menu');
        })
        .catch(function (err) {
          console.error('❌ Load error:', err);
          showToast('Erreur chargement données');
          goTo('screen-login');
        });
    })
    .catch(function (err) {
      console.error('❌ MSAL error:', err);
      goTo('screen-login');
    });
}
