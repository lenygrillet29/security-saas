import { useState, useEffect } from 'react';
import { Clock, Download, Sun, Moon, CalendarDays, Star, ChevronLeft, ChevronRight, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function fmtH(h) {
  if (!h || h === 0) return <span className="text-slate-600">—</span>;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return <span>{hh}h{mm > 0 ? String(mm).padStart(2, '0') : ''}</span>;
}

function fmtHStr(h) {
  if (!h || h === 0) return '0h';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm > 0 ? String(mm).padStart(2, '0') : ''}`;
}

// En-têtes des colonnes d'heures majorées
const COLS = [
  { key: 'total_day',     label: 'Heures jour',    icon: Sun,         color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { key: 'total_night',   label: 'Heures nuit',    icon: Moon,        color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  { key: 'total_sunday',  label: 'Heures dim.',    icon: CalendarDays,color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { key: 'total_holiday', label: 'Heures fériées', icon: Star,        color: 'text-rose-400',    bg: 'bg-rose-500/10' },
];

function monthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function RecapHeures() {
  const now    = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  function startOfMonth(y, m) { return `${y}-${String(m).padStart(2,'0')}-01`; }
  function endOfMonth(y, m) {
    return new Date(y, m, 0).toISOString().slice(0, 10);
  }

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(
        `${API_BASE}/shifts/recap?start_date=${startOfMonth(year, month)}&end_date=${endOfMonth(year, month)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      setData(json);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // Export CSV
  function exportCSV() {
    if (!data?.agents?.length) return;
    const header = ['Agent', 'N° Employé', 'Vacations', 'H. Jour', 'H. Nuit', 'H. Dimanche', 'H. Fériées', 'Total'].join(';');
    const rows = data.agents.map(a =>
      [
        `${a.last_name} ${a.first_name}`,
        a.employee_number || '',
        a.shift_count,
        fmtHStr(a.total_day),
        fmtHStr(a.total_night),
        fmtHStr(a.total_sunday),
        fmtHStr(a.total_holiday),
        fmtHStr(a.total_hours),
      ].join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `recap_heures_${year}-${String(month).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Totaux globaux
  const totals = data?.agents?.reduce((acc, a) => ({
    shift_count:   acc.shift_count   + (a.shift_count   || 0),
    total_day:     acc.total_day     + (parseFloat(a.total_day)     || 0),
    total_night:   acc.total_night   + (parseFloat(a.total_night)   || 0),
    total_sunday:  acc.total_sunday  + (parseFloat(a.total_sunday)  || 0),
    total_holiday: acc.total_holiday + (parseFloat(a.total_holiday) || 0),
    total_hours:   acc.total_hours   + (parseFloat(a.total_hours)   || 0),
  }), { shift_count: 0, total_day: 0, total_night: 0, total_sunday: 0, total_holiday: 0, total_hours: 0 });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Récapitulatif des heures</h1>
          <p className="text-slate-400 text-sm mt-1">
            Heures jour · nuit · dimanche · fériées par agent
          </p>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Sélecteur de mois */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-lg bg-dark-800 border border-dark-600 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-[180px] text-center">
          <span className="text-white font-semibold capitalize">{monthLabel(year, month)}</span>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg bg-dark-800 border border-dark-600 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Cartes totaux */}
      {totals && data?.agents?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLS.map(c => (
            <div key={c.key} className={`${c.bg} border border-dark-700 rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs text-slate-400">{c.label}</span>
              </div>
              <div className={`text-xl font-bold ${c.color}`}>{fmtHStr(totals[c.key])}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Chargement...
          </div>
        ) : !data?.agents?.length ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Aucune vacation ce mois-ci</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600 text-xs text-slate-400">
                  <th className="text-left py-3 px-4 font-medium">Agent</th>
                  <th className="text-right py-3 px-4 font-medium">Vacations</th>
                  <th className="text-right py-3 px-4 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Sun className="w-3 h-3 text-amber-400" /> Jour
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Moon className="w-3 h-3 text-violet-400" /> Nuit
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <CalendarDays className="w-3 h-3 text-blue-400" /> Dim.
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Star className="w-3 h-3 text-rose-400" /> Fériés
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-white">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a, i) => (
                  <tr key={a.agent_id} className={`border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-dark-800/30'}`}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white text-sm">{a.last_name} {a.first_name}</div>
                      {a.employee_number && <div className="text-xs text-slate-500">{a.employee_number}</div>}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 text-sm">{a.shift_count}</td>
                    <td className="py-3 px-4 text-right text-sm text-amber-300/80">{fmtH(parseFloat(a.total_day))}</td>
                    <td className="py-3 px-4 text-right text-sm text-violet-300/80">{fmtH(parseFloat(a.total_night))}</td>
                    <td className="py-3 px-4 text-right text-sm text-blue-300/80">{fmtH(parseFloat(a.total_sunday))}</td>
                    <td className="py-3 px-4 text-right text-sm text-rose-300/80">{fmtH(parseFloat(a.total_holiday))}</td>
                    <td className="py-3 px-4 text-right font-semibold text-white">{fmtHStr(parseFloat(a.total_hours))}</td>
                  </tr>
                ))}

                {/* Ligne totaux */}
                <tr className="border-t border-dark-500 bg-dark-800/60 font-semibold">
                  <td className="py-3 px-4 text-slate-300 text-sm">TOTAL</td>
                  <td className="py-3 px-4 text-right text-slate-300 text-sm">{totals.shift_count}</td>
                  <td className="py-3 px-4 text-right text-sm text-amber-300">{fmtHStr(totals.total_day)}</td>
                  <td className="py-3 px-4 text-right text-sm text-violet-300">{fmtHStr(totals.total_night)}</td>
                  <td className="py-3 px-4 text-right text-sm text-blue-300">{fmtHStr(totals.total_sunday)}</td>
                  <td className="py-3 px-4 text-right text-sm text-rose-300">{fmtHStr(totals.total_holiday)}</td>
                  <td className="py-3 px-4 text-right text-white">{fmtHStr(totals.total_hours)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600">
        Nuit : 21h–6h · Dimanche : 00h–24h · Fériés : jours fériés légaux français (priorité sur dimanche)
      </p>
    </div>
  );
}
