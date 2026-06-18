import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Building2, MapPin, Clock, Euro, BarChart3, Star,
  AlertTriangle, CheckCircle, LogIn, LogOut, Calendar,
  Bell, FileText, ChevronRight, Loader2, Shield,
  Siren, CheckSquare, Circle, FolderOpen, GraduationCap, Package,
} from 'lucide-react';
import { agentsApi, clientsApi, sitesApi, shiftsApi, invoicesApi, shiftOffersApi, get } from '../api';
import { TrendingUp } from 'lucide-react';

const fmt = n => n >= 1000 ? `${(n/1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:    'bg-blue-600/20 text-blue-400',
    emerald: 'bg-emerald-600/20 text-emerald-400',
    violet:  'bg-violet-600/20 text-violet-400',
    amber:   'bg-amber-600/20 text-amber-400',
    rose:    'bg-rose-600/20 text-rose-400',
  };
  return (
    <div className="stat-card">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Carte alerte cliquable ────────────────────────────────────────────────────
function AlertCard({ icon: Icon, iconColor, bg, border, title, count, sub, onClick }) {
  if (!count) return null;
  return (
    <button
      onClick={onClick}
      className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-3 w-full text-left hover:opacity-90 transition-opacity`}
    >
      <div className={`w-10 h-10 rounded-lg ${bg} border ${border} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${iconColor}`}>{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      </div>
      <div className={`text-2xl font-bold ${iconColor} shrink-0`}>{count}</div>
      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
    </button>
  );
}

