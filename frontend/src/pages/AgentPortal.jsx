import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield, MapPin, Clock, LogIn, LogOut, CheckCircle,
  AlertTriangle, Loader2, Calendar, ChevronRight, Info, Download, X, Share,
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

// ── Notifications push — activation automatique ───────────────────────────────
function NotifButton({ token }) {
  const [status, setStatus] = useState('idle'); // idle | loading | on | off | unsupported | blocked

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function subscribe(key) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Vérifier si déjà souscrit
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await fetch(`${API_BASE}/agent-portal/${token}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus('on');
    } catch (e) {
      console.error('[Push] subscribe error:', e);
      setStatus('idle');
    }
  }

  async function autoActivate() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return;
    }
    setStatus('loading');
    try {
      // Récupérer la clé VAPID
      const res = await fetch(`${API_BASE}/agent-portal/vapid-public-key`);
      const { key } = await res.json();
      if (!key) { setStatus('unsupported'); return; }

      if (Notification.permission === 'granted') {
        await subscribe(key);
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('blocked'); return;
      }
      // Demander la permission automatiquement
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        await subscribe(key);
      } else {
        setStatus('blocked');
      }
    } catch (e) {
      console.error('[Push] autoActivate error:', e);
      setStatus('idle');
    }
  }

  // Lancer dès que le composant monte
  useEffect(() => { autoActivate(); }, []); // eslint-disable-line

  // Affichage discret — seulement si bloqué ou activé
  if (status === 'unsupported') return null;
  if (status === 'idle') return null;

  if (status === 'on') {
    return (
      <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-emerald-400/70">
        <span>🔔</span> Rappels de vacation activés
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="mx-4 mt-3 bg-amber-600/10 border border-amber-600/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
        <span className="text-amber-400">🔔</span>
        <span className="text-xs text-amber-300/80 flex-1">
          Activez les notifications dans les réglages de votre navigateur pour recevoir vos rappels de vacation.
        </span>
      </div>
    );
  }

  // loading
  return (
    <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-slate-500">
      <Loader2 className="w-3 h-3 animate-spin" /> Activation des rappels…
    </div>
  );
}

// ── Bannière d'installation PWA ───────────────────────────────────────────────
function InstallBanner() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [dismissed, setDismissed]         = useState(false);
  const [installed, setInstalled]         = useState(false);

  // Détecter iOS
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  useEffect(() => {
    if (isStandalone) { setInstalled(true); return; }
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
  }

  if (installed || dismissed) return null;
  // Android : bouton natif
  if (installPrompt) return (
    <div className="mx-4 mt-4 bg-blue-600/15 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
        <Shield className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">Installer l'application</div>
        <div className="text-xs text-slate-400">Accès rapide depuis votre écran d'accueil</div>
      </div>
      <button onClick={handleInstall}
        className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
        Installer
      </button>
      <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
  // iOS : instructions manuelles
  if (isIOS) return (
    <div className="mx-4 mt-4 bg-dark-800 border border-dark-600 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-semibold text-white">📲 Installer sur votre iPhone</div>
        <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ol className="text-xs text-slate-400 space-y-1.5">
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
          Appuyez sur <span className="inline-flex items-center gap-0.5 text-blue-400 font-medium mx-1">Partager <span className="text-base">⎙</span></span> en bas de Safari
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
          Faites défiler et appuyez sur <span className="text-white font-medium mx-1">"Sur l'écran d'accueil"</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
          Appuyez sur <span className="text-white font-medium mx-1">"Ajouter"</span> en haut à droite
        </li>
      </ol>
    </div>
  );
  return null;
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

      <InstallBanner />
      <NotifButton token={token} />

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
