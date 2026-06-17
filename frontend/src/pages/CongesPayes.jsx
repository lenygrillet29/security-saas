import { useEffect, useState } from 'react';
import { Sun, Plus, Trash2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cpApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';

const TYPE_LABELS = {
  acquisition:   { label: 'Acquisition',    color: 'text-emerald-400' },
  utilisation:   { label: 'Congé pris',     color: 'text-red-400' },
  ajustement:    { label: 'Ajustement',     color: 'text-blue-400' },
  solde_initial: { label: 'Solde initial',  color: 'text-violet-400' },
};

function TransactionForm({ agents, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    agent_id: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'acquisition',
    days: '',
    notes: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const days = form.type === 'utilisation' ? -Math.abs(parseFloat(form.days)) : parseFloat(form.days);
      await cpApi.addTransaction({ ...form, days });
      toast('Transaction ajoutée');
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
        <label className="label">Type</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'utilisation').map(([k, v]) => (
            <button key={k} type="button"
              onClick={() => set('type', k)}
              className={`p-2 rounded-xl border text-xs font-medium transition-colors text-left ${form.type === k ? `border-blue-500 bg-blue-500/10 ${v.color}` : 'border-dark-600 text-slate-500 hover:border-dark-500'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Nombre de jours *</label>
        <input type="number" step="0.5" min="0.5" className="input" value={form.days} onChange={e => set('days', e.target.value)} placeholder="Ex : 2.5" required />
        {form.type === 'utilisation' && <p className="text-xs text-slate-500 mt-1">Ces jours seront déduits du solde.</p>}
      </div>

      <div>
        <label className="label">Notes</label>
        <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Ex : Acquisition juin 2026" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">Ajouter</button>
      </div>
    </form>
  );
}

function AcquisitionModal({ onSave, onClose }) {
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [days, setDays]   = useState('2.5');
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      const res = await cpApi.acquisitionMensuelle(month, parseFloat(days));
      toast(`${res.agents_count} agents crédités de ${days}j pour ${month}`);
      onSave();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Crédite automatiquement tous les agents actifs du nombre de jours saisi.</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Mois *</label>
          <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <div>
          <label className="label">Jours par agent *</label>
          <input type="number" step="0.5" className="input" value={days} onChange={e => setDays(e.target.value)} />
        </div>
      </div>
      <div className="bg-dark-700 rounded-xl p-3 text-xs text-slate-400">
        Droit légal : <strong className="text-white">2.5 jours</strong> par mois de travail effectif (30 jours/an).
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary flex items-center gap-2" onClick={handle} disabled={loading}>
          <Zap className="w-4 h-4" /> {loading ? 'En cours…' : 'Créditer tous les agents'}
        </button>
      </div>
    </div>
  );
}

function AgentRow({ agent, onRefresh }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  async function loadDetail() {
    if (detail) { setOpen(false); setDetail(null); return; }
    try {
      const d = await cpApi.agent(agent.agent_id);
      setDetail(d);
      setOpen(true);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDelete() {
    try {
      await cpApi.deleteTransaction(deleteId);
      toast('Transaction supprimée');
      setDeleteId(null);
      const d = await cpApi.agent(agent.agent_id);
      setDetail(d);
      onRefresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  const balanceColor = agent.balance <= 0 ? 'text-red-400' : agent.balance < 5 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <>
      <tr className="border-b border-dark-700/50 hover:bg-dark-700/20 transition-colors cursor-pointer" onClick={loadDetail}>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: agent.color || '#3B82F6' }}>
              {agent.first_name?.[0]}{agent.last_name?.[0]}
            </div>
            <span className="text-white font-medium text-sm">{agent.last_name} {agent.first_name}</span>
          </div>
        </td>
        <td className="py-3 px-4 text-right">
          <span className={`text-lg font-bold ${balanceColor}`}>{agent.balance.toFixed(1)} j</span>
        </td>
        <td className="py-3 px-4 text-right text-slate-500">
          {open ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </td>
      </tr>
      {open && detail && (
        <tr>
          <td colSpan={3} className="px-4 pb-3">
            <div className="bg-dark-800 rounded-xl overflow-hidden border border-dark-600">
              {detail.transactions.length === 0 ? (
                <p className="text-slate-500 text-sm p-4">Aucune transaction</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-dark-600 text-slate-500">
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Notes</th>
                      <th className="text-right px-3 py-2">Jours</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.transactions.map(t => {
                      const ti = TYPE_LABELS[t.type] || { label: t.type, color: 'text-slate-400' };
                      return (
                        <tr key={t.id} className="border-b border-dark-700/50">
                          <td className="px-3 py-2 text-slate-400">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                          <td className={`px-3 py-2 font-medium ${ti.color}`}>{ti.label}</td>
                          <td className="px-3 py-2 text-slate-500">{t.notes || '—'}</td>
                          <td className={`px-3 py-2 text-right font-bold ${parseFloat(t.days) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {parseFloat(t.days) >= 0 ? '+' : ''}{parseFloat(t.days).toFixed(1)}
                          </td>
                          <td className="px-3 py-2">
                            {!t.absence_id && (
                              <button onClick={(e) => { e.stopPropagation(); setDeleteId(t.id); }}
                                className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
      {deleteId && (
        <tr><td colSpan={3}>
          <Confirm message="Supprimer cette transaction ?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
        </td></tr>
      )}
    </>
  );
}

function CongesPayesInner() {
  const toast = useToast();
  const [balances, setBalances] = useState([]);
  const [modal, setModal]       = useState(null); // 'transaction' | 'acquisition'

  async function load() {
    try { setBalances(await cpApi.balances()); }
    catch (e) { toast(e.message, 'error'); }
  }
  useEffect(() => { load(); }, []);

  const totalBalance = balances.reduce((s, a) => s + a.balance, 0);
  const lowBalance   = balances.filter(a => a.balance < 5).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Congés payés</h1>
          <p className="text-slate-400 text-sm mt-1">Soldes CP par agent — acquisition et utilisation</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => setModal('acquisition')}>
            <Zap className="w-4 h-4" /> Acquisition mensuelle
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setModal('transaction')}>
            <Plus className="w-4 h-4" /> Ajouter transaction
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-slate-500 mb-1">Total jours CP</div>
          <div className="text-2xl font-bold text-white">{totalBalance.toFixed(1)} j</div>
          <div className="text-xs text-slate-500">{balances.length} agents</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500 mb-1">Soldes faibles (&lt;5j)</div>
          <div className={`text-2xl font-bold ${lowBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{lowBalance}</div>
          <div className="text-xs text-slate-500">agents à surveiller</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500 mb-1">Acquisition légale</div>
          <div className="text-2xl font-bold text-blue-400">2.5 j</div>
          <div className="text-xs text-slate-500">par mois travaillé</div>
        </div>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        {balances.length === 0 ? (
          <div className="py-16 text-center">
            <Sun className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Aucun agent actif</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 text-xs text-slate-400">
                <th className="text-left py-3 px-4 font-medium">Agent</th>
                <th className="text-right py-3 px-4 font-medium">Solde CP</th>
                <th className="py-3 px-4 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {balances.map(a => <AgentRow key={a.agent_id} agent={a} onRefresh={load} />)}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'transaction' && (
        <Modal title="Ajouter une transaction CP" onClose={() => setModal(null)}>
          <TransactionForm
            agents={balances.map(a => ({ id: a.agent_id, first_name: a.first_name, last_name: a.last_name }))}
            onSave={() => { setModal(null); load(); }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === 'acquisition' && (
        <Modal title="Acquisition mensuelle" onClose={() => setModal(null)}>
          <AcquisitionModal onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

export default function CongesPayes() {
  return <ToastProvider><CongesPayesInner /></ToastProvider>;
}
