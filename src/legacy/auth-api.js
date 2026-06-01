// ═══════════════════════════════════════════════════════════
// 🔐 CONFIGURATION SHAREPOINT / GRAPH
// ═══════════════════════════════════════════════════════════
var GRAPH_CONFIG = {
  clientId: 'a34965e3-9597-4cd7-9373-214086e8ec4c',
  tenantId: '2a9dfcb1-f2fd-4d8d-9046-00b1c3267d95',
  siteHost: 'se3m.sharepoint.com',
  sitePath: '/sites/GestionDeSite',
  lists: {
    users:    'GS_Users',
    clients:  'GS_Clients',
    entries:  'GS_Entries',
    planning: 'GS_Planning',
    access:   'GS_Access',
    planningSst: 'GS_PlanningSst',
    loginHistory: 'GS_LoginHistory'
  }
};
var GRAPH_SCOPES = ['Sites.ReadWrite.All', 'User.Read'];

var msalInstance = new msal.PublicClientApplication({
  auth: {
    clientId: GRAPH_CONFIG.clientId,
    authority: 'https://login.microsoftonline.com/' + GRAPH_CONFIG.tenantId,
    redirectUri: window.location.origin + window.location.pathname
  },
  cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false }
});

var _currentAccount = null;
var _siteId = null;
var _listIds = {};

// ═══════════════════════════════════════════════════════════
// 🔑 AUTH
// ═══════════════════════════════════════════════════════════
function doLogin()  { msalInstance.loginRedirect({ scopes: GRAPH_SCOPES }); }
function doLogout() { msalInstance.logoutRedirect(); }

function getToken() {
  var req = { scopes: GRAPH_SCOPES, account: _currentAccount };
  return msalInstance.acquireTokenSilent(req).catch(function() {
    return msalInstance.acquireTokenRedirect(req);
  });
}

function graphFetch(path, opts) {
  opts = opts || {};
  var body = undefined;
  if (opts.body) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  return getToken().then(function(t) {
    console.log('BODY:', body);  // ← ajoute cette ligne
    return fetch('https://graph.microsoft.com/v1.0' + path, {

      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + t.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body
    }).then(function(r) {
      if (r.status === 204) return null;
      if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
      return r.json();
    });
  });
}


function getSiteId() {
  if (_siteId) return Promise.resolve(_siteId);
  return graphFetch('/sites/' + GRAPH_CONFIG.siteHost + ':' + GRAPH_CONFIG.sitePath).then(function(s) {
    _siteId = s.id;
    return _siteId;
  });
}

function getListId(listKey) {
  if (_listIds[listKey]) return Promise.resolve(_listIds[listKey]);
  var listName = GRAPH_CONFIG.lists[listKey];
  return getSiteId().then(function(sid) {
    return graphFetch('/sites/' + sid + '/lists?$filter=displayName eq \'' + listName + '\'');
  }).then(function(res) {
    if (!res.value || !res.value.length) throw new Error('Liste introuvable: ' + listName);
    _listIds[listKey] = res.value[0].id;
    return _listIds[listKey];
  });
}

// ═══════════════════════════════════════════════════════════
// 🔄 CONVERTISSEURS
// ═══════════════════════════════════════════════════════════
function userFromSP(f) { return { id: f.Title, role: f.Role || 'user' }; }
function userToSP(u)   { return { Title: u.id, Role: u.role || 'user' }; }

function clientFromSP(f) { return f.Title; }
function clientToSP(c)   { return { Title: c }; }

function entryToSP(e) {
  return {
    Title: String(e.id || ('entry_' + Date.now())),
    DateDebut: e.dateDebut || null, DateFin: e.dateFin || null,
    Client: e.client || '', Localisation: e.localisation || '',
    EntryType: e.type || '', Operations: e.operations || '',
    Actions: e.actions || '', Commentaire: e.commentaire || '',
    Impact: e.impact ? 'Oui' : 'Non', CRI: e.cri || '',
    Intervenant: e.intervenant || '', LotTechnique: e.lotTechnique || '',
    HeureAppel: e.heureAppel || '', HeureArrivee: e.heureArrivee || '',
    HeureDepart: e.heureDepart || '', Societe: e.societe || '',
    Lot: e.lot || '', UserId: e.user || ''
  };
}

