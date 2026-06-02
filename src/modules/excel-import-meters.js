/**
 * Import Excel matriciel — lignes = compteurs, colonnes = périodes
 */
import { store } from './store.js';
import { parsePeriodFromCell } from './energy-dates.js';
import { getDefaultUnit, deduceEnergyFromText, parseSectionEnergyType } from './energy-constants.js';

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function normalizeLabel(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Lignes purement structurelles (pas compteur, pas section) */
var PURE_SKIP_LABELS = {
  'nom compteur': true,
  'date du releve': true,
  compteur: true,
  meter: true,
};

function isPureSkipRow(name) {
  var n = normalizeLabel(name);
  if (!n) return true;
  return !!PURE_SKIP_LABELS[n];
}

function cellText(cell) {
  if (!cell) return '';
  return String(cell.w != null ? cell.w : cell.v).trim();
}

function parseIndexValue(cell) {
  if (!cell || cell.v === '' || cell.v == null) return null;
  var raw = cell.w != null ? cell.w : cell.v;
  var n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function findMeterByName(clientId, name) {
  var norm = name.trim().toLowerCase();
  return store.meters.find(function (m) {
    return m.clientId === clientId && m.name.trim().toLowerCase() === norm;
  });
}

function makeMeterId(clientId, name) {
  var base = 'meter_' + slugify(clientId) + '_' + slugify(name);
  if (!store.meters.some(function (m) { return m.id === base; })) return base;
  return base + '_' + Date.now().toString(36);
}

/** Ligne Excel 1 = index 0 « Nom compteur », ligne 2 = index 1 « Date du relevé » */
var EXCEL_ROW_NOM_COMPTEUR = 0;
var EXCEL_ROW_DATE_RELEVE = 1;
var EXCEL_ROW_FIRST_DATA = 2;

function collectPeriodColumns(sheet, row, maxCol) {
  var XLSX = window.XLSX;
  var periodCols = [];
  var skippedCols = [];

  for (var c = 1; c <= maxCol; c++) {
    var addr = XLSX.utils.encode_cell({ r: row, c: c });
    var cell = sheet[addr];
    if (!cell) continue;
    var period = parsePeriodFromCell(cell);
    if (period) {
      periodCols.push({ col: c, period: period, label: cellText(cell) });
    } else if (cellText(cell) || cell.v != null) {
      skippedCols.push(addr + ' (« ' + cellText(cell) + ' »)');
    }
  }

  periodCols.skippedLabels = skippedCols;
  return periodCols;
}

/** Repli si la ligne 2 ne contient pas de dates (fichiers anciens / décalés) */
function findDateHeaderRowFallback(sheet, range) {
  var XLSX = window.XLSX;
  var best = null;

  for (var r = 0; r <= Math.min(range.e.r, 15); r++) {
    if (r === EXCEL_ROW_DATE_RELEVE) continue;
    var label = normalizeLabel(cellText(sheet[XLSX.utils.encode_cell({ r: r, c: 0 })]));
    var periodCols = collectPeriodColumns(sheet, r, range.e.c);
    if (!periodCols.length) continue;

    if (label.indexOf('date') !== -1 && label.indexOf('relev') !== -1) {
      return { row: r, periodCols: periodCols, dataStartRow: r + 1 };
    }

    if (!best || periodCols.length > best.periodCols.length) {
      best = { row: r, periodCols: periodCols, dataStartRow: r + 1 };
    }
  }

  return best;
}

/**
 * Layout matriciel standard : A1 nom, ligne 2 = dates (B2, C2…), données dès ligne 3.
 */
function resolveImportLayout(sheet, range) {
  var XLSX = window.XLSX;
  var layoutWarnings = [];
  var periodCols = collectPeriodColumns(sheet, EXCEL_ROW_DATE_RELEVE, range.e.c);

  if (periodCols.length) {
    if (periodCols.skippedLabels && periodCols.skippedLabels.length) {
      layoutWarnings.push(
        'Colonnes ignorées (date non reconnue) : ' +
          periodCols.skippedLabels.slice(0, 8).join(', ') +
          (periodCols.skippedLabels.length > 8 ? '…' : '')
      );
    }
    var labelA2 = cellText(
      sheet[XLSX.utils.encode_cell({ r: EXCEL_ROW_DATE_RELEVE, c: 0 })]
    );
    var n = normalizeLabel(labelA2);
    if (n && n.indexOf('date') === -1 && n.indexOf('relev') === -1) {
      layoutWarnings.push(
        'Ligne 2 : libellé A2 inattendu (« ' +
          labelA2 +
          ' »). Les mois sont lus sur la ligne 2 (colonnes B, C…).'
      );
    }
    return {
      row: EXCEL_ROW_DATE_RELEVE,
      periodCols: periodCols,
      dataStartRow: EXCEL_ROW_FIRST_DATA,
      layoutWarnings: layoutWarnings,
    };
  }

  var fallback = findDateHeaderRowFallback(sheet, range);
  if (fallback) {
    layoutWarnings.push(
      'Dates non trouvées en ligne 2 : détection automatique sur la ligne ' +
        (fallback.row + 1) +
        '.'
    );
    fallback.layoutWarnings = layoutWarnings;
    return fallback;
  }

  return null;
}

/**
 * @param {object} workbook — objet XLSX
 * @param {string} clientId
 * @returns {{ metersToCreate: object[], readings: object[], skipped: number, warnings: string[] }}
 */
export function parseMeterMatrixWorkbook(workbook, clientId) {
  if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
    throw new Error('Classeur Excel vide');
  }
  if (!clientId) throw new Error('Sélectionnez un client avant import');

  var XLSX = window.XLSX;
  if (!XLSX) throw new Error('Bibliothèque XLSX indisponible');

  var sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet['!ref']) throw new Error('Feuille Excel vide');

  var range = XLSX.utils.decode_range(sheet['!ref']);
  var layout = resolveImportLayout(sheet, range);

  if (!layout || !layout.periodCols.length) {
    throw new Error(
      'Aucune colonne de date reconnue en ligne 2 (B2, C2…). ' +
        'Format : A1 « Nom compteur », A2 « Date du relevé », mois en B2→.'
    );
  }

  var periodCols = layout.periodCols;
  var dataStartRow = layout.dataStartRow;

  var metersToCreate = [];
  var readings = [];
  var skipped = 0;
  var warnings = layout.layoutWarnings ? layout.layoutWarnings.slice() : [];
  var userId = store.currentUser ? store.currentUser.id : '';
  var currentSection = null;

  for (var r = dataStartRow; r <= range.e.r; r++) {
    if (r === EXCEL_ROW_NOM_COMPTEUR || r === EXCEL_ROW_DATE_RELEVE) {
      skipped++;
      continue;
    }

    var name = cellText(sheet[XLSX.utils.encode_cell({ r: r, c: 0 })]);
    if (isPureSkipRow(name)) {
      skipped++;
      continue;
    }

    var sectionType = parseSectionEnergyType(name);
    if (sectionType) {
      currentSection = sectionType;
      skipped++;
      continue;
    }

    var meter = findMeterByName(clientId, name);
    if (!meter) {
      var deduced = deduceEnergyFromText(name, currentSection);
      meter = {
        id: makeMeterId(clientId, name),
        clientId: clientId,
        name: name,
        energyType: deduced.energyType,
        unit: deduced.unit,
        parentId: '',
        isGeneral: false,
        linkedMeters: [],
        isDecreasing: false,
      };
      metersToCreate.push(meter);
      store.meters.push(meter);
    }

    periodCols.forEach(function (pc) {
      var valAddr = XLSX.utils.encode_cell({ r: r, c: pc.col });
      var indexValue = parseIndexValue(sheet[valAddr]);
      if (indexValue == null) return;

      readings.push({
        meterId: meter.id,
        period: pc.period,
        indexValue: indexValue,
        userId: userId,
      });
    });
  }

  if (!readings.length) {
    warnings.push('Aucune valeur index trouvée dans le fichier.');
  }

  return {
    metersToCreate: metersToCreate,
    readings: readings,
    skipped: skipped,
    warnings: warnings,
    periodCount: periodCols.length,
  };
}

/** Statistiques import : créations vs mises à jour par période */
export function summarizeImportReadings(readings) {
  var periodMap = {};
  var updates = 0;
  var creates = 0;

  readings.forEach(function (r) {
    periodMap[r.period] = true;
    var exists = store.readings.some(function (x) {
      return x.meterId === r.meterId && x.period === r.period;
    });
    if (exists) updates++;
    else creates++;
  });

  var periodList = Object.keys(periodMap).sort();
  return {
    updates: updates,
    creates: creates,
    periodMin: periodList[0] || '',
    periodMax: periodList[periodList.length - 1] || '',
    periodCount: periodList.length,
    total: readings.length,
  };
}

export function readExcelFile(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var XLSX = window.XLSX;
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array', cellDates: true });
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = function () {
      reject(new Error('Lecture du fichier impossible'));
    };
    reader.readAsArrayBuffer(file);
  });
}
