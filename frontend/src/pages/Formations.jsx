import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Edit2, Trash2, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { trainingsApi, agentsApi } from '../api';
import { useToast } from '../components/Toast';

const CATEGORIES = [
  { value: 'formation',      label: 'Formation',       color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { value: 'habilitation',   label: 'Habilitation',    color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  { value: 'certification',  label: 'Certification',   color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { value: 'diplome',        label: 'Diplôme',         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { value: 'autre',          label: 'Autre',           color: 'text-slate-400',   bg: 'bg-slate-500/10' },
];

const PRESETS = [
  'CQP APS', 'Carte professionnelle', 'SST (Sauveteur Secouriste du Travail)',
  'SSIAP 1', 'SSIAP 2', 'SSIAP 3', 'Habilitation électrique B0/H0',
  'Permis B', 'Permis C', 'Formation incendie EPI', 'Recyclage SST',
];

function catInfo(v) { return CATEGORIES.find(c => c.value === v) || CATEGORIES[4]; }

function statusBadge(expiry) {
  if (!expiry) return { label: 'Pas d\'expiration', color: 'text-slate-400 bg-slate-500/10', icon: null };
  const today = new Date();
  const exp   = new Date(expiry);
  const days  = Math.ceil((exp - today) / 86400000);
  if (days < 0)  return { label: `Expiré (${Math.abs(days)}j)`, color: 'text-red-400 bg-red-500/10',   icon: AlertTriangle };
  if (days <= 30) return { label: `Expire dans ${days}j`,         color: 'text-red-400 bg-red-500/10',   icon: AlertTriangle };
  if (days <= 60) return { label: `Expire dans ${days}j`,         color: 'text-amber-400 bg-amber-500/10', icon: Clock };
  return { label: `Valide (${days}j)`, color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle };
}

const emptyForm = () => ({
  agent_id: '', name: '', category: 'formation', obtained_date: '',
  expiry_date: '', issuer: '', reference: '', notes: '',
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

export default function Formations() {
  const toast = useToast();
  const [items, setItems]       = useState([]);
  const [stats, setStats]       = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filterCat, setFilterCat]     = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm]         = useState(null);
  const [editing, setEditing]   = useState(null);
  const [expanded, setExpanded] = useState({});
  const [showPresets, setShowPresets] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filterCat)   params.category = filterCat;
      if (filterAgent) params.agent_id = filterAgent;
      const [data, s, al, ag] = await Promise.all([
        trainingsApi.list(params),
        trainingsApi.stats(),
        trainingsApi.alerts(),
        agentsApi.list(true),
      ]);
      setItems(data);
      setStats(s);
      setAlerts(al);
      setAgents(ag);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterCat, filterAgent]);

  async function save() {
    try {
      if (editing) await trainingsApi.update(editing.id, form);
      else await trainingsApi.create(form);
      toast(editing ? 'Formation modifiée' : 'Formation ajoutée', 'success');
      setForm(null); setEditing(null); load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function doDelete(id) {
    if (!confirm('Supprimer cette formation ?')) return;
    try { await trainingsApi.delete(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function openEdit(item) { setEditing(item); setForm({ ...item }); }
  function openNew()      { setEditing(null); setForm(emptyForm()); }

  // Filtrage status côté client
  const filtered = items.filter(item => {
    if (!filterStatus) return true;
    const exp = item.expiry_date ? new Date(item.expiry_date) : null;
    const today = new Date();
    if (filterStatus === 'expired') return exp && exp < today;
    if (filterStatus === 'expiring') { const d = exp ? Math.ceil((exp - today) / 86400000) : null; return d !== null && d >= 0 && d <= 60; }
    if (filterStatus === 'valid')   return !exp || exp >= today;
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

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Formations & Habilitations</h1>
          <p className="text-slate-400 text-sm mt-1">Suivi des certifications, diplômes et formations par agent</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <div className={`card p-4 border-amber-600/30 flex items-start gap-3 ${totalExpired > 0 ? 'border-red-600/30' : ''}`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${totalExpired > 0 ? 'text-red-400' : 'text-amber-400'}`} />
          <div>
            <p className="text-white font-medium text-sm">
              {totalExpired > 0 && `${totalExpired} formation${totalExpired > 1 ? 's' : ''} expirée${totalExpired > 1 ? 's' : ''}`}
              {totalExpired > 0 && totalExpiring > 0 && ' · '}
              {totalExpiring > 0 && `${totalExpiring} expire${totalExpiring > 1 ? 'nt' : ''} dans moins de 60 jours`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {alerts.slice(0, 3).map(a => `${a.last_name} ${a.first_name} — ${a.name}`).join(' · ')}
              {alerts.length > 3 && ` · +${alerts.length - 3} autres`}
            </p>
          </div>
        </div>
      )}

      {/* KPIs par catégorie */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {CATEGORIES.map(cat => {
          const s = stats.find(r => r.category === cat.value);
          return (
            <button key={cat.value}
              onClick={() => setFilterCat(filterCat === cat.value ? '' : cat.value)}
              className={`card p-3 text-left transition-colors ${filterCat === cat.value ? 'border-blue-600/50 bg-blue-600/5' : 'hover:border-dark-500'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className={`w-3.5 h-3.5 ${cat.color}`} />
                <span className="text-xs text-slate-500">{cat.label}</span>
              </div>
              <div className="text-xl font-bold text-white">{s ? s.total : 0}</div>
              {s?.expired > 0 && <div className="text-xs text-red-400">{s.expired} expirée{s.expired > 1 ? 's' : ''}</div>}
              {s?.expiring_30 > 0 && !s?.expired && <div className="text-xs text-amber-400">{s.expiring_30} bientôt</div>}
            </button>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select className="input w-auto" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="">Tous les agents</option>
          {agents.map(a => <option key={a.agent_id || a.id} value={a.agent_id || a.id}>{a.last_name} {a.first_name}</option>)}
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
          <GraduationCap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucune formation enregistrée</p>
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
                  <span className="text-xs text-slate-500 mr-2">{g.items.length} élément{g.items.length > 1 ? 's' : ''}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {isOpen && (
                  <div className="border-t border-dark-600 divide-y divide-dark-700">
                    {g.items.map(item => {
                      const cat  = catInfo(item.category);
                      const st   = statusBadge(item.expiry_date);
                      const StIcon = st.icon;
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat.bg}`}>
                            <GraduationCap className={`w-4 h-4 ${cat.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">{item.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${st.color}`}>
                                {StIcon && <StIcon className="w-3 h-3" />}
                                {st.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                              {item.obtained_date && <span>Obtenu le {item.obtained_date}</span>}
                              {item.expiry_date && <span>Expire le {item.expiry_date}</span>}
                              {item.issuer && <span>{item.issuer}</span>}
                              {item.reference && <span>Réf. {item.reference}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
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
        <Modal title={editing ? 'Modifier la formation' : 'Ajouter une formation'} onClose={() => { setForm(null); setEditing(null); }}>
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
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Intitulé *</label>
                <button type="button" onClick={() => setShowPresets(o => !o)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Suggestions
                </button>
              </div>
              <input className="input" value={form.name} placeholder="Ex: CQP APS, SSIAP 1…"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {showPresets && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => { setForm(f => ({ ...f, name: p })); setShowPresets(false); }}
                      className="text-xs px-2 py-1 rounded-lg bg-dark-700 border border-dark-500 text-slate-300 hover:text-white hover:border-blue-600/50 transition-colors">
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date d'obtention</label>
                <input className="input" type="date" value={form.obtained_date}
                  onChange={e => setForm(f => ({ ...f, obtained_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Date d'expiration</label>
                <input className="input" type="date" value={form.expiry_date}
                  onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Organisme</label>
                <input className="input" placeholder="CNFPT, INHESJ…" value={form.issuer}
                  onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} />
              </div>
              <div>
                <label className="label">Référence / N° certificat</label>
                <input className="input" placeholder="optionnel" value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
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
