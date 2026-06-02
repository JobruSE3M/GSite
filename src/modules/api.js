/**
 * API Microsoft Graph / SharePoint — Phase 2
 */
import { GRAPH_CONFIG } from '../config/graph.js';
import { getToken } from './auth.js';
import { store } from './store.js';

let siteId = null;
const listIds = {};

export function graphFetch(path, opts) {
  opts = opts || {};
  let body = undefined;
  if (opts.body) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  return getToken().then(function (t) {
    if (import.meta.env.DEV && body) {
      console.debug('[api] BODY:', body);
    }
    return fetch('https://graph.microsoft.com/v1.0' + path, {
      method: opts.method || 'GET',
      headers: {
        Authorization: 'Bearer ' + t.accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body,
    }).then(function (r) {
      if (r.status === 204) return null;
      if (!r.ok) return r.text().then(function (txt) { throw new Error(txt); });
      return r.json();
    });
  });
}

function getSiteId() {
  if (siteId) return Promise.resolve(siteId);
  return graphFetch('/sites/' + GRAPH_CONFIG.siteHost + ':' + GRAPH_CONFIG.sitePath).then(function (s) {
    siteId = s.id;
    return siteId;
  });
}

function getListId(listKey) {
  if (listIds[listKey]) return Promise.resolve(listIds[listKey]);
  const listName = GRAPH_CONFIG.lists[listKey];
  return getSiteId().then(function (sid) {
    return graphFetch("/sites/" + sid + "/lists?$filter=displayName eq '" + listName + "'");
  }).then(function (res) {
    if (!res.value || !res.value.length) throw new Error('Liste introuvable: ' + listName);
    listIds[listKey] = res.value[0].id;
    return listIds[listKey];
  });
}

export function userFromSP(f) {
  return { id: f.Title, role: f.Role || 'user' };
}
export function userToSP(u) {
  return { Title: u.id, Role: u.role || 'user' };
}

export function clientFromSP(f) {
  return f.Title;
}
export function clientToSP(c) {
  return { Title: c };
}

export function entryToSP(e) {
  return {
    Title: String(e.id || 'entry_' + Date.now()),
    DateDebut: e.dateDebut || null,
    DateFin: e.dateFin || null,
    Client: e.client || '',
    Localisation: e.localisation || '',
    EntryType: e.type || '',
    Operations: e.operations || '',
    Actions: e.actions || '',
    Commentaire: e.commentaire || '',
    Impact: e.impact ? 'Oui' : 'Non',
    CRI: e.cri || '',
    Intervenant: e.intervenant || '',
    LotTechnique: e.lotTechnique || '',
    HeureAppel: e.heureAppel || '',
    HeureArrivee: e.heureArrivee || '',
    HeureDepart: e.heureDepart || '',
    Societe: e.societe || '',
    Lot: e.lot || '',
    UserId: e.user || '',
  };
}

export function entryFromSP(f) {
  return {
    id: f.Title || '',
    dateDebut: f.DateDebut || '',
    dateFin: f.DateFin || '',
    client: f.Client || '',
    localisation: f.Localisation || '',
    type: f.EntryType || '',
    operations: f.Operations || '',
    actions: f.Actions || '',
    commentaire: f.Commentaire || '',
    impact: f.Impact === 'Oui',
    cri: f.CRI || '',
    intervenant: f.Intervenant || '',
    lotTechnique: f.LotTechnique || '',
    heureAppel: f.HeureAppel || '',
    heureArrivee: f.HeureArrivee || '',
    heureDepart: f.HeureDepart || '',
    societe: f.Societe || '',
    lot: f.Lot || '',
    user: f.UserId || '',
  };
}

function spBool(value) {
  return value === true || value === 'Yes' || value === 'Oui' || value === 1;
}

/** Oui/Non SP absent → undefined (défaut métier côté isMeterCalculated) */
function spBoolOptional(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return spBool(value);
}

export function meterToSP(m) {
  var fields = {
    Title: m.id,
    ClientId: m.clientId || '',
    Name: m.name || '',
    EnergyType: m.energyType || 'ELECTRICITE',
    Unit: m.unit || 'kWh',
    IsGeneral: !!m.isGeneral,
    IsDecreasing: !!m.isDecreasing,
    IsCalculated: !!m.isGeneral && m.isCalculated !== false,
  };
  if (m.linkedMeters && m.linkedMeters.length) {
    fields.LinkedMeters = JSON.stringify(m.linkedMeters);
  }
  return fields;
}

export function meterFromSP(f) {
  var linked = [];
  try {
    linked = JSON.parse(f.LinkedMeters || '[]');
  } catch (e) {
    linked = [];
  }
  if (!Array.isArray(linked)) linked = [];
  return {
    id: f.Title || '',
    clientId: f.ClientId || '',
    name: f.Name || '',
    energyType: f.EnergyType || 'ELECTRICITE',
    unit: f.Unit || 'kWh',
    parentId: '',
    isGeneral: spBool(f.IsGeneral),
    linkedMeters: linked,
    isDecreasing: spBool(f.IsDecreasing),
    isCalculated: spBoolOptional(f.IsCalculated),
  };
}

export function readingToSP(r) {
  return {
    Title: r.id,
    MeterId: r.meterId || '',
    Period: r.period || null,
    IndexValue: Number(r.indexValue),
    UserId: r.userId || '',
  };
}

function normalizePeriod(raw) {
  if (!raw) return '';
  var s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var d = new Date(s);
  if (isNaN(d.getTime())) return s;
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  return y + '-' + m + '-01';
}

export function normalizeReadingPeriod(raw) {
  return normalizePeriod(raw);
}

export function readingFromSP(f) {
  return {
    id: f.Title || '',
    meterId: f.MeterId || '',
    period: normalizePeriod(f.Period),
    indexValue: Number(f.IndexValue) || 0,
    userId: f.UserId || '',
  };
}

/** Une ligne SP par site + année ; tous les commentaires des généraux dans CommentsJSON */
export function energyCommentsBundleKey(clientId, year) {
  var slug = String(clientId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return 'ecj_' + slug + '_' + Number(year);
}

function parseCommentsJsonField(raw) {
  if (!raw) return {};
  try {
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    return o;
  } catch (e) {
    return {};
  }
}

function commentTextFromJsonEntry(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object' && entry.comment != null) return String(entry.comment);
  return '';
}

export function energyCommentsBundleFromSP(f) {
  return {
    id: f.Title || energyCommentsBundleKey(f.ClientId, f.Year),
    clientId: f.ClientId || '',
    year: Number(f.Year) || 0,
    commentsByMeter: parseCommentsJsonField(f.CommentsJSON),
  };
}

export function energyCommentsBundleToSP(bundle) {
  return {
    Title: bundle.id || energyCommentsBundleKey(bundle.clientId, bundle.year),
    ClientId: bundle.clientId || '',
    Year: Number(bundle.year) || 0,
    CommentsJSON: JSON.stringify(bundle.commentsByMeter || {}),
  };
}

export function findEnergyCommentsBundle(clientId, year) {
  var y = Number(year);
  return store.energyComments.find(function (b) {
    return b.clientId === clientId && Number(b.year) === y;
  });
}

export function getMeterCommentText(clientId, meterId, year) {
  var bundle = findEnergyCommentsBundle(clientId, year);
  if (!bundle || !bundle.commentsByMeter) return '';
  return commentTextFromJsonEntry(bundle.commentsByMeter[meterId]);
}

/** Pour l’UI graphique : commentaire d’un général sur l’année N */
export function findEnergyCommentForMeter(clientId, meterId, year) {
  var text = getMeterCommentText(clientId, meterId, year);
  if (!text) return null;
  return {
    clientId: clientId,
    meterId: meterId,
    year: Number(year),
    comment: text,
  };
}

export function generalConsumptionKey(meterId, period) {
  var mid = String(meterId).replace(/[^a-zA-Z0-9._-]/g, '_');
  var p = normalizePeriod(period).replace(/-/g, '');
  return 'gc_' + mid + '_' + p;
}

export function generalConsumptionKeyMatch(meterId, period) {
  return meterId + '|' + normalizePeriod(period);
}

/** Uniquement colonnes obligatoires SP (Title, MeterId, ClientId, Period, ConsumptionValue). */
export function generalConsumptionToSP(gc) {
  return {
    Title: gc.id || generalConsumptionKey(gc.meterId, gc.period),
    MeterId: gc.meterId || '',
    ClientId: gc.clientId || '',
    Period: gc.period || null,
    ConsumptionValue: Number(gc.consumptionValue),
  };
}

export function generalConsumptionFromSP(f) {
  return {
    id: f.Title || '',
    meterId: f.MeterId || '',
    clientId: f.ClientId || '',
    period: normalizePeriod(f.Period),
    consumptionValue: Number(f.ConsumptionValue),
    unit: f.Unit || '',
    source: f.Source || 'CALCUL',
    userId: f.UserId || '',
    notes: f.Notes || '',
  };
}

export function findGeneralConsumption(meterId, period) {
  var key = generalConsumptionKeyMatch(meterId, period);
  return store.generalConsumptions.find(function (gc) {
    return generalConsumptionKeyMatch(gc.meterId, gc.period) === key;
  });
}

function upsertGeneralConsumptionInStore(gc) {
  var key = generalConsumptionKeyMatch(gc.meterId, gc.period);
  var idx = store.generalConsumptions.findIndex(function (x) {
    return generalConsumptionKeyMatch(x.meterId, x.period) === key;
  });
  if (idx !== -1) store.generalConsumptions[idx] = gc;
  else store.generalConsumptions.push(gc);
}

export function readingKey(meterId, period) {
  return meterId + '|' + normalizePeriod(period);
}

function isGraphConflict(err) {
  var msg = err && err.message ? err.message : String(err);
  return (
    msg.indexOf('409') !== -1 ||
    msg.indexOf('nameAlreadyExists') !== -1 ||
    msg.indexOf('resourceModified') !== -1 ||
    msg.indexOf('activityInProgress') !== -1
  );
}

/** Élément SP supprimé ou _spId obsolète en cache local */
function isGraphItemNotFound(err) {
  var msg = err && err.message ? err.message : String(err);
  return msg.indexOf('itemNotFound') !== -1 || msg.indexOf('"code":"itemNotFound"') !== -1;
}

function removeReadingFromStore(meterId, period) {
  var key = readingKey(meterId, period);
  store.readings = store.readings.filter(function (r) {
    return readingKey(r.meterId, r.period) !== key;
  });
}

function findReadingInStore(meterId, period) {
  var key = readingKey(meterId, period);
  return store.readings.find(function (r) {
    return readingKey(r.meterId, r.period) === key;
  });
}

function upsertReadingInStore(reading) {
  var key = readingKey(reading.meterId, reading.period);
  var idx = store.readings.findIndex(function (r) {
    return readingKey(r.meterId, r.period) === key;
  });
  if (idx !== -1) store.readings[idx] = reading;
  else store.readings.push(reading);
}

/** Recharge tous les relevés SP en mémoire (pas de $filter — MeterId non indexé) */
var readingsRefreshPromise = null;

function refreshReadingsFromSharePoint() {
  if (readingsRefreshPromise) return readingsRefreshPromise;
  readingsRefreshPromise = apiGet('readings')
    .then(function (list) {
      store.readings = list;
      return list;
    })
    .finally(function () {
      readingsRefreshPromise = null;
    });
  return readingsRefreshPromise;
}

function resolveExistingReading(reading) {
  var existing = findReadingInStore(reading.meterId, reading.period);
  if (existing && existing._spId) return Promise.resolve(existing);
  return Promise.resolve(existing || null);
}

function resolveReadingAfterConflict(reading, refreshFn) {
  return refreshFn().then(function () {
    return findReadingInStore(reading.meterId, reading.period);
  });
}

export function spGetItems(listKey) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function (r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items?$expand=fields&$top=5000');
  }).then(function (res) {
    return (res.value || []).map(function (it) {
      return { id: it.id, fields: it.fields };
    });
  });
}

