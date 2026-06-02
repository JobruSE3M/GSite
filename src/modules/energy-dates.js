/** Normalisation des périodes mensuelles — module Énergie */



export function toPeriodISO(year, month) {

  var y = parseInt(year, 10);

  var mo = parseInt(month, 10);

  if (isNaN(y) || isNaN(mo) || mo < 1 || mo > 12) return null;

  return y + '-' + String(mo).padStart(2, '0') + '-01';

}



/** @param {Date} date — composantes calendaires locales */

export function dateToPeriodISO(date) {

  return toPeriodISO(date.getFullYear(), date.getMonth() + 1);

}



function expandYear(y) {

  y = parseInt(y, 10);

  if (y < 100) return y < 50 ? 2000 + y : 1900 + y;

  return y;

}



/**

 * Dates jj/mm/aaaa (texte Excel FR) ou format court type 1/1/25 (1er du mois, M/D/YY).

 */

export function parsePeriodFromString(s) {

  if (!s) return null;

  s = String(s).trim();

  if (!s) return null;



  var m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);

  if (m) return toPeriodISO(+m[1], +m[2]);



  m = s.match(/^(\d{4})[/\-.](\d{1,2})(?:[/\-.]\d{1,2})?/);

  if (m) return toPeriodISO(+m[1], +m[2]);



  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);

  if (m) {

    var p1 = m[1];

    var p2 = +m[2];

    var y = expandYear(m[3]);



    /* 01/02/2024, 01/12/2024… — format historique ERIA (jour/mois/année) */

    if (p1.length === 2 && p1 === '01' && String(m[3]).length === 4) {

      return toPeriodISO(y, p2);

    }



    /* 1/1/25, 2/1/25… — affichage Excel court : mois/jour/année, jour = 1 */

    if (p2 === 1 && +p1 >= 1 && +p1 <= 12) {

      return toPeriodISO(y, +p1);

    }



    /* défaut FR : jj/mm/aaaa */

    return toPeriodISO(y, p2);

  }



  m = s.match(/^(\d{1,2})[/\-.](\d{4})$/);

  if (m) return toPeriodISO(+m[2], +m[1]);



  return null;

}



/** Série Excel → 1er du mois (midi UTC pour éviter le décalage de fuseau) */

function periodFromExcelSerial(serial) {

  if (!isFinite(serial)) return null;

  var ms = Math.round((serial - 25569) * 86400 * 1000 + 12 * 3600 * 1000);

  var d = new Date(ms);

  if (isNaN(d.getTime())) return null;

  return toPeriodISO(d.getUTCFullYear(), d.getUTCMonth() + 1);

}



/** Parse une cellule Excel (ligne « Date du relevé ») en période YYYY-MM-01 */

export function parsePeriodFromCell(cell) {

  if (!cell) return null;



  var display = cell.w != null ? String(cell.w).trim() : '';

  if (display) {

    var fromDisplay = parsePeriodFromString(display);

    if (fromDisplay) return fromDisplay;

  }



  var v = cell.v;



  if (cell.t === 'd' && v instanceof Date && !isNaN(v.getTime())) {

    return dateToPeriodISO(v);

  }



  if (typeof v === 'number' && isFinite(v)) {

    return periodFromExcelSerial(v);

  }



  if (v != null && v !== '') {

    var fromV = parsePeriodFromString(String(v));

    if (fromV) return fromV;

  }



  return null;

}



export function formatPeriodLabel(period) {

  if (!period) return '';

  var parts = period.split('-');

  if (parts.length < 2) return period;

  var months = [

    'Jan',

    'Fév',

    'Mar',

    'Avr',

    'Mai',

    'Juin',

    'Juil',

    'Août',

    'Sep',

    'Oct',

    'Nov',

    'Déc',

  ];

  var mi = parseInt(parts[1], 10) - 1;

  return (months[mi] || parts[1]) + ' ' + parts[0];

}



/** Libellé mois seul (abscisse graphiques) */

export function formatMonthLabel(period) {

  if (!period) return '';

  var parts = period.split('-');

  if (parts.length < 2) return period;

  var months = [

    'Jan',

    'Fév',

    'Mar',

    'Avr',

    'Mai',

    'Juin',

    'Juil',

    'Août',

    'Sep',

    'Oct',

    'Nov',

    'Déc',

  ];

  var mi = parseInt(parts[1], 10) - 1;

  return months[mi] || parts[1];

}


