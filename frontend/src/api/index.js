const BASE = import.meta.env.VITE_API_URL || '/api';

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error('[SecuroPlan] ⚠️  VITE_API_URL non définie au build.');
}

export const API_BASE_URL = BASE;

async function request(method, path, body) {
  const token = localStorage.getItem('auth_token');
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Session expirée');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erreur serveur');
  }
  return res.json();
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);
const del = (path) => request('DELETE', path);

// Auth
export const authApi = {
  register: (data) => post('/auth/register', data),
  login: (data) => post('/auth/login', data),
  me: () => get('/auth/me'),
  changePassword: (data) => put('/auth/password', data),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => post('/auth/reset-password', { token, password }),
  getUsers: () => get('/auth/users'),
  createUser: (data) => post('/auth/users', data),
  updateUser: (id, data) => put(`/auth/users/${id}`, data),
  deleteUser: (id) => del(`/auth/users/${id}`),
};

// Agents
export const agentsApi = {
  list: (active) => get(`/agents${active !== undefined ? `?active=${active}` : ''}`),
  get: (id) => get(`/agents/${id}`),
  create: (data) => post('/agents', data),
  update: (id, data) => put(`/agents/${id}`, data),
  delete: (id) => del(`/agents/${id}`),
  archive: (id) => post(`/agents/${id}/archive`, {}),
  unarchive: (id) => post(`/agents/${id}/unarchive`, {}),
  sendPortal: (id) => post(`/agents/${id}/send-portal`, {}),
  available: (params = {}) => { const q = new URLSearchParams(params).toString(); return get(`/agents/available${q ? `?${q}` : ''}`); },
  carteProAlerts: () => get('/agents/carte-pro-alerts'),
  import: (rows) => post('/agents/import', { rows }),
  uploadPhoto: (id, photo) => post(`/agents/${id}/photo`, { photo }),
  deletePhoto: (id) => del(`/agents/${id}/photo`),
};

// Clients
export const clientsApi = {
  list: () => get('/clients'),
  get: (id) => get(`/clients/${id}`),
  create: (data) => post('/clients', data),
  update: (id, data) => put(`/clients/${id}`, data),
  delete: (id) => del(`/clients/${id}`),
};

// Sites
export const sitesApi = {
  list: (clientId) => get(`/sites${clientId ? `?client_id=${clientId}` : ''}`),
  get: (id) => get(`/sites/${id}`),
  create: (data) => post('/sites', data),
  update: (id, data) => put(`/sites/${id}`, data),
  delete: (id) => del(`/sites/${id}`),
};

// Shifts
export const shiftsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/shifts${q ? `?${q}` : ''}`);
  },
  get: (id) => get(`/shifts/${id}`),
  create: (data) => post('/shifts', data),
  update: (id, data) => put(`/shifts/${id}`, data),
  delete: (id) => del(`/shifts/${id}`),
  stats: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/shifts/stats/summary${q ? `?${q}` : ''}`);
  },
  replacements: (id) => get(`/shifts/${id}/replacements`),
  overtime: (weeks = 4) => get(`/shifts/stats/overtime?weeks=${weeks}`),
  copyDay: (from_date, to_date, copy_agents) => post('/shifts/copy-day', { from_date, to_date, copy_agents }),
  createRecurring: (data) => post('/shifts/recurring', data),
  deleteRecurrence: (recurrenceId, from_date) => {
    const q = from_date ? `?from_date=${from_date}` : '';
    return del(`/shifts/recurrence/${recurrenceId}${q}`);
  },
};

// Absences
export const absencesApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/absences${q ? `?${q}` : ''}`);
  },
  get: (id) => get(`/absences/${id}`),
  create: (data) => post('/absences', data),
  update: (id, data) => put(`/absences/${id}`, data),
  delete: (id) => del(`/absences/${id}`),
  approve: (id) => put(`/absences/${id}/approve`, {}),
  reject: (id, reason) => put(`/absences/${id}/reject`, { reason }),
};

// Quotes
export const quotesApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/quotes${q ? `?${q}` : ''}`);
  },
  get: (id) => get(`/quotes/${id}`),
  create: (data) => post('/quotes', data),
  update: (id, data) => put(`/quotes/${id}`, data),
  delete: (id) => del(`/quotes/${id}`),
};

// Settings
export const settingsApi = {
  get: () => get('/settings'),
  getAll: () => get('/settings/all'),
  update: (data) => put('/settings', data),
};

// PDF (token passé en query string car window.open ne peut pas envoyer de header)
export const pdfApi = {
  agentPlanning: (id, params) => {
    const token = localStorage.getItem('auth_token');
    const q = new URLSearchParams({ ...params, token }).toString();
    window.open(`${BASE}/pdf/planning/agent/${id}?${q}`, '_blank');
  },
  sitePlanning: (id, params) => {
    const token = localStorage.getItem('auth_token');
    const q = new URLSearchParams({ ...params, token }).toString();
    window.open(`${BASE}/pdf/planning/site/${id}?${q}`, '_blank');
  },
  clientPlanning: (id, params) => {
    const token = localStorage.getItem('auth_token');
    const q = new URLSearchParams({ ...params, token }).toString();
    window.open(`${BASE}/pdf/planning/client/${id}?${q}`, '_blank');
  },
  quote: (id) => {
    const token = localStorage.getItem('auth_token');
    window.open(`${BASE}/pdf/quote/${id}?token=${token}`, '_blank');
  },
  agentBadge: (id) => {
    const token = localStorage.getItem('auth_token');
    window.open(`${BASE}/pdf/badge/${id}?token=${token}`, '_blank');
  },
  agentRecap: (agentId, month) => {
    const token = localStorage.getItem('auth_token');
    window.open(`${BASE}/pdf/recap/agent/${agentId}?month=${month}&token=${token}`, '_blank');
  },
};

