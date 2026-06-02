/**
 * Analyse ligne 2 d'un import matriciel — calibration dates
 * Usage: node scripts/analyze-excel-dates.mjs "chemin/fichier.xlsx"
 */
import XLSX from 'xlsx-js-style';
import { readFileSync } from 'fs';
import { parsePeriodFromCell } from '../src/modules/energy-dates.js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/analyze-excel-dates.mjs <fichier.xlsx>');
  process.exit(1);
}

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

const DATE_ROW = 1;

function cellInfo(addr) {
  const cell = sheet[addr];
  if (!cell) return null;
  const period = parsePeriodFromCell(cell);
  return {
    addr,
    t: cell.t,
    v: cell.v,
    w: cell.w,
    period,
    vType: cell.v instanceof Date ? 'Date' : typeof cell.v,
  };
}

console.log('Fichier:', filePath);
console.log('Feuille:', sheetName);
console.log('Plage:', sheet['!ref']);
console.log('\n--- Ligne 2 (index 1) — en-têtes dates ---\n');

const rows = [];
for (let c = 0; c <= Math.min(range.e.c, 40); c++) {
  const addr = XLSX.utils.encode_cell({ r: DATE_ROW, c });
  const info = cellInfo(addr);
  if (!info && c > 1) continue;
  rows.push(info || { addr, t: '-', v: '', w: '', period: null });
}

console.table(
  rows.map((r) => ({
    cellule: r.addr,
    type: r.t,
    valeur: r.v instanceof Date ? r.v.toISOString() : r.v,
    affichage: r.w || '',
    periode_app: r.period || '(ignorée)',
  }))
);

const ok = rows.filter((r) => r.period).length;
const fail = rows.filter((r) => r.c >= 1 && !r.period).length;
console.log('\nColonnes B+ reconnues:', ok, '| ignorées (échantillon):', fail);

console.log('\n--- Ligne 1 (A1) ---');
console.log(cellInfo(XLSX.utils.encode_cell({ r: 0, c: 0 })));

console.log('\n--- Première ligne données (ligne 3) ---');
for (let c = 0; c <= 5; c++) {
  const addr = XLSX.utils.encode_cell({ r: 2, c });
  const cell = sheet[addr];
  if (cell) console.log(addr, cell.w ?? cell.v, 't=' + cell.t);
}
