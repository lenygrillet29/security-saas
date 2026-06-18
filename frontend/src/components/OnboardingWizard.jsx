import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Building2, MapPin, Users, Calendar,
  CheckCircle, ChevronRight, X, ArrowRight, Sparkles,
} from 'lucide-react';
import { clientsApi, sitesApi, agentsApi, shiftsApi } from '../api';
import { useToast } from './Toast';

const STEPS = [
  { id: 'welcome',  title: 'Bienvenue',          icon: Sparkles,  color: 'text-blue-400'   },
  { id: 'client',   title: 'Premier client',      icon: Building2, color: 'text-emerald-400' },
  { id: 'site',     title: 'Premier site',        icon: MapPin,    color: 'text-violet-400'  },
  { id: 'agent',    title: 'Premier agent',       icon: Users,     color: 'text-amber-400'   },
  { id: 'done',     title: 'Tout est prêt !',     icon: CheckCircle, color: 'text-emerald-400' },
];

function ProgressBar({ currentStep }) {
  const idx = STEPS.findIndex(s => s.id === currentStep);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.filter(s => s.id !== 'welcome' && s.id !== 'done').map((step, i) => {
        const stepIdx = STEPS.findIndex(s2 => s2.id === step.id);
        const done    = stepIdx < idx;
        const active  = stepIdx === idx;
        return (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
              done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white ring-2 ring-blue-400/50' : 'bg-dark-600 text-slate-500'
            }`}>
              {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-white' : done ? 'text-emerald-400' : 'text-slate-600'}`}>
              {step.title}
            </span>
            {i < 2 && <div className={`flex-1 h-px ${done ? 'bg-emerald-500' : 'bg-dark-600'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Étape : premier client ────────────────────────────────────────────────────
function StepClient({ onNext, onSkip }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) return toast('Le nom du client est requis', 'error');
    setSaving(true);
    try {
      const client = await clientsApi.create({ ...form, active: true });
      onNext({ clientId: client.id, clientName: client.name });
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-white text-lg font-semibold">Ajoutez votre premier client</h2>
          <p className="text-slate-500 text-sm">La société pour laquelle vous intervenez</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nom de la société *</label>
          <input className="input text-base" placeholder="Ex: Logistique Express SA" autoFocus
            value={form.name} onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()} />
        </div>
        <div>
          <label className="label">Contact</label>
          <input className="input" placeholder="Jean Dupont" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="contact@entreprise.fr" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" placeholder="06 00 00 00 00" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onSkip} className="btn-secondary flex-shrink-0 text-slate-500">Passer</button>
        <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
          {saving ? 'Création…' : 'Créer le client'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Étape : premier site ──────────────────────────────────────────────────────
function StepSite({ data, onNext, onSkip }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', address: '', client_id: data.clientId || '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) return toast('Le nom du site est requis', 'error');
    setSaving(true);
    try {
      const site = await sitesApi.create({ ...form, active: true });
      onNext({ siteId: site.id, siteName: site.name });
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-violet-500/15 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-white text-lg font-semibold">Ajoutez votre premier site</h2>
          <p className="text-slate-500 text-sm">Le lieu où interviennent vos agents</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">Nom du site *</label>
          <input className="input text-base" placeholder="Ex: Entrepôt Nord, Centre Commercial Riviera…" autoFocus
            value={form.name} onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()} />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="input" placeholder="12 rue des Lilas, 75001 Paris"
            value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        {data.clientId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-300">Associé à {data.clientName}</span>
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onSkip} className="btn-secondary flex-shrink-0 text-slate-500">Passer</button>
        <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
          {saving ? 'Création…' : 'Créer le site'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Étape : premier agent ─────────────────────────────────────────────────────
function StepAgent({ onNext, onSkip }) {
  const toast = useToast();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.first_name.trim() || !form.last_name.trim()) return toast('Prénom et nom requis', 'error');
    setSaving(true);
    try {
      const agent = await agentsApi.create({ ...form, active: true });
      onNext({ agentId: agent.id });
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Users className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-white text-lg font-semibold">Ajoutez votre premier agent</h2>
          <p className="text-slate-500 text-sm">Vous pourrez en ajouter d'autres plus tard</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Prénom *</label>
          <input className="input" placeholder="Jean" autoFocus
            value={form.first_name} onChange={e => set('first_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Nom *</label>
          <input className="input" placeholder="MARTIN"
            value={form.last_name} onChange={e => set('last_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="jean.martin@email.fr"
            value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" placeholder="06 00 00 00 00"
            value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onSkip} className="btn-secondary flex-shrink-0 text-slate-500">Passer</button>
        <button onClick={save} disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
          className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
          {saving ? 'Création…' : 'Créer l\'agent'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Étape finale ──────────────────────────────────────────────────────────────
function StepDone({ data, onClose }) {
  const navigate = useNavigate();
  const actions = [
    { label: 'Aller au planning', sub: 'Planifier les prochaines vacations', icon: Calendar, to: '/planning', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { label: 'Gérer les agents', sub: 'Compléter les fiches agents', icon: Users, to: '/agents', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { label: 'Voir le tableau de bord', sub: 'Vue d\'ensemble de votre activité', icon: Shield, to: '/dashboard', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ];
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-white text-xl font-bold">SecuroPlan est prêt !</h2>
        <p className="text-slate-400 text-sm max-w-sm">
          Votre espace est configuré. Vous pouvez maintenant gérer votre activité de sécurité.
        </p>
      </div>
      <div className="space-y-2 text-left">
        {actions.map(a => (
          <button key={a.to} onClick={() => { onClose(); navigate(a.to); }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all hover:opacity-90 ${a.color}`}>
            <a.icon className="w-5 h-5 shrink-0" />
            <div className="flex-1 text-left">
              <div className="text-white text-sm font-medium">{a.label}</div>
              <div className="text-xs text-slate-500">{a.sub}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Wizard principal ──────────────────────────────────────────────────────────
export default function OnboardingWizard({ onClose }) {
  const [step, setStep] = useState('welcome');
  const [data, setData] = useState({});

  function next(newData = {}) {
    const merged = { ...data, ...newData };
    setData(merged);
    const idx = STEPS.findIndex(s => s.id === step);
    setStep(STEPS[idx + 1]?.id || 'done');
  }

  function skip() {
    const idx = STEPS.findIndex(s => s.id === step);
    setStep(STEPS[idx + 1]?.id || 'done');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="text-slate-400 text-sm font-medium">Configuration initiale</span>
          </div>
          {step !== 'welcome' && step !== 'done' && (
            <button onClick={onClose} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 pb-6 pt-4">
          {step !== 'welcome' && step !== 'done' && <ProgressBar currentStep={step} />}

          {step === 'welcome' && (
            <div className="space-y-6 text-center py-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-white text-xl font-bold">Bienvenue sur SecuroPlan</h2>
                <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                  Configurez votre espace en 3 étapes rapides pour démarrer la gestion de votre société de sécurité.
                </p>
              </div>
              <div className="space-y-2 text-left">
                {[
                  { icon: Building2, color: 'text-emerald-400 bg-emerald-500/10', label: 'Créer votre premier client' },
                  { icon: MapPin,    color: 'text-violet-400 bg-violet-500/10',   label: 'Ajouter un site d\'intervention' },
                  { icon: Users,     color: 'text-amber-400 bg-amber-500/10',     label: 'Enregistrer un agent' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-dark-700">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-slate-300 text-sm">{item.label}</span>
                    <span className="ml-auto text-xs text-slate-600">{i + 1}/3</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-shrink-0 text-slate-500 text-sm">Plus tard</button>
                <button onClick={() => next()} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Commencer la configuration <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'client' && <StepClient onNext={next} onSkip={skip} />}
          {step === 'site'   && <StepSite   data={data} onNext={next} onSkip={skip} />}
          {step === 'agent'  && <StepAgent  onNext={next} onSkip={skip} />}
          {step === 'done'   && <StepDone   data={data} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
