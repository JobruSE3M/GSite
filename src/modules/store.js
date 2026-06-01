/**
 * Gestionnaire d'état encapsulé — Phase 2
 * Accès aux données partagées via getters/setters (plus de variables globales).
 */

const state = {
  users: [],
  clients: [],
  entries: [],
  accessMap: {},
  planningData: {},
  planningSSTData: {},
  allLoginHistory: [],
  currentUser: null,
  currentType: '',
  accessEditUser: '',
  planningMonth: new Date().getMonth(),
  planningYear: new Date().getFullYear(),
  pickerTarget: '',
  isDragging: false,
  dragEmpIndex: null,
  dragStartDay: null,
  dragCurrentDay: null,
  dragSourceCode: null,
  sstYear: new Date().getFullYear(),
};

function assertArray(name, value) {
  if (!Array.isArray(value)) {
    throw new TypeError(`store.${name} doit être un tableau`);
  }
}

function assertObject(name, value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`store.${name} doit être un objet`);
  }
}

export const store = {
  get users() {
    return state.users;
  },
  set users(value) {
    assertArray('users', value);
    state.users = value;
  },

  get clients() {
    return state.clients;
  },
  set clients(value) {
    assertArray('clients', value);
    state.clients = value;
  },

  get entries() {
    return state.entries;
  },
  set entries(value) {
    assertArray('entries', value);
    state.entries = value;
  },

  get accessMap() {
    return state.accessMap;
  },
  set accessMap(value) {
    assertObject('accessMap', value);
    state.accessMap = value;
  },

  get planningData() {
    return state.planningData;
  },
  set planningData(value) {
    assertObject('planningData', value);
    state.planningData = value;
  },

  get planningSSTData() {
    return state.planningSSTData;
  },
  set planningSSTData(value) {
    assertObject('planningSSTData', value);
    state.planningSSTData = value;
  },

  get allLoginHistory() {
    return state.allLoginHistory;
  },
  set allLoginHistory(value) {
    assertArray('allLoginHistory', value);
    state.allLoginHistory = value;
  },

  get currentUser() {
    return state.currentUser;
  },
  set currentUser(value) {
    state.currentUser = value;
  },

  get currentType() {
    return state.currentType;
  },
  set currentType(value) {
    state.currentType = value;
  },

  get accessEditUser() {
    return state.accessEditUser;
  },
  set accessEditUser(value) {
    state.accessEditUser = value;
  },

  get planningMonth() {
    return state.planningMonth;
  },
  set planningMonth(value) {
    state.planningMonth = value;
  },

  get planningYear() {
    return state.planningYear;
  },
  set planningYear(value) {
    state.planningYear = value;
  },

  get pickerTarget() {
    return state.pickerTarget;
  },
  set pickerTarget(value) {
    state.pickerTarget = value;
  },

  get isDragging() {
    return state.isDragging;
  },
  set isDragging(value) {
    state.isDragging = value;
  },

  get dragEmpIndex() {
    return state.dragEmpIndex;
  },
  set dragEmpIndex(value) {
    state.dragEmpIndex = value;
  },

  get dragStartDay() {
    return state.dragStartDay;
  },
  set dragStartDay(value) {
    state.dragStartDay = value;
  },

  get dragCurrentDay() {
    return state.dragCurrentDay;
  },
  set dragCurrentDay(value) {
    state.dragCurrentDay = value;
  },

  get dragSourceCode() {
    return state.dragSourceCode;
  },
  set dragSourceCode(value) {
    state.dragSourceCode = value;
  },

  get sstYear() {
    return state.sstYear;
  },
  set sstYear(value) {
    state.sstYear = value;
  },

  setLoadedData({ users, clients, entries, planning, access, planningSst }) {
    if (users !== undefined) this.users = users;
    if (clients !== undefined) this.clients = clients;
    if (entries !== undefined) this.entries = entries;
    if (planning !== undefined) this.planningData = planning;
    if (access !== undefined) this.accessMap = access;
    if (planningSst !== undefined) this.planningSSTData = planningSst;
  },
};
