import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Calendar, UserCheck, X, CheckCircle, XCircle, Smartphone } from 'lucide-react';
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

// ─── Popup remplaçants disponibles ───────────────────────────────────────────
function ReplacementPopup({ absence, onClose }) {
  const [available, setAvailable] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentsApi.available({
      start_date: absence.start_date,
      end_date: absence.end_date,
      exclude_agent_id: absence.agent_id,
    }).then(data => { setAvailable(data); setLoading(false); })
      .catch(() => { setAvailable([]); setLoading(false); });
  }, []);

  const days = Math.ceil((new Date(absence.end_date) - new Date(absence.start_date)) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              Remplaçants disponibles
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Pour <span className="text-white font-medium">{absence.first_name} {absence.last_name}</span> — {days}j
              ({new Date(absence.start_date).toLocaleDateString('fr-FR')} → {new Date(absence.end_date).toLocaleDateString('fr-FR')})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {loading ? (
          <div className="text-center text-slate-400 py-6 text-sm">Recherche en cours...</div>
        ) : available.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-slate-400 text-sm">Aucun agent disponible sur cette période.</div>
            <div className="text-xs text-slate-500 mt-1">Tous les agents ont des prestations ou des absences prévues.</div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 mb-3">{available.length} agent(s) sans prestation ni absence sur cette période :</p>
            {available.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: a.color || '#3B82F6' }}>
                  {a.first_name[0]}{a.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{a.first_name} {a.last_name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{a.contract_type}</span>
                    {a.hourly_rate > 0 && <span>{a.hourly_rate}€/h</span>}
                    {a.phone && <span>{a.phone}</span>}
                  </div>
                </div>
                {a.email && (
                  <a href={`mailto:${a.email}`} className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors" title={a.email}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                )}
                {a.phone && (
                  <a href={`tel:${a.phone}`} className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
  const [replacementAbsence, setReplacementAbsence] = useState(null);

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

  const pending = absences.filter(a => a.status === 'pending');

  async function handleApprove(id) {
    try { await absencesApi.approve(id); toast('Demande approuvée ✅'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function handleReject(id) {
    try { await absencesApi.reject(id); toast('Demande refusée'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

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

      {/* Demandes en attente */}
      {pending.length > 0 && (
        <div className="bg-amber-600/10 border border-amber-600/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">
              {pending.length} demande{pending.length > 1 ? 's' : ''} en attente de validation
            </span>
          </div>
          <div className="space-y-2">
            {pending.map(ab => (
              <div key={ab.id} className="bg-dark-800 border border-dark-600 rounded-lg p-3 flex items-center gap-3 flex-wrap">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: ab.agent_color || '#3B82F6' }}>
                  {ab.first_name?.[0]}{ab.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{ab.first_name} {ab.last_name}</div>
                  <div className="text-xs text-slate-400">
                    {typeInfo(ab.type).label} · {format(new Date(ab.start_date), 'dd/MM/yyyy')}
                    {ab.start_date !== ab.end_date && ` → ${format(new Date(ab.end_date), 'dd/MM/yyyy')}`}
                    {' '}· {daysBetween(ab.start_date, ab.end_date)}j
                  </div>
                  {ab.notes && <div className="text-xs text-slate-500 italic mt-0.5">"{ab.notes}"</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleReject(ab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/15 border border-red-600/30 text-red-400 text-xs font-semibold hover:bg-red-600/25 transition-colors">
                    <XCircle className="w-3.5 h-3.5" /> Refuser
                  </button>
                  <button onClick={() => handleApprove(ab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 border border-emerald-600/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/25 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Approuver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                        <button onClick={() => setReplacementAbsence(ab)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-600/10 rounded-lg transition-colors"
                          title="Trouver un remplaçant">
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
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
      {replacementAbsence && (
        <ReplacementPopup absence={replacementAbsence} onClose={() => setReplacementAbsence(null)} />
      )}
    </div>
  );
}

export default function Absences() {
  return <ToastProvider><AbsencesInner /></ToastProvider>;
}
