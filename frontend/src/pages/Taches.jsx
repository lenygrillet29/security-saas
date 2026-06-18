import { useState, useEffect, useRef } from 'react';
import { CheckSquare, Square, Plus, Trash2, Edit2, AlertTriangle, Clock, ChevronDown, Flag, User, Users } from 'lucide-react';
import { tasksApi, messagesApi, agentsApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

const PRIORITIES = [
  { value: 'urgente', label: 'Urgente', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-400' },
  { value: 'haute',   label: 'Haute',   color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  { value: 'normale', label: 'Normale', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   dot: 'bg-blue-400' },
  { value: 'basse',   label: 'Basse',   color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  dot: 'bg-slate-500' },
];
function prioInfo(v) { return PRIORITIES.find(p => p.value === v) || PRIORITIES[2]; }

function dueBadge(due_date, status) {
  if (status === 'fait' || !due_date) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (due_date < today) return { label: 'En retard', color: 'text-red-400 bg-red-500/10', icon: AlertTriangle };
  if (due_date === today) return { label: 'Aujourd\'hui', color: 'text-amber-400 bg-amber-500/10', icon: Clock };
  const days = Math.ceil((new Date(due_date) - new Date(today)) / 86400000);
  if (days <= 3) return { label: `Dans ${days}j`, color: 'text-amber-400 bg-amber-500/10', icon: Clock };
  return null;
}

const emptyForm = () => ({
  title: '', description: '', priority: 'normale',
  due_date: new Date().toISOString().slice(0, 10),
  assigned_user_id: '', assigned_agent_id: '',
});

export default function Taches() {
  const toast      = useToast();
  const { user: me } = useAuth();
  const [tasks, setTasks]     = useState([]);
  const [stats, setStats]     = useState(null);
  const [users, setUsers]     = useState([]);
  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState('open'); // open | today | overdue | done | all
  const [form, setForm]       = useState(null);
  const [editing, setEditing] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const quickRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filter === 'today')   params.due = 'today';
      if (filter === 'overdue') params.due = 'overdue';
      if (filter === 'done')    params.status = 'fait';
      if (filter === 'open')    params.status = 'a_faire';

      const [data, s, us, ag] = await Promise.all([
        tasksApi.list(params),
        tasksApi.stats(),
        messagesApi.users(),
        agentsApi.list(true),
      ]);
      setTasks(data); setStats(s); setUsers(us); setAgents(ag);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter]);

  async function quickAdd(e) {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    try {
      await tasksApi.create({ title: quickTitle.trim(), due_date: new Date().toISOString().slice(0, 10) });
      setQuickTitle('');
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function save() {
    try {
      if (editing) await tasksApi.update(editing.id, form);
      else await tasksApi.create(form);
      toast(editing ? 'Tâche modifiée' : 'Tâche créée', 'success');
      setForm(null); setEditing(null); load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function doDone(id) {
    try { await tasksApi.done(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function doReopen(id) {
    try { await tasksApi.reopen(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function doDelete(id) {
    if (!confirm('Supprimer cette tâche ?')) return;
    try { await tasksApi.delete(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function openEdit(task) {
    setEditing(task);
    setForm({
      title: task.title, description: task.description || '',
      priority: task.priority, due_date: task.due_date || '',
      assigned_user_id: task.assigned_user_id || '',
      assigned_agent_id: task.assigned_agent_id || '',
    });
  }

  function assigneeLabel(t) {
    if (t.user_first)  return `${t.user_first} ${t.user_last}`;
    if (t.agent_first) return `${t.agent_first} ${t.agent_last}`;
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);

  // Grouper par date d'échéance
  const grouped = tasks.reduce((acc, t) => {
    let key;
    if (t.status === 'fait') key = 'Terminées';
    else if (!t.due_date)    key = 'Sans date limite';
    else if (t.due_date < today) key = 'En retard';
    else if (t.due_date === today) key = "Aujourd'hui";
    else {
      const d = new Date(t.due_date);
      key = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  // Ordre des groupes
  const groupOrder = ["En retard", "Aujourd'hui"];
  const keys = [
    ...groupOrder.filter(k => grouped[k]),
    ...Object.keys(grouped).filter(k => !groupOrder.includes(k) && k !== 'Terminées' && k !== 'Sans date limite'),
    ...(grouped['Sans date limite'] ? ['Sans date limite'] : []),
    ...(grouped['Terminées'] ? ['Terminées'] : []),
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tâches</h1>
          <p className="text-slate-400 text-sm mt-1">Liste des choses à faire — assignez, priorisez, validez</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm()); }}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { key: 'open',    label: 'À faire',     value: stats.total_open, color: 'text-white',       active: filter === 'open' },
            { key: 'today',   label: "Auj.",        value: stats.due_today,  color: 'text-amber-400',   active: filter === 'today' },
            { key: 'overdue', label: 'En retard',   value: stats.overdue,    color: 'text-red-400',     active: filter === 'overdue' },
            { key: 'urgent',  label: 'Urgentes',    value: stats.urgent,     color: 'text-orange-400',  active: filter === 'urgent' },
            { key: 'done',    label: 'Terminées',   value: stats.done,       color: 'text-emerald-400', active: filter === 'done' },
          ].map(s => (
            <button key={s.key} onClick={() => setFilter(s.key)}
              className={`card p-3 text-left transition-colors ${s.active ? 'border-blue-600/50 bg-blue-600/5' : 'hover:border-dark-500'}`}>
              <div className="text-xs text-slate-500 mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</div>
            </button>
          ))}
        </div>
      )}

      {/* Ajout rapide */}
      <form onSubmit={quickAdd} className="flex gap-2">
        <input ref={quickRef} className="input flex-1" placeholder="Ajouter rapidement une tâche pour aujourd'hui…"
          value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />
        <button type="submit" disabled={!quickTitle.trim()} className="btn-primary px-4 disabled:opacity-40">
          Ajouter
        </button>
      </form>

      {/* Liste groupée */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="card h-14 animate-pulse bg-dark-800" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">
            {filter === 'done' ? 'Aucune tâche terminée' : 'Aucune tâche — tout est bon !'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {keys.map(group => {
            const groupTasks = grouped[group];
            const isOverdue = group === 'En retard';
            const isToday   = group === "Aujourd'hui";
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`text-xs font-semibold uppercase tracking-wide ${isOverdue ? 'text-red-400' : isToday ? 'text-amber-400' : 'text-slate-500'}`}>
                    {group}
                  </h3>
                  <span className="text-xs text-slate-600">{groupTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {groupTasks.map(task => {
                    const prio   = prioInfo(task.priority);
                    const badge  = dueBadge(task.due_date, task.status);
                    const BadgeIcon = badge?.icon;
                    const isDone = task.status === 'fait';
                    const assignee = assigneeLabel(task);
                    return (
                      <div key={task.id}
                        className={`card flex items-start gap-3 p-3.5 transition-colors group ${isDone ? 'opacity-50' : ''} ${!isDone && (isOverdue || isToday) ? prio.border : ''}`}>
                        {/* Checkbox */}
                        <button onClick={() => isDone ? doReopen(task.id) : doDone(task.id)}
                          className={`mt-0.5 shrink-0 transition-colors ${isDone ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}>
                          {isDone ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
                              {task.title}
                            </span>
                            {/* Priorité dot */}
                            <span className={`w-2 h-2 rounded-full shrink-0 ${prio.dot}`} title={prio.label} />
                            {badge && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${badge.color}`}>
                                {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                                {badge.label}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 flex-wrap">
                            {assignee && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" /> {assignee}
                              </span>
                            )}
                            {task.creator_first && (
                              <span>par {task.creator_first} {task.creator_last}</span>
                            )}
                            {isDone && task.done_first && (
                              <span className="text-emerald-600">✓ {task.done_first} {task.done_last}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(task)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => doDelete(task.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal formulaire */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 sticky top-0 bg-dark-800">
              <h2 className="text-white font-semibold">{editing ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
              <button onClick={() => { setForm(null); setEditing(null); }} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Titre *</label>
                <input className="input" value={form.title} placeholder="Que faut-il faire ?"
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description}
                  placeholder="Détails, instructions…"
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Priorité</label>
                  <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date limite</label>
                  <input className="input" type="date" value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Assigner à un collaborateur</label>
                <select className="input" value={form.assigned_user_id}
                  onChange={e => setForm(f => ({ ...f, assigned_user_id: e.target.value, assigned_agent_id: '' }))}>
                  <option value="">— Non assigné —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ou assigner à un agent</label>
                <select className="input" value={form.assigned_agent_id}
                  onChange={e => setForm(f => ({ ...f, assigned_agent_id: e.target.value, assigned_user_id: '' }))}>
                  <option value="">— Non assigné —</option>
                  {agents.map(a => <option key={a.agent_id || a.id} value={a.agent_id || a.id}>{a.last_name} {a.first_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6 justify-end">
              <button onClick={() => { setForm(null); setEditing(null); }} className="btn-secondary">Annuler</button>
              <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Créer la tâche'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