// ── Agents en poste aujourd'hui ───────────────────────────────────────────────
function TodayShiftRow({ shift }) {
  const checkinDone  = !!shift.checkin_at;
  const checkoutDone = !!shift.checkout_at;

  let badge, badgeClass;
  if (checkoutDone) {
    badge = 'Terminé'; badgeClass = 'bg-slate-700 text-slate-400';
  } else if (checkinDone) {
    badge = 'En poste'; badgeClass = 'bg-emerald-500/20 text-emerald-400';
  } else {
    badge = 'Pas encore pointé'; badgeClass = 'bg-amber-500/15 text-amber-400';
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-dark-600 last:border-0">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ backgroundColor: shift.agent_color || '#3B82F6' }}
      >
        {shift.agent_first_name?.[0]}{shift.agent_last_name?.[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium truncate">
          {shift.agent_first_name} {shift.agent_last_name}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {shift.site_name} · {shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}
        </div>
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
        {badge}
      </span>
    </div>
  );
}

// ── Graphique CA facturé vs encaissé ─────────────────────────────────────────
function CAChart({ months }) {
  if (!months || !months.length) return <p className="text-slate-500 text-sm py-8 text-center">Aucune facture émise</p>;
  const max = Math.max(...months.flatMap(m => [m.invoiced, m.paid]), 1);
  return (
    <div>
      <div className="flex gap-4 mb-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Facturé</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Encaissé</span>
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {months.map(m => {
          const hi = Math.max((m.invoiced / max) * 100, m.invoiced > 0 ? 4 : 0);
          const hp = Math.max((m.paid     / max) * 100, m.paid > 0     ? 4 : 0);
          const label = m.month ? m.month.slice(5) + '/' + m.month.slice(2, 4) : '';
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="text-[10px] text-slate-500 h-4 leading-4">
                {m.invoiced > 0 ? fmt(m.invoiced) : ''}
              </div>
              <div className="w-full flex gap-0.5 items-end" style={{ height: '80px' }}>
                <div
                  className="flex-1 rounded-t bg-blue-500/70 hover:bg-blue-500 transition-colors"
                  style={{ height: `${hi}%` }}
                  title={`Facturé : ${m.invoiced.toLocaleString('fr-FR')} €`}
                />
                <div
                  className="flex-1 rounded-t bg-emerald-500/70 hover:bg-emerald-500 transition-colors"
                  style={{ height: `${hp}%` }}
                  title={`Encaissé : ${m.paid.toLocaleString('fr-FR')} €`}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Barre heures agent ────────────────────────────────────────────────────────
function HoursBar({ label, day, night, sunday }) {
  const total = (parseFloat(day)||0) + (parseFloat(night)||0) + (parseFloat(sunday)||0);
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-dark-600 last:border-0">
      <div className="w-28 text-sm text-slate-300 truncate">{label}</div>
      <div className="flex-1 flex rounded overflow-hidden h-4 bg-dark-700">
        {day   > 0 && <div className="bg-blue-500   h-full" style={{ width: `${(day/total)*100}%` }} />}
        {night > 0 && <div className="bg-violet-500 h-full" style={{ width: `${(night/total)*100}%` }} />}
        {sunday> 0 && <div className="bg-amber-500  h-full" style={{ width: `${(sunday/total)*100}%` }} />}
      </div>
      <div className="text-sm text-slate-300 font-medium w-12 text-right">{total.toFixed(1)}h</div>
    </div>
  );
}

// ── Page dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(true);
  const [agents, setAgents]         = useState([]);
  const [clients, setClients]       = useState([]);
  const [sites, setSites]           = useState([]);
  const [weekStats, setWeekStats]   = useState([]);
  const [monthStats, setMonthStats] = useState([]);
  const [revenue, setRevenue]       = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [caStats, setCaStats]       = useState(null);
  const [overtime, setOvertime]     = useState([]);
  const [todayShifts, setTodayShifts]     = useState([]);
  const [weekShifts, setWeekShifts]       = useState([]);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [carteProAlerts, setCarteProAlerts] = useState([]);
  const [todayTasks, setTodayTasks]         = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [notifData, setNotifData]           = useState({ count: 0, items: [] });

  const today      = new Date();
  const todayStr   = format(today, 'yyyy-MM-dd');
  const weekStart  = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd    = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd   = format(endOfMonth(today), 'yyyy-MM-dd');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      agentsApi.list(true),
      clientsApi.list(),
      sitesApi.list(),
      shiftsApi.stats({ start_date: weekStart,  end_date: weekEnd }),
      shiftsApi.stats({ start_date: monthStart, end_date: monthEnd }),
      fetch(`${BASE}/shifts/stats/revenue`, { headers: h }).then(r => r.json()),
      fetch(`${BASE}/shifts/stats/clients?start_date=${monthStart}&end_date=${monthEnd}`, { headers: h }).then(r => r.json()),
      // Nouvelles données opérationnelles
      shiftsApi.list({ start_date: todayStr, end_date: todayStr }),
      shiftsApi.list({ start_date: weekStart, end_date: weekEnd }),
      shiftOffersApi.list(),
      invoicesApi.list(),
      agentsApi.carteProAlerts(),
      invoicesApi.statsCA().catch(() => null),
      shiftsApi.overtime(4).catch(() => []),
      get(`/tasks?due=today&status=a_faire`).catch(() => []),
      get(`/incidents?status=ouvert`).catch(() => ({ items: [] })),
      get('/notifications').catch(() => ({ count: 0, items: [] })),
    ]).then(([a, c, s, ws, ms, rev, tc, ts, wsh, offers, invoices, cpa, ca, ot, tasks, incidents, notifs]) => {
      setAgents(a); setClients(c); setSites(s);
      setWeekStats(ws); setMonthStats(ms);
      setRevenue(Array.isArray(rev) ? rev : []);
      setTopClients(Array.isArray(tc) ? tc : []);
      setTodayShifts(Array.isArray(ts) ? ts : []);
      setWeekShifts(Array.isArray(wsh) ? wsh : []);
      setPendingOffers(Array.isArray(offers) ? offers.filter(o => o.status === 'pending') : []);
      const now = new Date();
      setUnpaidInvoices(Array.isArray(invoices)
        ? invoices.filter(i => (i.status === 'sent' || i.status === 'overdue') && i.due_date && new Date(i.due_date) < now)
        : []
      );
      setCarteProAlerts(Array.isArray(cpa) ? cpa : []);
      if (ca) setCaStats(ca);
      setOvertime(Array.isArray(ot) ? ot : []);
      setTodayTasks(Array.isArray(tasks) ? tasks : []);
      const incList = Array.isArray(incidents) ? incidents : (incidents?.items || []);
      setRecentIncidents(incList.slice(0, 5));
      setNotifData(notifs || { count: 0, items: [] });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
    </div>
  );

  const totalMonthHours  = monthStats.reduce((s, r) => s + (parseFloat(r.total_day)||0) + (parseFloat(r.total_night)||0) + (parseFloat(r.total_sunday)||0), 0);
  const totalWeekHours   = weekStats.reduce((s, r)  => s + (parseFloat(r.total_day)||0) + (parseFloat(r.total_night)||0) + (parseFloat(r.total_sunday)||0), 0);
  const currentMonthRev  = revenue.length ? parseFloat(revenue[revenue.length - 1]?.revenue) || 0 : 0;
  const prevMonthRev     = revenue.length > 1 ? parseFloat(revenue[revenue.length - 2]?.revenue) || 0 : 0;
  const revTrend         = prevMonthRev > 0 ? Math.round(((currentMonthRev - prevMonthRev) / prevMonthRev) * 100) : null;

  // Postes non couverts cette semaine
  const unassignedShifts = weekShifts.filter(s => !s.agent_id);
  // Shifts d'aujourd'hui avec agent
  const todayAssigned    = todayShifts.filter(s => s.agent_id);
  // Agents actuellement en poste (checkin sans checkout)
  const inService        = todayAssigned.filter(s => s.checkin_at && !s.checkout_at);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="text-slate-400 text-sm mt-1 capitalize">{format(today, "EEEE d MMMM yyyy", { locale: fr })}</p>
        </div>
      </div>

      {/* ── Alertes opérationnelles ── */}
      {(() => {
        const criticalIncidents = notifData.items?.filter(i => i.category === 'incidents' && i.level === 'critique') || [];
        const expiredDocs       = notifData.items?.filter(i => i.category === 'documents' && i.level === 'critique') || [];
        const expiredTrainings  = notifData.items?.filter(i => i.category === 'formations') || [];
        const overdueEquip      = notifData.items?.filter(i => i.category === 'equipements') || [];
        const hasAny = unassignedShifts.length || pendingOffers.length || unpaidInvoices.length ||
          carteProAlerts.length || overtime.length || criticalIncidents.length ||
          expiredDocs.length || expiredTrainings.length || overdueEquip.length;
        if (!hasAny) return null;
        return (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Alertes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AlertCard
              icon={Calendar}
              iconColor="text-red-400"
              bg="bg-red-600/10"
              border="border-red-600/30"
              title="Postes non couverts"
              count={unassignedShifts.length}
              sub="cette semaine sans agent"
              onClick={() => navigate('/planning')}
            />
            <AlertCard
              icon={Bell}
              iconColor="text-amber-400"
              bg="bg-amber-600/10"
              border="border-amber-600/30"
              title="Offres sans réponse"
              count={pendingOffers.length}
              sub="agents n'ont pas encore répondu"
              onClick={() => navigate('/planning')}
            />
            <AlertCard
              icon={FileText}
              iconColor="text-orange-400"
              bg="bg-orange-600/10"
              border="border-orange-600/30"
              title="Factures en retard"
              count={unpaidInvoices.length}
              sub="dépassent la date d'échéance"
              onClick={() => navigate('/invoices')}
            />
            <AlertCard
              icon={TrendingUp}
              iconColor="text-purple-400"
              bg="bg-purple-600/10"
              border="border-purple-600/30"
              title="Heures supplémentaires"
              count={overtime.length}
              sub={`semaine(s) dépassant 35h sur les 4 dernières semaines`}
              onClick={() => navigate('/recap-heures')}
            />
            {carteProAlerts.length > 0 && (
              <AlertCard
                icon={Shield}
                iconColor={carteProAlerts.some(a => a.expired) ? 'text-red-400' : 'text-amber-400'}
                bg={carteProAlerts.some(a => a.expired) ? 'bg-red-600/10' : 'bg-amber-600/10'}
                border={carteProAlerts.some(a => a.expired) ? 'border-red-600/30' : 'border-amber-600/30'}
                title="Cartes pro à renouveler"
                count={carteProAlerts.length}
                sub={carteProAlerts.some(a => a.expired) ? 'dont expirée(s) — action urgente' : 'expirent dans moins de 30 jours'}
                onClick={() => navigate('/agents')}
              />
            )}
            <AlertCard icon={Siren} iconColor="text-red-400" bg="bg-red-600/10" border="border-red-600/30"
              title="Incidents critiques ouverts" count={criticalIncidents.length}
              sub="nécessitent une clôture urgente" onClick={() => navigate('/incidents')} />
            <AlertCard icon={FolderOpen} iconColor="text-rose-400" bg="bg-rose-600/10" border="border-rose-600/30"
              title="Documents expirés" count={expiredDocs.length}
              sub="agents avec document(s) expiré(s)" onClick={() => navigate('/documents')} />
            <AlertCard icon={GraduationCap} iconColor="text-violet-400" bg="bg-violet-600/10" border="border-violet-600/30"
              title="Formations à renouveler" count={expiredTrainings.length}
              sub="expirent dans moins de 60 jours" onClick={() => navigate('/formations')} />
            <AlertCard icon={Package} iconColor="text-cyan-400" bg="bg-cyan-600/10" border="border-cyan-600/30"
              title="Équipements non rendus" count={overdueEquip.length}
              sub="dépassent la date de retour" onClick={() => navigate('/equipements')} />
          </div>
        </section>
        );
      })()}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users}     label="Agents actifs"    value={agents.filter(a => a.active !== false).length} color="blue" />
        <StatCard icon={Building2} label="Clients"          value={clients.filter(c => c.active).length}          color="emerald" />
        <StatCard icon={MapPin}    label="Sites actifs"     value={sites.filter(s => s.active).length}            color="violet" />
        <StatCard icon={Clock}     label="Heures ce mois"   value={`${totalMonthHours.toFixed(0)}h`}              color="amber" />
        <StatCard
          icon={Euro}
          label="CA ce mois (estimé)"
          value={`${currentMonthRev.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €`}
          sub={revTrend !== null ? `${revTrend >= 0 ? '+' : ''}${revTrend}% vs mois dernier` : undefined}
          color="rose"
        />
      </div>

      {/* ── Aujourd'hui ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Agents en poste aujourd'hui
          </h2>
          {inService.length > 0 && (
            <span className="text-xs text-emerald-400 font-semibold">
              {inService.length} actuellement en service
            </span>
          )}
        </div>

        {todayAssigned.length === 0 ? (
          <div className="card p-6 text-center">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Aucun agent planifié aujourd'hui</p>
          </div>
        ) : (
          <div className="card p-4">
            {todayAssigned.map(s => <TodayShiftRow key={s.id} shift={s} />)}
            {unassignedShifts.filter(s => {
              const todayStr2 = format(today, 'yyyy-MM-dd');
              return s.date === todayStr2;
            }).length > 0 && (
              <div className="flex items-center gap-2 py-2.5 text-xs text-red-400/80 border-t border-dark-600 mt-1 pt-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {unassignedShifts.filter(s => s.date === format(today,'yyyy-MM-dd')).length} poste(s) non couverts aujourd'hui
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Tâches du jour + Incidents récents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tâches du jour */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-400" />
              Tâches du jour
            </h2>
            <button onClick={() => navigate('/taches')} className="text-xs text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1">
              Voir tout <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            {todayTasks.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-slate-600">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-sm">Aucune tâche pour aujourd'hui</span>
              </div>
            ) : todayTasks.map(t => {
              const priorityColor = t.priority === 'urgente' ? 'bg-red-500' : t.priority === 'haute' ? 'bg-orange-400' : t.priority === 'normale' ? 'bg-blue-500' : 'bg-slate-500';
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-dark-600 last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColor}`} />
                  <span className="text-sm text-slate-200 flex-1 truncate">{t.title}</span>
                  {t.priority === 'urgente' && <span className="text-[10px] text-red-400 font-semibold shrink-0">URGENT</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Incidents récents */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Siren className="w-4 h-4 text-orange-400" />
              Incidents ouverts récents
            </h2>
            <button onClick={() => navigate('/incidents')} className="text-xs text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1">
              Voir tout <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            {recentIncidents.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-slate-600">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-sm">Aucun incident ouvert</span>
              </div>
            ) : recentIncidents.map(inc => {
              const sevColor = inc.severity === 'critique' ? 'bg-red-500' : inc.severity === 'majeur' ? 'bg-orange-500' : inc.severity === 'modere' ? 'bg-amber-400' : 'bg-slate-500';
              return (
                <div key={inc.id} className="flex items-center gap-3 px-4 py-3 border-b border-dark-600 last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sevColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{inc.title}</div>
                    <div className="text-xs text-slate-500">{inc.site_name || ''} · {inc.incident_date}</div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 capitalize">{inc.severity}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── CA factures ── */}
      {caStats && (
        <section className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">Total facturé</div>
            <div className="text-xl font-bold text-blue-400">{Number(caStats.totals.total_invoiced).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €</div>
            <div className="text-xs text-slate-500 mt-0.5">HT · toutes périodes</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">Total encaissé</div>
            <div className="text-xl font-bold text-emerald-400">{Number(caStats.totals.total_paid).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €</div>
            <div className="text-xs text-slate-500 mt-0.5">HT · factures payées</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">En attente</div>
            <div className="text-xl font-bold text-amber-400">{Number(caStats.totals.total_pending).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €</div>
            <div className="text-xs text-slate-500 mt-0.5">HT · envoyées non payées</div>
          </div>
        </section>
      )}

      {/* ── Graphiques ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" /> CA sur 12 mois
            </h2>
            <span className="text-xs text-slate-500">Facturé vs encaissé</span>
          </div>
          <CAChart months={caStats?.months} />
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" /> Top clients ce mois
            </h2>
            <span className="text-xs text-slate-500 capitalize">{format(today, 'MMMM yyyy', { locale: fr })}</span>
          </div>
          {topClients.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">Aucune prestation ce mois</p>
          ) : (
            <div className="space-y-2">
              {topClients.slice(0, 6).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-xs font-bold text-slate-500 w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.hours}h · {c.shift_count} prestation{c.shift_count > 1 ? 's' : ''}</div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 shrink-0">
                    {parseFloat(c.revenue).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Heures semaine / mois ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Heures semaine en cours</h2>
            <span className="text-xs text-slate-500">{weekStart} → {weekEnd}</span>
          </div>
          <div className="flex gap-4 mb-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Jour</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Nuit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Dimanche</span>
          </div>
          {weekStats.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Aucun shift cette semaine</p>
          ) : (
            <>
              {weekStats.map(s => <HoursBar key={s.agent_id} label={`${s.first_name} ${s.last_name}`} day={s.total_day} night={s.total_night} sunday={s.total_sunday} />)}
              <div className="mt-3 pt-3 border-t border-dark-500 flex justify-between text-sm">
                <span className="text-slate-400">Total semaine</span>
                <span className="font-semibold text-white">{totalWeekHours.toFixed(1)}h</span>
              </div>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Heures mois en cours</h2>
            <span className="text-xs text-slate-500 capitalize">{format(today, 'MMMM yyyy', { locale: fr })}</span>
          </div>
          <div className="flex gap-4 mb-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Jour</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Nuit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Dimanche</span>
          </div>
          {monthStats.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Aucun shift ce mois</p>
          ) : (
            <>
              {monthStats.slice(0, 8).map(s => <HoursBar key={s.agent_id} label={`${s.first_name} ${s.last_name}`} day={s.total_day} night={s.total_night} sunday={s.total_sunday} />)}
              <div className="mt-3 pt-3 border-t border-dark-500 flex justify-between text-sm">
                <span className="text-slate-400">Total mois</span>
                <span className="font-semibold text-white">{totalMonthHours.toFixed(1)}h</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
