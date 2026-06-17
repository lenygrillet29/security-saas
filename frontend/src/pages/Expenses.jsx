import { useEffect, useState } from 'react';
import { Plus, CheckCircle, XCircle, Trash2, Edit2, Receipt, Car, Coffee, Home, Package } from 'lucide-react';
import { expensesApi, agentsApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';

const TYPES = [
  { value: 'transport',    label: 'Transport',    icon: Car,     color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  { value: 'repas',        label: 'Repas',        icon: Coffee,  color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  { value: 'hebergement',  label: 'Hébergement',  icon: Home,    color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { value: 'materiel',     label: 'Matériel',     icon: Package, color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
  { value: 'autre',        label: 'Autre',        icon: Receipt, color: 'text-slate-400',  bg: 'bg-slate-500/10' },
];

const STATUS = {
  pending:  { label: 'En attente', color: 'text-amber-400 bg-amber-400/10' },
  approved: { label: 'Approuvé',   color: 'text-emerald-400 bg-emerald-400/10' },
  rejected: { label: 'Refusé',     color: 'text-red-400 bg-red-400/10' },
};

function typeInfo(v) { return TYPES.find(t => t.value === v) || TYPES[4]; }

function ExpenseForm({ expense, agents, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    agent_id:    expense?.agent_id    || '',
    date:        expense?.date        || new Date().toISOString().slice(0, 10),
    type:        expense?.type        || 'transport',
    description: expense?.description || '',
    amount:      expense?.amount      || '',
    notes:       expense?.notes       || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (expense?.id) { await expensesApi.update(expense.id, form); toast('Note modifiée'); }
      else             { await expensesApi.create(form);              toast('Note créée'); }
      onSave();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Agent *</label>
          <select className="input" value={form.agent_id} onChange={e => set('agent_id', e.target.value)} required>
            <option value="">Sélectionner...</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="label">Type de frais</label>
        <div className="grid grid-cols-5 gap-2">
          {TYPES.map(t => (
            <button
              key={t.value} type="button"
              onClick={() => set('type', t.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-colors ${
                form.type === t.value
                  ? `${t.bg} border-current ${t.color}`
                  : 'border-dark-600 text-slate-500 hover:text-slate-300 hover:border-dark-500'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex : Trajet domicile-site, ticket restaurant..." />
      </div>

      <div>
        <label className="label">Montant (€) *</label>
        <input type="number" step="0.01" min="0" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" required />
      </div>

      <div>
        <label className="label">Notes internes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">{expense?.id ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>
  );
}

function RejectModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Motif du refus (optionnel)</label>
        <textarea className="input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex : Justificatif manquant, montant incorrect..." />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors" onClick={() => onConfirm(reason)}>
          Refuser
        </button>
      </div>
    </div>
  );
}

function ExpensesInner() {
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [agents, setAgents]     = useState([]);
  const [stats, setStats]       = useState(null);
  const [modal, setModal]       = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [filter, setFilter]     = useState('all');
  const [agentFilter, setAgentFilter] = useState('');

  async function load() {
    const [e, a, s] = await Promise.all([expensesApi.list(), agentsApi.list(), expensesApi.stats()]);
    setExpenses(e); setAgents(a); setStats(s);
  }
  useEffect(() => { load(); }, []);

  async function handleApprove(id) {
    try { await expensesApi.approve(id); toast('Note approuvée'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function handleReject(id, reason) {
    try { await expensesApi.reject(id, reason); toast('Note refusée'); setRejectId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function handleDelete() {
    try { await expensesApi.delete(deleteId); toast('Note supprimée'); setDeleteId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  const filtered = expenses.filter(e => {
    if (filter !== 'all' && e.status !== filter) return false;
    if (agentFilter && String(e.agent_id) !== agentFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Notes de frais</h1>
          <p className="text-slate-400 text-sm mt-1">Transport, repas, hébergement — suivi et validation</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ expense: null })}>
          <Plus className="w-4 h-4" /> Nouvelle note
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">En attente</div>
            <div className="text-xl font-bold text-amber-400">{stats.pending_count || 0}</div>
            <div className="text-xs text-slate-500">{Number(stats.pending_amount || 0).toFixed(2)} € à traiter</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">Approuvées</div>
            <div className="text-xl font-bold text-emerald-400">{stats.approved_count || 0}</div>
            <div className="text-xs text-slate-500">{Number(stats.approved_amount || 0).toFixed(2)} € validés</div>
          </div>
          {TYPES.slice(0, 2).map(t => {
            const total = expenses.filter(e => e.type === t.value && e.status === 'approved').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            return (
              <div key={t.value} className={`card p-4 ${t.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className={`w-3.5 h-3.5 ${t.color}`} />
                  <span className="text-xs text-slate-400">{t.label}</span>
                </div>
                <div className={`text-xl font-bold ${t.color}`}>{total.toFixed(2)} €</div>
                <div className="text-xs text-slate-500">approuvés</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap items-center">
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-dark-700 text-slate-400 hover:text-white'}`}
          >
            {f === 'all' ? 'Toutes' : STATUS[f]?.label}
          </button>
        ))}
        <select className="input text-xs py-1.5 ml-auto w-auto" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
          <option value="">Tous les agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
        </select>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucune note de frais</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 text-xs text-slate-400">
                <th className="text-left py-3 px-4 font-medium">Agent</th>
                <th className="text-left py-3 px-3 font-medium">Date</th>
                <th className="text-left py-3 px-3 font-medium">Type</th>
                <th className="text-left py-3 px-3 font-medium">Description</th>
                <th className="text-right py-3 px-3 font-medium">Montant</th>
                <th className="text-center py-3 px-3 font-medium">Statut</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const ti = typeInfo(e.type);
                const st = STATUS[e.status] || STATUS.pending;
                return (
                  <tr key={e.id} className={`border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-dark-800/30'}`}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: e.agent_color || '#3B82F6' }}>
                          {e.agent_name?.[0]}
                        </div>
                        <span className="text-sm text-white font-medium">{e.agent_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-slate-400">
                      {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${ti.bg} ${ti.color}`}>
                        <ti.icon className="w-3 h-3" /> {ti.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-slate-300 max-w-[200px] truncate">
                      {e.description || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-white">
                      {Number(e.amount).toFixed(2)} €
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      {e.status === 'rejected' && e.reject_reason && (
                        <div className="text-xs text-slate-500 mt-0.5 max-w-[100px] truncate" title={e.reject_reason}>{e.reject_reason}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1">
                        {e.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(e.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Approuver">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => setRejectId(e.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Refuser">
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => setModal({ expense: e })} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 transition-colors" title="Modifier">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => setDeleteId(e.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-dark-500 bg-dark-800/60">
                <td colSpan={4} className="py-2.5 px-4 text-sm text-slate-400 font-medium">Total affiché</td>
                <td className="py-2.5 px-3 text-right font-bold text-white">
                  {filtered.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toFixed(2)} €
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.expense ? 'Modifier la note' : 'Nouvelle note de frais'} onClose={() => setModal(null)}>
          <ExpenseForm expense={modal.expense} agents={agents} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}

      {rejectId && (
        <Modal title="Refuser la note de frais" onClose={() => setRejectId(null)}>
          <RejectModal onConfirm={(reason) => handleReject(rejectId, reason)} onClose={() => setRejectId(null)} />
        </Modal>
      )}

      {deleteId && (
        <Confirm message="Supprimer cette note de frais ?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}

export default function Expenses() {
  return <ToastProvider><ExpensesInner /></ToastProvider>;
}