// Email
export const emailApi = {
  sendAgentPlanning: (id, data) => post(`/email/planning/agent/${id}`, data),
  sendBulkPlanning: (data) => post('/email/planning/bulk', data),
  sendQuote: (id, data) => post(`/email/quote/${id}`, data),
};

// Simulation marge
export const simulationApi = {
  margin: (params = {}) => { const q = new URLSearchParams(params).toString(); return get(`/shifts/stats/margin${q ? `?${q}` : ''}`); },
};

// Add-ons & Packs
export const addonsApi = {
  list: () => get('/addons'),
  limits: () => get('/addons/limits'),
  checkout: (addonId) => post(`/addons/checkout/${addonId}`, {}),
  cancel: (addonId) => post(`/addons/cancel/${addonId}`, {}),
};

// Billing
export const billingApi = {
  getSubscription: () => get('/billing/subscription'),
  cancel: () => post('/billing/cancel', {}),
  reactivate: () => post('/billing/reactivate', {}),
};

// Contracts agents
export const contractsApi = {
  list: () => get('/contracts'),
  get: (id) => get(`/contracts/${id}`),
  create: (data) => post('/contracts', data),
  update: (id, data) => put(`/contracts/${id}`, data),
  delete: (id) => del(`/contracts/${id}`),
  send: (id) => post(`/contracts/${id}/send`, {}),
  getByToken: (token) => fetch(`${BASE}/contracts/sign/${token}`).then(r => r.json()),
  signByToken: (token) => fetch(`${BASE}/contracts/sign/${token}`, { method: 'POST' }).then(r => r.json()),
};

// Contrats clients (prestation)
export const clientContractsApi = {
  list: () => get('/client-contracts'),
  get: (id) => get(`/client-contracts/${id}`),
  create: (data) => post('/client-contracts', data),
  update: (id, data) => put(`/client-contracts/${id}`, data),
  delete: (id) => del(`/client-contracts/${id}`),
  send: (id) => post(`/client-contracts/${id}/send`, {}),
  getByToken: (token) => fetch(`${BASE}/client-contracts/sign/${token}`).then(r => r.json()),
  signByToken: (token) => fetch(`${BASE}/client-contracts/sign/${token}`, { method: 'POST' }).then(r => r.json()),
};

// Invoices
export const invoicesApi = {
  list: (params = {}) => { const q = new URLSearchParams(params).toString(); return get(`/invoices${q ? `?${q}` : ''}`); },
  get: (id) => get(`/invoices/${id}`),
  create: (data) => post('/invoices', data),
  update: (id, data) => put(`/invoices/${id}`, data),
  delete: (id) => del(`/invoices/${id}`),
  fromQuote: (quoteId) => post(`/invoices/from-quote/${quoteId}`, {}),
  previewPlanning: (params) => { const q = new URLSearchParams(params).toString(); return get(`/invoices/preview-planning?${q}`); },
  fromPlanning: (data) => post('/invoices/from-planning', data),
  remind: (id) => post(`/invoices/${id}/remind`, {}),
  statsCA: () => get('/invoices/stats/ca'),
};

// Audit
export const auditApi = {
  list: (params = {}) => { const q = new URLSearchParams(params).toString(); return get(`/audit${q ? `?${q}` : ''}`); },
};

// Export CSV / Excel (window.open car c'est un téléchargement)
export const exportApi = {
  shifts: (start_date, end_date, format = 'csv') => {
    const token = localStorage.getItem('auth_token');
    window.open(`${BASE}/export/shifts?start_date=${start_date}&end_date=${end_date}&format=${format}&token=${token}`, '_blank');
  },
  invoices: (start_date, end_date, format = 'csv') => {
    const token = localStorage.getItem('auth_token');
    window.open(`${BASE}/export/invoices?start_date=${start_date}&end_date=${end_date}&format=${format}&token=${token}`, '_blank');
  },
};

// Rapport mensuel PDF
export const reportApi = {
  monthly: (clientId, month) => {
    const token = localStorage.getItem('auth_token');
    window.open(`${BASE}/pdf/report/monthly/${clientId}?month=${month}&token=${token}`, '_blank');
  },
};

// Shifts check-in/check-out
export const checkinApi = {
  checkin: (shiftId, coords) => post(`/shifts/${shiftId}/checkin`, coords),
  checkout: (shiftId, coords) => post(`/shifts/${shiftId}/checkout`, coords),
};

// Offres de vacation
export const shiftOffersApi = {
  send: (data) => post('/shift-offers', data),
  list: (params = {}) => { const q = new URLSearchParams(params).toString(); return get(`/shift-offers${q ? `?${q}` : ''}`); },
  cancel: (id) => del(`/shift-offers/${id}`),
};

// Portail client
export const portalApi = {
  generate: (clientId) => post(`/clients/${clientId}/portal-token`, {}),
  send:     (clientId) => post(`/clients/${clientId}/portal-send`,  {}),
  revoke:   (clientId) => del(`/clients/${clientId}/portal-token`),
};
