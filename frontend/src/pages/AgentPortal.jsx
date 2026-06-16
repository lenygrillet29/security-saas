import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield, MapPin, Clock, LogIn, LogOut, CheckCircle,
  AlertTriangle, Loader2, Calendar, ChevronRight, Info, X,
  Bell, BellOff, User, Phone, Mail, FileText, Hash,
  CalendarDays, TrendingUp, ChevronDown,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
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

function initials(first, last) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
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
        Shift terminé
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handle}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 ${
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
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
}

// ── Carte shift ───────────────────────────────────────────────────────────────
function ShiftCard({ shift, token, onUpdated, highlight }) {
  const [open, setOpen] = useState(highlight);

  const statusColor = shift.checkout_at ? 'bg-emerald-500'
    : shift.checkin_at ? 'bg-orange-400'
    : highlight ? 'bg-blue-500' : 'bg-slate-600';

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      highlight ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700/50 bg-slate-800/60'
    }`}>
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className={`w-1 self-stretch rounded-full shrink-0 ${statusColor}`} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{shift.site_name}</div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <Clock className="w-3 h-3" />
            <span>{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</span>
            <span className="text-slate-600">·</span>
            <span>{shiftDuration(shift.start_time, shift.end_time)}</span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
          {(shift.site_address || shift.site_city) && (
            <div className="flex items-start gap-2 text-sm text-slate-400">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
              <span>{[shift.site_address, shift.site_city].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {shift.site_instructions && (
            <div className="flex items-start gap-2 text-sm text-slate-300 bg-slate-700/40 rounded-xl p-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <span>{shift.site_instructions}</span>
            </div>
          )}
          {shift.notes && (
            <div className="text-xs text-slate-500 italic">{shift.notes}</div>
          )}
          {shift.checkin_at && (
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <LogIn className="w-3 h-3" />
                Arrivée à {format(new Date(shift.checkin_at), 'HH:mm')}
                {shift.checkin_distance != null && (
                  <span className="text-slate-500 ml-1">· {shift.checkin_distance}m du site</span>
                )}
              </div>
              {shift.checkout_at && (
                <div className="flex items-center gap-1.5 text-orange-400">
                  <LogOut className="w-3 h-3" />
                  Sortie à {format(new Date(shift.checkout_at), 'HH:mm')}
                </div>
              )}
            </div>
          )}
          {isToday(parseISO(shift.date)) && (
            <CheckButton shift={shift} token={token} onUpdated={onUpdated} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Notifications push ────────────────────────────────────────────────────────
function useNotifStatus(token) {
  const [status, setStatus] = useState('loading');

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function subscribe(key) {
    const reg = await navigator.serviceWorker.ready;
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
  }

  async function enable() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/agent-portal/vapid-public-key`);
      const { key } = await res.json();
      if (!key) { setStatus('unsupported'); return; }
      if (Notification.permission === 'granted') { await subscribe(key); return; }
      if (Notification.permission === 'denied') { setStatus('blocked'); return; }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') await subscribe(key); else setStatus('blocked');
    } catch { setStatus('idle'); }
  }

  async function disable() {
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch(`${API_BASE}/agent-portal/${token}/unsubscribe`, { method: 'POST' });
      setStatus('idle');
    } catch { setStatus('on'); }
  }

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
    if (Notification.permission === 'denied') { setStatus('blocked'); return; }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setStatus(sub ? 'on' : 'idle'))
    ).catch(() => setStatus('idle'));
  }, []);

  return { status, enable, disable };
}

// ── Bannière d'installation PWA ───────────────────────────────────────────────
function InstallBanner() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [dismissed, setDismissed]         = useState(() => sessionStorage.getItem('pwa-dismissed') === '1');
  const [installed, setInstalled]         = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  useEffect(() => {
    if (isStandalone) { setInstalled(true); return; }
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() { setDismissed(true); sessionStorage.setItem('pwa-dismissed', '1'); }

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
  }

  if (installed || dismissed) return null;

  if (installPrompt) return (
    <div className="mx-4 mt-3 bg-blue-600/15 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
        <Shield className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">Installer l'application</div>
        <div className="text-xs text-slate-400">Accès rapide depuis l'écran d'accueil</div>
      </div>
      <button onClick={handleInstall}
        className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
        Installer
      </button>
      <button onClick={dismiss} className="text-slate-500"><X className="w-4 h-4" /></button>
    </div>
  );

  if (isIOS && !isStandalone) return (
    <div className="mx-4 mt-3 bg-slate-800 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="text-sm font-semibold text-white">📲 Installer sur iPhone</div>
        <button onClick={dismiss} className="text-slate-500"><X className="w-4 h-4" /></button>
      </div>
      <ol className="text-xs text-slate-400 space-y-2">
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold shrink-0">1</span>
          Appuyez sur <span className="text-blue-400 font-medium mx-1">Partager ⎙</span> en bas de Safari
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold shrink-0">2</span>
          Appuyez sur <span className="text-white font-medium mx-1">"Sur l'écran d'accueil"</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold shrink-0">3</span>
          Appuyez sur <span className="text-white font-medium mx-1">"Ajouter"</span>
        </li>
      </ol>
    </div>
  );

  return null;
}

