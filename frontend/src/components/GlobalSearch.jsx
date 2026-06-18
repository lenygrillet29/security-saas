import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Building2, MapPin, Calendar, X, Loader2 } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';

function useDebounce(val, ms) {
  const [debounced, setDebounced] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return debounced;
}

function ResultSection({ icon: Icon, label, items, renderItem, onSelect }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Icon className="w-3 h-3 text-slate-500" />
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          onMouseDown={e => { e.preventDefault(); onSelect(item); }}
          className="w-full text-left px-4 py-2.5 hover:bg-dark-700 transition-colors flex items-center gap-3 group"
        >
          {renderItem(item)}
        </button>
      ))}
    </div>
  );
}

export default function GlobalSearch() {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 220);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setResults(null); }
  }, [open]);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); return; }
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    fetch(`${BASE}/search?q=${encodeURIComponent(debouncedQuery)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setResults(data))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  function go(path) { navigate(path); setOpen(false); }

  const hasResults = results && (
    results.agents?.length || results.clients?.length ||
    results.sites?.length  || results.shifts?.length
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onMouseDown={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-dark-800 border border-dark-500 rounded-2xl shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-dark-600">
          {loading
            ? <Loader2 className="w-4 h-4 text-slate-400 shrink-0 animate-spin" />
            : <Search className="w-4 h-4 text-slate-400 shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un agent, client, site…"
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-xs text-slate-600 border border-dark-500 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Résultats */}
        {hasResults ? (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-dark-700 py-1">
            <ResultSection
              icon={Users} label="Agents"
              items={results.agents}
              onSelect={a => go('/agents')}
              renderItem={a => (
                <>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: a.color || '#3B82F6' }}>
                    {a.first_name?.[0]}{a.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium">{a.first_name} {a.last_name}</span>
                    {!a.active && <span className="ml-2 text-xs text-red-400">Inactif</span>}
                    {a.contract_type && <span className="ml-2 text-xs text-slate-500">{a.contract_type}</span>}
                  </div>
                </>
              )}
            />
            <ResultSection
              icon={Building2} label="Clients"
              items={results.clients}
              onSelect={c => go('/clients')}
              renderItem={c => (
                <>
                  <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium">{c.name}</span>
                    {c.email && <span className="ml-2 text-xs text-slate-500">{c.email}</span>}
                  </div>
                </>
              )}
            />
            <ResultSection
              icon={MapPin} label="Sites"
              items={results.sites}
              onSelect={s => go('/sites')}
              renderItem={s => (
                <>
                  <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium">{s.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{s.client_name}</span>
                  </div>
                </>
              )}
            />
            <ResultSection
              icon={Calendar} label="Vacations récentes"
              items={results.shifts}
              onSelect={s => go('/planning')}
              renderItem={s => (
                <>
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium">
                      {s.agent_first ? `${s.agent_last} ${s.agent_first}` : 'Sans agent'} — {s.site_name}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {s.date} · {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                    </span>
                  </div>
                </>
              )}
            />
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            Aucun résultat pour « {query} »
          </div>
        ) : query.length < 2 && query.length > 0 ? (
          <div className="px-4 py-4 text-center text-slate-600 text-xs">Tapez au moins 2 caractères…</div>
        ) : (
          <div className="px-4 py-5 text-center text-slate-600 text-xs">
            Rechercher agents · clients · sites · vacations
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-dark-700 text-xs text-slate-600">
          <span><kbd className="border border-dark-500 rounded px-1">↵</kbd> ouvrir</span>
          <span><kbd className="border border-dark-500 rounded px-1">Esc</kbd> fermer</span>
          <span className="ml-auto opacity-50">⌘K</span>
        </div>
      </div>
    </div>
  );
}
