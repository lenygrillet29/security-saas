import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { TrendingUp, TrendingDown, Euro, Clock, Users, BarChart3, Info } from 'lucide-react';
import { simulationApi } from '../api';
import { ToastProvider, useToast } from '../components/Toast';

function KPICard({ label, value, sub, color = 'blue', icon: Icon }) {
  const colors = {
    blue: 'text-blue-400 bg-blue-400/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    red: 'text-red-400 bg-red-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    violet: 'text-violet-400 bg-violet-400/10',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MarginBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = pct >= 40 ? 'bg-emerald-500' : pct >= 20 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-sm font-bold w-12 text-right ${pct >= 40 ? 'text-emerald-400' : pct >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function SimulationInner() {
  const toast = useToast();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    try {
      const res = await simulationApi.margin({ start_date: startDate, end_date: endDate });
      setData(res);
    } catch (err) {
      toast(err.message, 'error');
    } finally { setLoading(false); }
  }

  const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="page-header">
        <h1 className="page-title">Simulation & Marge</h1>
      </div>

      {/* Sélection période */}
      <div className="card p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Date début</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Date fin</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
            <BarChart3 className="w-4 h-4" />
            {loading ? 'Calcul...' : 'Analyser'}
          </button>
          {/* Raccourcis période */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Ce mois', s: format(startOfMonth(new Date()), 'yyyy-MM-dd'), e: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
              { label: 'Mois dernier', s: format(startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth()-1, 1)), 'yyyy-MM-dd'), e: format(endOfMonth(new Date(new Date().getFullYear(), new Date().getMonth()-1, 1)), 'yyyy-MM-dd') },
              { label: 'Cette semaine', s: format(new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)), 'yyyy-MM-dd'), e: format(new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 7)), 'yyyy-MM-dd') },
            ].map(p => (
              <button key={p.label} onClick={() => { setStartDate(p.s); setEndDate(p.e); }}
                className="px-3 py-1.5 text-xs rounded-lg border border-dark-500 text-slate-400 hover:text-white hover:border-dark-400 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Résultats */}
      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Chiffre d'affaires" value={fmt(data.summary.total_revenue)} icon={Euro} color="blue" />
            <KPICard label="Coût agents" value={fmt(data.summary.total_cost)} sub="Taux horaires agents" icon={Users} color="amber" />
            <KPICard
              label="Marge brute"
              value={fmt(data.summary.total_margin)}
              sub={`${data.summary.margin_pct}% du CA`}
              icon={data.summary.total_margin >= 0 ? TrendingUp : TrendingDown}
              color={data.summary.total_margin >= 0 ? 'emerald' : 'red'}
            />
            <KPICard label="Prestations" value={`${data.shifts.length}`} sub={`${data.shifts.reduce((s, r) => s + r.total_hours, 0).toFixed(1)}h au total`} icon={Clock} color="violet" />
          </div>

          {/* Taux de marge visuel */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h2 className="font-semibold text-white text-sm">Taux de marge global</h2>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                <Info className="w-3 h-3" />
                <span>Basé sur les taux horaires enregistrés pour les agents</span>
              </div>
            </div>
            <MarginBar pct={data.summary.margin_pct} />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span className="text-red-400">⚠ &lt;20% faible</span>
              <span className="text-amber-400">20–40% correct</span>
              <span className="text-emerald-400">✓ &gt;40% bon</span>
            </div>
          </div>

          {/* Détail par agent */}
          {data.summary.by_agent.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Détail par agent
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-600 text-xs text-slate-400">
                      <th className="text-left py-2 px-3 font-medium">Agent</th>
                      <th className="text-right py-2 px-3 font-medium">Heures</th>
                      <th className="text-right py-2 px-3 font-medium">CA</th>
                      <th className="text-right py-2 px-3 font-medium">Coût</th>
                      <th className="text-right py-2 px-3 font-medium">Marge</th>
                      <th className="text-left py-2 px-3 font-medium w-40">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.by_agent.sort((a,b) => b.revenue - a.revenue).map((a, i) => {
                      const pct = a.revenue > 0 ? (a.margin / a.revenue * 100) : 0;
                      return (
                        <tr key={i} className="table-row">
                          <td className="py-2.5 px-3 text-sm font-medium text-white">{a.name}</td>
                          <td className="py-2.5 px-3 text-sm text-slate-300 text-right">{a.hours.toFixed(1)}h</td>
                          <td className="py-2.5 px-3 text-sm text-white font-medium text-right">{fmt(a.revenue)}</td>
                          <td className="py-2.5 px-3 text-sm text-amber-400 text-right">{fmt(a.cost)}</td>
                          <td className={`py-2.5 px-3 text-sm font-bold text-right ${a.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(a.margin)}
                          </td>
                          <td className="py-2.5 px-3">
                            <MarginBar pct={pct} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-dark-600 bg-dark-700/50">
                      <td className="py-2.5 px-3 text-sm font-semibold text-white">Total</td>
                      <td className="py-2.5 px-3 text-sm text-right text-slate-300">
                        {data.shifts.reduce((s, r) => s + r.total_hours, 0).toFixed(1)}h
                      </td>
                      <td className="py-2.5 px-3 text-sm font-bold text-white text-right">{fmt(data.summary.total_revenue)}</td>
                      <td className="py-2.5 px-3 text-sm font-bold text-amber-400 text-right">{fmt(data.summary.total_cost)}</td>
                      <td className={`py-2.5 px-3 text-sm font-bold text-right ${data.summary.total_margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(data.summary.total_margin)}
                      </td>
                      <td className="py-2.5 px-3">
                        <MarginBar pct={data.summary.margin_pct} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Détail prestations */}
          {data.shifts.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Détail des {data.shifts.length} prestation(s)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-600 text-xs text-slate-400">
                      <th className="text-left py-2 px-3 font-medium">Date</th>
                      <th className="text-left py-2 px-3 font-medium">Agent</th>
                      <th className="text-left py-2 px-3 font-medium">Site / Client</th>
                      <th className="text-right py-2 px-3 font-medium">Heures</th>
                      <th className="text-right py-2 px-3 font-medium">CA</th>
                      <th className="text-right py-2 px-3 font-medium">Coût</th>
                      <th className="text-right py-2 px-3 font-medium">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shifts.map((s, i) => (
                      <tr key={i} className="table-row">
                        <td className="py-2 px-3 text-xs text-slate-300 whitespace-nowrap">
                          {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          <div className="text-slate-500">{s.start_time}–{s.end_time}</div>
                        </td>
                        <td className="py-2 px-3 text-sm text-white">{s.first_name} {s.last_name}</td>
                        <td className="py-2 px-3">
                          <div className="text-sm text-slate-300">{s.site_name}</div>
                          <div className="text-xs text-slate-500">{s.client_name}</div>
                        </td>
                        <td className="py-2 px-3 text-sm text-slate-300 text-right">{s.total_hours.toFixed(1)}h</td>
                        <td className="py-2 px-3 text-sm text-white text-right">{fmt(s.revenue)}</td>
                        <td className="py-2 px-3 text-sm text-amber-400 text-right">{fmt(s.cost)}</td>
                        <td className={`py-2 px-3 text-sm font-bold text-right ${s.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(s.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.shifts.length === 0 && (
            <div className="card p-10 text-center text-slate-500">
              Aucune prestation sur cette période.
            </div>
          )}

          {/* Note taux horaires manquants */}
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 text-xs text-amber-300">
            <strong className="flex items-center gap-1.5 mb-1"><Info className="w-3.5 h-3.5" /> Note sur les calculs</strong>
            <p>Le coût est calculé à partir du taux horaire renseigné dans la fiche de chaque agent.
            Si le taux est à 0, le coût sera nul. Le chiffre d'affaires est calculé à partir des taux horaires du site (jour/nuit/dimanche),
            avec repli sur les taux par défaut des paramètres.</p>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="card p-10 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sélectionnez une période et cliquez sur <strong className="text-white">Analyser</strong></p>
          <p className="text-xs text-slate-500 mt-1">Visualisez le CA, les coûts et la marge par agent</p>
        </div>
      )}
    </div>
  );
}

export default function Simulation() {
  return <ToastProvider><SimulationInner /></ToastProvider>;
}
