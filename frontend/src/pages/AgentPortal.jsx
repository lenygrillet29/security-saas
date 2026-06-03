import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield, MapPin, Clock, LogIn, LogOut, CheckCircle,
  AlertTriangle, Loader2, Calendar, ChevronRight, Info,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function formatTime(t) { return t?.slice(0, 5) || ''; }

function shiftDuration(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let m = (eh * 60 + em) - (sh * 60 + sm);
  if (m < 0) m += 24 * 60;
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return mn > 0 ? `${h}h${String(mn).padStart(2, '0')}` : `${h}h`;
}

function dayLabel(date) {
  const d = parseISO(date);
  if (isToday(d)) return "Aujourd'hui";
  if (isTomorrow(d)) return 'Demain';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

// ── Bouton check-in / check-out ───────────────────────────────────────────────
function CheckButton({ shift, token, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function getCoords() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({}),
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }

  async function handle() {
    setLoading(true);
    setError('');
    try {
      const coords = await getCoords();
      const action = shift.checkin_at ? 'checkout' : 'checkin';
      const res = await fetch(`${API_BASE}/agent-portal/${token}/${action}/${shift.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      onUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const done = shift.checkin_at && shift.checkout_at;

  if (done) {
    return (
      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
        <CheckCircle className="w-4 h-4" />
        Terminé
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handle}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 ${
          shift.checkin_at
            ? 'bg-orange-500 hover:bg-orange-400 text-white'
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : shift.checkin_at ? (
          <><LogOut className="w-4 h-4" /> Pointer la sortie</>
        ) : (
          <><LogIn className="w-4 h-4" /> Pointer l'arrivée</>
        )}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Carte shift ───────────────────────────────────────────────────────────────
function ShiftCard({ shift, token, onUpdated, highlight }) {
  const [open, setOpen] = useState(highlight);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      highlight ? 'border-blue-500/50 bg-blue-500/5' : 'border-dark-600 bg-dark-800'
    }`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className={`w-1 self-stretch rounded-full ${
          shift.checkout_at ? 'bg-emerald-500' :
          shift.checkin_at  ? 'bg-orange-400' :
          highlight         ? 'bg-blue-500'   : 'bg-dark-500'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{shift.site_name}</div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
            </span>
            <span className="text-slate-600">·</span>
            <span>{shiftDuration(shift.start_time, shift.end_time)}</span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {/* Détails */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-dark-700 pt-3">
          {(shift.site_address || shift.site_city) && (
            <div className="flex items-start gap-2 text-sm text-slate-400">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
              <span>{[shift.site_address, shift.site_city].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {shift.site_instructions && (
            <div className="flex items-start gap-2 text-sm text-slate-300 bg-dark-700 rounded-xl p-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <span>{shift.site_instructions}</span>
            </div>
          )}
          {shift.notes && (
            <div className="text-xs text-slate-500 italic">{shift.notes}</div>
          )}

          {/* Statut pointage */}
          {shift.checkin_at && (
            <div className="text-xs text-slate-500 space-y-0.5">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <LogIn className="w-3 h-3" />
                Arrivée pointée à {format(new Date(shift.checkin_at), 'HH:mm')}
                {shift.checkin_distance !== null && shift.checkin_distance !== undefined && (
                  <span className="text-slate-500">· {shift.checkin_distance}m du site</span>
                )}
              </div>
              {shift.checkout_at && (
                <div className="flex items-center gap-1.5 text-orange-400">
                  <LogOut className="w-3 h-3" />
                  Sortie pointée à {format(new Date(shift.checkout_at), 'HH:mm')}
                </div>
              )}
            </div>
          )}

          {/* Bouton check-in/out uniquement pour aujourd'hui */}
          {isToday(parseISO(shift.date)) && (
            <CheckButton shift={shift} token={token} onUpdated={onUpdated} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AgentPortal() {
  const { token } = useParams();
  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/agent-portal/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lien invalide');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
        <div className="max-w-sm w-full bg-dark-800 border border-red-600/40 rounded-2xl p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Lien invalide</h1>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  const { agent, shifts, today } = data;

  // Grouper par date
  const grouped = {};
  for (const s of shifts) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }
  const days = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  const todayShifts = grouped[today] || [];
  const hasToday = todayShifts.length > 0;

  return (
    <div className="min-h-screen bg-dark-900 text-white pb-10">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{agent.first_name} {agent.last_name}</div>
            <div className="text-xs text-slate-400">{agent.company_name}</div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-6">

        {/* Aujourd'hui */}
        {hasToday ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Aujourd'hui</h2>
            </div>
            {todayShifts.map(s => (
              <ShiftCard key={s.id} shift={s} token={token} onUpdated={load} highlight />
            ))}
          </section>
        ) : (
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 text-center">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Pas de vacation aujourd'hui</p>
          </div>
        )}

        {/* Prochains jours */}
        {days.filter(([d]) => d !== today).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">À venir</h2>
            {days.filter(([d]) => d !== today).map(([date, dayShifts]) => (
              <div key={date} className="space-y-2">
                <div className="text-xs font-medium text-slate-500 capitalize px-1">
                  {dayLabel(date)}
                </div>
                {dayShifts.map(s => (
                  <ShiftCard key={s.id} shift={s} token={token} onUpdated={load} highlight={false} />
                ))}
              </div>
            ))}
          </section>
        )}

        {days.length === 0 && !hasToday && (
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 text-center">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Aucune vacation planifiée<br />dans les 30 prochains jours</p>
          </div>
        )}

        <p className="text-center text-xs text-slate-600">
          SecuroPlan · {agent.company_name}
        </p>
      </main>
    </div>
  );
}
