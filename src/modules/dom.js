/**
 * Helpers DOM sécurisés (anti-XSS) — Phase 3
 */

/** Vide un élément sans innerHTML */
export function clearElement(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Crée un élément avec textContent (jamais innerHTML pour données utilisateur) */
export function createTextEl(tag, text, className) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text == null ? '' : String(text);
  return el;
}

/** Remplit un <select> de façon sécurisée */
export function fillSelect(select, items, options) {
  if (!select) return;
  options = options || {};
  clearElement(select);
  if (options.placeholder != null) {
    var ph = document.createElement('option');
    ph.value = options.placeholderValue || '';
    ph.textContent = options.placeholder;
    select.appendChild(ph);
  }
  items.forEach(function (item) {
    var opt = document.createElement('option');
    if (typeof item === 'string') {
      opt.value = options.useValue ? item : item;
      opt.textContent = item;
    } else {
      opt.value = item.value;
      opt.textContent = item.label;
    }
    select.appendChild(opt);
  });
}

/** Ligne vide centrée dans un tbody */
export function appendTableEmptyRow(tbody, colSpan, message) {
  var tr = document.createElement('tr');
  var td = document.createElement('td');
  td.colSpan = colSpan;
  td.style.textAlign = 'center';
  td.style.color = '#aaa';
  td.style.padding = '20px';
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/** td avec texte tronqué */
export function appendTableCell(tr, text, maxWidth) {
  var td = document.createElement('td');
  td.textContent = text == null ? '' : String(text);
  if (maxWidth) {
    td.style.maxWidth = maxWidth + 'px';
    td.style.overflow = 'hidden';
    td.style.textOverflow = 'ellipsis';
  }
  tr.appendChild(td);
  return td;
}
