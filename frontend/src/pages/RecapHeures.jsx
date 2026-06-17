import { useState, useEffect, useRef } from 'react';
import { Clock, Download, Sun, Moon, CalendarDays, Star, ChevronLeft, ChevronRight, Users, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { exportApi, pdfApi } from '../api';
import AgentQuickView from '../components/AgentQuickView';

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
  { key: 'total_day',                  label: 'Jour',           icon: Sun,         color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { key: 'total_night',                label: 'Nuit',           icon: Moon,        color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  { key: 'total_sunday',               label: 'Dim. jour',      icon: CalendarDays,color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { key: 'total_sunday_night',         label: 'Dim. nuit',      icon: Moon,        color: 'text-blue-300',    bg: 'bg-blue-500/10' },
  { key: 'total_holiday',              label: 'Férié jour',     icon: Star,        color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  { key: 'total_holiday_night',        label: 'Férié nuit',     icon: Star,        color: 'text-rose-300',    bg: 'bg-rose-500/10' },
  { key: 'total_holiday_sunday_day',   label: 'Fér. dim. jour', icon: Star,        color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { key: 'total_holiday_sunday_night', label: 'Fér. dim. nuit', icon: Star,        color: 'text-orange-300',  bg: 'bg-orange-500/10' },
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
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  const [quickViewId, setQuickViewId] = useState(null);

  useEffect(() => {
    function handleClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  function doExport(format) {
    const start = startOfMonth(year, month);
    const end   = endOfMonth(year, month);
    exportApi.shifts(start, end, format);
    setExportOpen(false);
  }

  // Totaux globaux
  const totals = data?.agents?.reduce((acc, a) => ({
    shift_count:                acc.shift_count                + (a.shift_count                || 0),
    total_day:                  acc.total_day                  + (parseFloat(a.total_day)                  || 0),
    total_night:                acc.total_night                + (parseFloat(a.total_night)                || 0),
    total_sunday:               acc.total_sunday               + (parseFloat(a.total_sunday)               || 0),
    total_sunday_night:         acc.total_sunday_night         + (parseFloat(a.total_sunday_night)         || 0),
    total_holiday:              acc.total_holiday              + (parseFloat(a.total_holiday)              || 0),
    total_holiday_night:        acc.total_holiday_night        + (parseFloat(a.total_holiday_night)        || 0),
    total_holiday_sunday_day:   acc.total_holiday_sunday_day   + (parseFloat(a.total_holiday_sunday_day)   || 0),
    total_holiday_sunday_night: acc.total_holiday_sunday_night + (parseFloat(a.total_holiday_sunday_night) || 0),
    total_hours:                acc.total_hours                + (parseFloat(a.total_hours)                || 0),
  }), {
    shift_count: 0, total_day: 0, total_night: 0,
    total_sunday: 0, total_sunday_night: 0,
    total_holiday: 0, total_holiday_night: 0,
    total_holiday_sunday_day: 0, total_holiday_sunday_night: 0,
    total_hours: 0,
  });

  return (
    <>
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Récapitulatif des heures</h1>
          <p className="text-slate-400 text-sm mt-1">
            Heures jour · nuit · dimanche · fériées par agent
          </p>
        </div>
        {/* Bouton export paie consolidé */}
        <button
          onClick={() => exportApi.paie(`${year}-${String(month).padStart(2,'0')}`)}
          disabled={!data?.agents?.length}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
          title="Export Excel consolidé heures + frais + CP"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export paie
        </button>
        {/* Bouton export split CSV / Excel */}
        <div className="relative" ref={exportRef}>
          <div className="flex">
            <button
              onClick={() => doExport('csv')}
              disabled={!data?.agents?.length}
              className="btn-secondary flex items-center gap-2 rounded-r-none border-r-0 disabled:opacity-40"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => setExportOpen(o => !o)}
              disabled={!data?.agents?.length}
              className="btn-secondary px-2 rounded-l-none disabled:opacity-40"
              title="Choisir le format"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-dark-700 border border-dark-500 rounded-xl shadow-xl z-20 overflow-hidden">
              <button
                onClick={() => doExport('csv')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-dark-600 transition-colors"
              >
                <Download className="w-4 h-4 text-slate-400" />
                CSV (.csv)
              </button>
              <button
                onClick={() => doExport('xlsx')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-dark-600 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Excel (.xlsx)
              </button>
            </div>
          )}
        </div>
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
          {COLS.map(c => {
            const val = totals[c.key] || 0;
            if (val === 0) return null; // masquer les catégories vides
            return (
              <div key={c.key} className={`${c.bg} border border-dark-700 rounded-xl p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                  <span className="text-xs text-slate-400">{c.label}</span>
                </div>
                <div className={`text-lg font-bold ${c.color}`}>{fmtHStr(val)}</div>
              </div>
            );
          })}
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
                  <th className="text-left py-3 px-3 font-medium">Agent</th>
                  <th className="text-right py-3 px-2 font-medium">Vac.</th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><Sun className="w-3 h-3 text-amber-400" />Jour</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><Moon className="w-3 h-3 text-violet-400" />Nuit</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><CalendarDays className="w-3 h-3 text-blue-400" />Dim.J</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><CalendarDays className="w-3 h-3 text-blue-300" />Dim.N</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><Star className="w-3 h-3 text-rose-400" />Fér.J</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><Star className="w-3 h-3 text-rose-300" />Fér.N</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><Star className="w-3 h-3 text-orange-400" />F.D.J</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium">
                    <span className="flex items-center justify-end gap-1"><Star className="w-3 h-3 text-orange-300" />F.D.N</span>
                  </th>
                  <th className="text-right py-3 px-3 font-medium text-white">Total</th>
                  <th className="py-3 px-2"></th>
                </tr>
                <tr className="text-xs text-slate-600 border-b border-dark-700">
                  <td colSpan={2}></td>
                  <td className="text-right px-2 pb-1 text-xs text-slate-600">06h–21h</td>
                  <td className="text-right px-2 pb-1">21h–06h</td>
                  <td className="text-right px-2 pb-1">Dim.06–21</td>
                  <td className="text-right px-2 pb-1">Dim.21–06</td>
                  <td className="text-right px-2 pb-1">Fér.06–21</td>
                  <td className="text-right px-2 pb-1">Fér.21–06</td>
                  <td className="text-right px-2 pb-1">F+D.06–21</td>
                  <td className="text-right px-2 pb-1 text-xs text-slate-600">F+D.21–06</td>
                  <td></td>
                  <td></td>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a, i) => (
                  <tr key={a.agent_id} className={`border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-dark-800/30'}`}>
                    <td className="py-2.5 px-3">
                      <div
                        className="font-medium text-white text-sm cursor-pointer hover:text-blue-400 transition-colors select-none"
                        onDoubleClick={() => setQuickViewId(a.agent_id)}
                        title="Double-cliquer pour voir la fiche"
                      >{a.last_name} {a.first_name}</div>
                      {a.employee_number && <div className="text-xs text-slate-500">{a.employee_number}</div>}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-400 text-sm">{a.shift_count}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-amber-300/80">{fmtH(parseFloat(a.total_day))}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-violet-300/80">{fmtH(parseFloat(a.total_night))}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-blue-300/80">{fmtH(parseFloat(a.total_sunday))}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-blue-200/70">{fmtH(parseFloat(a.total_sunday_night))}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-rose-300/80">{fmtH(parseFloat(a.total_holiday))}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-rose-200/70">{fmtH(parseFloat(a.total_holiday_night))}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-orange-300/80">{fmtH(parseFloat(a.total_holiday_sunday_day))}</td>
                    <td className="py-2.5 px-2 text-right text-sm text-orange-200/70">{fmtH(parseFloat(a.total_holiday_sunday_night))}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-white">{fmtHStr(parseFloat(a.total_hours))}</td>
                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => pdfApi.agentRecap(a.agent_id, `${year}-${String(month).padStart(2,'0')}`)}
                        className="p-1.5 rounded-lg hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 transition-colors"
                        title="Récap paie PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Ligne totaux */}
                <tr className="border-t border-dark-500 bg-dark-800/60 font-semibold">
                  <td className="py-2.5 px-3 text-slate-300 text-sm">TOTAL</td>
                  <td className="py-2.5 px-2 text-right text-slate-300 text-sm">{totals.shift_count}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-amber-300">{fmtHStr(totals.total_day)}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-violet-300">{fmtHStr(totals.total_night)}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-blue-300">{fmtHStr(totals.total_sunday)}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-blue-200">{fmtHStr(totals.total_sunday_night)}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-rose-300">{fmtHStr(totals.total_holiday)}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-rose-200">{fmtHStr(totals.total_holiday_night)}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-orange-300">{fmtHStr(totals.total_holiday_sunday_day)}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-orange-200">{fmtHStr(totals.total_holiday_sunday_night)}</td>
                  <td className="py-2.5 px-3 text-right text-white">{fmtHStr(totals.total_hours)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-600 space-y-0.5">
        <p><span className="text-amber-400/60">Jour</span> 06h–21h &nbsp;·&nbsp; <span className="text-violet-400/60">Nuit</span> 21h–06h &nbsp;·&nbsp; <span className="text-blue-400/60">Dim.J / Dim.N</span> dimanche jour/nuit &nbsp;·&nbsp; <span className="text-rose-400/60">Fér.J / Fér.N</span> férié jour/nuit &nbsp;·&nbsp; <span className="text-orange-400/60">F.D.J / F.D.N</span> férié + dimanche jour/nuit</p>
        <p>11 jours fériés légaux français inclus (Pâques mobile, Ascension, Pentecôte…)</p>
      </div>
    </div>

    {quickViewId && <AgentQuickView agentId={quickViewId} onClose={() => setQuickViewId(null)} />}
    </>
  );
}
