/**
 * Authentification MSAL v2 — Phase 2
 */
import { PublicClientApplication } from '@azure/msal-browser';
import { GRAPH_CONFIG, GRAPH_SCOPES } from '../config/graph.js';

let msalInstance = null;
let currentAccount = null;

export function initAuth() {
  if (msalInstance) return msalInstance;

  msalInstance = new PublicClientApplication({
    auth: {
      clientId: GRAPH_CONFIG.clientId,
      authority: 'https://login.microsoftonline.com/' + GRAPH_CONFIG.tenantId,
      redirectUri: window.location.origin + window.location.pathname,
    },
    cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
  });

  return msalInstance;
}

export function getMsalInstance() {
  if (!msalInstance) initAuth();
  return msalInstance;
}

export function getCurrentAccount() {
  return currentAccount;
}

export function setCurrentAccount(account) {
  currentAccount = account;
  if (account && msalInstance) {
    msalInstance.setActiveAccount(account);
  }
}

export function doLogin() {
  getMsalInstance().loginRedirect({ scopes: GRAPH_SCOPES });
}

export function doLogout() {
  getMsalInstance().logoutRedirect();
}

export function getToken() {
  const req = { scopes: GRAPH_SCOPES, account: currentAccount };
  return getMsalInstance()
    .acquireTokenSilent(req)
    .catch(function () {
      return getMsalInstance().acquireTokenRedirect(req);
    });
}

/** @returns {Promise<import('@azure/msal-browser').AuthenticationResult|null>} */
export function handleRedirectPromise() {
  return getMsalInstance().handleRedirectPromise();
}

export function getActiveAccountFromSession() {
  const instance = getMsalInstance();
  return instance.getAllAccounts()[0] || null;
}