export function apiGet(listKey) {
  return spGetItems(listKey).then(function (items) {
    if (listKey === 'users') {
      return items.map(function (i) {
        var u = userFromSP(i.fields);
        u._spId = i.id;
        return u;
      });
    }
    if (listKey === 'clients') {
      return items.map(function (i) {
        return clientFromSP(i.fields);
      });
    }
    if (listKey === 'entries') {
      return items.map(function (i) {
        var e = entryFromSP(i.fields);
        e._spId = i.id;
        return e;
      });
    }
    if (listKey === 'access') {
      var map = {};
      items.forEach(function (i) {
        try {
          map[i.fields.Title] = JSON.parse(i.fields.ClientsJSON || '[]');
        } catch (e) {
          map[i.fields.Title] = [];
        }
      });
      return map;
    }
    if (listKey === 'planning') {
      var pl = {};
      items.forEach(function (i) {
        try {
          pl[i.fields.Title] = JSON.parse(i.fields.DataJSON || '{}');
        } catch (e) {
          pl[i.fields.Title] = { employees: [], cells: {} };
        }
        pl[i.fields.Title]._spId = i.id;
      });
      return pl;
    }
    if (listKey === 'planningSst') {
      var ps = {};
      items.forEach(function (i) {
        try {
          ps[i.fields.Title] = JSON.parse(i.fields.DataJSON || '{}');
        } catch (e) {
          ps[i.fields.Title] = { ssts: [], cells: {} };
        }
        ps[i.fields.Title]._spId = i.id;
      });
      return ps;
    }
    if (listKey === 'loginHistory') {
      return items.map(function (i) {
        var parcours = null;
        try {
          parcours = JSON.parse(i.fields.ParcoursJSON || '{}');
        } catch (e) {
          parcours = null;
        }
        return {
          id: i.id,
          email: i.fields.Title,
          dateConnexion: i.fields.DateConnexion,
          statut: i.fields.Statut,
          navigateur: i.fields.Navigateur,
          tempsTotal: Number(i.fields.TempsTotal) || 0,
          parcours: parcours,
          role: i.fields.Role || 'user',
        };
      });
    }
    if (listKey === 'meters') {
      return items.map(function (i) {
        var m = meterFromSP(i.fields);
        m._spId = i.id;
        return m;
      });
    }
    if (listKey === 'readings') {
      return items.map(function (i) {
        var r = readingFromSP(i.fields);
        r._spId = i.id;
        return r;
      });
    }
    if (listKey === 'energyComments') {
      return items.map(function (i) {
        var b = energyCommentsBundleFromSP(i.fields);
        b._spId = i.id;
        return b;
      });
    }
    if (listKey === 'generalConsumptions') {
      return items.map(function (i) {
        var gc = generalConsumptionFromSP(i.fields);
        gc._spId = i.id;
        return gc;
      });
    }
    return items;
  });
}

