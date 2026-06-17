import { useEffect, useState } from 'react';
import { FileText, Plus, Send, Trash2, CheckCircle, Edit2, Users, Building2, BookOpen, Copy } from 'lucide-react';
import { contractsApi, agentsApi, clientContractsApi, clientsApi, contractTemplatesApi } from '../api';
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

// ─── Formulaire contrat client ────────────────────────────────────────────────
const BILLING_OPTIONS = [
  { value: 'monthly',  label: 'Mensuel' },
  { value: 'yearly',   label: 'Annuel' },
  { value: 'one_time', label: 'Forfait unique' },
  { value: 'hourly',   label: 'À l\'heure' },
];

const TEMPLATE_VARS = [
  { key: '{{client_name}}',    label: 'Nom client' },
  { key: '{{start_date}}',     label: 'Date début' },
  { key: '{{end_date}}',       label: 'Date fin' },
  { key: '{{amount}}',         label: 'Montant HT' },
  { key: '{{billing_type}}',   label: 'Facturation' },
  { key: '{{company_name}}',   label: 'Votre société' },
];

function applyTemplate(body, { clientName = '', startDate = '', endDate = '', amount = '', billingType = '', companyName = '' } = {}) {
  const BILLING_FR = { monthly: 'mensuel', yearly: 'annuel', one_time: 'forfait unique', hourly: 'à l\'heure' };
  return body
    .replace(/{{client_name}}/g, clientName)
    .replace(/{{start_date}}/g, startDate)
    .replace(/{{end_date}}/g, endDate)
    .replace(/{{amount}}/g, amount ? `${amount} €` : '')
    .replace(/{{billing_type}}/g, BILLING_FR[billingType] || billingType)
    .replace(/{{company_name}}/g, companyName);
}

