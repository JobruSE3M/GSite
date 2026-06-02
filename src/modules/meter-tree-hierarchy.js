/**
 * Arborescence : uniquement les compteurs IsGeneral + LinkedMeters
 */
import { metersOfEnergyType } from './meter-accordion.js';
import { ENERGY_TYPES } from './energy-constants.js';
import { getEffectiveLinkedMeterIds } from './energy-calc.js';

export function isMeterTreeParent(meter) {
  return !!meter.isGeneral;
}

function buildTypeContext(meters, clientId, energyType) {
  var ofType = metersOfEnergyType(meters, clientId, energyType);
  var byId = {};
  ofType.forEach(function (m) {
    byId[m.id] = m;
  });

  var linkedChildIds = {};
  ofType.forEach(function (m) {
    if (!m.isGeneral) return;
    getEffectiveLinkedMeterIds(m).forEach(function (id) {
      if (byId[id]) linkedChildIds[id] = true;
    });
  });

  return { byId: byId, linkedChildIds: linkedChildIds, ofType: ofType };
}

/** Compteurs racine : généraux + simples non liés à un général */
export function getTreeRoots(meters, clientId, energyType) {
  var ctx = buildTypeContext(meters, clientId, energyType);
  var roots = ctx.ofType.filter(function (m) {
    return !ctx.linkedChildIds[m.id];
  });

  roots.sort(function (a, b) {
    if (a.isGeneral !== b.isGeneral) return a.isGeneral ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });

  return roots;
}

export function getLinkedSubMeters(meters, clientId, energyType, parentMeter) {
  if (!parentMeter.isGeneral) return [];
  var ctx = buildTypeContext(meters, clientId, energyType);
  return getEffectiveLinkedMeterIds(parentMeter)
    .map(function (id) {
      return ctx.byId[id];
    })
    .filter(Boolean);
}

/** Pôles énergétiques ayant au moins un compteur général sur le site */
export function getEnergyTypesWithGeneral(meters, clientId) {
  var has = {};
  meters
    .filter(function (m) {
      return m.clientId === clientId && m.isGeneral;
    })
    .forEach(function (m) {
      has[m.energyType || 'ELECTRICITE'] = true;
    });
  return ENERGY_TYPES.filter(function (t) {
    return has[t];
  });
}

/**
 * Rendu groupé : général repliable (+) + sous-compteurs liés.
 * @param {function(HTMLElement, object, object): void} renderRow
 */
export function renderMeterTreeInContainer(bodyEl, meters, clientId, energyType, renderRow) {
  getTreeRoots(meters, clientId, energyType).forEach(function (root) {
    if (!root.isGeneral) {
      renderRow(bodyEl, root, { isChild: false, isTreeParent: false });
      return;
    }

    var subs = getLinkedSubMeters(meters, clientId, energyType, root);
    var group = document.createElement('div');
    group.className = 'meter-tree-group meter-tree-group--general';

    if (subs.length) {
      var details = document.createElement('details');
      details.className = 'meter-general-branch';
      details.open = true;

      var summary = document.createElement('summary');
      summary.className = 'meter-general-branch__summary';
      renderRow(summary, root, {
        isChild: false,
        isTreeParent: true,
        isCollapsible: true,
        hasChildren: true,
      });
      details.appendChild(summary);

      var childWrap = document.createElement('div');
      childWrap.className = 'meter-tree-children';
      subs.forEach(function (sub, idx) {
        renderRow(childWrap, sub, {
          isChild: true,
          isLastChild: idx === subs.length - 1,
          isTreeParent: false,
          parentMeter: root,
        });
      });
      details.appendChild(childWrap);
      group.appendChild(details);
    } else {
      renderRow(group, root, { isChild: false, isTreeParent: true, isCollapsible: false });
    }

    bodyEl.appendChild(group);
  });
}
