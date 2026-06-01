import { useEffect, useState } from 'react';
import { FileText, Plus, Send, Trash2, CheckCircle, Clock, Edit2, ExternalLink } from 'lucide-react';
import { contractsApi, agentsApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';

const STATUS_LABELS = {
  draft:  { label: 'Brouillon',        color: 'text-slate-400 bg-slate-400/10' },
  sent:   { label: 'Envoyé',           color: 'text-yellow-400 bg-yellow-400/10' },
  signed: { label: 'Signé',            color: 'text-emerald-400 bg-emerald-400/10' },
};

const TYPE_LABELS = {
  CDI:     'CDI',
  CDD:     'CDD',
  avenant: 'Avenant',
};

function ContractForm({ contract, agents, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    agent_id:             contract?.agent_id || '',
    type:                 contract?.type || 'CDI',
    title:                contract?.title || '',
    start_date:           contract?.start_date || '',
    end_date:             contract?.end_date || '',
    gross_salary:         contract?.gross_salary || '',
    hours_per_week:       contract?.hours_per_week || 35,
    position:             contract?.position || '',
    trial_period_months:  contract?.trial_period_months || 0,
    notes:                contract?.notes || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (contract?.id) {
        await contractsApi.update(contract.id, form);
        toast('Contrat modifié');
      } else {
        await contractsApi.create(form);
        toast('Contrat créé');
      }
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
          <label className="label">Type *</label>
          <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="avenant">Avenant</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Intitulé du poste *</label>
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex : Agent de sécurité" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date de début *</label>
          <input type="date" className="input" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Date de fin {form.type === 'CDD' ? '*' : '(CDI = vide)'}</label>
          <input type="date" className="input" value={form.end_date} onChange={e => set('end_date', e.target.value)}
            required={form.type === 'CDD'} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Salaire brut (€/mois)</label>
          <input type="number" step="0.01" className="input" value={form.gross_salary} onChange={e => set('gross_salary', e.target.value)} placeholder="2000" />
        </div>
        <div>
          <label className="label">Heures/semaine</label>
          <input type="number" step="0.5" className="input" value={form.hours_per_week} onChange={e => set('hours_per_week', e.target.value)} />
        </div>
        <div>
          <label className="label">Période d'essai (mois)</label>
          <input type="number" min="0" max="6" className="input" value={form.trial_period_months} onChange={e => set('trial_period_months', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Notes internes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">{contract?.id ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>
  );
}

function ContractsInner() {
  const toast = useToast();
  const [contracts, setContracts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [modal, setModal] = useState(null); // { type: 'create'|'edit', data }
  const [deleteId, setDeleteId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    const [c, a] = await Promise.all([contractsApi.list(), agentsApi.list()]);
    setContracts(c);
    setAgents(a);
  };

  useEffect(() => { load(); }, []);

  async function handleSend(contract) {
    if (!window.confirm(`Envoyer le contrat à ${contract.agent_name} pour signature électronique ?`)) return;
    setSendingId(contract.id);
    try {
      const { sign_url } = await contractsApi.send(contract.id);
      toast('Email de signature envoyé !');
      await load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSendingId(null); }
  }

  async function handleDelete(id) {
    try {
      await contractsApi.delete(id);
      toast('Contrat supprimé');
      await load();
    } catch (e) { toast(e.message, 'error'); }
  }

  const filtered = filter === 'all' ? contracts : contracts.filter(c => c.status === filter || c.type === filter);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Contrats de travail</h1>
          <p className="text-sm text-slate-400 mt-0.5">CDI, CDD et avenants — signature électronique intégrée</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: 'create' })}>
          <Plus className="w-4 h-4" /> Nouveau contrat
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'CDI', 'CDD', 'avenant', 'draft', 'sent', 'signed'].map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-dark-700 text-slate-400 hover:text-white'}`}
          >
            {f === 'all' ? 'Tous' : f === 'draft' ? 'Brouillons' : f === 'sent' ? 'Envoyés' : f === 'signed' ? 'Signés' : f}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun contrat trouvé</p>
          <button className="mt-4 btn-primary" onClick={() => setModal({ type: 'create' })}>Créer le premier contrat</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const st = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
            return (
              <div key={c.id} className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{c.agent_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-dark-600 text-slate-400">{TYPE_LABELS[c.type] || c.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.title} · Début {new Date(c.start_date).toLocaleDateString('fr-FR')}
                    {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString('fr-FR')}`}
                    {c.gross_salary > 0 && ` · ${c.gross_salary} €/mois brut`}
                  </div>
                  {c.status === 'signed' && c.signed_at && (
                    <div className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Signé le {new Date(c.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.status !== 'signed' && (
                    <>
                      <button
                        onClick={() => setModal({ type: 'edit', data: c })}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSend(c)}
                        disabled={sendingId === c.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-50"
                        title="Envoyer pour signature"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {c.status !== 'signed' && (
                    <button
                      onClick={() => setDeleteId(c.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal création/édition */}
      {modal && (
        <Modal title={modal.type === 'create' ? 'Nouveau contrat' : 'Modifier le contrat'} onClose={() => setModal(null)}>
          <ContractForm
            contract={modal.data}
            agents={agents}
            onSave={() => { setModal(null); load(); }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {deleteId && (
        <Confirm
          message="Supprimer ce contrat définitivement ?"
          onConfirm={() => { handleDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

export default function Contracts() {
  return <ToastProvider><ContractsInner /></ToastProvider>;
}