export function spCreate(listKey, fields) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function (r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items', {
      method: 'POST',
      body: JSON.stringify({ fields: fields }),
    });
  });
}

export function spUpdate(listKey, itemId, fields) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function (r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items/' + itemId + '/fields', {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
  });
}

export function spDelete(listKey, itemId) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function (r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items/' + itemId, { method: 'DELETE' });
  });
}

export function apiSaveAll(listKey, data) {
  return spGetItems(listKey).then(function (existing) {
    var existingByTitle = {};
    existing.forEach(function (it) {
      existingByTitle[it.fields.Title] = it;
    });
    var ops = [];

    if (listKey === 'users') {
      var seen = {};
      data.forEach(function (u) {
        seen[u.id] = true;
        var f = userToSP(u);
        if (existingByTitle[u.id]) ops.push(spUpdate('users', existingByTitle[u.id].id, f));
        else ops.push(spCreate('users', f));
      });
      existing.forEach(function (it) {
        if (!seen[it.fields.Title]) ops.push(spDelete('users', it.id));
      });
    } else if (listKey === 'clients') {
      var seenC = {};
      data.forEach(function (c) {
        seenC[c] = true;
        if (!existingByTitle[c]) ops.push(spCreate('clients', { Title: c }));
      });
      existing.forEach(function (it) {
        if (!seenC[it.fields.Title]) ops.push(spDelete('clients', it.id));
      });
    } else if (listKey === 'access') {
      var seenA = {};
      Object.keys(data).forEach(function (uid) {
        seenA[uid] = true;
        var f = { Title: uid, ClientsJSON: JSON.stringify(data[uid] || []) };
        if (existingByTitle[uid]) ops.push(spUpdate('access', existingByTitle[uid].id, f));
        else ops.push(spCreate('access', f));
      });
      existing.forEach(function (it) {
        if (!seenA[it.fields.Title]) ops.push(spDelete('access', it.id));
      });
    } else if (listKey === 'planning') {
      var seenP = {};
      Object.keys(data).forEach(function (site) {
        seenP[site] = true;
        var clean = Object.assign({}, data[site]);
        delete clean._spId;
        var f = { Title: site, DataJSON: JSON.stringify(clean) };
        if (existingByTitle[site]) ops.push(spUpdate('planning', existingByTitle[site].id, f));
        else ops.push(spCreate('planning', f));
      });
      existing.forEach(function (it) {
        if (!seenP[it.fields.Title]) ops.push(spDelete('planning', it.id));
      });
    } else if (listKey === 'entries') {
      var seenE = {};
      data.forEach(function (e) {
        var key = e.id || e.Title || '';
        seenE[key] = true;
        var f = entryToSP(e);
        if (existingByTitle[key]) ops.push(spUpdate('entries', existingByTitle[key].id, f));
        else ops.push(spCreate('entries', f));
      });
      existing.forEach(function (it) {
        if (!seenE[it.fields.Title]) ops.push(spDelete('entries', it.id));
      });
    } else if (listKey === 'planningSst') {
      var seenPS = {};
      Object.keys(data).forEach(function (site) {
        seenPS[site] = true;
        var clean = Object.assign({}, data[site]);
        delete clean._spId;
        var f = { Title: site, DataJSON: JSON.stringify(clean) };
        if (existingByTitle[site]) ops.push(spUpdate('planningSst', existingByTitle[site].id, f));
        else ops.push(spCreate('planningSst', f));
      });
      existing.forEach(function (it) {
        if (!seenPS[it.fields.Title]) ops.push(spDelete('planningSst', it.id));
      });
    }

    return Promise.all(ops);
  });
}

