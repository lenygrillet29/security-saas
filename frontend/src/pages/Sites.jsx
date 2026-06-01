import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, MapPin, Search, Download, Sun, Moon } from 'lucide-react';
import { sitesApi, clientsApi, pdfApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';

function SiteForm({ site, clients, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    client_id:          site?.client_id || '',
    name:               site?.name || '',
    address:            site?.address || '',
    city:               site?.city || '',
    hourly_rate_day:    site?.hourly_rate_day || '',
    hourly_rate_night:  site?.hourly_rate_night || '',
    hourly_rate_sunday: site?.hourly_rate_sunday || '',
    latitude:           site?.latitude || '',
    longitude:          site?.longitude || '',
    instructions:       site?.instructions || '',
    notes:              site?.notes || '',
    active:             site?.active !== undefined ? site.active : 1,
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (site?.id) { await sitesApi.update(site.id, form); toast('Site modifié'); }
      else { await sitesApi.create(form); toast('Site créé'); }
      onSave();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Client *</label>
        <select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)} required>
          <option value="">Sélectionner...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Nom du site *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Adresse</label>
          <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div>
          <label className="label">Ville</label>
          <input className="input" value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
      </div>
      <div className="bg-dark-700 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-400 mb-3">Taux horaires (€/h)</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label flex items-center gap-1"><Sun className="w-3 h-3 text-yellow-400"/>Jour (06h–21h)</label>
            <input type="number" step="0.01" className="input" value={form.hourly_rate_day} onChange={e => set('hourly_rate_day', e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><Moon className="w-3 h-3 text-violet-400"/>Nuit (21h–06h)</label>
            <input type="number" step="0.01" className="input" value={form.hourly_rate_night} onChange={e => set('hourly_rate_night', e.target.value)} />
          </div>
          <div>
            <label className="label">Dimanche</label>
            <input type="number" step="0.01" className="input" value={form.hourly_rate_sunday} onChange={e => set('hourly_rate_sunday', e.target.value)} />
          </div>
        </div>
      </div>
      {/* Géolocalisation */}
      <div className="bg-dark-700 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          Coordonnées GPS (pour la prise de service obligatoire à 200m)
        </div>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="label">Latitude</label>
            <input type="number" step="any" className="input" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="48.8566" />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input type="number" step="any" className="input" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="2.3522" />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          💡 Cherchez l'adresse sur{' '}
          <a href="https://www.latlong.net/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">latlong.net</a>
          {' '}pour obtenir les coordonnées.
        </p>
      </div>

      {/* Consignes du site */}
      <div>
        <label className="label">Consignes du site</label>
        <textarea className="input" rows={3} value={form.instructions} onChange={e => set('instructions', e.target.value)}
          placeholder="Consignes envoyées par SMS aux agents avant leur prestation..." />
      </div>

      <div>
        <label className="label">Notes internes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="sactive" checked={form.active === 1 || form.active === true}
          onChange={e => set('active', e.target.checked ? 1 : 0)} className="w-4 h-4 accent-blue-500 rounded" />
        <label htmlFor="sactive" className="text-sm text-slate-300">Site actif</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">{site?.id ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>
  );
}

function SitesInner() {
  const toast = useToast();
  const [sites, setSites] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  async function load() {
    const [s, c] = await Promise.all([sitesApi.list(), clientsApi.list()]);
    setSites(s);
    setClients(c);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    try {
      await sitesApi.delete(deleteId);
      toast('Site supprimé');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const filtered = sites.filter(s =>
    (s.name.toLowerCase().includes(search.toLowerCase()) || (s.city || '').toLowerCase().includes(search.toLowerCase())) &&
    (!filterClient || s.client_id === parseInt(filterClient))
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Sites</h1>
        <button className="btn-primary" onClick={() => setModal({ site: null })}>
          <Plus className="w-4 h-4" /> Nouveau site
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-48" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
            <option value="">Tous les clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-xs text-slate-500">{filtered.length} site(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 text-xs text-slate-400">
                <th className="text-left py-3 px-3 font-medium">Site</th>
                <th className="text-left py-3 px-3 font-medium">Client</th>
                <th className="text-left py-3 px-3 font-medium">Localisation</th>
                <th className="text-right py-3 px-3 font-medium">Taux Jour</th>
                <th className="text-right py-3 px-3 font-medium">Taux Nuit</th>
                <th className="text-right py-3 px-3 font-medium">Taux Dim.</th>
                <th className="text-center py-3 px-3 font-medium">Statut</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(site => (
                <tr key={site.id} className="table-row">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-medium text-white text-sm">{site.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-sm text-slate-300">{site.client_name}</td>
                  <td className="py-3 px-3 text-xs text-slate-400">{[site.city, site.address].filter(Boolean).join(' — ')}</td>
                  <td className="py-3 px-3 text-right text-sm text-blue-400 font-medium">{site.hourly_rate_day > 0 ? `${site.hourly_rate_day}€` : '—'}</td>
                  <td className="py-3 px-3 text-right text-sm text-violet-400 font-medium">{site.hourly_rate_night > 0 ? `${site.hourly_rate_night}€` : '—'}</td>
                  <td className="py-3 px-3 text-right text-sm text-amber-400 font-medium">{site.hourly_rate_sunday > 0 ? `${site.hourly_rate_sunday}€` : '—'}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`badge ${site.active ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}`}>
                      {site.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => pdfApi.sitePlanning(site.id, { start_date: monthStart, end_date: monthEnd })}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors" title="Export planning">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModal({ site })}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(site.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-10">Aucun site</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal.site ? 'Modifier le site' : 'Nouveau site'} onClose={() => setModal(null)} size="lg">
          <SiteForm site={modal.site} clients={clients} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleteId && (
        <Confirm title="Supprimer le site" message="Supprimer ce site ?" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
      )}
    </div>
  );
}

export default function Sites() {
  return <ToastProvider><SitesInner /></ToastProvider>;
}
