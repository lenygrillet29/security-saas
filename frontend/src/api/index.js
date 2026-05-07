// VITE_API_URL est injectée au BUILD TIME par Vercel.
// Si absente → fallback '/api' (dev local via proxy Vite uniquement).
const BASE = import.meta.env.VITE_API_URL || '/api';

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error(
    '[SecuritySaaS] ⚠️  VITE_API_URL non définie au build.\n' +
    'Toutes les requêtes vont sur /api (Vercel) au lieu de Railway.\n' +
    'Dans Vercel → Settings → Environment Variables, ajoute :\n' +
    '  VITE_API_URL = https://TON_APP.up.railway.app/api\n' +
    'puis redéploie.'
  );
}

export const API_BASE_URL = BASE;

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
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
  update: (data) => put('/settings', data),
};

// PDF (open in new tab)
export const pdfApi = {
  agentPlanning: (id, params) => {
    const q = new URLSearchParams(params).toString();
    window.open(`${BASE}/pdf/planning/agent/${id}?${q}`, '_blank');
  },
  sitePlanning: (id, params) => {
    const q = new URLSearchParams(params).toString();
    window.open(`${BASE}/pdf/planning/site/${id}?${q}`, '_blank');
  },
  clientPlanning: (id, params) => {
    const q = new URLSearchParams(params).toString();
    window.open(`${BASE}/pdf/planning/client/${id}?${q}`, '_blank');
  },
  quote: (id) => window.open(`${BASE}/pdf/quote/${id}`, '_blank'),
};

// Email
export const emailApi = {
  sendAgentPlanning: (id, data) => post(`/email/planning/agent/${id}`, data),
  sendQuote: (id, data) => post(`/email/quote/${id}`, data),
};
