/**
 * Formulaires événements — Phase 3
 * Validation et soumission (Fait marquant, Information, Astreinte, Sous-traitant)
 */
import { store } from './store.js';
import { apiSaveAll } from './api.js';
import { showToast, goTo } from './ui.js';
import { getUserClients } from './user-access.js';
import { loadAllClientSelects } from './client-selects.js';

/** @param {HTMLElement} el @param {string} type */
export function selectType(el, type) {
  document.querySelectorAll('.type-card').forEach(function (c) {
    c.classList.remove('selected');
  });
  el.classList.add('selected');
  store.currentType = type;
}

export function goToNewEvent() {
  var uc = getUserClients(store.currentUser.id);
  if (uc.length === 0) return showToast('🔒 Aucun client assigné');
  loadAllClientSelects();
  goTo('screen-home');
}

export function goToForm() {
  if (!document.getElementById('client').value) return showToast('⚠️ Choisissez un client');
  if (!store.currentType) return showToast('⚠️ Choisissez un type');
  if (store.currentType === 'Fait marquant') goTo('screen-fait');
  else if (store.currentType === 'Information') goTo('screen-info');
  else if (store.currentType === 'Astreinte') goTo('screen-astreinte');
  else if (store.currentType === 'Sous-traitant') goTo('screen-soustraitant');
}

export function submitEvent() {
  var entry = {
    id: Date.now(),
    user: store.currentUser.id,
    client: document.getElementById('client').value,
    localisation: document.getElementById('localisation').value.trim(),
    type: store.currentType,
    dateDebut: document.getElementById('dateDebut').value,
    dateFin: document.getElementById('dateFin').value,
  };

  if (!entry.dateDebut || !entry.dateFin) return showToast('⚠️ Dates requises');

  if (store.currentType === 'Fait marquant') {
    entry.operations = document.getElementById('fait-operations').value.trim();
    entry.actions = document.getElementById('fait-actions').value.trim();
    entry.commentaire = document.getElementById('fait-commentaire').value.trim();
    entry.impact = document.getElementById('fm-impact').checked ? 'Oui' : 'Non';
    entry.cri = document.getElementById('fm-cri').value.trim();
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  if (store.currentType === 'Information') {
    entry.operations = document.getElementById('info-operations').value.trim();
    entry.actions = document.getElementById('info-actions').value.trim();
    entry.commentaire = document.getElementById('info-commentaire').value.trim();
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  if (store.currentType === 'Astreinte') {
    entry.operations = document.getElementById('astr-operations').value.trim();
    entry.actions = document.getElementById('astr-actions').value.trim();
    entry.commentaire = document.getElementById('astr-commentaire').value.trim();
    entry.impact = document.getElementById('astr-impact').checked ? 'Oui' : 'Non';
    entry.intervenant = document.getElementById('astr-intervenant').value.trim();
    entry.lotTechnique = document.getElementById('astr-lot-technique').value.trim();
    entry.heureAppel = document.getElementById('astr-heure-appel').value;
    entry.heureArrivee = document.getElementById('astr-heure-arrivee').value;
    entry.heureDepart = document.getElementById('astr-heure-depart').value;
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  if (store.currentType === 'Sous-traitant') {
    entry.operations = document.getElementById('st-operations').value.trim();
    entry.actions = document.getElementById('st-actions').value.trim();
    entry.commentaire = document.getElementById('st-commentaire').value.trim();
    entry.societe = document.getElementById('st-societe').value.trim();
    entry.lot = document.getElementById('st-lot').value.trim();
    entry.heureArrivee = document.getElementById('st-heure-arrivee').value;
    entry.heureDepart = document.getElementById('st-heure-depart').value;
    if (!entry.operations) return showToast('⚠️ Opérations requises');
  }

  store.entries.push(entry);
  apiSaveAll('entries', store.entries);
  showToast('✅ Enregistré !');
  goTo('screen-menu');
}
