/**
 * Migre src/legacy/app.js vers src/modules/app.js (Phase 2)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/legacy/app.js'), 'utf8');

const STORE_KEYS = [
  'users',
  'clients',
  'entries',
  'accessMap',
  'planningData',
  'planningSSTData',
  'allLoginHistory',
  'currentUser',
  'currentType',
  'accessEditUser',
  'planningMonth',
  'planningYear',
  'pickerTarget',
  'isDragging',
  'dragEmpIndex',
  'dragStartDay',
  'dragCurrentDay',
  'dragSourceCode',
  'sstYear',
];

let code = source;

// Retirer les déclarations d'état migrées vers store
const stateVarPattern = new RegExp(
  '^var (' + STORE_KEYS.join('|') + ')\\s*=\\s*[^;]+;\\s*\\n',
  'gm'
);
code = code.replace(stateVarPattern, '');

// Retirer trackLogin et initApp (déplacés ailleurs)
code = code.replace(/\n\/\/ ========== INIT ==========[\s\S]*$/m, '');

// Retirer le listener blur (déplacé dans ui.initUi)
code = code.replace(
  /document\.addEventListener\('click', function\(e\) \{[\s\S]*?\}\);\s*\n/,
  ''
);

// codePicker : exécuté après montage DOM (Phase 2)
code = code.replace(
  /document\.getElementById\('codePicker'\)\.addEventListener\('click', function\(e\) \{[\s\S]*?\}\);\s*\n/,
  `/** Listeners DOM — appelé après montage du shell */
function initAppDomListeners() {
  var picker = document.getElementById('codePicker');
  if (picker && !picker.dataset.bound) {
    picker.dataset.bound = '1';
    picker.addEventListener('click', function (e) {
      if (e.target === this) {
        this.classList.remove('active');
        store.pickerTarget = null;
      }
    });
  }
}

`
);

const header = `/**
 * Logique métier application — Phase 2 (module ES6)
 */
import { store } from './store.js';
import { apiSaveAll, spCreate, spGetItems, apiGet } from './api.js';
import { showScreen, showToast, goTo } from './ui.js';

`;

// Renommer les variables locales qui entrent en conflit avec le store
code = code.replace(/var clients = getUserClients/g, 'var uc = getUserClients');

// Remplacer les accès état par store.* (sauf déclarations locales)
for (const key of STORE_KEYS) {
  const re = new RegExp('(?<!(var |let |const ))\\b' + key + '\\b', 'g');
  code = code.replace(re, 'store.' + key);
}

// Corriger les clés SharePoint écrasées dans les chaînes ('entries' → 'store.entries')
code = code.replace(/\.download = 'store\.clients\.csv'/g, ".download = 'clients.csv'");
code = code.replace(/apiSaveAll\('store\.(\w+)'/g, "apiSaveAll('$1'");
code = code.replace(/apiGet\('store\.(\w+)'/g, "apiGet('$1'");
code = code.replace(/apiGet\('store\.(\w+)'/g, "apiGet('$1'");
// Corriger double store.store.
code = code.replace(/store\.store\./g, 'store.');

// Exporter toutes les fonctions déclarées
const fnNames = [...code.matchAll(/^function (\w+)\s*\(/gm)].map((m) => m[1]);
const exportBlock =
  '\n\nexport {\n  ' +
  fnNames.join(',\n  ') +
  '\n};\n';

code = header + code.trim() + exportBlock;

fs.mkdirSync(path.join(root, 'src/modules'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/modules/app.js'), code);
console.log('app.js migré —', fnNames.length, 'fonctions exportées');