function entryFromSP(f) {
  return {
    id: f.Title || '',          // ← manquait
    dateDebut: f.DateDebut || '', dateFin: f.DateFin || '',
    client: f.Client || '', localisation: f.Localisation || '',
    type: f.EntryType || '',    // ← plus le fallback sur Title
    operations: f.Operations || '', actions: f.Actions || '',
    commentaire: f.Commentaire || '', impact: f.Impact === 'Oui',
    cri: f.CRI || '', intervenant: f.Intervenant || '',
    lotTechnique: f.LotTechnique || '',
    heureAppel: f.HeureAppel || '', heureArrivee: f.HeureArrivee || '',
    heureDepart: f.HeureDepart || '', societe: f.Societe || '',
    lot: f.Lot || '', user: f.UserId || ''
  };
}


// ═══════════════════════════════════════════════════════════
// 📥 LECTURE
// ═══════════════════════════════════════════════════════════
function spGetItems(listKey) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items?$expand=fields&$top=5000');
  }).then(function(res) {
    return (res.value || []).map(function(it) {
      return { id: it.id, fields: it.fields };
    });
  });
}

function apiGet(listKey) {
  return spGetItems(listKey).then(function(items) {
    if (listKey === 'users')    return items.map(function(i){ var u = userFromSP(i.fields); u._spId = i.id; return u; });
    if (listKey === 'clients')  return items.map(function(i){ return clientFromSP(i.fields); });
    if (listKey === 'entries')  return items.map(function(i){ var e = entryFromSP(i.fields); e._spId = i.id; return e; });
    if (listKey === 'access') {
      var map = {};
      items.forEach(function(i){
        try { map[i.fields.Title] = JSON.parse(i.fields.ClientsJSON || '[]'); }
        catch(e){ map[i.fields.Title] = []; }
      });
      return map;
    }
    if (listKey === 'planning') {
      var pl = {};
      items.forEach(function(i){
        try { pl[i.fields.Title] = JSON.parse(i.fields.DataJSON || '{}'); }
        catch(e){ pl[i.fields.Title] = { employees: [], cells: {} }; }
        pl[i.fields.Title]._spId = i.id;
      });
      return pl;
    }
    if (listKey === 'planningSst') {
      var ps = {};
      items.forEach(function(i){
        try { ps[i.fields.Title] = JSON.parse(i.fields.DataJSON || '{}'); }
        catch(e){ ps[i.fields.Title] = { ssts: [], cells: {} }; }
        ps[i.fields.Title]._spId = i.id;
      });
      return ps;
    }
    if (listKey === 'loginHistory') {
  return items.map(function(i) {
    return {
      id:            i.id,
      email:         i.fields.Title,
      dateConnexion: i.fields.DateConnexion,
      statut:        i.fields.Statut,
      navigateur:    i.fields.Navigateur
    };
  });
}
    return items;
  });
}

// ═══════════════════════════════════════════════════════════
// 📤 ÉCRITURE
// ═══════════════════════════════════════════════════════════
function spCreate(listKey, fields) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items', {
      method: 'POST', body: JSON.stringify({ fields: fields })
    });
  });
}
function spUpdate(listKey, itemId, fields) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items/' + itemId + '/fields', {
      method: 'PATCH', body: JSON.stringify(fields)
    });
  });
}
function spDelete(listKey, itemId) {
  return Promise.all([getSiteId(), getListId(listKey)]).then(function(r) {
    return graphFetch('/sites/' + r[0] + '/lists/' + r[1] + '/items/' + itemId, { method: 'DELETE' });
  });
}

