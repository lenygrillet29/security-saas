import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Edit2, Trash2, CheckCircle, RotateCcw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { incidentsApi, sitesApi, agentsApi } from '../api';
import { useToast } from '../components/Toast';

const TYPES = [
  { value: 'intrusion',    label: 'Intrusion' },
  { value: 'vol',          label: 'Vol' },
  { value: 'vandalisme',   label: 'Vandalisme' },
  { value: 'accident',     label: 'Accident' },
  { value: 'incendie',     label: 'Incendie' },
  { value: 'agression',    label: 'Agression' },
  { value: 'technique',    label: 'Défaillance technique' },
  { value: 'autre',        label: 'Autre' },
];

const SEVERITIES = [
  { value: 'mineur',    label: 'Mineur',    color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-600/30' },
  { value: 'modere',    label: 'Modéré',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-600/30' },
  { value: 'majeur',    label: 'Majeur',    color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-600/30' },
  { value: 'critique',  label: 'Critique',  color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-600/30' },
];

function sevInfo(v) { return SEVERITIES.find(s => s.value === v) || SEVERITIES[0]; }
function typeLabel(v) { return TYPES.find(t => t.value === v)?.label || v; }

const emptyForm = () => ({
  site_id: '', agent_id: '', date: new Date().toISOString().slice(0,10),
  time: new Date().toTimeString().slice(0,5), type: 'autre', severity: 'mineur',
  title: '', description: '', actions_taken: '', notes: '',
});

function Modal({ title, onClose, wide, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`bg-dark-800 border border-dark-600 rounded-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 sticky top-0 bg-dark-800 z-10">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function IncidentForm({ form, setForm, sites, agents, onSave, onClose }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date *</label>
          <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Heure</label>
          <input className="input" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Site</label>
          <select className="input" value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}>
            <option value="">— Non renseigné —</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Agent concerné</label>
          <select className="input" value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}>
            <option value="">— Non renseigné —</option>
            {agents.map(a => <option key={a.agent_id || a.id} value={a.agent_id || a.id}>{a.last_name} {a.first_name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Gravité</label>
          <select className="input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Titre *</label>
        <input className="input" value={form.title} placeholder="Résumé en une ligne…"
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={3} value={form.description}
          placeholder="Déroulé des faits, contexte…"
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div>
        <label className="label">Mesures prises</label>
        <textarea className="input" rows={2} value={form.actions_taken}
          placeholder="Actions engagées, intervenants contactés…"
          onChange={e => setForm(f => ({ ...f, actions_taken: e.target.value }))} />
      </div>
      <div>
        <label className="label">Notes internes</label>
        <textarea className="input" rows={1} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex gap-3 mt-4 justify-end">
        <button onClick={onClose} className="btn-secondary">Annuler</button>
        <button onClick={onSave} className="btn-primary">Enregistrer</button>
      </div>
    </div>
  );
}

export default function Incidents() {
  const toast = useToast();
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems]   = useState([]);
  const [stats, setStats]   = useState(null);
  const [sites, setSites]   = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterSev, setFilterSev]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm]     = useState(null);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail]   = useState(null);

  const ym = `${year}-${String(month).padStart(2,'0')}`;

  async function load() {
    setLoading(true);
    try {
      const params = { month: ym };
      if (filterSev)    params.severity = filterSev;
      if (filterStatus) params.status   = filterStatus;
      const [data, s, si, ag] = await Promise.all([
        incidentsApi.list(params),
        incidentsApi.stats(),
        sitesApi.list(),
        agentsApi.list(true),
      ]);
      setItems(data); setStats(s); setSites(si); setAgents(ag);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [ym, filterSev, filterStatus]);

  function prev() { month === 1 ? (setYear(y => y-1), setMonth(12)) : setMonth(m => m-1); }
  function next() { month === 12 ? (setYear(y => y+1), setMonth(1)) : setMonth(m => m+1); }

  async function save() {
    try {
      if (editing) await incidentsApi.update(editing.id, form);
      else await incidentsApi.create(form);
      toast(editing ? 'Incident modifié' : 'Incident créé', 'success');
      setForm(null); setEditing(null); load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function doClose(id) {
    try { await incidentsApi.close(id); toast('Incident clos', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function doReopen(id) {
    try { await incidentsApi.reopen(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function doDelete(id) {
    if (!confirm('Supprimer cet incident ?')) return;
    try { await incidentsApi.delete(id); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function monthLabel() {
    return new Date(year, month-1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Incidents</h1>
          <p className="text-slate-400 text-sm mt-1">Signalement et suivi des incidents sur sites</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm()); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Signaler un incident
        </button>
      </div>

      {/* KPIs globaux */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3">
            <div className="text-xs text-slate-500 mb-1">Total (tous)</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className={`card p-3 ${parseInt(stats.ouverts) > 0 ? 'border-amber-600/30' : ''}`}>
            <div className="text-xs text-slate-500 mb-1">Ouverts</div>
            <div className={`text-2xl font-bold ${parseInt(stats.ouverts) > 0 ? 'text-amber-400' : 'text-white'}`}>{stats.ouverts}</div>
          </div>
          <div className={`card p-3 ${parseInt(stats.critiques) > 0 ? 'border-red-600/30' : ''}`}>
            <div className="text-xs text-slate-500 mb-1">Critiques</div>
            <div className={`text-2xl font-bold ${parseInt(stats.critiques) > 0 ? 'text-red-400' : 'text-white'}`}>{stats.critiques}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500 mb-1">Clos</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.clos}</div>
          </div>
        </div>
      )}

      {/* Sélecteur de mois + filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={prev} className="p-2 rounded-lg bg-dark-800 border border-dark-600 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-white font-semibold capitalize min-w-[160px] text-center">{monthLabel()}</span>
        <button onClick={next} className="p-2 rounded-lg bg-dark-800 border border-dark-600 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex gap-1 ml-2">
          {[['', 'Tous'], ['ouvert', 'Ouverts'], ['clos', 'Clos']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === v ? 'bg-blue-600 text-white' : 'bg-dark-700 text-slate-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {SEVERITIES.map(s => (
            <button key={s.value} onClick={() => setFilterSev(filterSev === s.value ? '' : s.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterSev === s.value ? `${s.bg} ${s.color} ${s.border}` : 'bg-dark-700 text-slate-400 hover:text-white border-transparent'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-dark-800" />)}</div>
      ) : items.length === 0 ? (
        <div className="card py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucun incident ce mois-ci</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(inc => {
            const sev = sevInfo(inc.severity);
            const isClos = inc.status === 'clos';
            return (
              <div key={inc.id} className={`card p-4 flex items-start gap-4 ${sev.border} ${isClos ? 'opacity-60' : ''}`}>
                {/* Gravité */}
                <div className={`w-2 self-stretch rounded-full shrink-0 ${sev.bg.replace('/10', '/40')}`}
                  style={{ minHeight: 40 }} />

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.bg} ${sev.color}`}>{sev.label}</span>
                    <span className="text-xs text-slate-500 bg-dark-700 px-2 py-0.5 rounded-full">{typeLabel(inc.type)}</span>
                    {isClos && <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Clos</span>}
                  </div>
                  <p className="text-white font-semibold text-sm">{inc.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    <span>{inc.date}{inc.time ? ` à ${inc.time}` : ''}</span>
                    {inc.site_name && <span>📍 {inc.site_name}</span>}
                    {inc.agent_first && <span>👤 {inc.agent_last} {inc.agent_first}</span>}
                  </div>
                  {inc.description && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{inc.description}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setDetail(inc)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 transition-colors" title="Détail">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setEditing(inc); setForm({ site_id: inc.site_id || '', agent_id: inc.agent_id || '', date: inc.date, time: inc.time || '', type: inc.type, severity: inc.severity, title: inc.title, description: inc.description || '', actions_taken: inc.actions_taken || '', notes: inc.notes || '' }); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!isClos ? (
                    <button onClick={() => doClose(inc.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Clore l'incident">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => doReopen(inc.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Réouvrir">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => doDelete(inc.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal formulaire */}
      {form && (
        <Modal title={editing ? 'Modifier l\'incident' : 'Signaler un incident'} onClose={() => { setForm(null); setEditing(null); }} wide>
          <IncidentForm form={form} setForm={setForm} sites={sites} agents={agents} onSave={save} onClose={() => { setForm(null); setEditing(null); }} />
        </Modal>
      )}

      {/* Modal détail */}
      {detail && (
        <Modal title="Détail de l'incident" onClose={() => setDetail(null)} wide>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => { const sev = sevInfo(detail.severity); return <span className={`text-sm px-3 py-1 rounded-full font-medium ${sev.bg} ${sev.color}`}>{sev.label}</span>; })()}
              <span className="text-sm text-slate-400 bg-dark-700 px-3 py-1 rounded-full">{typeLabel(detail.type)}</span>
              <span className={`text-sm px-3 py-1 rounded-full ${detail.status === 'clos' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                {detail.status === 'clos' ? 'Clos' : 'Ouvert'}
              </span>
            </div>
            <h3 className="text-white text-lg font-bold">{detail.title}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Date</span><br /><span className="text-white">{detail.date}{detail.time ? ` à ${detail.time}` : ''}</span></div>
              {detail.site_name && <div><span className="text-slate-500">Site</span><br /><span className="text-white">{detail.site_name}</span></div>}
              {detail.agent_first && <div><span className="text-slate-500">Agent</span><br /><span className="text-white">{detail.agent_last} {detail.agent_first}</span></div>}
            </div>
            {detail.description && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{detail.description}</p>
              </div>
            )}
            {detail.actions_taken && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mesures prises</p>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{detail.actions_taken}</p>
              </div>
            )}
            {detail.notes && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Notes internes</p>
                <p className="text-slate-400 text-sm">{detail.notes}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              {detail.status !== 'clos'
                ? <button onClick={() => { doClose(detail.id); setDetail(null); }} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Clore l'incident</button>
                : <button onClick={() => { doReopen(detail.id); setDetail(null); }} className="btn-secondary flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Réouvrir</button>
              }
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
