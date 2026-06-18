import { useState, useEffect } from 'react';
import {
  ClipboardList, Plus, Search, ChevronDown, ChevronUp,
  CheckCircle, Clock, Edit2, Trash2, X, PenLine,
  AlertTriangle, Eye, CalendarDays, User, MapPin,
} from 'lucide-react';
import { get, agentsApi, sitesApi } from '../api';
import { useToast } from '../components/Toast';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}`, 'Content-Type': 'application/json' });

const apiCall = (method, path, body) =>
  fetch(`${API}${path}`, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

const EVENT_TYPES = [
  { value: 'observation', label: 'Observation', color: 'text-blue-400' },
  { value: 'incident',    label: 'Incident',    color: 'text-red-400' },
  { value: 'visiteur',    label: 'Visiteur',    color: 'text-amber-400' },
  { value: 'ronde',       label: 'Ronde',       color: 'text-emerald-400' },
  { value: 'intervention',label: 'Intervention',color: 'text-orange-400' },
  { value: 'autre',       label: 'Autre',       color: 'text-slate-400' },
];

function statusBadge(status) {
  if (status === 'signe') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">Signé</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">Brouillon</span>;
}

// ── Formulaire création / édition ─────────────────────────────────────────────
function ReportForm({ report, agents, sites, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    agent_id: report?.agent_id || '',
    site_id:  report?.site_id  || '',
    report_date: report?.report_date || new Date().toISOString().split('T')[0],
    start_time:  report?.start_time  || '',
    end_time:    report?.end_time    || '',
    nothing_to_report: report?.nothing_to_report || false,
    observations:  report?.observations  || '',
    incidents:     report?.incidents     || '',
    visitors:      report?.visitors      || '',
    equipment_check: report?.equipment_check !== false,
    equipment_notes: report?.equipment_notes || '',
  });
  const [events, setEvents] = useState(report?.events || []);
  const [newEvent, setNewEvent] = useState({ time: '', type: 'observation', description: '' });
  const [saving, setSaving] = useState(false);

  function addEvent() {
    if (!newEvent.time || !newEvent.description.trim()) return;
    setEvents(e => [...e, { ...newEvent }].sort((a, b) => a.time.localeCompare(b.time)));
    setNewEvent({ time: '', type: 'observation', description: '' });
  }

  async function save() {
    if (!form.agent_id || !form.report_date) return toast('Agent et date requis', 'error');
    setSaving(true);
    try {
      const payload = { ...form, events };
      const saved = report?.id
        ? await apiCall('PUT', `/vacation-reports/${report.id}`, payload)
        : await apiCall('POST', '/vacation-reports', payload);
      toast(report?.id ? 'Rapport mis à jour' : 'Rapport créé', 'success');
      onSaved(saved);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 shrink-0">
          <h2 className="text-white font-semibold">{report?.id ? 'Modifier le rapport' : 'Nouveau rapport de vacation'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Infos de base */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Agent *</label>
              <select className="input" value={form.agent_id} onChange={e => set('agent_id', e.target.value)}>
                <option value="">Sélectionner…</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Site</label>
              <select className="input" value={form.site_id} onChange={e => set('site_id', e.target.value)}>
                <option value="">Aucun</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.report_date} onChange={e => set('report_date', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Début</label>
                <input type="time" className="input" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
              </div>
              <div>
                <label className="label">Fin</label>
                <input type="time" className="input" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
              </div>
            </div>
          </div>

          {/* RAS */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-dark-600 hover:bg-dark-700 transition-colors">
            <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={form.nothing_to_report}
              onChange={e => set('nothing_to_report', e.target.checked)} />
            <div>
              <div className="text-white text-sm font-medium">Rien à signaler (RAS)</div>
              <div className="text-xs text-slate-500">Vacation sans événement particulier</div>
            </div>
          </label>

          {!form.nothing_to_report && (
            <>
              {/* Événements chronologiques */}
              <div>
                <label className="label">Événements du service</label>
                <div className="space-y-2 mb-3">
                  {events.map((ev, i) => {
                    const meta = EVENT_TYPES.find(t => t.value === ev.type) || EVENT_TYPES[0];
                    return (
                      <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-dark-700 group">
                        <span className="text-xs text-slate-400 font-mono shrink-0 mt-0.5">{ev.time}</span>
                        <span className={`text-xs font-semibold shrink-0 mt-0.5 ${meta.color}`}>{meta.label}</span>
                        <span className="text-sm text-slate-300 flex-1">{ev.description}</span>
                        <button onClick={() => setEvents(e => e.filter((_, j) => j !== i))}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 shrink-0 transition-opacity">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {events.length === 0 && <p className="text-xs text-slate-600 italic">Aucun événement ajouté</p>}
                </div>
                <div className="flex gap-2">
                  <input type="time" className="input w-28 shrink-0 text-sm" value={newEvent.time}
                    onChange={e => setNewEvent(n => ({ ...n, time: e.target.value }))} />
                  <select className="input w-36 shrink-0 text-sm" value={newEvent.type}
                    onChange={e => setNewEvent(n => ({ ...n, type: e.target.value }))}>
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input className="input flex-1 text-sm" placeholder="Description de l'événement…"
                    value={newEvent.description} onChange={e => setNewEvent(n => ({ ...n, description: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addEvent()} />
                  <button onClick={addEvent} className="btn-primary px-3 shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Observations générales */}
              <div>
                <label className="label">Observations générales</label>
                <textarea className="input resize-none text-sm" rows={3}
                  placeholder="État général du site, remarques…"
                  value={form.observations} onChange={e => set('observations', e.target.value)} />
              </div>

              {/* Incidents */}
              <div>
                <label className="label">Incidents / signalements</label>
                <textarea className="input resize-none text-sm" rows={2}
                  placeholder="Incidents survenus durant la vacation…"
                  value={form.incidents} onChange={e => set('incidents', e.target.value)} />
              </div>

              {/* Visiteurs */}
              <div>
                <label className="label">Entrées / visiteurs</label>
                <input className="input text-sm" placeholder="Noms, entreprises, heures de passage…"
                  value={form.visitors} onChange={e => set('visitors', e.target.value)} />
              </div>
            </>
          )}

          {/* Vérification équipements */}
          <div>
            <label className="label">Vérification équipements</label>
            <label className="flex items-center gap-3 cursor-pointer mb-2">
              <input type="checkbox" className="accent-emerald-500" checked={form.equipment_check}
                onChange={e => set('equipment_check', e.target.checked)} />
              <span className="text-sm text-slate-300">Équipements vérifiés et en ordre</span>
            </label>
            {!form.equipment_check && (
              <input className="input text-sm" placeholder="Préciser les anomalies…"
                value={form.equipment_notes} onChange={e => set('equipment_notes', e.target.value)} />
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-dark-600 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={save} disabled={saving || !form.agent_id}
            className="btn-primary flex-1 disabled:opacity-40">
            {saving ? 'Enregistrement…' : report?.id ? 'Mettre à jour' : 'Créer le rapport'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Détail rapport ────────────────────────────────────────────────────────────
function ReportDetail({ report, onClose, onSigned, onEdit }) {
  const toast = useToast();
  const [signing, setSigning] = useState(false);

  async function sign() {
    setSigning(true);
    try {
      await apiCall('POST', `/vacation-reports/${report.id}/sign`, {});
      toast('Rapport signé', 'success');
      onSigned();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSigning(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 shrink-0">
          <div>
            <h2 className="text-white font-semibold">Rapport de vacation</h2>
            <p className="text-xs text-slate-500">{report.report_date} · {report.agent_first} {report.agent_last}</p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(report.status)}
            <button onClick={onClose} className="text-slate-400 hover:text-white ml-2"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* En-tête */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <User className="w-4 h-4 shrink-0" />
              <span>{report.agent_first} {report.agent_last}</span>
            </div>
            {report.site_name && (
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{report.site_name}</span>
              </div>
            )}
            {(report.start_time || report.end_time) && (
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{report.start_time?.slice(0,5) || '?'} – {report.end_time?.slice(0,5) || '?'}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-400">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>{report.report_date}</span>
            </div>
          </div>

          {report.nothing_to_report ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-medium">Rien à signaler (RAS)</span>
            </div>
          ) : (
            <>
              {report.events?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Événements</p>
                  <div className="space-y-1.5">
                    {report.events.map(ev => {
                      const meta = EVENT_TYPES.find(t => t.value === ev.type) || EVENT_TYPES[0];
                      return (
                        <div key={ev.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-dark-700">
                          <span className="text-xs text-slate-400 font-mono shrink-0 mt-0.5">{ev.time}</span>
                          <span className={`text-xs font-semibold shrink-0 mt-0.5 ${meta.color}`}>{meta.label}</span>
                          <span className="text-sm text-slate-300">{ev.description}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {report.observations && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Observations</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{report.observations}</p>
                </div>
              )}
              {report.incidents && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400 uppercase tracking-wide font-semibold mb-1">Incidents</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{report.incidents}</p>
                </div>
              )}
              {report.visitors && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Visiteurs / Entrées</p>
                  <p className="text-sm text-slate-300">{report.visitors}</p>
                </div>
              )}
            </>
          )}

          <div className={`flex items-center gap-2 p-3 rounded-lg ${report.equipment_check ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
            {report.equipment_check
              ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            <span className="text-sm text-slate-300">
              {report.equipment_check ? 'Équipements vérifiés — tout en ordre' : `Anomalie équipements : ${report.equipment_notes || 'voir rapport'}`}
            </span>
          </div>

          {report.signed_at && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <PenLine className="w-3.5 h-3.5" />
              Signé le {new Date(report.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-dark-600 shrink-0">
          {report.status !== 'signe' && (
            <button onClick={onEdit} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <Edit2 className="w-4 h-4" /> Modifier
            </button>
          )}
          {report.status !== 'signe' && (
            <button onClick={sign} disabled={signing} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
              <PenLine className="w-4 h-4" /> {signing ? 'Signature…' : 'Signer le rapport'}
            </button>
          )}
          {report.status === 'signe' && (
            <button onClick={onClose} className="btn-secondary flex-1">Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function VacationReports() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [stats, setStats]     = useState({});
  const [agents, setAgents]   = useState([]);
  const [sites, setSites]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [viewReport, setViewReport] = useState(null);
  const [viewFull, setViewFull]     = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAgent)  params.set('agent_id', filterAgent);
      if (filterStatus) params.set('status', filterStatus);
      const [r, s, ag, si] = await Promise.all([
        get(`/vacation-reports${params.toString() ? '?' + params : ''}`),
        get('/vacation-reports/stats'),
        agentsApi.list(true),
        sitesApi.list(),
      ]);
      setReports(Array.isArray(r) ? r : []);
      setStats(s || {});
      setAgents(Array.isArray(ag) ? ag : []);
      setSites(Array.isArray(si) ? si : []);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterAgent, filterStatus]);

  async function openDetail(r) {
    try {
      const full = await get(`/vacation-reports/${r.id}`);
      setViewFull(full);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function del(id) {
    if (!confirm('Supprimer ce rapport ?')) return;
    try { await apiCall('DELETE', `/vacation-reports/${id}`); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  const displayed = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${r.agent_first} ${r.agent_last}`.toLowerCase().includes(q)
      || (r.site_name || '').toLowerCase().includes(q)
      || r.report_date.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-blue-400" /> Rapports de vacation
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Comptes-rendus de fin de poste</p>
        </div>
        <button onClick={() => { setEditReport(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau rapport
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',      value: stats.total  || 0, color: 'text-white' },
          { label: "Aujourd'hui", value: stats.today  || 0, color: 'text-blue-400' },
          { label: 'Signés',     value: stats.signed || 0, color: 'text-emerald-400' },
          { label: 'Brouillons', value: stats.draft  || 0, color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9 text-sm" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm w-48" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="">Tous les agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>)}
        </select>
        <select className="input text-sm w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="signe">Signé</option>
        </select>
      </div>

      {/* Liste */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-14 text-slate-600">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-700" />
            <p className="text-sm">Aucun rapport trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-left">
                <th className="px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Agent</th>
                <th className="px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Site</th>
                <th className="px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Horaires</th>
                <th className="px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Contenu</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => (
                <tr key={r.id} className="border-b border-dark-600/50 hover:bg-dark-700/30 transition-colors">
                  <td className="px-5 py-3 text-slate-300 font-medium whitespace-nowrap">
                    {new Date(r.report_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: r.agent_color || '#3B82F6' }}>
                        {r.agent_first?.[0]}{r.agent_last?.[0]}
                      </div>
                      <span className="text-slate-200">{r.agent_last} {r.agent_first}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.site_name || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {r.start_time && r.end_time ? `${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}` : '—'}
                  </td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3">
                    {r.nothing_to_report
                      ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />RAS</span>
                      : <span className="text-xs text-slate-400">Avec observations</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openDetail(r)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      {r.status !== 'signe' && (
                        <button onClick={() => { setEditReport(r); setShowForm(true); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => del(r.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ReportForm
          report={editReport}
          agents={agents} sites={sites}
          onClose={() => { setShowForm(false); setEditReport(null); }}
          onSaved={() => { setShowForm(false); setEditReport(null); load(); }}
        />
      )}

      {viewFull && (
        <ReportDetail
          report={viewFull}
          onClose={() => setViewFull(null)}
          onSigned={() => { setViewFull(null); load(); }}
          onEdit={() => { setEditReport(viewFull); setViewFull(null); setShowForm(true); }}
        />
      )}
    </div>
  );
}
