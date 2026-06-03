import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Clock, User, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, parseISO, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Grouper les shifts par date
function groupByDate(shifts) {
  const map = {};
  for (const sh of shifts) {
    if (!map[sh.date]) map[sh.date] = [];
    map[sh.date].push(sh);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Semaine courante
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const start = format(weekStart, 'yyyy-MM-dd');
      const end   = format(weekEnd,   'yyyy-MM-dd');
      const res = await fetch(`${API_BASE}/portal/${token}?start=${start}&end=${end}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lien invalide');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [weekStart]);

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d,  7));
  const thisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-dark-800 border border-red-600/40 rounded-xl p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Lien introuvable</h1>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  const { client, shifts } = data;
  const grouped = groupByDate(shifts);

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-400">{client.company_name}</div>
            <div className="font-semibold text-white truncate">{client.name}</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Navigation semaine */}
        <div className="flex items-center gap-2">
          <button onClick={prevWeek}
            className="p-2 rounded-lg border border-dark-600 bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-sm font-medium text-white">
              {format(weekStart, 'd MMM', { locale: fr })} — {format(weekEnd, 'd MMM yyyy', { locale: fr })}
            </div>
          </div>
          <button onClick={nextWeek}
            className="p-2 rounded-lg border border-dark-600 bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isCurrentWeek && (
            <button onClick={thisWeek}
              className="text-xs px-3 py-2 rounded-lg border border-blue-600/40 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors">
              Aujourd'hui
            </button>
          )}
        </div>

        {/* Planning */}
        {grouped.length === 0 ? (
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-10 text-center">
            <div className="text-slate-400 text-sm">Aucune prestation prévue cette semaine</div>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, dayShifts]) => {
              const d = parseISO(date);
              const today = isToday(d);
              return (
                <div key={date} className={`bg-dark-800 border rounded-xl overflow-hidden ${today ? 'border-blue-500/40' : 'border-dark-600'}`}>
                  {/* En-tête date */}
                  <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${today ? 'border-blue-500/30 bg-blue-500/10' : 'border-dark-600 bg-dark-700/50'}`}>
                    <div className={`text-sm font-semibold capitalize ${today ? 'text-blue-300' : 'text-slate-200'}`}>
                      {format(d, 'EEEE d MMMM', { locale: fr })}
                    </div>
                    {today && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white font-medium">Aujourd'hui</span>}
                    <span className="ml-auto text-xs text-slate-500">{dayShifts.length} prestation(s)</span>
                  </div>

                  {/* Shifts du jour */}
                  <div className="divide-y divide-dark-700">
                    {dayShifts.map(sh => (
                      <div key={sh.id} className="px-4 py-3 flex items-start gap-3">
                        {/* Horaires */}
                        <div className="shrink-0 text-center pt-0.5">
                          <div className="text-xs font-semibold text-white">{sh.start_time.slice(0,5)}</div>
                          <div className="text-xs text-slate-500">{sh.end_time.slice(0,5)}</div>
                        </div>
                        {/* Séparateur vertical */}
                        <div className="w-px self-stretch bg-dark-500 mx-1" />
                        {/* Détails */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-white">{sh.site_name}</div>
                          {(sh.site_address || sh.site_city) && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{[sh.site_address, sh.site_city].filter(Boolean).join(', ')}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <User className="w-3 h-3 shrink-0" />
                            <span>{sh.agent_first_name} {sh.agent_last_name}</span>
                          </div>
                        </div>
                        {/* Durée */}
                        <div className="shrink-0 flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {(() => {
                            const [sh_h, sh_m] = sh.start_time.split(':').map(Number);
                            const [eh, em]   = sh.end_time.split(':').map(Number);
                            let mins = (eh * 60 + em) - (sh_h * 60 + sh_m);
                            if (mins < 0) mins += 24 * 60;
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pb-4">
          Portail client SecuroPlan · {client.company_name}
        </div>
      </main>
    </div>
  );
}
