const BASE = import.meta.env.VITE_API_URL || '/api';

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error('[SecuritySaaS] ⚠️  VITE_API_URL non définie au build.');
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
};

// Email
export const emailApi = {
  sendAgentPlanning: (id, data) => post(`/email/planning/agent/${id}`, data),
  sendQuote: (id, data) => post(`/email/quote/${id}`, data),
};

// Billing
export const billingApi = {
  getSubscription: () => get('/billing/subscription'),
  cancel: () => post('/billing/cancel', {}),
  reactivate: () => post('/billing/reactivate', {}),
};

// Contracts
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

// Shifts check-in/check-out
export const checkinApi = {
  checkin: (shiftId, coords) => post(`/shifts/${shiftId}/checkin`, coords),
  checkout: (shiftId, coords) => post(`/shifts/${shiftId}/checkout`, coords),
};
