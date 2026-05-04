import { useEffect, useState } from 'react';
import { Users, Building2, MapPin, Calendar, TrendingUp, Moon, Sun, Clock } from 'lucide-react';
import { agentsApi, clientsApi, sitesApi, shiftsApi } from '../api';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-600/20 text-blue-400',
    emerald: 'bg-emerald-600/20 text-emerald-400',
    violet: 'bg-violet-600/20 text-violet-400',
    amber: 'bg-amber-600/20 text-amber-400',
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

function HoursBar({ label, day, night, sunday }) {
  const total = day + night + sunday;
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-dark-600 last:border-0">
      <div className="w-28 text-sm text-slate-300 truncate">{label}</div>
      <div className="flex-1 flex rounded overflow-hidden h-4 bg-dark-700">
        {day > 0 && (
          <div className="bg-blue-500 h-full flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${(day / total) * 100}%` }}>
            {day > 2 ? `${day.toFixed(1)}h` : ''}
          </div>
        )}
        {night > 0 && (
          <div className="bg-violet-500 h-full flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${(night / total) * 100}%` }}>
            {night > 2 ? `${night.toFixed(1)}h` : ''}
          </div>
        )}
        {sunday > 0 && (
          <div className="bg-amber-500 h-full flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${(sunday / total) * 100}%` }}>
            {sunday > 2 ? `${sunday.toFixed(1)}h` : ''}
          </div>
        )}
      </div>
      <div className="text-sm text-slate-300 font-medium w-12 text-right">{total.toFixed(1)}h</div>
    </div>
  );
}

export default function Dashboard() {
  const [agents, setAgents] = useState([]);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [weekStats, setWeekStats] = useState([]);
  const [monthStats, setMonthStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  useEffect(() => {
    Promise.all([
      agentsApi.list(true),
      clientsApi.list(),
      sitesApi.list(),
      shiftsApi.stats({ start_date: weekStart, end_date: weekEnd }),
      shiftsApi.stats({ start_date: monthStart, end_date: monthEnd }),
    ]).then(([a, c, s, ws, ms]) => {
      setAgents(a);
      setClients(c);
      setSites(s);
      setWeekStats(ws);
      setMonthStats(ms);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400">Chargement...</div>
    </div>
  );

  const totalWeekHours = weekStats.reduce((s, r) => s + r.total_day + r.total_night + r.total_sunday, 0);
  const totalMonthHours = monthStats.reduce((s, r) => s + r.total_day + r.total_night + r.total_sunday, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="text-slate-400 text-sm mt-1">
            {format(today, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Agents actifs" value={agents.length} color="blue" />
        <StatCard icon={Building2} label="Clients" value={clients.filter(c => c.active).length} color="emerald" />
        <StatCard icon={MapPin} label="Sites actifs" value={sites.filter(s => s.active).length} color="violet" />
        <StatCard icon={Clock} label="Heures ce mois" value={`${totalMonthHours.toFixed(0)}h`} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heures semaine */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Heures semaine en cours</h2>
            <span className="text-xs text-slate-500">{weekStart} → {weekEnd}</span>
          </div>
          <div className="flex gap-4 mb-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Jour</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block"/>Nuit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Dimanche</span>
          </div>
          {weekStats.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Aucun shift cette semaine</p>
          ) : (
            <div>
              {weekStats.map(s => (
                <HoursBar
                  key={s.agent_id}
                  label={`${s.first_name} ${s.last_name}`}
                  day={s.total_day}
                  night={s.total_night}
                  sunday={s.total_sunday}
                />
              ))}
              <div className="mt-3 pt-3 border-t border-dark-500 flex justify-between text-sm">
                <span className="text-slate-400">Total semaine</span>
                <span className="font-semibold text-white">{totalWeekHours.toFixed(1)}h</span>
              </div>
            </div>
          )}
        </div>

        {/* Heures mois */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Heures mois en cours</h2>
            <span className="text-xs text-slate-500">{format(today, 'MMMM yyyy', { locale: fr })}</span>
          </div>
          <div className="flex gap-4 mb-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Jour</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block"/>Nuit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Dimanche</span>
          </div>
          {monthStats.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Aucun shift ce mois</p>
          ) : (
            <div>
              {monthStats.slice(0, 8).map(s => (
                <HoursBar
                  key={s.agent_id}
                  label={`${s.first_name} ${s.last_name}`}
                  day={s.total_day}
                  night={s.total_night}
                  sunday={s.total_sunday}
                />
              ))}
              <div className="mt-3 pt-3 border-t border-dark-500 flex justify-between text-sm">
                <span className="text-slate-400">Total mois</span>
                <span className="font-semibold text-white">{totalMonthHours.toFixed(1)}h</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