export function apiAddEntry(entry) {
  entry.id = entry.id || 'entry_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  return spCreate('entries', entryToSP(entry)).then(function (res) {
    entry._spId = res.id;
    return entry;
  });
}

export function apiDeleteEntry(entry) {
  if (!entry._spId) return Promise.resolve();
  return spDelete('entries', entry._spId);
}

export function apiSaveMeter(meter) {
  if (!meter.id) {
    meter.id = 'meter_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }
  var fields = meterToSP(meter);
  if (meter._spId) {
    return spUpdate('meters', meter._spId, fields)
      .then(function () {
        return meter;
      })
      .catch(function (err) {
        if (!isGraphItemNotFound(err)) throw err;
        meter._spId = null;
        return spCreate('meters', fields).then(function (res) {
          meter._spId = res.id;
          return meter;
        });
      });
  }
  return spCreate('meters', fields).then(function (res) {
    meter._spId = res.id;
    return meter;
  });
}

export function apiDeleteMeter(meter) {
  var ops = [];
  store.readings.forEach(function (r) {
    if (r.meterId === meter.id && r._spId) {
      ops.push(spDelete('readings', r._spId));
    }
  });
  if (meter._spId) ops.push(spDelete('meters', meter._spId));
  return Promise.all(ops).then(function () {
    store.meters = store.meters.filter(function (m) {
      return m.id !== meter.id;
    });
    store.readings = store.readings.filter(function (r) {
      return r.meterId !== meter.id;
    });
  });
}

export function apiUpsertReading(reading, options) {
  options = options || {};
  var onConflictRefresh = options.onConflictRefresh || refreshReadingsFromSharePoint;

  reading.period = normalizePeriod(reading.period);
  if (!reading.userId) reading.userId = store.currentUser ? store.currentUser.id : '';
  if (!reading.id) {
    reading.id =
      'reading_' +
      reading.meterId.replace(/[^a-zA-Z0-9_]/g, '_') +
      '_' +
      reading.period.replace(/-/g, '');
  }

  var fields = readingToSP(reading);

  function doUpdate(existing) {
    reading._spId = existing._spId;
    reading.id = existing.id;
    fields.Title = existing.id;
    return spUpdate('readings', existing._spId, fields)
      .then(function () {
        upsertReadingInStore(reading);
        return reading;
      })
      .catch(function (err) {
        if (!isGraphItemNotFound(err)) throw err;
        removeReadingFromStore(reading.meterId, reading.period);
        reading._spId = null;
        return doCreate();
      });
  }

  function doCreate() {
    return spCreate('readings', fields).then(function (res) {
      reading._spId = res.id;
      upsertReadingInStore(reading);
      return reading;
    });
  }

  function handleConflict(err) {
    return resolveReadingAfterConflict(reading, onConflictRefresh).then(function (spReading) {
      if (!spReading || !spReading._spId) throw err;
      return doUpdate(spReading);
    });
  }

  return resolveExistingReading(reading).then(function (existing) {
    if (existing && existing._spId) {
      return doUpdate(existing).catch(function (err) {
        if (isGraphItemNotFound(err)) {
          return doCreate();
        }
        if (!isGraphConflict(err)) throw err;
        return handleConflict(err);
      });
    }
    if (existing && !existing._spId) {
      reading.id = existing.id;
      fields.Title = existing.id;
    }
    return doCreate().catch(function (err) {
      if (!isGraphConflict(err)) throw err;
      return handleConflict(err);
    });
  });
}

/** Import Excel : upsert séquentiel (réimport / historique complet) */
export function apiUpsertReadingsBatch(readings, onProgress) {
  var index = 0;
  var batchRefreshDone = false;

  function batchRefresh() {
    if (batchRefreshDone) return Promise.resolve(store.readings);
    batchRefreshDone = true;
    return refreshReadingsFromSharePoint();
  }

  function next() {
    if (index >= readings.length) return Promise.resolve(readings.length);
    var reading = readings[index];
    index += 1;
    return apiUpsertReading(reading, { onConflictRefresh: batchRefresh }).then(function () {
      if (onProgress) onProgress(index, readings.length);
      return next();
    });
  }

  return next();
}

/**
 * Enregistre ou met à jour une conso mensuelle de compteur général (GS_GeneralConsumptions).
 * @param {{ meterId: string, clientId: string, period: string, consumptionValue: number, unit?: string, source?: string, notes?: string }} record
 */
export function apiUpsertGeneralConsumption(record) {
  record.period = normalizePeriod(record.period);
  if (!record.userId) record.userId = store.currentUser ? store.currentUser.id : '';
  if (!record.source) record.source = 'CALCUL';
  if (!record.id) record.id = generalConsumptionKey(record.meterId, record.period);

  var existing = findGeneralConsumption(record.meterId, record.period);
  var fields = generalConsumptionToSP(record);

  function applyLocal(saved) {
    upsertGeneralConsumptionInStore(saved);
    return saved;
  }

  if (existing && existing._spId) {
    record.id = existing.id;
    fields.Title = existing.id;
    return spUpdate('generalConsumptions', existing._spId, fields)
      .then(function () {
        record._spId = existing._spId;
        return applyLocal(record);
      })
      .catch(function (err) {
        if (!isGraphItemNotFound(err)) throw err;
        record._spId = null;
        return spCreate('generalConsumptions', fields).then(function (res) {
          record._spId = res.id;
          return applyLocal(record);
        });
      });
  }

  return spCreate('generalConsumptions', fields).then(function (res) {
    record._spId = res.id;
    return applyLocal(record);
  });
}

function saveEnergyCommentsBundle(bundle) {
  var existing = findEnergyCommentsBundle(bundle.clientId, bundle.year);
  var fields = energyCommentsBundleToSP(bundle);

  function applyLocal(saved) {
    var idx = store.energyComments.findIndex(function (b) {
      return b.clientId === saved.clientId && Number(b.year) === Number(saved.year);
    });
    if (idx !== -1) store.energyComments[idx] = saved;
    else store.energyComments.push(saved);
    return saved;
  }

  if (existing && existing._spId) {
    bundle.id = existing.id;
    bundle._spId = existing._spId;
    fields.Title = bundle.id;
    return spUpdate('energyComments', existing._spId, fields).then(function () {
      return applyLocal(bundle);
    });
  }

  return spCreate('energyComments', fields).then(function (res) {
    bundle._spId = res.id;
    return applyLocal(bundle);
  });
}

/**
 * Enregistre le commentaire d’un général (fusion dans le JSON du site + année).
 * Format JSON : { "Title_du_compteur": "texte du commentaire", ... }
 */
export function apiUpsertEnergyCommentForMeter(clientId, meterId, year, commentText) {
  var yearNum = Number(year);
  var bundle = findEnergyCommentsBundle(clientId, yearNum);
  if (!bundle) {
    bundle = {
      id: energyCommentsBundleKey(clientId, yearNum),
      clientId: clientId,
      year: yearNum,
      commentsByMeter: {},
    };
  }
  bundle.commentsByMeter = bundle.commentsByMeter || {};
  var text = (commentText || '').trim();
  if (text) bundle.commentsByMeter[meterId] = text;
  else delete bundle.commentsByMeter[meterId];
  return saveEnergyCommentsBundle(bundle);
}

export function loadEnergyData() {
  return Promise.all([
    apiGet('meters'),
    apiGet('readings'),
    apiGet('energyComments').catch(function () {
      return [];
    }),
    apiGet('generalConsumptions').catch(function (err) {
      console.warn('[api] GS_GeneralConsumptions non chargée :', err.message || err);
      return [];
    }),
  ]).then(function (r) {
    store.meters = r[0];
    store.readings = r[1];
    store.energyComments = r[2];
    store.generalConsumptions = r[3];
    if (import.meta.env.DEV) {
      console.info('[api] Energy loaded', {
        meters: store.meters.length,
        readings: store.readings.length,
        energyComments: store.energyComments.length,
        generalConsumptions: store.generalConsumptions.length,
      });
    }
  });
}

export function loadAllData() {
  return Promise.all([
    apiGet('users'),
    apiGet('clients'),
    apiGet('entries'),
    apiGet('planning'),
    apiGet('access'),
    apiGet('planningSst'),
  ]).then(function (r) {
    store.setLoadedData({
      users: r[0],
      clients: r[1],
      entries: r[2],
      planning: r[3],
      access: r[4],
      planningSst: r[5],
    });
    if (import.meta.env.DEV) {
      console.info('[api] Data loaded', {
        users: store.users.length,
        clients: store.clients.length,
        entries: store.entries.length,
      });
    }
    return loadEnergyData().catch(function (err) {
      console.warn('[api] Listes énergie non chargées (GS_Meters / GS_Readings) :', err.message || err);
      store.meters = [];
      store.readings = [];
      store.energyComments = [];
      store.generalConsumptions = [];
    });
  });
}

/** @deprecated Utiliser flushSession() depuis analytics.js — Phase 5 */
export function trackLogin() {
  console.warn('[api] trackLogin() est obsolète — la session est enregistrée à la déconnexion');
  return Promise.resolve();
}
