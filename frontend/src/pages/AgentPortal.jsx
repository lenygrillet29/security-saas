import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield, MapPin, Clock, LogIn, LogOut, CheckCircle,
  AlertTriangle, Loader2, Calendar, Info, X,
  Bell, BellOff, User, Phone, Mail, FileText,
  CalendarDays, TrendingUp, ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function fmt(t) { return t?.slice(0, 5) || ''; }

function duration(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let m = (eh * 60 + em) - (sh * 60 + sm);
  if (m < 0) m += 1440;
  const h = Math.floor(m / 60), mn = m % 60;
  return mn ? `${h}h${String(mn).padStart(2,'0')}` : `${h}h`;
}

function dayLabel(date) {
  const d = parseISO(date);
  if (isToday(d))    return "Aujourd'hui";
  if (isTomorrow(d)) return 'Demain';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

function initials(first, last) {
  return `${(first||'')[0]||''}${(last||'')[0]||''}`.toUpperCase();
}

// ── Geolocalisation ───────────────────────────────────────────────────────────
function getCoords() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

// ── Carte vacation du jour ────────────────────────────────────────────────────
function TodayShiftCard({ shift, token, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const done = shift.checkin_at && shift.checkout_at;

  async function punch() {
    setLoading(true); setErr('');
    try {
      const coords = await getCoords();
      const action = shift.checkin_at ? 'checkout' : 'checkin';
      const r = await fetch(`${API_BASE}/agent-portal/${token}/${action}/${shift.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      onUpdated();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className={`rounded-3xl overflow-hidden ${
      done ? 'bg-emerald-900/30 border border-emerald-500/30'
           : shift.checkin_at ? 'bg-orange-900/30 border border-orange-500/30'
           : 'bg-blue-900/40 border border-blue-500/30'
    }`}>
      {/* Bandeau coloré haut */}
      <div className={`h-1.5 w-full ${done ? 'bg-emerald-500' : shift.checkin_at ? 'bg-orange-400' : 'bg-blue-500'}`} />

      <div className="p-5 space-y-4">
        {/* Site + horaires */}
        <div>
          <div className="text-xl font-bold text-white leading-tight">{shift.site_name}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-3xl font-bold text-white">{fmt(shift.start_time)}</span>
            <span className="text-slate-400 text-lg">–</span>
            <span className="text-3xl font-bold text-white">{fmt(shift.end_time)}</span>
            <span className="ml-2 text-sm text-slate-400 bg-slate-800 rounded-full px-3 py-1">
              {duration(shift.start_time, shift.end_time)}
            </span>
          </div>
        </div>

        {/* Adresse */}
        {(shift.site_address || shift.site_city) && (
          <div className="flex items-start gap-2.5 text-slate-300 text-base">
            <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <span>{[shift.site_address, shift.site_city].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {/* Instructions site */}
        {shift.site_instructions && (
          <div className="flex items-start gap-2.5 bg-blue-950/60 border border-blue-800/40 rounded-2xl p-4">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <span className="text-blue-100 text-sm">{shift.site_instructions}</span>
          </div>
        )}

        {/* Statut pointage */}
        {shift.checkin_at && (
          <div className="space-y-1.5 bg-slate-800/60 rounded-2xl p-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <LogIn className="w-4 h-4" />
              Arrivée pointée à {format(new Date(shift.checkin_at), 'HH:mm')}
              {shift.checkin_distance != null && (
                <span className="text-slate-500 text-xs">· {shift.checkin_distance}m</span>
              )}
            </div>
            {shift.checkout_at && (
              <div className="flex items-center gap-2 text-orange-400 text-sm font-medium">
                <LogOut className="w-4 h-4" />
                Sortie pointée à {format(new Date(shift.checkout_at), 'HH:mm')}
              </div>
            )}
          </div>
        )}

        {/* Bouton pointer */}
        {!done && (
          <button
            onClick={punch}
            disabled={loading}
            className={`w-full py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-60 ${
              shift.checkin_at
                ? 'bg-orange-500 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" />
              : shift.checkin_at
              ? <><LogOut className="w-6 h-6" /> Pointer la sortie</>
              : <><LogIn className="w-6 h-6" /> Pointer l'arrivée</>
            }
          </button>
        )}

        {done && (
          <div className="flex items-center justify-center gap-2 py-3 text-emerald-400 font-semibold">
            <CheckCircle className="w-5 h-5" /> Vacation terminée
          </div>
        )}

        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
      </div>
    </div>
  );
}

// ── Carte vacation à venir ────────────────────────────────────────────────────
function UpcomingShiftCard({ shift }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 p-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-1 self-stretch rounded-full bg-slate-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-base truncate">{shift.site_name}</div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mt-0.5">
            <Clock className="w-3.5 h-3.5" />
            {fmt(shift.start_time)} – {fmt(shift.end_time)}
            <span className="text-slate-600">·</span>
            {duration(shift.start_time, shift.end_time)}
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
               : <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/40 pt-3">
          {(shift.site_address || shift.site_city) && (
            <div className="flex items-start gap-2 text-slate-300 text-sm">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              {[shift.site_address, shift.site_city].filter(Boolean).join(', ')}
            </div>
          )}
          {shift.site_instructions && (
            <div className="flex items-start gap-2 bg-slate-700/40 rounded-xl p-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span className="text-slate-300 text-sm">{shift.site_instructions}</span>
            </div>
          )}
          {shift.notes && <p className="text-slate-500 text-xs italic">{shift.notes}</p>}
        </div>
      )}
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
  const days = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b));
  const todayShifts = grouped[today] || [];
  const future = days.filter(([d]) => d !== today);

  return (
    <div className="space-y-8">
      {/* Aujourd'hui */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Aujourd'hui</span>
        </div>
        {todayShifts.length > 0 ? (
          todayShifts.map(s => (
            <TodayShiftCard key={s.id} shift={s} token={token} onUpdated={onUpdated} />
          ))
        ) : (
          <div className="rounded-3xl bg-slate-800/50 border border-slate-700/40 p-8 text-center">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Pas de vacation aujourd'hui</p>
          </div>
        )}
      </section>

      {/* À venir */}
      {future.length > 0 && (
        <section className="space-y-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">À venir</span>
          <div className="space-y-5">
            {future.map(([date, dayShifts]) => (
              <div key={date}>
                <div className="text-sm font-semibold text-slate-400 capitalize mb-2 px-1">
                  {dayLabel(date)}
                </div>
                <div className="space-y-2">
                  {dayShifts.map(s => <UpcomingShiftCard key={s.id} shift={s} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {days.length === 0 && (
        <div className="rounded-3xl bg-slate-800/50 border border-slate-700/40 p-10 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Aucune vacation planifiée</p>
          <p className="text-slate-500 text-sm mt-1">dans les 30 prochains jours</p>
        </div>
      )}
    </div>
  );
}

// ── Carte offre de vacation ───────────────────────────────────────────────────
function OfferCard({ offer, token, onResponded }) {
  const [loading, setLoading] = useState(null);
  const [done, setDone]       = useState(null);
  const [err, setErr]         = useState('');

  async function respond(action) {
    setLoading(action); setErr('');
    try {
      const r = await fetch(`${API_BASE}/agent-portal/${token}/offers/${offer.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      setDone(action === 'accept' ? 'accepted' : 'declined');
      setTimeout(() => onResponded(), 1500);
    } catch (e) { setErr(e.message); }
    finally { setLoading(null); }
  }

  return (
    <div className="rounded-3xl border border-amber-500/30 bg-amber-950/30 overflow-hidden">
      <div className="h-1 bg-amber-400" />
      <div className="p-5 space-y-5">
        <div>
          <div className="text-xl font-bold text-white">{offer.site_name}</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-amber-300">{fmt(offer.start_time)}</span>
            <span className="text-slate-400">–</span>
            <span className="text-2xl font-bold text-amber-300">{fmt(offer.end_time)}</span>
            <span className="text-sm text-slate-400 bg-slate-800 rounded-full px-3 py-0.5 ml-1">
              {duration(offer.start_time, offer.end_time)}
            </span>
          </div>
          <div className="text-base text-amber-300/80 font-medium mt-1 capitalize">
            {dayLabel(offer.date)}
          </div>
          {offer.site_address && (
            <div className="flex items-center gap-2 text-slate-400 text-sm mt-2">
              <MapPin className="w-4 h-4" />{offer.site_address}
            </div>
          )}
        </div>

        {done ? (
          <div className={`rounded-2xl py-4 text-center text-base font-bold ${
            done === 'accepted' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            {done === 'accepted' ? '✅ Vacation acceptée !' : '❌ Vacation déclinée'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => respond('decline')}
              disabled={!!loading}
              className="py-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-base font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'decline' ? <Loader2 className="w-5 h-5 animate-spin" /> : '✕'} Décliner
            </button>
            <button
              onClick={() => respond('accept')}
              disabled={!!loading}
              className="py-4 rounded-2xl bg-emerald-600 text-white text-base font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'accept' ? <Loader2 className="w-5 h-5 animate-spin" /> : '✓'} Accepter
            </button>
          </div>
        )}
        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
      </div>
    </div>
  );
}

// ── Onglet Demandes ───────────────────────────────────────────────────────────
function TabDemandes({ offers, token, onReload }) {
  if (offers.length === 0) {
    return (
      <div className="rounded-3xl bg-slate-800/50 border border-slate-700/40 p-10 text-center">
        <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">Aucune demande en attente</p>
        <p className="text-slate-500 text-sm mt-1">Les propositions de vacation apparaîtront ici</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400 px-1">
        {offers.length} proposition{offers.length > 1 ? 's' : ''} en attente
      </p>
      {offers.map(o => (
        <OfferCard key={o.id} offer={o} token={token} onResponded={onReload} />
      ))}
    </div>
  );
}

// ── Onglet Congés ─────────────────────────────────────────────────────────────
const ABSENCE_TYPES = [
  { value: 'conge',     label: 'Congé payé' },
  { value: 'maladie',   label: 'Arrêt maladie' },
  { value: 'formation', label: 'Formation' },
  { value: 'autre',     label: 'Autre' },
];

const STATUS_STYLES = {
  pending:  { label: 'En attente', cls: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approuvé',   cls: 'bg-emerald-500/20 text-emerald-300' },
  rejected: { label: 'Refusé',     cls: 'bg-red-500/20 text-red-300' },
};

function TabConges({ token }) {
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [done, setDone]         = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ type: 'conge', start_date: today, end_date: today, notes: '' });

  async function load() {
    try {
      const r = await fetch(`${API_BASE}/agent-portal/${token}/absences`);
      const j = await r.json();
      setAbsences(Array.isArray(j) ? j : []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.end_date < form.start_date) { setErr('La date de fin doit être après le début'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch(`${API_BASE}/agent-portal/${token}/absences`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      setDone(true);
      setShowForm(false);
      await load();
      setTimeout(() => setDone(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  function daysBetween(a, b) {
    return Math.ceil((new Date(b) - new Date(a)) / 86400000) + 1;
  }

  return (
    <div className="space-y-4">
      {done && (
        <div className="rounded-2xl bg-emerald-900/40 border border-emerald-500/30 p-4 text-center text-emerald-300 font-semibold text-sm">
          ✅ Demande envoyée — en attente de validation
        </div>
      )}

      {/* Bouton nouvelle demande */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-600 text-slate-400 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" /> Nouvelle demande de congé
        </button>
      )}

      {/* Formulaire */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-3xl bg-slate-800/60 border border-slate-700/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold text-white">Nouvelle demande</div>
            <button type="button" onClick={() => { setShowForm(false); setErr(''); }}
              className="text-slate-500 active:opacity-70">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ABSENCE_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`py-3 rounded-2xl text-sm font-semibold border transition-all active:scale-95 ${
                    form.type === t.value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-700/50 border-slate-600 text-slate-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">Du</label>
              <input type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 rounded-2xl px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">Au</label>
              <input type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 rounded-2xl px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">Motif (facultatif)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Précisions éventuelles..."
              className="w-full bg-slate-700/60 border border-slate-600 rounded-2xl px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500 resize-none" />
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full py-4 rounded-2xl bg-blue-600 text-white text-base font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Envoyer la demande
          </button>
        </form>
      )}

      {/* Historique */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
      ) : absences.length === 0 ? (
        <div className="rounded-3xl bg-slate-800/50 border border-slate-700/40 p-10 text-center">
          <CalendarDays className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Aucune demande</p>
          <p className="text-slate-500 text-sm mt-1">Vos congés apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 px-1">Historique des demandes</p>
          {absences.map(ab => {
            const st = STATUS_STYLES[ab.status] || STATUS_STYLES.pending;
            const type = ABSENCE_TYPES.find(t => t.value === ab.type)?.label || ab.type;
            return (
              <div key={ab.id} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{type}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(ab.start_date).toLocaleDateString('fr-FR')}
                    {ab.start_date !== ab.end_date && ` → ${new Date(ab.end_date).toLocaleDateString('fr-FR')}`}
                    {' · '}{daysBetween(ab.start_date, ab.end_date)}j
                  </div>
                  {ab.notes && <div className="text-xs text-slate-500 italic mt-0.5">"{ab.notes}"</div>}
                </div>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${st.cls}`}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Notifications hook ────────────────────────────────────────────────────────
function useNotif(token) {
  const [status, setStatus] = useState('loading');

  function b64(s) {
    const p = '='.repeat((4 - s.length % 4) % 4);
    const b = (s + p).replace(/-/g,'+').replace(/_/g,'/');
    return Uint8Array.from([...atob(b)].map(c => c.charCodeAt(0)));
  }

  async function subscribe(key) {
    const reg = await navigator.serviceWorker.ready;
    const ex  = await reg.pushManager.getSubscription();
    const sub = ex || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    await fetch(`${API_BASE}/agent-portal/${token}/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    setStatus('on');
  }

  async function enable() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
    setStatus('loading');
    try {
      const { key } = await fetch(`${API_BASE}/agent-portal/vapid-public-key`).then(r => r.json());
      if (!key) { setStatus('unsupported'); return; }
      if (Notification.permission === 'granted') { await subscribe(key); return; }
      if (Notification.permission === 'denied')  { setStatus('blocked'); return; }
      const p = await Notification.requestPermission();
      if (p === 'granted') await subscribe(key); else setStatus('blocked');
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
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setStatus(sub ? 'on' : 'idle'))
      .catch(() => setStatus('idle'));
  }, []);

  return { status, enable, disable };
}

// ── Onglet Profil ─────────────────────────────────────────────────────────────
function TabProfil({ agent, stats, token }) {
  const { status, enable, disable } = useNotif(token);

  const contractLabel = {
    CDI: 'CDI', CDD: 'CDD', Interim: 'Intérim', Vacation: 'Vacation',
  }[agent.contract_type] || agent.contract_type;

  return (
    <div className="space-y-5">
      {/* Carte identité */}
      <div className="rounded-3xl bg-slate-800/60 border border-slate-700/40 p-6">
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{ backgroundColor: agent.color || '#3B82F6' }}
          >
            {initials(agent.first_name, agent.last_name)}
          </div>
          <div>
            <div className="text-xl font-bold text-white">{agent.first_name} {agent.last_name}</div>
            <div className="text-slate-400 mt-0.5">{agent.company_name}</div>
            {contractLabel && (
              <span className="inline-block mt-2 text-xs font-semibold bg-slate-700 text-slate-300 rounded-full px-3 py-1">
                {contractLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats du mois */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-slate-800/60 border border-slate-700/40 p-5 text-center">
          <div className="text-4xl font-bold text-white">{stats.shift_count}</div>
          <div className="text-slate-400 text-sm mt-1">vacations<br />ce mois</div>
        </div>
        <div className="rounded-3xl bg-slate-800/60 border border-slate-700/40 p-5 text-center">
          <div className="text-4xl font-bold text-white">{stats.hours_count}<span className="text-2xl">h</span></div>
          <div className="text-slate-400 text-sm mt-1">heures<br />ce mois</div>
        </div>
      </div>

      {/* Coordonnées */}
      {(agent.email || agent.phone) && (
        <div className="rounded-3xl bg-slate-800/60 border border-slate-700/40 overflow-hidden">
          {agent.phone && (
            <a href={`tel:${agent.phone}`}
              className="flex items-center gap-4 p-5 active:bg-slate-700/40 transition-colors">
              <div className="w-11 h-11 rounded-2xl bg-blue-900/60 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Téléphone</div>
                <div className="text-base text-white font-medium">{agent.phone}</div>
              </div>
            </a>
          )}
          {agent.email && agent.phone && <div className="h-px bg-slate-700/50 mx-5" />}
          {agent.email && (
            <a href={`mailto:${agent.email}`}
              className="flex items-center gap-4 p-5 active:bg-slate-700/40 transition-colors">
              <div className="w-11 h-11 rounded-2xl bg-purple-900/60 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Email</div>
                <div className="text-base text-white font-medium">{agent.email}</div>
              </div>
            </a>
          )}
        </div>
      )}

      {/* Infos contrat */}
      {(agent.carte_pro || agent.entry_date) && (
        <div className="rounded-3xl bg-slate-800/60 border border-slate-700/40 overflow-hidden">
          {agent.carte_pro && (
            <div className="flex items-center gap-4 p-5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-900/60 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Carte professionnelle</div>
                <div className="text-base text-white font-mono font-medium">{agent.carte_pro}</div>
              </div>
            </div>
          )}
          {agent.carte_pro && agent.entry_date && <div className="h-px bg-slate-700/50 mx-5" />}
          {agent.entry_date && (
            <div className="flex items-center gap-4 p-5">
              <div className="w-11 h-11 rounded-2xl bg-slate-700 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Date d'entrée</div>
                <div className="text-base text-white font-medium capitalize">
                  {format(new Date(agent.entry_date), 'd MMMM yyyy', { locale: fr })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifications */}
      <div className="rounded-3xl bg-slate-800/60 border border-slate-700/40 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              status === 'on' ? 'bg-blue-900/60' : 'bg-slate-700'
            }`}>
              {status === 'on'
                ? <Bell className="w-5 h-5 text-blue-400" />
                : <BellOff className="w-5 h-5 text-slate-500" />}
            </div>
            <div>
              <div className="text-base text-white font-medium">Rappels de vacation</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {status === 'on'      ? '24h et 2h avant chaque vacation'
                 : status === 'blocked' ? 'Bloqué — voir réglages navigateur'
                 : status === 'unsupported' ? 'Non disponible sur ce navigateur'
                 : 'Désactivés'}
              </div>
            </div>
          </div>

          {status !== 'unsupported' && status !== 'blocked' && (
            <button
              onClick={status === 'on' ? disable : enable}
              disabled={status === 'loading'}
              className={`relative w-14 h-8 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                status === 'on' ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                status === 'on' ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-600 pb-4">SecuroPlan · {agent.company_name}</p>
    </div>
  );
}

// ── Bannière installation PWA ─────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [gone, setGone] = useState(() => sessionStorage.getItem('pwa-gone') === '1');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    if (isStandalone) return;
    const h = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  function dismiss() { setGone(true); sessionStorage.setItem('pwa-gone','1'); }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setGone(true);
  }

  if (isStandalone || gone) return null;

  if (prompt) return (
    <div className="mx-4 mt-4 bg-blue-950/80 border border-blue-600/40 rounded-3xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
        <Shield className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1">
        <div className="font-bold text-white text-base">Installer l'application</div>
        <div className="text-slate-400 text-sm">Accès rapide depuis l'écran d'accueil</div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <button onClick={install} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-all">
          Installer
        </button>
        <button onClick={dismiss} className="text-slate-500 text-xs">Plus tard</button>
      </div>
    </div>
  );

  if (isIOS) return (
    <div className="mx-4 mt-4 bg-slate-800/90 border border-slate-700/50 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="font-bold text-white text-base">📲 Installer sur iPhone</div>
        <button onClick={dismiss} className="text-slate-500"><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-3">
        {[
          ["1", <>Appuyez sur <span className="text-blue-400 font-bold">Partager ⎙</span> en bas de Safari</>],
          ["2", <>"Sur l'écran d'accueil"</>],
          ["3", <>"Ajouter"</>],
        ].map(([n, txt]) => (
          <div key={n} className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-600/30 text-blue-400 text-sm font-bold flex items-center justify-center shrink-0">{n}</span>
            <span className="text-slate-300 text-base">{txt}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return null;
}

// ── Navigation bas de page ────────────────────────────────────────────────────
function BottomNav({ active, onChange, offerCount }) {
  const tabs = [
    { id: 'planning', icon: Calendar,     label: 'Planning' },
    { id: 'demandes', icon: Bell,         label: 'Demandes', badge: offerCount },
    { id: 'conges',   icon: CalendarDays, label: 'Congés' },
    { id: 'profil',   icon: User,         label: 'Profil' },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-slate-900/98 border-t border-slate-800 z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {tabs.map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3 transition-colors relative active:opacity-70 ${
              active === id ? 'text-blue-400' : 'text-slate-500'
            }`}
          >
            {active === id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-blue-400 rounded-full" />
            )}
            <div className="relative">
              <Icon className="w-6 h-6" />
              {badge > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ── App principale ────────────────────────────────────────────────────────────
export default function AgentPortal() {
  const { token }   = useParams();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('planning');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/agent-portal/${token}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Lien invalide');
      setData(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center">
        <Shield className="w-8 h-8 text-white" />
      </div>
      <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xs bg-slate-800 border border-red-800/50 rounded-3xl p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <div className="text-lg font-bold text-white">Lien invalide</div>
        <p className="text-slate-400">{error}</p>
      </div>
    </div>
  );

  const { agent, shifts, offers = [], today, stats = {} } = data;

  return (
    <div
      className="min-h-screen bg-slate-900 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold text-white shrink-0"
            style={{ backgroundColor: agent.color || '#3B82F6' }}
          >
            {initials(agent.first_name, agent.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-base leading-tight truncate">
              {agent.first_name} {agent.last_name}
            </div>
            <div className="text-slate-400 text-sm truncate">{agent.company_name}</div>
          </div>
          {offers.length > 0 && tab !== 'demandes' && (
            <button
              onClick={() => setTab('demandes')}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-300 text-sm font-bold"
            >
              <Bell className="w-4 h-4" />
              {offers.length}
            </button>
          )}
        </div>
      </header>

      <InstallBanner />

      {/* Contenu */}
      <main className="px-4 py-5 pb-28">
        {tab === 'planning' && (
          <TabPlanning shifts={shifts} token={token} today={today} onUpdated={load} />
        )}
        {tab === 'demandes' && (
          <TabDemandes offers={offers} token={token} onReload={load} />
        )}
        {tab === 'conges' && (
          <TabConges token={token} />
        )}
        {tab === 'profil' && (
          <TabProfil agent={agent} stats={stats} token={token} />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} offerCount={offers.length} />
    </div>
  );
}
