/** Types d'énergie et unités — module Énergie Phase 2 */

export var ENERGY_TYPES = [
  'ELECTRICITE',
  'GAZ',
  'CHALEUR/FROID',
  'EAU FROIDE',
  'EAU INCENDIE',
  'ECS',
  'FIOUL/GNR',
];

export var UNITS = ['kWh', 'm³', 'MWh', 'Litres', 'kVArh'];

export var DEFAULT_UNIT_BY_TYPE = {
  ELECTRICITE: 'kWh',
  GAZ: 'm³',
  'CHALEUR/FROID': 'MWh',
  'EAU FROIDE': 'm³',
  'EAU INCENDIE': 'm³',
  ECS: 'm³',
  'FIOUL/GNR': 'Litres',
};

export var UNITS_BY_TYPE = {
  ELECTRICITE: ['kWh', 'kVArh'],
  GAZ: ['m³'],
  'CHALEUR/FROID': ['MWh', 'kWh'],
  'EAU FROIDE': ['m³'],
  'EAU INCENDIE': ['m³'],
  ECS: ['m³'],
  'FIOUL/GNR': ['Litres'],
};

export function getUnitsForType(energyType) {
  return UNITS_BY_TYPE[energyType] || UNITS.slice();
}

export function getDefaultUnit(energyType) {
  return DEFAULT_UNIT_BY_TYPE[energyType] || 'kWh';
}

export var ENERGY_TYPE_LABELS = {
  ELECTRICITE: 'Électricité',
  GAZ: 'Gaz',
  'CHALEUR/FROID': 'Chaleur / Froid',
  'EAU FROIDE': 'Eau froide',
  'EAU INCENDIE': 'Eau incendie',
  ECS: 'ECS',
  'FIOUL/GNR': 'Fioul / GNR',
};

export var ENERGY_TYPE_ICONS = {
  ELECTRICITE: '⚡',
  GAZ: '🔥',
  'CHALEUR/FROID': '♨️',
  'EAU FROIDE': '💧',
  'EAU INCENDIE': '🧯',
  ECS: '🚿',
  'FIOUL/GNR': '⛽',
};

export var ENERGY_CHART_COLORS = {
  ELECTRICITE: '#FFC107',
  GAZ: '#FF5722',
  'CHALEUR/FROID': '#E91E63',
  'EAU FROIDE': '#2196F3',
  'EAU INCENDIE': '#C62828',
  ECS: '#9C27B0',
  'FIOUL/GNR': '#795548',
};

/** Variante plus claire (courbe N-1) */
export function lightenEnergyColor(hex, mix) {
  mix = mix == null ? 0.55 : mix;
  if (!hex || hex.charAt(0) !== '#') return hex;
  var num = parseInt(hex.slice(1), 16);
  if (isNaN(num)) return hex;
  var r = (num >> 16) & 255;
  var g = (num >> 8) & 255;
  var b = num & 255;
  r = Math.round(r + (255 - r) * mix);
  g = Math.round(g + (255 - g) * mix);
  b = Math.round(b + (255 - b) * mix);
  return (
    '#' +
    [r, g, b]
      .map(function (c) {
        return c.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

export function normalizeSemanticText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Déduit type + unité depuis un libellé (import Excel, insensible casse/accents).
 * @param {string} text
 * @param {string|null} sectionType — contexte section courante (ELECTRICITE, GAZ…)
 */
export function deduceEnergyFromText(text, sectionType) {
  var n = normalizeSemanticText(text);

  if (n.indexOf('electricite') !== -1 || n.indexOf('electric') !== -1) {
    return { energyType: 'ELECTRICITE', unit: 'kWh' };
  }
  if (/\bgaz\b/.test(n) || n.indexOf('gaz ') === 0) {
    return { energyType: 'GAZ', unit: 'm³' };
  }
  if (n.indexOf('incendie') !== -1) {
    return { energyType: 'EAU INCENDIE', unit: 'm³' };
  }
  if (n.indexOf('ecs') !== -1) {
    return { energyType: 'ECS', unit: 'm³' };
  }
  if (n.indexOf('eau froide') !== -1 || n === 'eau') {
    return { energyType: 'EAU FROIDE', unit: 'm³' };
  }
  if (n.indexOf('eau') !== -1) {
    return { energyType: 'EAU FROIDE', unit: 'm³' };
  }
  if (n.indexOf('chaleur') !== -1 || n.indexOf('froid') !== -1) {
    return { energyType: 'CHALEUR/FROID', unit: getDefaultUnit('CHALEUR/FROID') };
  }
  if (n.indexOf('fioul') !== -1 || n.indexOf('gnr') !== -1) {
    return { energyType: 'FIOUL/GNR', unit: 'Litres' };
  }

  if (sectionType) {
    return { energyType: sectionType, unit: getDefaultUnit(sectionType) };
  }
  return { energyType: 'ELECTRICITE', unit: 'kWh' };
}

/** Ligne repère de section Excel → type d'énergie (null si compteur réel) */
export function parseSectionEnergyType(label) {
  var n = normalizeSemanticText(label);
  if (!n) return null;

  var exact = {
    electricite: 'ELECTRICITE',
    energie: 'ELECTRICITE',
    gaz: 'GAZ',
    eau: 'EAU FROIDE',
    'eau froide': 'EAU FROIDE',
    'eau incendie': 'EAU INCENDIE',
    incendie: 'EAU INCENDIE',
    ecs: 'ECS',
    'chaleur/froid': 'CHALEUR/FROID',
    'chaleur froid': 'CHALEUR/FROID',
    'fioul/gnr': 'FIOUL/GNR',
    fioul: 'FIOUL/GNR',
    gnr: 'FIOUL/GNR',
  };
  if (exact[n]) return exact[n];

  if (n.indexOf('electric') !== -1) return 'ELECTRICITE';
  if (n.indexOf('gaz') !== -1) return 'GAZ';
  if (n.indexOf('incendie') !== -1) return 'EAU INCENDIE';
  if (n.indexOf('ecs') !== -1) return 'ECS';
  if (n.indexOf('eau') !== -1) return 'EAU FROIDE';
  if (n.indexOf('chaleur') !== -1 || n.indexOf('froid') !== -1) return 'CHALEUR/FROID';
  if (n.indexOf('fioul') !== -1 || n.indexOf('gnr') !== -1) return 'FIOUL/GNR';

  return null;
}
