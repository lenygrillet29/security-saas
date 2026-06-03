import { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, Mail, Building2, Sun, Moon, Download } from 'lucide-react';
import { settingsApi, exportApi } from '../api';
import { ToastProvider, useToast } from '../components/Toast';

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
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    tva_rate: '20',
    hourly_rate_day: '18',
    hourly_rate_night: '22',
    hourly_rate_sunday: '25',
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
        </Section>

        <Section title="Taux horaires par défaut" icon={Sun}>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label flex items-center gap-1"><Sun className="w-3 h-3 text-yellow-400"/>Jour (€/h)</label>
              <input type="number" step="0.01" className="input" value={form.hourly_rate_day} onChange={e => set('hourly_rate_day', e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">06h00 – 21h00</p>
            </div>
            <div>
              <label className="label flex items-center gap-1"><Moon className="w-3 h-3 text-violet-400"/>Nuit (€/h)</label>
              <input type="number" step="0.01" className="input" value={form.hourly_rate_night} onChange={e => set('hourly_rate_night', e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">21h00 – 06h00</p>
            </div>
            <div>
              <label className="label">Dimanche (€/h)</label>
              <input type="number" step="0.01" className="input" value={form.hourly_rate_sunday} onChange={e => set('hourly_rate_sunday', e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Toutes heures</p>
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
