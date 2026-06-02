/**
 * Export Excel index bruts et consommations calculées — Phase 4
 * Index : format import (lignes = compteurs, colonnes = mois).
 * Conso : format ERIA (col. A = dates, ligne 1 = noms compteurs, lignes 2–13 = janv.–déc.).
 */
import { formatPeriodLabel } from './energy-dates.js';
import {
  computeMeterConsumption,
  consumptionForChartMeter,
  getCalendarYearPeriods,
} from './energy-calc.js';

function clientMeters(meters, clientId) {
  return meters
    .filter(function (m) {
      return m.clientId === clientId;
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name, 'fr');
    });
}

function consoForExport(meter, period, readings, meters, generalConsumptions) {
  var c = meter.isGeneral
    ? consumptionForChartMeter(meter, period, readings, meters, generalConsumptions)
    : computeMeterConsumption(meter, period, readings);
  return roundConso(c);
}

function indexForMeter(meterId, period, readings) {
  var r = readings.find(function (x) {
    return x.meterId === meterId && x.period === period;
  });
  return r != null ? Number(r.indexValue) : '';
}

function roundConso(value) {
  if (value == null || isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** 1er du mois au format jj/mm/aaaa (reconnu à l’import ERIA) */
function periodToExcelDate(period) {
  var parts = String(period || '').split('-');
  if (parts.length < 2) return period;
  var y = parts[0];
  var mo = String(parseInt(parts[1], 10)).padStart(2, '0');
  return '01/' + mo + '/' + y;
}

function buildMatrixRows(meters, clientId, periods, readings, mode) {
  var list = clientMeters(meters, clientId);
  var header = ['Nom compteur'];
  periods.forEach(function (p) {
    header.push(formatPeriodLabel(p));
  });

  var rows = [header];
  rows.push(['Date du relevé'].concat(periods));

  list.forEach(function (meter) {
    var row = [meter.name];
    periods.forEach(function (period) {
      if (mode === 'index') {
        row.push(indexForMeter(meter.id, period, readings));
      } else {
        var c = computeMeterConsumption(meter, period, readings);
        row.push(c != null && !isNaN(c) ? roundConso(c) : '');
      }
    });
    rows.push(row);
  });

  return rows;
}

/**
 * Colonne A = dates (1er du mois), ligne 1 = en-têtes compteurs, lignes 2–13 = conso mensuelle.
 */
function buildConsoExportRows(meters, clientId, year, readings, generalConsumptions) {
  var list = clientMeters(meters, clientId);
  var periods = getCalendarYearPeriods(year);
  if (!periods.length) throw new Error('Année invalide');

  var rows = [
    ['Date du relevé'].concat(
      list.map(function (m) {
        return m.name;
      })
    ),
  ];

  periods.forEach(function (period) {
    rows.push(
      [periodToExcelDate(period)].concat(
        list.map(function (meter) {
          return consoForExport(meter, period, readings, meters, generalConsumptions);
        })
      )
    );
  });

  return rows;
}

function downloadWorkbook(rows, filename) {
  var XLSX = window.XLSX;
  if (!XLSX) throw new Error('Bibliothèque XLSX indisponible');

  var ws = XLSX.utils.aoa_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Données');
  XLSX.writeFile(wb, filename);
}

function yearFromPeriod(period) {
  return parseInt(String(period || '').slice(0, 4), 10);
}

export function exportIndexesExcel(clientId, meters, readings, periodAnchor) {
  if (!clientId) throw new Error('Sélectionnez un site');
  var year = yearFromPeriod(periodAnchor);
  var periods = getCalendarYearPeriods(year);
  var rows = buildMatrixRows(meters, clientId, periods, readings, 'index');
  var safeName = clientId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 30);
  downloadWorkbook(rows, 'index_' + safeName + '_' + year + '.xlsx');
}

export function exportConsumptionsExcel(
  clientId,
  meters,
  readings,
  periodAnchor,
  generalConsumptions
) {
  if (!clientId) throw new Error('Sélectionnez un site');
  var year = yearFromPeriod(periodAnchor);
  if (isNaN(year)) throw new Error('Période invalide');
  var rows = buildConsoExportRows(
    meters,
    clientId,
    year,
    readings,
    generalConsumptions || []
  );
  var safeName = clientId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 30);
  downloadWorkbook(rows, 'consommations_' + safeName + '_' + year + '.xlsx');
}
