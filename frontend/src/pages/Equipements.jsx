import { useState, useEffect } from 'react';
import { Package, Plus, RotateCcw, Trash2, Edit2, ChevronDown, ChevronUp, Shield, Car, Wrench, Tag, HelpCircle } from 'lucide-react';
import { equipmentsApi, agentsApi } from '../api';
import { useToast } from '../components/Toast';

const CATEGORIES = [
  { value: 'tenue',    label: 'Tenue',     icon: Shield,     color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { value: 'badge',    label: 'Badge',     icon: Tag,        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { value: 'materiel', label: 'Matériel',  icon: Wrench,     color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  { value: 'vehicule', label: 'Véhicule',  icon: Car,        color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { value: 'autre',    label: 'Autre',     icon: HelpCircle, color: 'text-slate-400',   bg: 'bg-slate-500/10' },
];

const CONDITIONS = [
  { value: 'neuf',       label: 'Neuf',        color: 'text-emerald-400' },
  { value: 'bon',        label: 'Bon état',    color: 'text-blue-400' },
  { value: 'use',        label: 'Usé',         color: 'text-amber-400' },
  { value: 'endommage',  label: 'Endommagé',   color: 'text-red-400' },
];

function catInfo(v) { return CATEGORIES.find(c => c.value === v) || CATEGORIES[4]; }
function condInfo(v) { return CONDITIONS.find(c => c.value === v) || CONDITIONS[1]; }

const empty = () => ({
  agent_id: '', category: 'tenue', label: '', size: '', quantity: 1,
  condition: 'neuf', issued_date: new Date().toISOString().slice(0,10),
  return_date: '', serial_number: '', notes: '',
});

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function Equipements() {
  const toast = useToast();
  const [items, setItems]     = useState([]);
  const [stats, setStats]     = useState([]);
  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCat, setFilterCat]   = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterReturned, setFilterReturned] = useState('false');
  const [form, setForm]       = useState(null);
  const [editing, setEditing] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [expanded, setExpanded] = useState({});

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filterCat)     params.category = filterCat;
      if (filterAgent)   params.agent_id = filterAgent;
      if (filterReturned !== '') params.returned = filterReturned;
      const [data, s, ag] = await Promise.all([
        equipmentsApi.list(params),
        equipmentsApi.stats(),
        agentsApi.list(true),
      ]);
      setItems(data);
      setStats(s);
      setAgents(ag);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterCat, filterAgent, filterReturned]);

  async function save() {
    try {
      if (editing) await equipmentsApi.update(editing.id, form);
      else await equipmentsApi.create(form);
      toast(editing ? 'Équipement modifié' : 'Équipement ajouté', 'success');
      setForm(null); setEditing(null); load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function doReturn() {
    try {
      await equipmentsApi.return(returnModal.id, { returned_at: returnModal.date });
      toast('Équipement marqué comme rendu', 'success');
      setReturnModal(null); load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function doDelete(id) {
    if (!confirm('Supprimer cet équipement ?')) return;
    try { await equipmentsApi.delete(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function openNew()     { setEditing(null); setForm(empty()); }
  function openEdit(item){ setEditing(item); setForm({ ...item }); }

  // Grouper par agent pour l'affichage
  const byAgent = items.reduce((acc, item) => {
    const key = item.agent_id;
    if (!acc[key]) acc[key] = { agent_id: item.agent_id, first_name: item.first_name, last_name: item.last_name, color: item.color, employee_number: item.employee_number, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});
  const agentGroups = Object.values(byAgent);

  const totalEnCours = stats.reduce((s, r) => s + parseInt(r.en_cours || 0), 0);
  const totalRendus  = stats.reduce((s, r) => s + parseInt(r.rendus || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Équipements & Dotations</h1>
          <p className="text-slate-400 text-sm mt-1">Tenues, badges, matériels attribués par agent</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Attribuer équipement
        </button>
      </div>

      {/* KPIs par catégorie */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {CATEGORIES.map(cat => {
          const s = stats.find(r => r.category === cat.value);
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCat(filterCat === cat.value ? '' : cat.value)}
              className={`card p-3 text-left transition-colors ${filterCat === cat.value ? 'border-blue-600/50 bg-blue-600/5' : 'hover:border-dark-500'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                <span className="text-xs text-slate-500">{cat.label}</span>
              </div>
              <div className="text-xl font-bold text-white">{s ? s.en_cours : 0}</div>
              <div className="text-xs text-slate-600">en cours</div>
            </button>
          );
        })}
      </div>

      {/* Résumé global */}
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span className="text-white font-medium">{totalEnCours}</span> attribués
        <span className="text-slate-600">·</span>
        <span>{totalRendus}</span> rendus
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select className="input w-auto" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="">Tous les agents</option>
          {agents.map(a => <option key={a.agent_id || a.id} value={a.agent_id || a.id}>{a.last_name} {a.first_name}</option>)}
        </select>
        <select className="input w-auto" value={filterReturned} onChange={e => setFilterReturned(e.target.value)}>
          <option value="false">En cours</option>
          <option value="true">Rendus</option>
          <option value="">Tous</option>
        </select>
      </div>

      {/* Liste groupée par agent */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-dark-800" />)}</div>
      ) : agentGroups.length === 0 ? (
        <div className="card py-16 text-center">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucun équipement trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agentGroups.map(g => {
            const isOpen = expanded[g.agent_id] !== false;
            return (
              <div key={g.agent_id} className="card overflow-hidden">
                {/* En-tête agent */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/30 transition-colors"
                  onClick={() => setExpanded(e => ({ ...e, [g.agent_id]: !isOpen }))}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: g.color || '#3B82F6' }}>
                    {g.first_name?.[0]}{g.last_name?.[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-white font-semibold text-sm">{g.last_name} {g.first_name}</span>
                    {g.employee_number && <span className="text-slate-500 text-xs ml-2">{g.employee_number}</span>}
                  </div>
                  <span className="text-xs text-slate-500 mr-2">{g.items.length} élément{g.items.length > 1 ? 's' : ''}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {/* Équipements */}
                {isOpen && (
                  <div className="border-t border-dark-600 divide-y divide-dark-700">
                    {g.items.map(item => {
                      const cat  = catInfo(item.category);
                      const cond = condInfo(item.condition);
                      const CatIcon = cat.icon;
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat.bg}`}>
                            <CatIcon className={`w-4 h-4 ${cat.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">{item.label}</span>
                              {item.size && <span className="text-xs text-slate-500">T.{item.size}</span>}
                              {item.quantity > 1 && <span className="text-xs text-slate-500">×{item.quantity}</span>}
                              <span className={`text-xs ${cond.color}`}>{cond.label}</span>
                              {item.returned_at && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Rendu {item.returned_at}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                              <span>Remis le {item.issued_date}</span>
                              {item.return_date && !item.returned_at && <span className="text-amber-400">Retour prévu {item.return_date}</span>}
                              {item.serial_number && <span>N° {item.serial_number}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!item.returned_at && (
                              <button
                                onClick={() => setReturnModal({ id: item.id, label: item.label, date: new Date().toISOString().slice(0,10) })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                title="Marquer comme rendu"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
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
        <Modal title={editing ? 'Modifier équipement' : 'Attribuer un équipement'} onClose={() => { setForm(null); setEditing(null); }}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">État</label>
                <select className="input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                  {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Désignation *</label>
              <input className="input" placeholder="Ex: Veste hiver, Badge RFID…" value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Taille</label>
                <input className="input" placeholder="L, XL, 42…" value={form.size}
                  onChange={e => setForm(f => ({ ...f, size: e.target.value }))} />
              </div>
              <div>
                <label className="label">Quantité</label>
                <input className="input" type="number" min="1" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label className="label">N° série</label>
                <input className="input" placeholder="optionnel" value={form.serial_number}
                  onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date de remise *</label>
                <input className="input" type="date" value={form.issued_date}
                  onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Retour prévu</label>
                <input className="input" type="date" value={form.return_date}
                  onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
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
            <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Attribuer'}</button>
          </div>
        </Modal>
      )}

      {/* Modal retour */}
      {returnModal && (
        <Modal title="Confirmer le retour" onClose={() => setReturnModal(null)}>
          <p className="text-slate-300 mb-4">Marquer <strong className="text-white">"{returnModal.label}"</strong> comme rendu ?</p>
          <div>
            <label className="label">Date de retour</label>
            <input className="input" type="date" value={returnModal.date}
              onChange={e => setReturnModal(m => ({ ...m, date: e.target.value }))} />
          </div>
          <div className="flex gap-3 mt-5 justify-end">
            <button onClick={() => setReturnModal(null)} className="btn-secondary">Annuler</button>
            <button onClick={doReturn} className="btn-primary">Confirmer le retour</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
