import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertTriangle, AlertCircle, Info,
  CheckSquare, UserMinus, FileWarning, GraduationCap,
  Siren, Package, RefreshCw,
} from 'lucide-react';
import { get } from '../api';

const CATEGORY_META = {
  taches:      { label: 'Tâches',       icon: CheckSquare,   color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  absences:    { label: 'Absences',     icon: UserMinus,     color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  documents:   { label: 'Documents',    icon: FileWarning,   color: 'text-rose-400',   bg: 'bg-rose-500/10'   },
  formations:  { label: 'Formations',   icon: GraduationCap, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  incidents:   { label: 'Incidents',    icon: Siren,         color: 'text-orange-400', bg: 'bg-orange-500/10' },
  equipements: { label: 'Équipements',  icon: Package,       color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
};

const LEVEL_META = {
  critique: { label: 'Critique', icon: AlertCircle,   badge: 'bg-red-500/15 text-red-400 border-red-500/30',    dot: 'bg-red-500'    },
  warning:  { label: 'Attention', icon: AlertTriangle, badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  info:     { label: 'Info',      icon: Info,          badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-500' },
};

function NotifCard({ item, onClick }) {
  const cat   = CATEGORY_META[item.category] || CATEGORY_META.taches;
  const lvl   = LEVEL_META[item.level] || LEVEL_META.info;
  const CatIcon = cat.icon;
  const LvlIcon = lvl.icon;

  return (
    <button onClick={onClick}
      className="w-full flex items-start gap-4 px-5 py-4 hover:bg-dark-700/60 transition-colors text-left border-b border-dark-600/50 last:border-0">
      <div className={`w-9 h-9 rounded-xl ${cat.bg} flex items-center justify-center shrink-0 mt-0.5`}>
        <CatIcon className={`w-4 h-4 ${cat.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-white text-sm font-medium leading-snug">{item.title}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${lvl.badge}`}>
            <LvlIcon className="w-2.5 h-2.5" />
            {lvl.label}
          </span>
        </div>
        {item.detail && <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>}
        {item.assignee && <p className="text-xs text-slate-600 mt-0.5">→ {item.assignee}</p>}
      </div>
    </button>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // all | critique | warning | info | <category>

  async function load() {
    setLoading(true);
    try { setData(await get('/notifications')); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const items = data?.items || [];

  const critCount = items.filter(i => i.level === 'critique').length;
  const warnCount = items.filter(i => i.level === 'warning').length;
  const infoCount = items.filter(i => i.level === 'info').length;

  const catCounts = Object.fromEntries(
    Object.keys(CATEGORY_META).map(k => [k, items.filter(i => i.category === k).length])
  );

  const displayed = filter === 'all'      ? items
    : ['critique','warning','info'].includes(filter) ? items.filter(i => i.level === filter)
    : items.filter(i => i.category === filter);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-400" />
            Notifications
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? 'Chargement…' : items.length === 0 ? 'Aucune alerte active' : `${items.length} alerte${items.length > 1 ? 's' : ''} active${items.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={load}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-700 border border-dark-600 text-slate-300 hover:text-white text-sm transition-colors ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: 'critique', count: critCount, label: 'Critiques',  bg: 'bg-red-500/10 border-red-500/20',    text: 'text-red-400',    icon: AlertCircle   },
          { key: 'warning',  count: warnCount, label: 'Attentions', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400',  icon: AlertTriangle },
          { key: 'info',     count: infoCount, label: 'Infos',      bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-400',  icon: Info          },
        ].map(k => (
          <button key={k.key} onClick={() => setFilter(filter === k.key ? 'all' : k.key)}
            className={`card p-4 flex items-center gap-4 transition-all cursor-pointer border ${k.bg} ${filter === k.key ? 'ring-1 ring-white/20' : 'hover:opacity-80'}`}>
            <k.icon className={`w-6 h-6 ${k.text} shrink-0`} />
            <div>
              <div className={`text-2xl font-bold ${k.text}`}>{k.count}</div>
              <div className="text-xs text-slate-500">{k.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-6 min-h-0">
        {/* Filtres par catégorie */}
        <div className="w-48 shrink-0 space-y-1">
          <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pb-1">Catégories</p>
          <button onClick={() => setFilter('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${filter === 'all' ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30' : 'text-slate-400 hover:text-white hover:bg-dark-700'}`}>
            <span>Toutes</span>
            <span className="text-xs bg-dark-600 px-1.5 py-0.5 rounded-full">{items.length}</span>
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const count = catCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button key={key} onClick={() => setFilter(filter === key ? 'all' : key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${filter === key ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30' : 'text-slate-400 hover:text-white hover:bg-dark-700'}`}>
                <div className="flex items-center gap-2">
                  <meta.icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span>{meta.label}</span>
                </div>
                <span className="text-xs bg-dark-600 px-1.5 py-0.5 rounded-full">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Liste */}
        <div className="flex-1 card overflow-hidden p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
              <Bell className="w-10 h-10 text-slate-700" />
              <p className="text-sm">{items.length === 0 ? 'Tout est à jour !' : 'Aucune alerte dans cette catégorie'}</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-600/50">
              {displayed.map(item => (
                <NotifCard key={item.id} item={item} onClick={() => navigate(item.link)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
