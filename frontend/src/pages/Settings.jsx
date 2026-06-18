import { useEffect, useState } from 'react';
import { Save, Mail, Building2, Sun, Moon, Download, CalendarDays, Star, Users, UserPlus, Pencil, Trash2, Shield, Eye, X } from 'lucide-react';
import { settingsApi, exportApi } from '../api';
import { ToastProvider, useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';

const BASE = import.meta.env.VITE_API_URL || '/api';

const ROLE_OPTIONS = [
  { value: 'admin',        label: 'Admin',        desc: 'Accès complet + paramètres',   color: 'text-blue-400 bg-blue-400/10' },
  { value: 'gestionnaire', label: 'Gestionnaire', desc: 'Tout sauf paramètres société', color: 'text-emerald-400 bg-emerald-400/10' },
  { value: 'lecteur',      label: 'Lecteur',      desc: 'Lecture seule',                color: 'text-slate-400 bg-slate-400/10' },
];

function RoleBadge({ role }) {
  const r = ROLE_OPTIONS.find(o => o.value === role) || ROLE_OPTIONS[2];
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.color}`}>{r.label}</span>;
}

// ── Modal créer / éditer utilisateur ─────────────────────────────────────────
function UserModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isEdit = !!user;
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    password:   '',
    role:       user?.role       || 'gestionnaire',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const token = localStorage.getItem('auth_token');

  async function save() {
    if (!form.first_name || !form.last_name || !form.email) return toast('Tous les champs sont requis', 'error');
    if (!isEdit && !form.password) return toast('Mot de passe requis', 'error');
    setSaving(true);
    try {
      const body = { ...form };
      if (isEdit && !body.password) delete body.password;
      const url = isEdit ? `${BASE}/auth/users/${user.id}` : `${BASE}/auth/users`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast(isEdit ? 'Utilisateur mis à jour' : 'Utilisateur créé');
      onSaved();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
          <h2 className="text-white font-semibold">{isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prénom *</label>
              <input className="input" autoFocus value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={isEdit} />
          </div>
          <div>
            <label className="label">{isEdit ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</label>
            <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <div>
            <label className="label">Rôle</label>
            <div className="space-y-2 mt-1">
              {ROLE_OPTIONS.map(r => (
                <label key={r.value} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${form.role === r.value ? 'border-blue-500/50 bg-blue-500/10' : 'border-dark-600 bg-dark-700 hover:border-dark-500'}`}>
                  <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => set('role', r.value)} className="hidden" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.role === r.value ? 'border-blue-400' : 'border-slate-600'}`}>
                    {form.role === r.value && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${form.role === r.value ? 'text-white' : 'text-slate-300'}`}>{r.label}</span>
                    <span className="text-xs text-slate-500 ml-2">{r.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Section utilisateurs ──────────────────────────────────────────────────────
function UsersSection() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // null | 'new' | {user object}
  const token = localStorage.getItem('auth_token');

  async function load() {
    try {
      const res = await fetch(`${BASE}/auth/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(u) {
    try {
      const res = await fetch(`${BASE}/auth/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...u, active: !u.active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast(u.active ? 'Utilisateur désactivé' : 'Utilisateur réactivé');
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteUser(u) {
    if (!confirm(`Supprimer ${u.first_name} ${u.last_name} ?`)) return;
    try {
      const res = await fetch(`${BASE}/auth/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error);
      toast('Utilisateur supprimé');
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-dark-600">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <h2 className="font-semibold text-white text-sm">Utilisateurs ({users.length})</h2>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3">
          <UserPlus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${u.active ? 'bg-dark-700 border-dark-600' : 'bg-dark-800 border-dark-700 opacity-60'}`}>
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-300">{u.first_name?.[0]}{u.last_name?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-white font-medium">{u.first_name} {u.last_name}</span>
                <RoleBadge role={u.role} />
                {u.id === currentUser?.id && <span className="text-xs text-slate-500">(vous)</span>}
                {!u.active && <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">Désactivé</span>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{u.email}</div>
            </div>
            {u.id !== currentUser?.id && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setModal(u)} title="Modifier" className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-dark-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleActive(u)} title={u.active ? 'Désactiver' : 'Réactiver'}
                  className="p-1.5 text-slate-500 hover:text-amber-400 rounded hover:bg-dark-600 transition-colors">
                  {u.active ? <Eye className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteUser(u)} title="Supprimer" className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-dark-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Aucun utilisateur</p>}
      </div>
      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-600">
        <Icon className="w-4 h-4 text-blue-400" />
        <h2 className="font-semibold text-white text-sm">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingsInner() {
  const toast = useToast();
  const [form, setForm] = useState({
    company_name: '',
    company_address: '',
    company_email: '',
    company_phone: '',
    company_siret: '',
    company_tva_number: '',
    company_cnaps: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    tva_rate: '20',
    hourly_rate_day: '18',
    hourly_rate_night: '22',
    hourly_rate_sunday: '25',
    hourly_rate_sunday_night: '25',
    hourly_rate_holiday_day: '30',
    hourly_rate_holiday_night: '30',
    hourly_rate_holiday_sunday_day: '30',
    hourly_rate_holiday_sunday_night: '30',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    settingsApi.get().then(data => setForm(prev => ({ ...prev, ...data })));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await settingsApi.update(form);
      toast('Paramètres sauvegardés');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <Section title="Informations société" icon={Building2}>
          <div>
            <label className="label">Nom de la société</label>
            <input className="input" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.company_address} onChange={e => set('company_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.company_email} onChange={e => set('company_email', e.target.value)} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.company_phone} onChange={e => set('company_phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">SIRET</label>
              <input className="input" value={form.company_siret} onChange={e => set('company_siret', e.target.value)} placeholder="123 456 789 00012" />
            </div>
            <div>
              <label className="label">N° TVA intracommunautaire</label>
              <input className="input" value={form.company_tva_number} onChange={e => set('company_tva_number', e.target.value)} placeholder="FR 12 345678900" />
            </div>
            <div>
              <label className="label">N° autorisation CNAPS</label>
              <input className="input" value={form.company_cnaps} onChange={e => set('company_cnaps', e.target.value)} placeholder="AUT-075-2114-01-12-20XXXXXX" />
            </div>
          </div>
        </Section>

        <Section title="Taux horaires par défaut" icon={Sun}>
          {/* Heures normales */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Heures normales</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1"><Sun className="w-3 h-3 text-yellow-400"/> Jour (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_day} onChange={e => set('hourly_rate_day', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">06h00 – 21h00</p>
              </div>
              <div>
                <label className="label flex items-center gap-1"><Moon className="w-3 h-3 text-violet-400"/> Nuit (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_night} onChange={e => set('hourly_rate_night', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">21h00 – 06h00</p>
              </div>
            </div>
          </div>
          {/* Dimanche */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><CalendarDays className="w-3 h-3 text-blue-400"/> Dimanche</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Dimanche jour (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_sunday} onChange={e => set('hourly_rate_sunday', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Dim. 06h00 – 21h00</p>
              </div>
              <div>
                <label className="label">Dimanche nuit (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_sunday_night} onChange={e => set('hourly_rate_sunday_night', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Dim. 21h00 – 06h00</p>
              </div>
            </div>
          </div>
          {/* Jours fériés */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><Star className="w-3 h-3 text-rose-400"/> Jours fériés</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Férié jour (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_holiday_day} onChange={e => set('hourly_rate_holiday_day', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Férié 06h00 – 21h00</p>
              </div>
              <div>
                <label className="label">Férié nuit (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_holiday_night} onChange={e => set('hourly_rate_holiday_night', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Férié 21h00 – 06h00</p>
              </div>
              <div>
                <label className="label">Férié dimanche jour (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_holiday_sunday_day} onChange={e => set('hourly_rate_holiday_sunday_day', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Dim. férié 06h00 – 21h00</p>
              </div>
              <div>
                <label className="label">Férié dimanche nuit (€/h)</label>
                <input type="number" step="0.01" className="input" value={form.hourly_rate_holiday_sunday_night} onChange={e => set('hourly_rate_holiday_sunday_night', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Dim. férié 21h00 – 06h00</p>
              </div>
            </div>
          </div>
          <div className="w-32">
            <label className="label">TVA par défaut (%)</label>
            <input type="number" step="0.1" className="input" value={form.tva_rate} onChange={e => set('tva_rate', e.target.value)} />
          </div>
        </Section>

        <Section title="Configuration email (SMTP)" icon={Mail}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hôte SMTP</label>
              <input className="input" value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="label">Port</label>
              <input type="number" className="input" value={form.smtp_port} onChange={e => set('smtp_port', e.target.value)} />
            </div>
            <div>
              <label className="label">Utilisateur</label>
              <input className="input" value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input type="password" className="input" value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)} placeholder="••••••••" />
            </div>
            <div className="col-span-2">
              <label className="label">Email expéditeur (From)</label>
              <input type="email" className="input" value={form.smtp_from} onChange={e => set('smtp_from', e.target.value)} placeholder="noreply@masociete.fr" />
            </div>
          </div>
          <div className="bg-dark-700 rounded-lg p-3 text-xs text-slate-400">
            Pour Gmail, activez l'accès aux applications moins sécurisées ou utilisez un mot de passe d'application.
            Port 465 = SSL, Port 587 = TLS (recommandé).
          </div>
        </Section>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={loading}>
            <Save className="w-4 h-4" />
            {loading ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>

      {/* Export comptable */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 mt-6">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-blue-400" /> Export comptable & paie
        </h2>
        <ExportSection />
      </div>

      {/* Gestion des utilisateurs */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
        <UsersSection />
      </div>
    </div>
  );
}

function ExportSection() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const start = `${month}-01`;
  const end   = new Date(month.slice(0,4), month.slice(5,7), 0).toISOString().split('T')[0];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div>
          <label className="label">Mois</label>
          <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <button onClick={() => exportApi.shifts(start, end)}
          className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Prestations CSV
        </button>
        <button onClick={() => exportApi.invoices(start, end)}
          className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Factures CSV
        </button>
      </div>
      <p className="text-xs text-slate-500">Les fichiers CSV s'ouvrent directement dans Excel (encodage UTF-8 BOM).</p>
    </div>
  );
}

export default function Settings() {
  return <ToastProvider><SettingsInner /></ToastProvider>;
}