function apiSaveAll(listKey, data) {
  return spGetItems(listKey).then(function(existing) {
    var existingByTitle = {};
    existing.forEach(function(it){ existingByTitle[it.fields.Title] = it; });
    var ops = [];

    if (listKey === 'users') {
      var seen = {};
      data.forEach(function(u){
        seen[u.id] = true;
        var f = userToSP(u);
        if (existingByTitle[u.id]) ops.push(spUpdate('users', existingByTitle[u.id].id, f));
        else ops.push(spCreate('users', f));
      });
      existing.forEach(function(it){ if (!seen[it.fields.Title]) ops.push(spDelete('users', it.id)); });
    }
    else if (listKey === 'clients') {
      var seenC = {};
      data.forEach(function(c){
        seenC[c] = true;
        if (!existingByTitle[c]) ops.push(spCreate('clients', { Title: c }));
      });
      existing.forEach(function(it){ if (!seenC[it.fields.Title]) ops.push(spDelete('clients', it.id)); });
    }
    else if (listKey === 'access') {
      var seenA = {};
      Object.keys(data).forEach(function(uid){
        seenA[uid] = true;
        var f = { Title: uid, ClientsJSON: JSON.stringify(data[uid] || []) };
        if (existingByTitle[uid]) ops.push(spUpdate('access', existingByTitle[uid].id, f));
        else ops.push(spCreate('access', f));
      });
      existing.forEach(function(it){ if (!seenA[it.fields.Title]) ops.push(spDelete('access', it.id)); });
    }
    else if (listKey === 'planning') {
      var seenP = {};
      Object.keys(data).forEach(function(site){
        seenP[site] = true;
        var clean = Object.assign({}, data[site]); delete clean._spId;
        var f = { Title: site, DataJSON: JSON.stringify(clean) };
        if (existingByTitle[site]) ops.push(spUpdate('planning', existingByTitle[site].id, f));
        else ops.push(spCreate('planning', f));
      });
      existing.forEach(function(it){ if (!seenP[it.fields.Title]) ops.push(spDelete('planning', it.id)); });
    }
    else if (listKey === 'entries') {
      var seenE = {};
      data.forEach(function(e){
        var key = e.id || e.Title || '';
        seenE[key] = true;
        var f = entryToSP(e);
        if (existingByTitle[key]) ops.push(spUpdate('entries', existingByTitle[key].id, f));
        else ops.push(spCreate('entries', f));
      });
      existing.forEach(function(it){
        if (!seenE[it.fields.Title]) ops.push(spDelete('entries', it.id));
      });
    }
    else if (listKey === 'planningSst') {
      var seenPS = {};
      Object.keys(data).forEach(function(site){
        seenPS[site] = true;
        var clean = Object.assign({}, data[site]); delete clean._spId;
        var f = { Title: site, DataJSON: JSON.stringify(clean) };
        if (existingByTitle[site]) ops.push(spUpdate('planningSst', existingByTitle[site].id, f));
        else ops.push(spCreate('planningSst', f));
      });
      existing.forEach(function(it){ if (!seenPS[it.fields.Title]) ops.push(spDelete('planningSst', it.id)); });
    }

    return Promise.all(ops);  // ← ICI, après tous les else if
  });
}


function apiAddEntry(entry) {
  entry.id = entry.id || ('entry_' + Date.now() + '_' + Math.random().toString(36).slice(2));
  return spCreate('entries', entryToSP(entry)).then(function(res) {
    entry._spId = res.id;
    return entry;
  });
}

function apiDeleteEntry(entry) {
  if (!entry._spId) return Promise.resolve();
  return spDelete('entries', entry._spId);
}

// ═══════════════════════════════════════════════════════════
// 🚀 LOAD ALL
// ═══════════════════════════════════════════════════════════
function loadAllData() {
  return Promise.all([
    apiGet('users'), apiGet('clients'), apiGet('entries'),
    apiGet('planning'), apiGet('access'), apiGet('planningSst')  // ← ajouter
  ]).then(function(r) {
    users = r[0]; clients = r[1]; entries = r[2];
    planningData = r[3]; accessMap = r[4]; planningSSTData = r[5];  // ← ajouter
    console.log('✅ Data loaded', { users: users.length, clients: clients.length, entries: entries.length });
  });
}

// ═══════════════════════════════════════════════════════════
// 🎬 BOOTSTRAP
// ═══════════════════════════════════════════════════════════
window.addEventListener('load', function() {
  msalInstance.handleRedirectPromise().then(function(resp) {
    var account = (resp && resp.account) || msalInstance.getAllAccounts()[0];
    if (account) {
      _currentAccount = account;
      msalInstance.setActiveAccount(account);
      console.log('✅ Connecté:', account.username);

      loadAllData().then(function() {
        // 🔍 Trouver / créer l'utilisateur courant
        var email = account.username;
        var u = users.find(function(x){ return x.id === email; });
        if (!u) {
          u = { id: email, role: 'user' };
          users.push(u);
          apiSaveAll('users', users);
        }
        currentUser = u;
        console.log('👤 currentUser:', currentUser);
        if (currentUser.role !== 'admin') {
          trackLogin(currentUser.id);
        }


        // ✅ Affichage menu selon rôle
        var welcome = document.getElementById('welcomeUser');
        if (welcome) welcome.textContent = currentUser.id;

        var adminCard = document.getElementById('menu-admin');
        if (adminCard) {
          adminCard.style.display = (currentUser.role === 'admin') ? 'block' : 'none';
        }

        goTo('screen-menu');
      }).catch(function(err) {
        console.error('❌ Load error:', err);
        if (typeof showToast === 'function') showToast('Erreur chargement données');
        goTo('screen-login');
      });
    } else {
      goTo('screen-login');
    }
  }).catch(function(err) {
    console.error('❌ MSAL error:', err);
    goTo('screen-login');
  });
});
