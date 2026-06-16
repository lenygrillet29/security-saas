import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Phone, Mail, Search, Download, Archive, ArchiveRestore, Send, AlertTriangle, Zap, Smartphone, User, MapPin, CreditCard, Shield, CalendarDays, ChevronDown, ChevronUp, Camera, X, BadgeCheck } from 'lucide-react';
import { agentsApi, shiftsApi, pdfApi, emailApi, addonsApi } from '../api';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const CONTRACT_TYPES = ['CDI', 'CDD', 'Intérim', 'Auto-entrepreneur'];
const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#EC4899'];

function FormSection({ icon: Icon, title, color = 'text-blue-400', children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-dark-600 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-4 py-3 bg-dark-700/50 text-left ${collapsible ? 'hover:bg-dark-700 cursor-pointer' : 'cursor-default'}`}
      >
        <Icon className={`w-4 h-4 ${color} shrink-0`} />
        <span className="text-sm font-semibold text-white flex-1">{title}</span>
        {collapsible && (open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />)}
      </button>
      {open && <div className="px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
}

function PhotoUpload({ agentId, currentPhoto, onPhotoChange }) {
  const toast = useToast();
  const fileRef = useRef();
  const [preview, setPreview] = useState(currentPhoto || null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast('Image trop volumineuse (max 4 Mo)', 'error'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      onPhotoChange(dataUrl);
      if (agentId) {
        try {
          await agentsApi.uploadPhoto(agentId, dataUrl);
          toast('Photo enregistrée');
        } catch (err) { toast(err.message, 'error'); }
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleDelete() {
    setPreview(null);
    onPhotoChange(null);
    if (agentId) {
      try { await agentsApi.deletePhoto(agentId); toast('Photo supprimée'); }
      catch (err) { toast(err.message, 'error'); }
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        {preview ? (
          <img src={preview} alt="Photo agent" className="w-20 h-20 rounded-full object-cover border-2 border-blue-500/50" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-dark-700 border-2 border-dashed border-dark-500 flex items-center justify-center">
            <User className="w-8 h-8 text-slate-600" />
          </div>
        )}
        {preview && (
          <button type="button" onClick={handleDelete}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors">
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-secondary flex items-center gap-2 text-sm py-1.5 px-3"
        >
          <Camera className="w-3.5 h-3.5" />
          {uploading ? 'Chargement…' : preview ? 'Changer la photo' : 'Ajouter une photo'}
        </button>
        <p className="text-xs text-slate-600">JPG, PNG, WEBP · max 4 Mo</p>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

function AgentForm({ agent, onSave, onClose }) {
  const toast = useToast();
  const [photoData, setPhotoData] = useState(agent?.photo || null);
  const [form, setForm] = useState({
    first_name:      agent?.first_name      || '',
    last_name:       agent?.last_name       || '',
    email:           agent?.email           || '',
    phone:           agent?.phone           || '',
    address:         agent?.address         || '',
    birth_date:      agent?.birth_date      || '',
    birth_place:     agent?.birth_place     || '',
    nationality:     agent?.nationality     || '',
    employee_number: agent?.employee_number || '',
    contract_type:   agent?.contract_type   || 'CDI',
    hourly_rate:     agent?.hourly_rate     || '',
    entry_date:      agent?.entry_date      || '',
    exit_date:       agent?.exit_date       || '',
    carte_vitale:    agent?.carte_vitale    || '',
    carte_pro:       agent?.carte_pro       || '',
    color:           agent?.color           || '#3B82F6',
    notes:           agent?.notes           || '',
    active:          agent?.active !== undefined ? agent.active : 1,
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = { ...form, photo: photoData };
      if (agent?.id) {
        await agentsApi.update(agent.id, payload);
        toast('Agent modifié');
      } else {
        const created = await agentsApi.create(payload);
        // Upload photo séparément si présente (l'ID n'existe qu'après la création)
        if (photoData && created?.id) {
          await agentsApi.uploadPhoto(created.id, photoData).catch(() => {});
        }
        toast('Agent créé');
      }
      onSave();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Identité */}
      <FormSection icon={User} title="Identité" color="text-blue-400">
        <PhotoUpload agentId={agent?.id} currentPhoto={photoData} onPhotoChange={setPhotoData} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Prénom *</label>
            <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Nom *</label>
            <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date de naissance</label>
            <input type="date" className="input" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Lieu de naissance</label>
            <input className="input" value={form.birth_place} onChange={e => set('birth_place', e.target.value)} placeholder="Ville, Pays" />
          </div>
        </div>
        <div>
          <label className="label">Nationalité</label>
          <input className="input" value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="Française" />
        </div>
      </FormSection>

      {/* Coordonnées */}
      <FormSection icon={MapPin} title="Coordonnées" color="text-emerald-400">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="06 XX XX XX XX" />
          </div>
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="N° rue, code postal, ville" />
        </div>
      </FormSection>

      {/* Contrat */}
      <FormSection icon={CalendarDays} title="Contrat & Emploi" color="text-amber-400">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">N° matricule</label>
            <input className="input" value={form.employee_number} onChange={e => set('employee_number', e.target.value)} />
          </div>
          <div>
            <label className="label">Type de contrat</label>
            <select className="input" value={form.contract_type} onChange={e => set('contract_type', e.target.value)}>
              {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Taux horaire (€/h)</label>
            <input type="number" step="0.01" className="input" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} />
          </div>
          <div>
            <label className="label">Date d'entrée</label>
            <input type="date" className="input" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Date de sortie</label>
            <input type="date" className="input" value={form.exit_date} onChange={e => set('exit_date', e.target.value)} />
          </div>
        </div>
      </FormSection>

      {/* Identifiants pro */}
      <FormSection icon={Shield} title="Identifiants professionnels" color="text-rose-400" collapsible defaultOpen={!!(agent?.carte_vitale || agent?.carte_pro)}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" /> N° Carte Vitale
            </label>
            <input className="input" value={form.carte_vitale} onChange={e => set('carte_vitale', e.target.value)} placeholder="1 XX XX XX XXX XXX XX" maxLength={21} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-rose-400" /> N° Carte professionnelle CNAPS
            </label>
            <input className="input" value={form.carte_pro} onChange={e => set('carte_pro', e.target.value)} placeholder="APS-XXXXXXXXX-XXXX-X" />
          </div>
        </div>
        <p className="text-xs text-slate-600">Ces données sont confidentielles et stockées de façon sécurisée.</p>
      </FormSection>

      {/* Planning & Notes */}
      <FormSection icon={CalendarDays} title="Planning & Notes" color="text-violet-400" collapsible defaultOpen>
        <div>
          <label className="label">Couleur planning</label>
          <div className="flex gap-2 flex-wrap mt-1">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => set('color', c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="active" checked={form.active === 1 || form.active === true}
            onChange={e => set('active', e.target.checked ? 1 : 0)}
            className="w-4 h-4 accent-blue-500 rounded" />
          <label htmlFor="active" className="text-sm text-slate-300">Agent actif</label>
        </div>
      </FormSection>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">{agent?.id ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>
  );
}

function AgentsInner() {
  const toast = useToast();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [archiveId, setArchiveId] = useState(null);
  const [monthStats, setMonthStats] = useState({});
  const [limits, setLimits] = useState(null);

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  async function load() {
    const [data, stats] = await Promise.all([
      agentsApi.list(),
      shiftsApi.stats({ start_date: monthStart, end_date: monthEnd }),
    ]);
    setAgents(data);
    setMonthStats(Object.fromEntries(stats.map(s => [s.agent_id, s])));
  }

  useEffect(() => {
    load();
    addonsApi.limits().then(setLimits).catch(() => {});
  }, []);

  async function handleDelete() {
    try {
      await agentsApi.delete(deleteId);
      toast('Agent supprimé');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleArchive(agent) {
    try {
      if (agent.active) {
        await agentsApi.archive(agent.id);
        toast(`${agent.first_name} ${agent.last_name} archivé`);
      } else {
        await agentsApi.unarchive(agent.id);
        toast(`${agent.first_name} ${agent.last_name} réactivé`);
      }
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleSendPlanning(agent) {
    if (!agent.email) return toast('Cet agent n\'a pas d\'email', 'error');
    try {
      await emailApi.sendAgentPlanning(agent.id, { start_date: monthStart, end_date: monthEnd });
      toast(`Planning envoyé à ${agent.email}`);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleSendPortal(agent) {
    if (!agent.email) return toast('Cet agent n\'a pas d\'email', 'error');
    try {
      await agentsApi.sendPortal(agent.id);
      toast(`Lien appli envoyé à ${agent.email} 📱`);
    } catch (err) { toast(err.message, 'error'); }
  }

  const filtered = agents.filter(a => {
    const matchSearch = `${a.first_name} ${a.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (a.employee_number || '').includes(search);
    const matchArchived = showArchived ? true : a.active;
    return matchSearch && matchArchived;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Agents</h1>
        <button className="btn-primary" onClick={() => setModal({ agent: null })}>
          <Plus className="w-4 h-4" /> Nouvel agent
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher un agent..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button
            onClick={() => setShowArchived(s => !s)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${showArchived ? 'bg-slate-600/20 border-slate-500 text-slate-300' : 'border-dark-500 text-slate-400 hover:text-slate-200'}`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? 'Masquer archivés' : 'Voir archivés'}
          </button>
          <span className="text-xs text-slate-500">{filtered.length} agent(s)</span>
        </div>

        {/* Bannière limite agents */}
        {limits?.agents && (
          limits.agents.exceeded ? (
            <div className="mb-4 flex items-center gap-3 bg-red-900/30 border border-red-600/40 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="text-red-300 font-medium">Limite atteinte</span>
                <span className="text-red-400/80"> — {limits.agents.count}/{limits.agents.limit} agents actifs</span>
              </div>
              <button onClick={() => navigate('/billing')} className="flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors">
                <Zap className="w-3 h-3" /> Upgrade
              </button>
            </div>
          ) : limits.agents.count >= Math.ceil((limits.agents.limit ?? 5) * 0.8) && limits.agents.limit !== null ? (
            <div className="mb-4 flex items-center gap-3 bg-amber-900/20 border border-amber-600/30 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 text-sm text-amber-300">
                {limits.agents.count}/{limits.agents.limit} agents actifs — vous approchez de la limite
              </div>
              <button onClick={() => navigate('/billing')} className="text-xs text-amber-400 hover:text-white transition-colors">
                Voir les packs →
              </button>
            </div>
          ) : null
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 text-xs text-slate-400">
                <th className="text-left py-3 px-3 font-medium">Agent</th>
                <th className="text-left py-3 px-3 font-medium">Contact</th>
                <th className="text-left py-3 px-3 font-medium">Contrat</th>
                <th className="text-right py-3 px-3 font-medium">H.Mois</th>
                <th className="text-center py-3 px-3 font-medium">Statut</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(agent => {
                const stats = monthStats[agent.id];
                const totalH = stats ? stats.total_day + stats.total_night + stats.total_sunday : 0;
                return (
                  <tr key={agent.id} className="table-row cursor-pointer" onDoubleClick={() => setModal({ agent })}>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        {agent.photo ? (
                          <img src={agent.photo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-dark-500" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: agent.color || '#3B82F6' }}>
                            {agent.first_name[0]}{agent.last_name[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{agent.first_name} {agent.last_name}</div>
                          {agent.employee_number && <div className="text-xs text-slate-500">N° {agent.employee_number}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        {agent.email && <div className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{agent.email}</div>}
                        {agent.phone && <div className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{agent.phone}</div>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="badge bg-dark-600 text-slate-300">{agent.contract_type}</span>
                      {agent.hourly_rate > 0 && <div className="text-xs text-slate-500 mt-0.5">{agent.hourly_rate}€/h</div>}
                      {agent.carte_pro && <div className="text-xs text-rose-400/70 mt-0.5 flex items-center gap-1"><Shield className="w-2.5 h-2.5" />{agent.carte_pro}</div>}
                      {agent.entry_date && <div className="text-xs text-slate-600 mt-0.5">Entrée : {new Date(agent.entry_date).toLocaleDateString('fr-FR')}</div>}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {totalH > 0 ? (
                        <div>
                          <div className="text-sm font-medium text-white">{totalH.toFixed(1)}h</div>
                          {stats?.total_night > 0 && <div className="text-xs text-violet-400">{stats.total_night.toFixed(1)}h nuit</div>}
                          {stats?.total_sunday > 0 && <div className="text-xs text-amber-400">{stats.total_sunday.toFixed(1)}h dim.</div>}
                        </div>
                      ) : <span className="text-slate-600 text-sm">—</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`badge ${agent.active ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}`}>
                        {agent.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => pdfApi.agentBadge(agent.id)}
                          className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-600/10 rounded-lg transition-colors"
                          title="Télécharger badge PDF"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => pdfApi.agentPlanning(agent.id, { start_date: monthStart, end_date: monthEnd })}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                          title="Télécharger planning PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSendPlanning(agent)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-600/10 rounded-lg transition-colors"
                          title="Envoyer planning par email"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSendPortal(agent)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                          title="Envoyer le lien appli mobile"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchive(agent)}
                          className={`p-1.5 rounded-lg transition-colors ${agent.active ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-600/10' : 'text-amber-400 hover:text-emerald-400 hover:bg-emerald-600/10'}`}
                          title={agent.active ? 'Archiver' : 'Réactiver'}
                        >
                          {agent.active ? <Archive className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setModal({ agent })}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(agent.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-10">Aucun agent trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal.agent ? 'Modifier l\'agent' : 'Nouvel agent'} onClose={() => setModal(null)} size="xl">
          <AgentForm agent={modal.agent} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleteId && (
        <Confirm title="Supprimer l'agent" message="Cette action supprimera tous les shifts et absences associés." onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
      )}
    </div>
  );
}

export default function Agents() {
  return <ToastProvider><AgentsInner /></ToastProvider>;
}
