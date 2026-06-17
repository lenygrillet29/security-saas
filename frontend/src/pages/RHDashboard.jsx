import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Users, Clock, Sun, Wallet, Shield, AlertTriangle } from 'lucide-react';
import { rhApi } from '../api';
import { ToastProvider, useToast } from '../components/Toast';

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function fmtH(h) {
  if (!h) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm > 0 ? String(mm).padStart(2, '0') : ''}`;
}

function Badge({ children, color }) {
  const colors = {
    red:    'bg-red-500/15 text-red-400',
    amber:  'bg-amber-500/15 text-amber-400',
    emerald:'bg-emerald-500/15 text-emerald-400',
    slate:  'bg-slate-500/15 text-slate-400',
    blue:   'bg-blue-500/15 text-blue-400',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color] || colors.slate}`}>{children}</span>;
}

function AgentCard({ a, navigate }) {
  const cpColor = a.cp_balance <= 0 ? 'text-red-400' : a.cp_balance < 5 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div
      className="card p-4 hover:border-dark-500 transition-colors cursor-pointer"
      onClick={() => navigate('/agents')}
    >
      {/* En-tête agent */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: a.color || '#3B82F6' }}
        >
          {a.first_name?.[0]}{a.last_name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">{a.last_name} {a.first_name}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <Badge color="blue">{a.contract_type || 'CDI'}</Badge>
            {a.employee_number && <span className="text-xs text-slate-500">{a.employee_number}</span>}
          </div>
        </div>
      </div>

      {/* Stats du mois */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-dark-700/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-slate-500">Heures</span>
          </div>
          <div className="text-base font-bold text-white">{fmtH(a.total_hours)}</div>
          <div className="text-xs text-slate-600">{a.shift_count} vacation{a.shift_count !== 1 ? 's' : ''}</div>
        </div>

        <div className="bg-dark-700/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sun className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-slate-500">CP restants</span>
          </div>
          <div className={`text-base font-bold ${cpColor}`}>{a.cp_balance.toFixed(1)} j</div>
          {a.absence_days > 0 && <div className="text-xs text-slate-600">{a.absence_days}j absent ce mois</div>}
        </div>
      </div>

      {/* Frais + alertes */}
      <div className="flex items-center gap-2 flex-wrap">
        {a.expenses_total > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Wallet className="w-3 h-3 text-emerald-400" />
            <span>{a.expenses_total.toFixed(2)} € frais</span>
          </div>
        )}
        {a.carte_pro_expired && (
          <Badge color="red"><Shield className="w-2.5 h-2.5 inline mr-1" />Carte pro expirée</Badge>
        )}
        {!a.carte_pro_expired && a.carte_pro_days_left !== null && a.carte_pro_days_left <= 30 && (
          <Badge color="amber"><Shield className="w-2.5 h-2.5 inline mr-1" />J-{a.carte_pro_days_left}</Badge>
        )}
        {a.absence_count > 0 && !a.absence_days && (
          <Badge color="amber">{a.absence_count} absence{a.absence_count > 1 ? 's' : ''} en attente</Badge>
        )}
      </div>

      {/* Barre heures détaillée */}
      {a.total_hours > 0 && (
        <div className="mt-3">
          <div className="flex rounded overflow-hidden h-1.5 bg-dark-700">
            {a.hours_breakdown.day > 0 && (
              <div className="bg-amber-400" style={{ width: `${(a.hours_breakdown.day / a.total_hours) * 100}%` }} title={`Jour: ${fmtH(a.hours_breakdown.day)}`} />
            )}
            {a.hours_breakdown.night > 0 && (
              <div className="bg-violet-400" style={{ width: `${(a.hours_breakdown.night / a.total_hours) * 100}%` }} title={`Nuit: ${fmtH(a.hours_breakdown.night)}`} />
            )}
            {a.hours_breakdown.sunday > 0 && (
              <div className="bg-blue-400" style={{ width: `${(a.hours_breakdown.sunday / a.total_hours) * 100}%` }} title={`Dim: ${fmtH(a.hours_breakdown.sunday)}`} />
            )}
            {a.hours_breakdown.holiday > 0 && (
              <div className="bg-rose-400" style={{ width: `${(a.hours_breakdown.holiday / a.total_hours) * 100}%` }} title={`Férié: ${fmtH(a.hours_breakdown.holiday)}`} />
            )}
          </div>
          <div className="flex gap-3 mt-1.5 flex-wrap">
            {a.hours_breakdown.day > 0    && <span className="text-[10px] text-amber-400/70">Jour {fmtH(a.hours_breakdown.day)}</span>}
            {a.hours_breakdown.night > 0  && <span className="text-[10px] text-violet-400/70">Nuit {fmtH(a.hours_breakdown.night)}</span>}
            {a.hours_breakdown.sunday > 0 && <span className="text-[10px] text-blue-400/70">Dim. {fmtH(a.hours_breakdown.sunday)}</span>}
            {a.hours_breakdown.holiday > 0&& <span className="text-[10px] text-rose-400/70">Fér. {fmtH(a.hours_breakdown.holiday)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function RHDashboardInner() {
  const toast    = useToast();
  const navigate = useNavigate();
  const now      = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');

  const ym = `${year}-${String(month).padStart(2, '0')}`;

  async function load() {
    setLoading(true);
    try { setData(await rhApi.dashboard(ym)); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [ym]);

  function prev() { month === 1 ? (setYear(y => y - 1), setMonth(12)) : setMonth(m => m - 1); }
  function next() { month === 12 ? (setYear(y => y + 1), setMonth(1)) : setMonth(m => m + 1); }

  const filtered = data.filter(a =>
    `${a.first_name} ${a.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  // Totaux
  const totalH    = data.reduce((s, a) => s + a.total_hours, 0);
  const totalAbs  = data.reduce((s, a) => s + a.absence_days, 0);
  const totalExp  = data.reduce((s, a) => s + a.expenses_total, 0);
  const alertsCp  = data.filter(a => a.cp_balance < 5).length;
  const alertsCarte = data.filter(a => a.carte_pro_expired || (a.carte_pro_days_left !== null && a.carte_pro_days_left <= 30)).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord RH</h1>
          <p className="text-slate-400 text-sm mt-1">Vue synthèse par agent — heures, CP, absences, frais</p>
        </div>
      </div>

      {/* Sélecteur mois */}
      <div className="flex items-center gap-3">
        <button onClick={prev} className="p-2 rounded-lg bg-dark-800 border border-dark-600 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-[180px] text-center">
          <span className="text-white font-semibold capitalize">{monthLabel(ym)}</span>
        </div>
        <button onClick={next} className="p-2 rounded-lg bg-dark-800 border border-dark-600 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <input
          className="input ml-auto max-w-xs"
          placeholder="Rechercher un agent..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1"><Users className="w-3.5 h-3.5 text-blue-400" /><span className="text-xs text-slate-500">Agents</span></div>
          <div className="text-xl font-bold text-white">{data.length}</div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-3.5 h-3.5 text-amber-400" /><span className="text-xs text-slate-500">Total heures</span></div>
          <div className="text-xl font-bold text-white">{fmtH(totalH)}</div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1"><Sun className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-slate-500">Jours absents</span></div>
          <div className="text-xl font-bold text-white">{totalAbs} j</div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-3.5 h-3.5 text-violet-400" /><span className="text-xs text-slate-500">Frais approuvés</span></div>
          <div className="text-xl font-bold text-white">{totalExp.toFixed(0)} €</div>
        </div>
        <div className={`card p-3 ${alertsCp > 0 || alertsCarte > 0 ? 'border-amber-600/30' : ''}`}>
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /><span className="text-xs text-slate-500">Alertes</span></div>
          <div className="text-xl font-bold text-amber-400">{alertsCp + alertsCarte}</div>
          <div className="text-xs text-slate-600">CP faibles + cartes pro</div>
        </div>
      </div>

      {/* Grille agents */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card p-4 h-40 animate-pulse bg-dark-800" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucun agent trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => <AgentCard key={a.agent_id} a={a} navigate={navigate} />)}
        </div>
      )}
    </div>
  );
}

export default function RHDashboard() {
  return <ToastProvider><RHDashboardInner /></ToastProvider>;
}
