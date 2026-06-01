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
  });
}

/** @deprecated Utiliser flushSession() depuis analytics.js — Phase 5 */
export function trackLogin() {
  console.warn('[api] trackLogin() est obsolète — la session est enregistrée à la déconnexion');
  return Promise.resolve();
}