// ── Carte d'offre de vacation ─────────────────────────────────────────────────
function OfferCard({ offer, token, onResponded }) {
  const [loading, setLoading] = useState(null);
  const [done, setDone]       = useState(null);
  const [error, setError]     = useState('');

  async function respond(action) {
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/agent-portal/${token}/offers/${offer.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setDone(action === 'accept' ? 'accepted' : 'declined');
      setTimeout(() => onResponded(), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-1 self-stretch rounded-full bg-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm">{offer.site_name}</div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{formatTime(offer.start_time)} – {formatTime(offer.end_time)}</span>
              <span className="text-slate-600">·</span>
              <span>{shiftDuration(offer.start_time, offer.end_time)}</span>
            </div>
            <div className="text-xs text-amber-300/80 mt-1 capitalize font-medium">
              {dayLabel(offer.date)}
            </div>
            {offer.site_address && (
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                <MapPin className="w-3 h-3" />
                {offer.site_address}
              </div>
            )}
          </div>
        </div>

        {done ? (
          <div className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${
            done === 'accepted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
          }`}>
            {done === 'accepted' ? '✅ Vacation acceptée !' : '❌ Vacation déclinée'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => respond('decline')}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
            >
              {loading === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : '❌'} Décliner
            </button>
            <button
              onClick={() => respond('accept')}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
            >
              {loading === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : '✅'} Accepter
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>
    </div>
  );
}

// ── Onglet Planning ───────────────────────────────────────────────────────────
function TabPlanning({ shifts, token, today, onUpdated }) {
  const grouped = {};
  for (const s of shifts) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }
  const days = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  const todayShifts = grouped[today] || [];
  const futureShifts = days.filter(([d]) => d !== today);

  return (
    <div className="space-y-6">
      {/* Aujourd'hui */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h2 className="text-xs font-semibold text-blue-300 uppercase tracking-widest">Aujourd'hui</h2>
        </div>
        {todayShifts.length > 0 ? (
          <div className="space-y-2">
            {todayShifts.map(s => (
              <ShiftCard key={s.id} shift={s} token={token} onUpdated={onUpdated} highlight />
            ))}
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-center">
            <Calendar className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Pas de vacation aujourd'hui</p>
          </div>
        )}
      </section>

      {/* À venir */}
      {futureShifts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">À venir</h2>
          <div className="space-y-4">
            {futureShifts.map(([date, dayShifts]) => (
              <div key={date}>
                <div className="text-xs font-medium text-slate-500 capitalize px-1 mb-2">
                  {dayLabel(date)}
                </div>
                <div className="space-y-2">
                  {dayShifts.map(s => (
                    <ShiftCard key={s.id} shift={s} token={token} onUpdated={onUpdated} highlight={false} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {days.length === 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-10 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucune vacation planifiée<br />dans les 30 prochains jours</p>
        </div>
      )}
    </div>
  );
}

// ── Onglet Demandes ───────────────────────────────────────────────────────────
function TabDemandes({ offers, token, onReload }) {
  if (offers.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-10 text-center">
        <CheckCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-white font-medium text-sm mb-1">Aucune demande en attente</p>
        <p className="text-slate-500 text-xs">Les propositions de vacation apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 px-1">
        {offers.length} proposition{offers.length > 1 ? 's' : ''} en attente de réponse
      </p>
      {offers.map(offer => (
        <OfferCard key={offer.id} offer={offer} token={token} onResponded={onReload} />
      ))}
    </div>
  );
}

// ── Onglet Profil ─────────────────────────────────────────────────────────────
function TabProfil({ agent, stats, token }) {
  const { status, enable, disable } = useNotifStatus(token);

  const contractLabel = {
    CDI: 'CDI — Contrat à durée indéterminée',
    CDD: 'CDD — Contrat à durée déterminée',
    Interim: 'Intérim',
    Vacation: 'Vacation',
  }[agent.contract_type] || agent.contract_type;

  return (
    <div className="space-y-4">
      {/* Avatar + nom */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ backgroundColor: agent.color || '#3B82F6' }}
        >
          {initials(agent.first_name, agent.last_name)}
        </div>
        <div>
          <div className="font-bold text-white text-lg">{agent.first_name} {agent.last_name}</div>
          <div className="text-sm text-slate-400">{agent.company_name}</div>
          {agent.employee_number && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <Hash className="w-3 h-3" /> {agent.employee_number}
            </div>
          )}
        </div>
      </div>

      {/* Stats du mois */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.shift_count}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
            <CalendarDays className="w-3 h-3" /> Vacations ce mois
          </div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.hours_count}h</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" /> Heures ce mois
          </div>
        </div>
      </div>

      {/* Infos de contact */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Contact</div>
        {agent.email && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Email</div>
              <div className="text-sm text-white">{agent.email}</div>
            </div>
          </div>
        )}
        {agent.phone && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Téléphone</div>
              <div className="text-sm text-white">{agent.phone}</div>
            </div>
          </div>
        )}
        {!agent.email && !agent.phone && (
          <p className="text-sm text-slate-500 italic">Aucune information de contact</p>
        )}
      </div>

      {/* Infos contrat */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Contrat</div>
        {agent.contract_type && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Type de contrat</div>
              <div className="text-sm text-white">{contractLabel}</div>
            </div>
          </div>
        )}
        {agent.entry_date && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Date d'entrée</div>
              <div className="text-sm text-white">
                {format(new Date(agent.entry_date), 'd MMMM yyyy', { locale: fr })}
              </div>
            </div>
          </div>
        )}
        {agent.carte_pro && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Carte professionnelle</div>
              <div className="text-sm text-white font-mono">{agent.carte_pro}</div>
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Notifications</div>
        {status === 'unsupported' ? (
          <p className="text-sm text-slate-500">Notifications non supportées sur ce navigateur</p>
        ) : status === 'blocked' ? (
          <div className="flex items-start gap-3">
            <BellOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-white">Notifications bloquées</div>
              <div className="text-xs text-slate-400 mt-0.5">Autorisez les notifications dans les réglages de votre navigateur</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {status === 'on' ? (
                <Bell className="w-5 h-5 text-emerald-400" />
              ) : (
                <BellOff className="w-5 h-5 text-slate-500" />
              )}
              <div>
                <div className="text-sm text-white">Rappels de vacation</div>
                <div className="text-xs text-slate-400">
                  {status === 'on' ? 'Activés (24h et 2h avant)' : 'Désactivés'}
                </div>
              </div>
            </div>
            <button
              onClick={status === 'on' ? disable : enable}
              disabled={status === 'loading'}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                status === 'on' ? 'bg-blue-600' : 'bg-slate-600'
              } disabled:opacity-50`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                status === 'on' ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 pb-2">
        SecuroPlan · {agent.company_name}
      </p>
    </div>
  );
}

// ── Navigation bas de page ────────────────────────────────────────────────────
function BottomNav({ active, onChange, offerCount }) {
  const tabs = [
    { id: 'planning', icon: Calendar, label: 'Planning' },
    { id: 'demandes', icon: Bell, label: 'Demandes', badge: offerCount },
    { id: 'profil', icon: User, label: 'Profil' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700/50 z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative ${
              active === id ? 'text-blue-400' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
            {active === id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AgentPortal() {
  const { token } = useParams();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('planning');

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

  // Basculer sur l'onglet Demandes si des offres arrivent
  useEffect(() => {
    if (data?.offers?.length > 0 && tab === 'planning') {
      // on ne force pas — laisser l'utilisateur voir le planning en premier
    }
  }, [data?.offers?.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-slate-800 border border-red-600/40 rounded-2xl p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Lien invalide</h1>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  const { agent, shifts, offers = [], today, stats = {} } = data;

  return (
    <div className="min-h-screen bg-slate-900 text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header sticky */}
      <header className="bg-slate-900/95 backdrop-blur border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
            style={{ backgroundColor: agent.color || '#3B82F6' }}
          >
            {initials(agent.first_name, agent.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm truncate">
              {agent.first_name} {agent.last_name}
            </div>
            <div className="text-xs text-slate-400 truncate">{agent.company_name}</div>
          </div>
          {offers.length > 0 && tab !== 'demandes' && (
            <button
              onClick={() => setTab('demandes')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-semibold animate-pulse"
            >
              <Bell className="w-3.5 h-3.5" />
              {offers.length}
            </button>
          )}
        </div>
      </header>

      <InstallBanner />

      {/* Contenu principal */}
      <main className="max-w-lg mx-auto px-4 py-5 pb-28">
        {tab === 'planning' && (
          <TabPlanning shifts={shifts} token={token} today={today} onUpdated={load} />
        )}
        {tab === 'demandes' && (
          <TabDemandes offers={offers} token={token} onReload={load} />
        )}
        {tab === 'profil' && (
          <TabProfil agent={agent} stats={stats} token={token} />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} offerCount={offers.length} />
    </div>
  );
}
