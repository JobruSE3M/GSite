/**
 * Remplissage des listes clients — Phase 3
 */
import { store } from './store.js';
import { getUserClients } from './user-access.js';
import { fillSelect } from './dom.js';

export function loadAllClientSelects() {
  var uc = getUserClients(store.currentUser.id);

  fillSelect(document.getElementById('client'), uc, { placeholder: '-- Choisir --' });
  fillSelect(document.getElementById('planningClientSelect'), uc, {
    placeholder: '-- Choisir un client --',
    useValue: true,
  });
  fillSelect(document.getElementById('filterClient'), uc, {
    placeholder: 'Tous les clients',
  });
  fillSelect(document.getElementById('sstClientSelect'), uc, {
    placeholder: '-- Choisir un client --',
    useValue: true,
  });
}

export function loadClientSelect() {
  var uc = getUserClients(store.currentUser.id);
  fillSelect(document.getElementById('client'), uc, { placeholder: '-- Choisir --' });
}

export function loadFilterClients() {
  var uc = getUserClients(store.currentUser.id);
  fillSelect(document.getElementById('filterClient'), uc, {
    placeholder: 'Tous les clients',
  });
}

export function loadPlanningClients() {
  var uc = getUserClients(store.currentUser.id);
  fillSelect(document.getElementById('planningClientSelect'), uc, {
    placeholder: '-- Choisir un client --',
    useValue: true,
  });
}
