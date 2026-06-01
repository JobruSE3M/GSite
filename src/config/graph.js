/** Configuration Microsoft Graph / SharePoint */
export const GRAPH_CONFIG = {
  clientId: 'a34965e3-9597-4cd7-9373-214086e8ec4c',
  tenantId: '2a9dfcb1-f2fd-4d8d-9046-00b1c3267d95',
  siteHost: 'se3m.sharepoint.com',
  sitePath: '/sites/GestionDeSite',
  lists: {
    users: 'GS_Users',
    clients: 'GS_Clients',
    entries: 'GS_Entries',
    planning: 'GS_Planning',
    access: 'GS_Access',
    planningSst: 'GS_PlanningSst',
    loginHistory: 'GS_LoginHistory',
  },
};

export const GRAPH_SCOPES = ['Sites.ReadWrite.All', 'User.Read'];
