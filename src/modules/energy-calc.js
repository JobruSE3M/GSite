/**
 * Calculs consommation énergie — partagé ronde / dashboard / exports
 */
import { toPeriodISO } from './energy-dates.js';

export function getPreviousPeriod(period) {
  if (!period) return '';
  var parts = period.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return '';
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return toPeriodISO(y, m);
}

export function periodFromMonthInput(monthValue) {
  if (!monthValue) return '';
  if (/^\d{4}-\d{2}$/.test(monthValue)) return monthValue + '-01';
  return monthValue.slice(0, 10);
}

export function monthInputFromPeriod(period) {
  if (!period) return '';
  return period.slice(0, 7);
}

/**
 * Conso générale stockée dans GS_GeneralConsumptions (prioritaire pour graphiques — phase 3+).
 * @param {Array<{ meterId: string, period: string, consumptionValue: number }>} [generalConsumptions]
 */
export function getStoredGeneralConsumption(meterId, period, generalConsumptions) {
  if (!meterId || !period || !generalConsumptions || !generalConsumptions.length) {
    return null;
  }
  var p = normalizeStoredPeriod(period);
  var row = generalConsumptions.find(function (gc) {
    return gc.meterId === meterId && normalizeStoredPeriod(gc.period) === p;
  });
  if (!row || row.consumptionValue == null || isNaN(Number(row.consumptionValue))) {
    return null;
  }
  return Math.round(Number(row.consumptionValue) * 100) / 100;
}

function normalizeStoredPeriod(period) {
  if (!period) return '';
  return String(period).slice(0, 10);
}

export function getReadingForMeter(meterId, period, readings) {
  var r = readings.find(function (x) {
    return x.meterId === meterId && x.period === period;
  });
  return r || null;
}

export function getIndexValue(meterId, period, readings) {
  var r = getReadingForMeter(meterId, period, readings);
  return r != null ? Number(r.indexValue) : null;
}

/**
 * @param {number|null} currentIndex
 * @param {number|null} previousIndex
 * @param {boolean} isDecreasing
 * @returns {number|null}
 */
export function calculateConsumption(currentIndex, previousIndex, isDecreasing) {
  if (currentIndex == null || previousIndex == null) return null;
  var curr = Number(currentIndex);
  var prev = Number(previousIndex);
  if (isNaN(curr) || isNaN(prev)) return null;
  if (isDecreasing) return prev - curr;
  return curr - prev;
}

export function formatConsumption(value, unit) {
  if (value == null || isNaN(value)) return '—';
  var n = Math.round(value * 100) / 100;
  return n.toLocaleString('fr-FR') + (unit ? ' ' + unit : '');
}

/** @param {string} endPeriod — YYYY-MM-01 */
export function getLastNPeriods(endPeriod, count) {
  var periods = [];
  var p = endPeriod;
  for (var i = 0; i < count; i++) {
    periods.unshift(p);
    p = getPreviousPeriod(p);
  }
  return periods;
}

/** Janvier → décembre d'une année civile (graphiques consommation) */
export function getCalendarYearPeriods(year) {
  year = parseInt(year, 10);
  if (isNaN(year)) return [];
  var periods = [];
  for (var m = 1; m <= 12; m++) {
    periods.push(toPeriodISO(year, m));
  }
  return periods;
}

export function getMeterById(meterId, meters) {
  return meters.find(function (m) {
    return m.id === meterId;
  });
}

export function metersForClient(meters, clientId) {
  return meters.filter(function (m) {
    return m.clientId === clientId;
  });
}

export function isLeafMeter(meterId, meters) {
  return !meters.some(function (m) {
    return m.parentId === meterId;
  });
}

export function computeMeterConsumption(meter, period, readings) {
  var prev = getPreviousPeriod(period);
  var currIdx = getIndexValue(meter.id, period, readings);
  var prevIdx = getIndexValue(meter.id, prev, readings);
  return calculateConsumption(currIdx, prevIdx, meter.isDecreasing);
}

/** Sous-compteurs d'un général : liste LinkedMeters (JSON sur GS_Meters). */
export function getEffectiveLinkedMeterIds(generalMeter) {
  if (!generalMeter || !generalMeter.isGeneral) return [];
  var ids = [];
  var seen = {};
  (generalMeter.linkedMeters || []).forEach(function (id) {
    if (!id || seen[id]) return;
    seen[id] = true;
    ids.push(id);
  });
  return ids;
}

