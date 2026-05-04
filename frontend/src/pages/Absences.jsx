import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Calendar, Filter } from 'lucide-react';
import { absencesApi, agentsApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPES = [
  { value: 'conge', label: 'Congé payé', color: 'bg-emerald-600/20 text-emerald-400' },
  { value: 'maladie', label: 'Arrêt maladie', color: 'bg-red-600/20 text-red-400' },
  { value: 'formation', label: 'Formation', color: 'bg-blue-600/20 text-blue-400' },
  { value: 'autre', label: 'Autre', color: 'bg-slate-600/20 text-slate-400' },
];

const STATUSES = [
  { value: 'approved', label: 'Approuvé', color: 'bg-emerald-600/20 text-emerald-400' },
  { value: 'pending', label: 'En attente', color: 'bg-amber-600/20 text-amber-400' },
  { value: 'rejected', label: 'Refusé', color: 'bg-red-600/20 text-red-400' },
];

function typeInfo(type) { return TYPES.find(t => t.value === type) || TYPES[3]; }
function statusInfo(status) { return STATUSES.find(s => s.value === status) || STATUSES[0]; }

function AbsenceForm({ absence, agents, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    agent_id: absence?.agent_id || '',
    start_date: absence?.start_date || format(new Date(), 'yyyy-MM-dd'),
    end_date: absence?.end_date || format(new Date(), 'yyyy-MM-dd'),
    type: absence?.type || 'conge',
    status: absence?.status || 'approved',
    notes: absence?.notes || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.end_date < form.start_date) return toast('La date de fin doit être après la date de début', 'error');
    try {
      if (absence?.id) { await absencesApi.update(absence.id, form); toast('Absence modifiée'); }
      else { await absencesApi.create(form); toast('Absence créée'); }
      onSave();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Agent *</label>
        <select className="input" value={form.agent_id} onChange={e => set('agent_id', e.target.value)} required>
          <option value="">Sélectionner...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date début *</label>
          <input type="date" className="input" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Date fin *</label>
          <input type="date" className="input" value={form.end_date} onChange={e => set('end_date', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">{absence?.id ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>
  );
}

function daysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

function AbsencesInner() {
  const toast = useToast();
  const [absences, setAbsences] = useState([]);
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  async function load() {
    const [ab, ag] = await Promise.all([absencesApi.list(), agentsApi.list()]);
    setAbsences(ab);
    setAgents(ag);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    try {
      await absencesApi.delete(deleteId);
      toast('Absence supprimée');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const filtered = absences.filter(ab => {
    const name = `${ab.first_name} ${ab.last_name}`.toLowerCase();
    return (
      name.includes(search.toLowerCase()) &&
      (!filterType || ab.type === filterType) &&
      (!filterAgent || ab.agent_id === parseInt(filterAgent))
    );
  });

  const totalsByType = TYPES.map(t => ({
    ...t,
    count: absences.filter(a => a.type === t.value && a.status !== 'rejected').length,
    days: absences.filter(a => a.type === t.value && a.status !== 'rejected')
      .reduce((s, a) => s + daysBetween(a.start_date, a.end_date), 0),
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Absences &amp; Congés</h1>
        <button className="btn-primary" onClick={() => setModal({ absence: null })}>
          <Plus className="w-4 h-4" /> Nouvelle absence
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {totalsByType.map(t => (
          <div key={t.value} className="card p-4">
            <div className="text-2xl font-bold text-white">{t.days}j</div>
            <div className="text-sm text-slate-400">{t.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t.count} demande(s)</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher agent..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous types</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input w-48" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
            <option value="">Tous les agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
          </select>
          <span className="text-xs text-slate-500">{filtered.length} résultat(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 text-xs text-slate-400">
                <th className="text-left py-3 px-3 font-medium">Agent</th>
                <th className="text-left py-3 px-3 font-medium">Type</th>
                <th className="text-left py-3 px-3 font-medium">Période</th>
                <th className="text-center py-3 px-3 font-medium">Durée</th>
                <th className="text-center py-3 px-3 font-medium">Statut</th>
                <th className="text-left py-3 px-3 font-medium">Notes</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ab => {
                const days = daysBetween(ab.start_date, ab.end_date);
                const ti = typeInfo(ab.type);
                const si = statusInfo(ab.status);
                return (
                  <tr key={ab.id} className="table-row">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: ab.agent_color || '#3B82F6' }}>
                          {ab.first_name?.[0]}{ab.last_name?.[0]}
                        </div>
                        <span className="text-sm font-medium text-white">{ab.first_name} {ab.last_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`badge ${ti.color}`}>{ti.label}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {format(new Date(ab.start_date), 'dd/MM/yyyy')}
                        {ab.start_date !== ab.end_date && <> → {format(new Date(ab.end_date), 'dd/MM/yyyy')}</>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-sm font-medium text-white">{days}j</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`badge ${si.color}`}>{si.label}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-400 max-w-[150px] truncate">{ab.notes || '—'}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal({ absence: ab })}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(ab.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-500 py-10">Aucune absence</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal.absence ? 'Modifier l\'absence' : 'Nouvelle absence'} onClose={() => setModal(null)}>
          <AbsenceForm absence={modal.absence} agents={agents} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleteId && (
        <Confirm title="Supprimer l'absence" message="Supprimer cette absence ?" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
      )}
    </div>
  );
}

export default function Absences() {
  return <ToastProvider><AbsencesInner /></ToastProvider>;
}
