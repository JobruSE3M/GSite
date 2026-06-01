/**
 * Constantes planning présence — Phase 4
 */
export var MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
export var JOURS_COURTS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
export var CODES = {
  '0': { label: '0 — Présent', color: '#3498db', text: '#fff' },
  '1': { label: '1 — 10H-18H', color: '#5dade2', text: '#fff' },
  '2': { label: '2 — 8H-16H', color: '#2e86c1', text: '#fff' },
  '3': { label: '3 — 12H-20H', color: '#1a5276', text: '#fff' },
  '4': { label: '4 — 09H-17H', color: '#5dade2', text: '#fff' },
  '5': { label: '5 — 15H-22H', color: '#1a5276', text: '#fff' },
  '6': { label: '6 — 07H-15H', color: '#1a5276', text: '#fff' },
  '7': { label: '7 — 11H-19H', color: '#1a5276', text: '#fff' },
  '8': { label: '8 — 08H-12H', color: '#2e86c1', text: '#fff' },
  '9': { label: '9 — 08H-10H', color: '#2e86c1', text: '#fff' },
  '10': { label: '10 — Formation', color: '#f1c40f', text: '#333' },
  '20': { label: '20 — Congés', color: '#e67e22', text: '#333' },
  '30': { label: '30 — Maladie', color: '#27ae60', text: '#333' },
  '40': { label: '40 — Repos', color: '#bdc3c7', text: '#333' },
};
export var PRESENT_CODES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export var ABSENT_CODES = ['20', '30', '40', '10'];