/**
 * Conso du général = somme des consos des sous-compteurs (jamais un relevé SP sur le général).
 * @param {Record<string, number|null|undefined>} [liveIndexByMeterId] — index saisis en direct (ronde)
 */
export function computeGeneralConsumptionFromLinked(
  generalMeter,
  period,
  readings,
  meters,
  liveIndexByMeterId
) {
  var linked = getEffectiveLinkedMeterIds(generalMeter);
  if (!generalMeter.isGeneral || !linked.length) return null;

  var prevPeriod = getPreviousPeriod(period);
  var total = 0;
  var hasAny = false;

  linked.forEach(function (subId) {
    var sub = getMeterById(subId, meters);
    if (!sub) return;
    var curr =
      liveIndexByMeterId && liveIndexByMeterId[subId] != null && liveIndexByMeterId[subId] !== ''
        ? Number(liveIndexByMeterId[subId])
        : getIndexValue(sub.id, period, readings);
    var prev = getIndexValue(sub.id, prevPeriod, readings);
    var c = calculateConsumption(curr, prev, sub.isDecreasing);
    if (c != null && !isNaN(c)) {
      total += c;
      hasAny = true;
    }
  });

  return hasAny ? Math.round(total * 100) / 100 : null;
}

/**
 * Couverture comptage : général vs somme des sous-compteurs liés.
 * @returns {{ generalConso: number|null, subConso: number|null, tracedPct: number|null, unknownPct: number|null }}
 */
export function computeCoverageForGeneral(
  generalMeter,
  period,
  meters,
  readings,
  generalConsumptions
) {
  var generalConso = consumptionForChartMeter(
    generalMeter,
    period,
    readings,
    meters,
    generalConsumptions
  );
  if (generalConso == null || generalConso <= 0) {
    return {
      generalConso: generalConso,
      subConso: null,
      tracedPct: null,
      unknownPct: null,
    };
  }

  var linked = getEffectiveLinkedMeterIds(generalMeter);
  var subConso = 0;
  var hasAny = false;

  linked.forEach(function (subId) {
    var sub = getMeterById(subId, meters);
    if (!sub) return;
    var c = computeMeterConsumption(sub, period, readings);
    if (c != null && !isNaN(c)) {
      subConso += c;
      hasAny = true;
    }
  });

  if (!hasAny || !linked.length) {
    return {
      generalConso: generalConso,
      subConso: null,
      tracedPct: null,
      unknownPct: null,
    };
  }

  var tracedPct = Math.min(100, Math.round((subConso / generalConso) * 1000) / 10);
  var unknownPct = Math.max(0, Math.round((100 - tracedPct) * 10) / 10);

  return {
    generalConso: generalConso,
    subConso: subConso,
    tracedPct: tracedPct,
    unknownPct: unknownPct,
  };
}

/** Consommation totale par type d'énergie (feuilles, hors général) pour une période */
export function aggregateByEnergyType(meters, clientId, period, readings) {
  var totals = {};
  metersForClient(meters, clientId).forEach(function (m) {
    if (m.isGeneral) return;
    if (!isLeafMeter(m.id, meters)) return;
    var c = computeMeterConsumption(m, period, readings);
    if (c == null || isNaN(c)) return;
    if (!totals[m.energyType]) totals[m.energyType] = 0;
    totals[m.energyType] += c;
  });
  return totals;
}

/**
 * Séries 12 mois par pôle énergétique.
 * @returns {{ periods: string[], series: Record<string, number[]> }}
 */
export function build12MonthSeriesByType(meters, clientId, endPeriod, readings, energyTypes) {
  var periods = getLastNPeriods(endPeriod, 12);
  var series = {};

  energyTypes.forEach(function (type) {
    series[type] = periods.map(function (period) {
      var total = 0;
      var has = false;
      metersForClient(meters, clientId).forEach(function (m) {
        if (m.energyType !== type || m.isGeneral) return;
        if (!isLeafMeter(m.id, meters)) return;
        var c = computeMeterConsumption(m, period, readings);
        if (c != null && !isNaN(c)) {
          total += c;
          has = true;
        }
      });
      return has ? Math.round(total * 100) / 100 : null;
    });
  });

  return { periods: periods, series: series };
}

export function shiftPeriodYears(period, years) {
  if (!period) return '';
  var parts = period.split('-');
  var y = parseInt(parts[0], 10) + years;
  return y + '-' + parts[1] + '-01';
}

