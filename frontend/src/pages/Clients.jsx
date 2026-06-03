import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, MapPin, Mail, Phone, Search, Download, FileBarChart, Link2, LinkOff, ExternalLink } from 'lucide-react';
import { clientsApi, sitesApi, pdfApi, reportApi, portalApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';

function ClientForm({ client, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: client?.name || '',
    contact_name: client?.contact_name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    address: client?.address || '',
    city: client?.city || '',
    postal_code: client?.postal_code || '',
    siret: client?.siret || '',
    notes: client?.notes || '',
    active: client?.active !== undefined ? client.active : 1,
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (client?.id) { await clientsApi.update(client.id, form); toast('Client modifié'); }
      else { await clientsApi.create(form); toast('Client créé'); }
      onSave();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Raison sociale *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Contact</label>
          <input className="input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
        </div>
        <div>
          <label className="label">SIRET</label>
          <input className="input" value={form.siret} onChange={e => set('siret', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Adresse</label>
          <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div>
          <label className="label">Ville</label>
          <input className="input" value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <label className="label">Code postal</label>
          <input className="input" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="cactive" checked={form.active === 1 || form.active === true}
          onChange={e => set('active', e.target.checked ? 1 : 0)} className="w-4 h-4 accent-blue-500 rounded" />
        <label htmlFor="cactive" className="text-sm text-slate-300">Client actif</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">{client?.id ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>
  );
}

function ClientsInner() {
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [portalLoading, setPortalLoading] = useState(null); // clientId en cours

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  async function load() {
    const [c, s] = await Promise.all([clientsApi.list(), sitesApi.list()]);
    setClients(c);
    setSites(s);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    try {
      await clientsApi.delete(deleteId);
      toast('Client supprimé');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handlePortal(client) {
    setPortalLoading(client.id);
    try {
      const { url } = await portalApi.generate(client.id);
      // Mettre à jour localement
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, portal_token: url.split('/portal/')[1] } : c));
      await navigator.clipboard.writeText(url);
      toast(`Lien copié dans le presse-papier`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPortalLoading(null);
    }
  }

  async function handleRevokePortal(client) {
    setPortalLoading(client.id);
    try {
      await portalApi.revoke(client.id);
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, portal_token: null } : c));
      toast('Lien portail révoqué');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPortalLoading(null);
    }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city || '').toLowerCase().includes(search.toLowerCase())
  );

  const siteCountByClient = Object.fromEntries(
    clients.map(c => [c.id, sites.filter(s => s.client_id === c.id).length])
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
        <button className="btn-primary" onClick={() => setModal({ client: null })}>
          <Plus className="w-4 h-4" /> Nouveau client
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-xs text-slate-500">{filtered.length} client(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 text-xs text-slate-400">
                <th className="text-left py-3 px-3 font-medium">Client</th>
                <th className="text-left py-3 px-3 font-medium">Contact</th>
                <th className="text-left py-3 px-3 font-medium">Localisation</th>
                <th className="text-center py-3 px-3 font-medium">Sites</th>
                <th className="text-center py-3 px-3 font-medium">Statut</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => (
                <tr key={client.id} className="table-row">
                  <td className="py-3 px-3">
                    <div className="font-medium text-white text-sm">{client.name}</div>
                    {client.siret && <div className="text-xs text-slate-500">SIRET: {client.siret}</div>}
                  </td>
                  <td className="py-3 px-3">
                    {client.contact_name && <div className="text-sm text-slate-300">{client.contact_name}</div>}
                    {client.email && <div className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</div>}
                    {client.phone && <div className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</div>}
                  </td>
                  <td className="py-3 px-3">
                    {(client.city || client.address) && (
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {client.city || client.address}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="badge bg-dark-600 text-slate-300">{siteCountByClient[client.id] || 0}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`badge ${client.active ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}`}>
                      {client.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => pdfApi.clientPlanning(client.id, { start_date: monthStart, end_date: monthEnd })}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors" title="Planning PDF">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => reportApi.monthly(client.id, new Date().toISOString().slice(0,7))}
                        className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-600/10 rounded-lg transition-colors" title="Rapport mensuel PDF">
                        <FileBarChart className="w-3.5 h-3.5" />
                      </button>
                      {/* Portail client */}
                      {client.portal_token ? (
                        <>
                          <button
                            onClick={() => { const url = `${window.location.origin}/portal/${client.portal_token}`; navigator.clipboard.writeText(url); toast('Lien copié !'); }}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/10 rounded-lg transition-colors"
                            title="Copier le lien portail">
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => window.open(`/portal/${client.portal_token}`, '_blank')}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-600/10 rounded-lg transition-colors"
                            title="Ouvrir le portail">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRevokePortal(client)}
                            disabled={portalLoading === client.id}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-600/10 rounded-lg transition-colors"
                            title="Révoquer le lien">
                            <LinkOff className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handlePortal(client)}
                          disabled={portalLoading === client.id}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-600/10 rounded-lg transition-colors"
                          title="Créer un lien portail client">
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setModal({ client })}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(client.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-10">Aucun client</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal.client ? 'Modifier le client' : 'Nouveau client'} onClose={() => setModal(null)} size="lg">
          <ClientForm client={modal.client} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleteId && (
        <Confirm title="Supprimer le client" message="Supprimer ce client ? Les sites et données associés seront affectés." onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
      )}
    </div>
  );
}

export default function Clients() {
  return <ToastProvider><ClientsInner /></ToastProvider>;
}