function ClientContractForm({ contract, clients, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    client_id:    contract?.client_id    || '',
    title:        contract?.title        || '',
    description:  contract?.description  || '',
    start_date:   contract?.start_date   || '',
    end_date:     contract?.end_date     || '',
    amount:       contract?.amount       || '',
    billing_type: contract?.billing_type || 'monthly',
    notes:        contract?.notes        || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [templates, setTemplates] = useState([]);
  const [tplOpen, setTplOpen]     = useState(false);

  useEffect(() => { contractTemplatesApi.list({ category: 'client' }).then(setTemplates).catch(() => {}); }, []);

  function useTemplate(tpl) {
    const client = clients.find(c => String(c.id) === String(form.client_id));
    const desc = applyTemplate(tpl.body, {
      clientName:   client?.name || '',
      startDate:    form.start_date,
      endDate:      form.end_date,
      amount:       form.amount,
      billingType:  form.billing_type,
      companyName:  '',
    });
    setForm(f => ({ ...f, description: desc }));
    setTplOpen(false);
    toast('Modèle appliqué', 'success');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (contract?.id) {
        await clientContractsApi.update(contract.id, form);
        toast('Contrat modifié');
      } else {
        await clientContractsApi.create(form);
        toast('Contrat créé');
      }
      onSave();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Client *</label>
          <select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)} required>
            <option value="">Sélectionner...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Facturation</label>
          <select className="input" value={form.billing_type} onChange={e => set('billing_type', e.target.value)}>
            {BILLING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Intitulé du contrat *</label>
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex : Contrat de gardiennage 2026" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date de début *</label>
          <input type="date" className="input" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Date de fin</label>
          <input type="date" className="input" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Montant HT (€)</label>
        <input type="number" step="0.01" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="Ex : 5000" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Description des prestations</label>
          {templates.length > 0 && (
            <div className="relative">
              <button type="button" onClick={() => setTplOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <BookOpen className="w-3.5 h-3.5" /> Utiliser un modèle
              </button>
              {tplOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-dark-700 border border-dark-500 rounded-xl shadow-xl z-30 overflow-hidden">
                  {templates.map(t => (
                    <button key={t.id} type="button" onClick={() => useTemplate(t)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-dark-600 transition-colors text-left">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <textarea className="input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Détail des services, conditions particulières..." />
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

// ─── Section contrats clients ──────────────────────────────────────────────────
function ClientContractsSection() {
  const toast = useToast();
  const [contracts, setContracts] = useState([]);
  const [clients, setClients]     = useState([]);
  const [modal, setModal]         = useState(null);
  const [deleteId, setDeleteId]   = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const load = async () => {
    const [cc, cl] = await Promise.all([clientContractsApi.list(), clientsApi.list()]);
    setContracts(cc);
    setClients(cl);
  };
  useEffect(() => { load(); }, []);

  async function handleSend(c) {
    if (!window.confirm(`Envoyer le contrat à ${c.client_name} pour signature électronique ?`)) return;
    setSendingId(c.id);
    try {
      await clientContractsApi.send(c.id);
      toast('Email de signature envoyé !');
      await load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSendingId(null); }
  }

  async function handleDelete(id) {
    try {
      await clientContractsApi.delete(id);
      toast('Contrat supprimé');
      await load();
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: 'create' })}>
          <Plus className="w-4 h-4" /> Nouveau contrat client
        </button>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun contrat client</p>
          <button className="mt-4 btn-primary" onClick={() => setModal({ type: 'create' })}>Créer le premier</button>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map(c => {
            const st = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
            return (
              <div key={c.id} className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{c.client_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.title}
                    {c.amount > 0 && ` · ${Number(c.amount).toLocaleString('fr-FR')} € HT`}
                    {' · Début '}{new Date(c.start_date).toLocaleDateString('fr-FR')}
                    {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString('fr-FR')}`}
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
                      <button onClick={() => setModal({ type: 'edit', data: c })} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition-colors" title="Modifier">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleSend(c)} disabled={sendingId === c.id} className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-50" title="Envoyer pour signature">
                        <Send className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {c.status !== 'signed' && (
                    <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.type === 'create' ? 'Nouveau contrat client' : 'Modifier le contrat'} onClose={() => setModal(null)}>
          <ClientContractForm
            contract={modal.data}
            clients={clients}
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

// ─── Inner principal avec onglets ─────────────────────────────────────────────
// ─── Section modèles de contrats ──────────────────────────────────────────────
function TemplatesSection() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(null);

  const load = () => contractTemplatesApi.list().then(setTemplates).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const emptyForm = () => ({ name: '', category: 'client', body: '', notes: '' });

  async function save() {
    try {
      if (editing) await contractTemplatesApi.update(editing.id, form);
      else await contractTemplatesApi.create(form);
      toast(editing ? 'Modèle modifié' : 'Modèle créé', 'success');
      setForm(null); setEditing(null); load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function del(id) {
    if (!confirm('Supprimer ce modèle ?')) return;
    try { await contractTemplatesApi.delete(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function openEdit(t) { setEditing(t); setForm({ name: t.name, category: t.category, body: t.body, notes: t.notes || '' }); }

  const vars = TEMPLATE_VARS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Créez des modèles réutilisables avec des variables dynamiques.</p>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setEditing(null); setForm(emptyForm()); }}>
          <Plus className="w-4 h-4" /> Nouveau modèle
        </button>
      </div>

      {/* Variables disponibles */}
      <div className="card p-4">
        <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Variables disponibles</p>
        <div className="flex flex-wrap gap-2">
          {vars.map(v => (
            <span key={v.key} className="flex items-center gap-1.5 text-xs bg-dark-700 border border-dark-500 rounded-lg px-2.5 py-1">
              <code className="text-blue-400">{v.key}</code>
              <span className="text-slate-500">{v.label}</span>
            </span>
          ))}
        </div>
      </div>

      {templates.length === 0 && !form ? (
        <div className="card py-16 text-center">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucun modèle — créez-en un pour l'utiliser lors de la rédaction de contrats clients.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{t.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-dark-700 text-slate-400">{t.category === 'client' ? 'Client' : 'Agent'}</span>
                  </div>
                  {t.body && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">{t.body.slice(0, 120)}{t.body.length > 120 ? '…' : ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => del(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire inline */}
      {form && (
        <div className="card p-5 border-blue-600/30">
          <h3 className="text-white font-semibold mb-4">{editing ? 'Modifier le modèle' : 'Nouveau modèle'}</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nom du modèle *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Contrat gardiennage standard" />
              </div>
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="client">Contrat client</option>
                  <option value="agent">Contrat agent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Corps du contrat</label>
              <textarea className="input font-mono text-xs" rows={10}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder={`Entre le prestataire et {{client_name}},\nPériode du {{start_date}} au {{end_date}}.\nMontant : {{amount}} ({{billing_type}}).\n\nPrestations :\n...`}
              />
              <p className="text-xs text-slate-600 mt-1">Utilisez les variables ci-dessus — elles seront remplacées automatiquement lors de l'application.</p>
            </div>
            <div>
              <label className="label">Notes internes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-4 justify-end">
            <button onClick={() => { setForm(null); setEditing(null); }} className="btn-secondary">Annuler</button>
            <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Créer le modèle'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractsInner() {
  const toast = useToast();
  const [tab, setTab] = useState('clients'); // 'agents' | 'clients'
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
          <h1 className="text-xl font-bold text-white">Contrats</h1>
          <p className="text-sm text-slate-400 mt-0.5">Contrats clients et agents — signature électronique intégrée</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 border-b border-dark-600 pb-0">
        <button
          onClick={() => setTab('clients')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'clients' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Building2 className="w-4 h-4" /> Clients
        </button>
        <button
          onClick={() => setTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'agents' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Users className="w-4 h-4" /> Agents
        </button>
        <button
          onClick={() => setTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'templates' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <BookOpen className="w-4 h-4" /> Modèles
        </button>
      </div>

      {tab === 'clients'   && <ClientContractsSection />}
      {tab === 'templates' && <TemplatesSection />}

      {tab === 'agents' && <>
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: 'create' })}>
          <Plus className="w-4 h-4" /> Nouveau contrat agent
        </button>
      </div>
      {/* Filtres agents */}
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
      </>}
    </div>
  );
}

export default function Contracts() {
  return <ToastProvider><ContractsInner /></ToastProvider>;
}
