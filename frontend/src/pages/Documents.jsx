import { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { agentDocumentsApi, agentsApi } from '../api';
import { useToast } from '../components/Toast';

const DOC_TYPES = [
  { value: 'cni',            label: "Carte d'identité",      color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { value: 'passeport',      label: 'Passeport',              color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  { value: 'titre_sejour',   label: 'Titre de séjour',        color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  { value: 'permis',         label: 'Permis de conduire',     color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { value: 'carte_pro',      label: 'Carte professionnelle',  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { value: 'rib',            label: 'RIB',                    color: 'text-slate-400',   bg: 'bg-slate-500/10' },
  { value: 'attestation',    label: 'Attestation',            color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  { value: 'diplome',        label: 'Diplôme / Certificat',   color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  { value: 'visite_medicale',label: 'Visite médicale',        color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { value: 'autre',          label: 'Autre',                  color: 'text-slate-400',   bg: 'bg-slate-500/10' },
];

function typeInfo(v) { return DOC_TYPES.find(t => t.value === v) || DOC_TYPES[DOC_TYPES.length - 1]; }

function expiryStatus(expiry) {
  if (!expiry) return null;
  const today = new Date();
  const exp   = new Date(expiry);
  const days  = Math.ceil((exp - today) / 86400000);
  if (days < 0)   return { label: `Expiré (${Math.abs(days)}j)`,  color: 'text-red-400 bg-red-500/10',     icon: AlertTriangle };
  if (days <= 30) return { label: `Expire dans ${days}j`,          color: 'text-red-400 bg-red-500/10',     icon: AlertTriangle };
  if (days <= 60) return { label: `Expire dans ${days}j`,          color: 'text-amber-400 bg-amber-500/10', icon: Clock };
  return { label: `Valide`,                                         color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle };
}

const emptyForm = () => ({
  agent_id: '', type: 'cni', label: '', reference: '',
  issued_date: '', expiry_date: '', issuer: '', file_url: '', notes: '',
});

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 sticky top-0 bg-dark-800">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function Documents() {
  const toast = useToast();
  const [items, setItems]   = useState([]);
  const [stats, setStats]   = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType]   = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm]     = useState(null);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filterType)  params.type     = filterType;
      if (filterAgent) params.agent_id = filterAgent;
      const [data, s, al, ag] = await Promise.all([
        agentDocumentsApi.list(params),
        agentDocumentsApi.stats(),
        agentDocumentsApi.alerts(),
        agentsApi.list(true),
      ]);
      setItems(data); setStats(s); setAlerts(al); setAgents(ag);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterType, filterAgent]);

  async function save() {
    try {
      if (editing) await agentDocumentsApi.update(editing.id, form);
      else await agentDocumentsApi.create(form);
      toast(editing ? 'Document modifié' : 'Document ajouté', 'success');
      setForm(null); setEditing(null); load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function doDelete(id) {
    if (!confirm('Supprimer ce document ?')) return;
    try { await agentDocumentsApi.delete(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function openEdit(item) { setEditing(item); setForm({ ...item, file_url: item.file_url || '' }); }
  function openNew()      { setEditing(null); setForm(emptyForm()); }

  // Filtrage statut côté client
  const filtered = items.filter(item => {
    if (!filterStatus) return true;
    const exp = item.expiry_date ? new Date(item.expiry_date) : null;
    const today = new Date();
    if (filterStatus === 'expired')  return exp && exp < today;
    if (filterStatus === 'expiring') { const d = exp ? Math.ceil((exp - today) / 86400000) : null; return d !== null && d >= 0 && d <= 60; }
    if (filterStatus === 'valid')    return !exp || exp >= today;
    return true;
  });

  // Grouper par agent
  const byAgent = filtered.reduce((acc, item) => {
    const key = item.agent_id;
    if (!acc[key]) acc[key] = { agent_id: item.agent_id, first_name: item.first_name, last_name: item.last_name, color: item.color, employee_number: item.employee_number, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});
  const agentGroups = Object.values(byAgent);

  const totalExpired  = alerts.filter(a => new Date(a.expiry_date) < new Date()).length;
  const totalExpiring = alerts.filter(a => new Date(a.expiry_date) >= new Date()).length;
  const totalDocs     = stats.reduce((s, r) => s + parseInt(r.total || 0), 0);

  // Auto-remplir le label selon le type
  function handleTypeChange(v) {
    const t = typeInfo(v);
    setForm(f => ({ ...f, type: v, label: f.label || t.label }));
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents agents</h1>
          <p className="text-slate-400 text-sm mt-1">Pièces justificatives et documents administratifs par agent</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter un document
        </button>
      </div>

      {/* Bannière alertes */}
      {alerts.length > 0 && (
        <div className={`card p-4 flex items-start gap-3 ${totalExpired > 0 ? 'border-red-600/30' : 'border-amber-600/30'}`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${totalExpired > 0 ? 'text-red-400' : 'text-amber-400'}`} />
          <div>
            <p className="text-white font-medium text-sm">
              {totalExpired > 0 && `${totalExpired} document${totalExpired > 1 ? 's' : ''} expiré${totalExpired > 1 ? 's' : ''}`}
              {totalExpired > 0 && totalExpiring > 0 && ' · '}
              {totalExpiring > 0 && `${totalExpiring} expire${totalExpiring > 1 ? 'nt' : ''} dans moins de 60 jours`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {alerts.slice(0, 3).map(a => `${a.last_name} ${a.first_name} — ${a.label}`).join(' · ')}
              {alerts.length > 3 && ` · +${alerts.length - 3} autres`}
            </p>
          </div>
        </div>
      )}

      {/* KPIs par type */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {DOC_TYPES.slice(0, 5).map(dt => {
          const s = stats.find(r => r.type === dt.value);
          return (
            <button key={dt.value}
              onClick={() => setFilterType(filterType === dt.value ? '' : dt.value)}
              className={`card p-3 text-left transition-colors ${filterType === dt.value ? 'border-blue-600/50 bg-blue-600/5' : 'hover:border-dark-500'}`}
            >
              <div className="text-xs text-slate-500 mb-1 truncate">{dt.label}</div>
              <div className="text-xl font-bold text-white">{s ? s.total : 0}</div>
              {s?.expired > 0 && <div className="text-xs text-red-400">{s.expired} exp.</div>}
            </button>
          );
        })}
      </div>

      {/* Résumé + filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-400"><span className="text-white font-medium">{totalDocs}</span> documents au total</span>
        <select className="input w-auto" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="">Tous les agents</option>
          {agents.map(a => <option key={a.agent_id || a.id} value={a.agent_id || a.id}>{a.last_name} {a.first_name}</option>)}
        </select>
        <select className="input w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tous les types</option>
          {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="flex gap-1">
          {[['', 'Tous'], ['expired', 'Expirés'], ['expiring', 'À renouveler'], ['valid', 'Valides']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === v ? 'bg-blue-600 text-white' : 'bg-dark-700 text-slate-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Liste groupée par agent */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-dark-800" />)}</div>
      ) : agentGroups.length === 0 ? (
        <div className="card py-16 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucun document trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agentGroups.map(g => {
            const isOpen = expanded[g.agent_id] !== false;
            const hasAlert = g.items.some(i => i.expiry_date && new Date(i.expiry_date) <= new Date(Date.now() + 60*86400000));
            return (
              <div key={g.agent_id} className={`card overflow-hidden ${hasAlert ? 'border-amber-600/20' : ''}`}>
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/30 transition-colors"
                  onClick={() => setExpanded(e => ({ ...e, [g.agent_id]: !isOpen }))}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: g.color || '#3B82F6' }}>
                    {g.first_name?.[0]}{g.last_name?.[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-white font-semibold text-sm">{g.last_name} {g.first_name}</span>
                    {g.employee_number && <span className="text-slate-500 text-xs ml-2">{g.employee_number}</span>}
                  </div>
                  {hasAlert && <AlertTriangle className="w-4 h-4 text-amber-400 mr-1" />}
                  <span className="text-xs text-slate-500 mr-2">{g.items.length} doc{g.items.length > 1 ? 's' : ''}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {isOpen && (
                  <div className="border-t border-dark-600 divide-y divide-dark-700">
                    {g.items.map(item => {
                      const dt = typeInfo(item.type);
                      const st = expiryStatus(item.expiry_date);
                      const StIcon = st?.icon;
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${dt.bg}`}>
                            <FileText className={`w-4 h-4 ${dt.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">{item.label}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${dt.bg} ${dt.color}`}>{dt.label}</span>
                              {st && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${st.color}`}>
                                  {StIcon && <StIcon className="w-3 h-3" />}
                                  {st.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                              {item.issued_date  && <span>Délivré le {item.issued_date}</span>}
                              {item.expiry_date  && <span>Expire le {item.expiry_date}</span>}
                              {item.issuer       && <span>{item.issuer}</span>}
                              {item.reference    && <span>Réf. {item.reference}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.file_url && (
                              <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Ouvrir le fichier">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => doDelete(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal formulaire */}
      {form && (
        <Modal title={editing ? 'Modifier le document' : 'Ajouter un document'} onClose={() => { setForm(null); setEditing(null); }}>
          <div className="space-y-3">
            {!editing && (
              <div>
                <label className="label">Agent *</label>
                <select className="input" value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}>
                  <option value="">Sélectionner un agent</option>
                  {agents.map(a => <option key={a.agent_id || a.id} value={a.agent_id || a.id}>{a.last_name} {a.first_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Type de document</label>
              <select className="input" value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Intitulé *</label>
              <input className="input" value={form.label} placeholder="Ex: CNI — Martin Dupont"
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date de délivrance</label>
                <input className="input" type="date" value={form.issued_date}
                  onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Date d'expiration</label>
                <input className="input" type="date" value={form.expiry_date}
                  onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Organisme émetteur</label>
                <input className="input" placeholder="Préfecture, CNAPS…" value={form.issuer}
                  onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} />
              </div>
              <div>
                <label className="label">N° / Référence</label>
                <input className="input" placeholder="optionnel" value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Lien vers le fichier (URL)</label>
              <input className="input" type="url" placeholder="https://drive.google.com/…" value={form.file_url}
                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} />
              <p className="text-xs text-slate-600 mt-1">Collez un lien Google Drive, Dropbox, etc.</p>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-5 justify-end">
            <button onClick={() => { setForm(null); setEditing(null); }} className="btn-secondary">Annuler</button>
            <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
