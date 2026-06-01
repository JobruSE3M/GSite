/**
 * Droits d'accès clients par utilisateur
 */
import { store } from './store.js';

/** @param {string} uid */
export function getUserClients(uid) {
  var user = store.users.find(function (u) {
    return u.id === uid;
  });
  if (user && user.role === 'admin') return store.clients.slice();
  var allowed = store.accessMap[uid];
  if (!allowed || !Array.isArray(allowed)) return [];
  return allowed.filter(function (c) {
    return store.clients.indexOf(c) !== -1;
  });
}
