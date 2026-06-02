/**
 * Arborescence compteurs par pôle énergétique — accordéons <details>/<summary>
 */
import { clearElement, createTextEl } from './dom.js';
import {
  ENERGY_TYPES,
  ENERGY_TYPE_LABELS,
  ENERGY_TYPE_ICONS,
} from './energy-constants.js';

export function metersOfEnergyType(meters, clientId, energyType) {
  return meters.filter(function (m) {
    return m.clientId === clientId && (m.energyType || 'ELECTRICITE') === energyType;
  });
}

/** Racines dont le parent n'est pas dans le même pôle (ou pas de parent) */
export function rootsWithinEnergyType(meters, clientId, energyType) {
  var ofType = metersOfEnergyType(meters, clientId, energyType);
  var ids = {};
  ofType.forEach(function (m) {
    ids[m.id] = true;
  });
  return ofType.filter(function (m) {
    return !m.parentId || !ids[m.parentId];
  });
}

/** Mémorise les pôles dont l'accordéon est ouvert (avant re-rendu) */
export function captureOpenAccordionTypes(container) {
  var open = {};
  if (!container) return open;
  container.querySelectorAll('details.energy-accordion[open]').forEach(function (d) {
    if (d.dataset.energyType) open[d.dataset.energyType] = true;
  });
  return open;
}

/**
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {string} opts.clientId
 * @param {object[]} opts.meters
 * @param {function(HTMLElement, string): void} opts.renderTypeBody — corps d'un accordéon (type, bodyEl)
 * @param {string} [opts.emptyMessage]
 * @param {boolean} [opts.openFirst=true] — ouvre le premier bloc non vide si aucun openTypes
 * @param {Record<string, boolean>} [opts.openTypes] — pôles à laisser dépliés
 */
export function renderEnergyAccordions(container, opts) {
  clearElement(container);
  opts = opts || {};

  if (!opts.clientId) {
    container.appendChild(
      createTextEl('p', opts.noClientMessage || 'Sélectionnez un client.', 'meter-empty')
    );
    return;
  }

  var any = false;
  var opened = false;
  var openTypes = opts.openTypes || {};
  var hasOpenPreference = Object.keys(openTypes).some(function (k) {
    return openTypes[k];
  });

  ENERGY_TYPES.forEach(function (energyType) {
    var list = metersOfEnergyType(opts.meters, opts.clientId, energyType);
    if (!list.length) return;
    any = true;

    var details = document.createElement('details');
    details.className = 'energy-accordion';
    details.dataset.energyType = energyType;

    if (openTypes[energyType]) {
      details.open = true;
      opened = true;
    } else if (!hasOpenPreference && opts.openFirst !== false && !opened) {
      details.open = true;
      opened = true;
    }

    var summary = document.createElement('summary');
    summary.className = 'energy-accordion__summary';

    var icon = document.createElement('span');
    icon.className = 'energy-accordion__icon';
    icon.textContent = ENERGY_TYPE_ICONS[energyType] || '⚡';
    icon.setAttribute('aria-hidden', 'true');

    var title = document.createElement('span');
    title.className = 'energy-accordion__title';
    title.textContent = ENERGY_TYPE_LABELS[energyType] || energyType;

    var count = document.createElement('span');
    count.className = 'energy-accordion__count';
    count.textContent =
      list.length + ' compteur' + (list.length > 1 ? 's' : '');

    summary.appendChild(icon);
    summary.appendChild(title);
    summary.appendChild(count);
    details.appendChild(summary);

    var body = document.createElement('div');
    body.className = 'energy-accordion__body';
    if (opts.renderTypeBody) opts.renderTypeBody(body, energyType);
    details.appendChild(body);
    container.appendChild(details);
  });

  if (!any) {
    container.appendChild(
      createTextEl('p', opts.emptyMessage || 'Aucun compteur pour ce site.', 'meter-empty')
    );
  }
}