function sumTypeConsumption(meters, clientId, period, readings, energyType) {
  var total = 0;
  var has = false;
  metersForClient(meters, clientId).forEach(function (m) {
    if (m.energyType !== energyType || m.isGeneral) return;
    if (!isLeafMeter(m.id, meters)) return;
    var c = computeMeterConsumption(m, period, readings);
    if (c != null && !isNaN(c)) {
      total += c;
      has = true;
    }
  });
  return has ? Math.round(total * 100) / 100 : null;
}

/** IDs des sous-compteurs liés à un général (exclus des graphiques) */
export function getChartExcludedMeterIds(meters, clientId) {
  var excluded = {};
  var list = metersForClient(meters, clientId);
  list.forEach(function (m) {
    if (!m.isGeneral) return;
    getEffectiveLinkedMeterIds(m).forEach(function (subId) {
      excluded[subId] = true;
    });
  });
  return excluded;
}

/** Général dont la conso = somme des sous-compteurs liés (pas seulement l'index du général) */
export function isMeterCalculated(meter, meters) {
  if (!meter || !meter.isGeneral) return false;
  if (meter.isCalculated === true) return true;
  if (meter.isCalculated === false) return false;
  return getEffectiveLinkedMeterIds(meter).length > 0;
}

export function consumptionForChartMeter(meter, period, readings, meters, generalConsumptions) {
  if (meter.isGeneral && generalConsumptions && generalConsumptions.length) {
    var stored = getStoredGeneralConsumption(meter.id, period, generalConsumptions);
    if (stored != null) return stored;
  }
  if (isMeterCalculated(meter, meters)) {
    return computeGeneralConsumptionFromLinked(meter, period, readings, meters);
  }
  return computeMeterConsumption(meter, period, readings);
}

/**
 * Agrégation graphiques : courbe(s) du/des Général(x) — index ou Σ sous-compteurs si calculé.
 */
export function sumTypeConsumptionForChart(meters, clientId, period, readings, energyType) {
  var list = metersForClient(meters, clientId).filter(function (m) {
    return m.energyType === energyType;
  });
  var excluded = getChartExcludedMeterIds(meters, clientId);
  var generals = list.filter(function (m) {
    return m.isGeneral;
  });

  if (generals.length) {
    var totalG = 0;
    var hasG = false;
    generals.forEach(function (g) {
      var c = consumptionForChartMeter(g, period, readings, meters);
      if (c != null && !isNaN(c)) {
        totalG += c;
        hasG = true;
      }
    });
    return hasG ? Math.round(totalG * 100) / 100 : null;
  }

  var total = 0;
  var has = false;
  list.forEach(function (m) {
    if (m.isGeneral || excluded[m.id]) return;
    var c = computeMeterConsumption(m, period, readings);
    if (c != null && !isNaN(c)) {
      total += c;
      has = true;
    }
  });
  return has ? Math.round(total * 100) / 100 : null;
}

/** Série année civile N + N-1 pour un compteur général (un graphique par général). */
export function buildGeneralMeterChartSeries(
  generalMeter,
  refPeriod,
  readings,
  meters,
  generalConsumptions
) {
  var year = parseInt(String(refPeriod || '').slice(0, 4), 10);
  var periods = getCalendarYearPeriods(year);
  var current = periods.map(function (p) {
    return consumptionForChartMeter(generalMeter, p, readings, meters, generalConsumptions);
  });
  var n1 = periods.map(function (p) {
    return consumptionForChartMeter(
      generalMeter,
      shiftPeriodYears(p, -1),
      readings,
      meters,
      generalConsumptions
    );
  });
  return { periods: periods, current: current, n1: n1 };
}

/** Série année civile N (janv.–déc.) + N-1 pour un pôle — graphiques consommation */
export function buildTypeChartSeries(meters, clientId, refPeriod, readings, energyType) {
  var year = parseInt(String(refPeriod || '').slice(0, 4), 10);
  var periods = getCalendarYearPeriods(year);
  var current = periods.map(function (p) {
    return sumTypeConsumptionForChart(meters, clientId, p, readings, energyType);
  });
  var n1 = periods.map(function (p) {
    return sumTypeConsumptionForChart(
      meters,
      clientId,
      shiftPeriodYears(p, -1),
      readings,
      energyType
    );
  });
  return { periods: periods, current: current, n1: n1 };
}

