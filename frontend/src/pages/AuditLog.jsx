import { useEffect, useState } from 'react';
import { Shield, Search, Filter } from 'lucide-react';
import { ToastProvider } from '../components/Toast';

const BASE = import.meta.env.VITE_API_URL || '/api';

const COLOR_MAP = {
  emerald: 'text-emerald-400 bg-emerald-400/10',
  blue:    'text-blue-400 bg-blue-400/10',
  red:     'text-red-400 bg-red-400/10',
  amber:   'text-amber-400 bg-amber-400/10',
  violet:  'text-violet-400 bg-violet-400/10',
  slate:   'text-slate-400 bg-slate-400/10',
};

const ENTITY_LABELS = {
  agent: 'Agent', client: 'Client', site: 'Site',
  shift: 'Prestation', contract: 'Contrat', invoice: 'Facture',
  quote: 'Devis', shifts: 'Prestations', invoices: 'Factures',
};

function AuditLogInner() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch(`${BASE}/audit?limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const entityTypes = ['all', ...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (filterType !== 'all' && l.entity_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return (l.user_name || '').toLowerCase().includes(s)
          || (l.entity_name || '').toLowerCase().includes(s)
          || (l.action_label || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" /> Journal d'audit
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Historique complet des actions effectuées sur le compte</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9 w-full" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {entityTypes.map(t => (
            <button key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? 'bg-blue-600 text-white' : 'bg-dark-700 text-slate-400 hover:text-white'}`}
            >
              {t === 'all' ? 'Tout' : ENTITY_LABELS[t] || t}
            </button>
          ))}
        </div>
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune action enregistrée</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(log => {
            const color = COLOR_MAP[log.action_color] || COLOR_MAP.slate;
            return (
              <div key={log.id} className="flex items-center gap-4 px-4 py-3 bg-dark-800 border border-dark-600 rounded-xl hover:border-dark-500 transition-colors">
                <span className={`text-xs px-2 py-0.5 rounded font-semibold shrink-0 ${color}`}>
                  {log.action_label}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">
                    {log.entity_name
                      ? <><span className="text-slate-400">{ENTITY_LABELS[log.entity_type] || log.entity_type} : </span>{log.entity_name}</>
                      : <span className="text-slate-400">{ENTITY_LABELS[log.entity_type] || log.entity_type || '—'}</span>
                    }
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">{log.user_name}</div>
                  <div className="text-xs text-slate-600">
                    {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    {' '}
                    {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AuditLog() {
  return <ToastProvider><AuditLogInner /></ToastProvider>;
}
