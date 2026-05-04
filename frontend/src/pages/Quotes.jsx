import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Download, Mail, Search, Sun, Moon } from 'lucide-react';
import { quotesApi, clientsApi, sitesApi, pdfApi, emailApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';
import { format } from 'date-fns';

const STATUSES = [
  { value: 'draft', label: 'Brouillon', color: 'bg-slate-600/20 text-slate-400' },
  { value: 'sent', label: 'Envoyé', color: 'bg-blue-600/20 text-blue-400' },
  { value: 'accepted', label: 'Accepté', color: 'bg-emerald-600/20 text-emerald-400' },
  { value: 'rejected', label: 'Refusé', color: 'bg-red-600/20 text-red-400' },
];
function statusInfo(s) { return STATUSES.find(x => x.value === s) || STATUSES[0]; }

function LineRow({ line, onChange, onRemove, idx }) {
  const set = (k, v) => onChange(idx, { ...line, [k]: v === '' ? 0 : parseFloat(v) || 0 });
  const setStr = (k, v) => onChange(idx, { ...line, [k]: v });
  const total = (line.hours_day * line.rate_day) + (line.hours_night * line.rate_night) + (line.hours_sunday * line.rate_sunday);

  return (
    <tr className="border-b border-dark-600">
      <td className="py-2 px-2">
        <input className="input text-xs" value={line.description} onChange={e => setStr('description', e.target.value)} placeholder="Description de la prestation" />
      </td>
      <td className="py-2 px-1 w-20">
        <input type="number" step="0.5" className="input text-xs text-right" value={line.hours_day || ''} onChange={e => set('hours_day', e.target.value)} placeholder="0" />
      </td>
      <td className="py-2 px-1 w-20">
        <input type="number" step="0.01" className="input text-xs text-right" value={line.rate_day || ''} onChange={e => set('rate_day', e.target.value)} placeholder="0€" />
      </td>
      <td className="py-2 px-1 w-20">
        <input type="number" step="0.5" className="input text-xs text-right" value={line.hours_night || ''} onChange={e => set('hours_night', e.target.value)} placeholder="0" />
      </td>
      <td className="py-2 px-1 w-20">
        <input type="number" step="0.01" className="input text-xs text-right" value={line.rate_night || ''} onChange={e => set('rate_night', e.target.value)} placeholder="0€" />
      </td>
      <td className="py-2 px-1 w-20">
        <input type="number" step="0.5" className="input text-xs text-right" value={line.hours_sunday || ''} onChange={e => set('hours_sunday', e.target.value)} placeholder="0" />
      </td>
      <td className="py-2 px-1 w-20">
        <input type="number" step="0.01" className="input text-xs text-right" value={line.rate_sunday || ''} onChange={e => set('rate_sunday', e.target.value)} placeholder="0€" />
      </td>
      <td className="py-2 px-2 text-right text-sm font-semibold text-white w-24">
        {total.toFixed(2)}€
      </td>
      <td className="py-2 px-1 w-8">
        <button type="button" onClick={() => onRemove(idx)} className="text-slate-500 hover:text-red-400 transition-colors">✕</button>
      </td>
    </tr>
  );
}

function QuoteForm({ quote, clients, sites, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    client_id: quote?.client_id || '',
    site_id: quote?.site_id || '',
    title: quote?.title || '',
    valid_until: quote?.valid_until || '',
    hourly_rate_day: quote?.hourly_rate_day || '',
    hourly_rate_night: quote?.hourly_rate_night || '',
    hourly_rate_sunday: quote?.hourly_rate_sunday || '',
    status: quote?.status || 'draft',
    notes: quote?.notes || '',
    tva_rate: quote?.tva_rate || 20,
  });
  const [lines, setLines] = useState(quote?.lines || [
    { description: '', hours_day: 0, hours_night: 0, hours_sunday: 0, rate_day: 0, rate_night: 0, rate_sunday: 0 }
  ]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const filteredSites = sites.filter(s => !form.client_id || s.client_id === parseInt(form.client_id));

  function updateLine(idx, newLine) {
    setLines(prev => prev.map((l, i) => i === idx ? newLine : l));
  }
  function removeLine(idx) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }
  function addLine() {
    setLines(prev => [...prev, { description: '', hours_day: 0, hours_night: 0, hours_sunday: 0, rate_day: form.hourly_rate_day || 0, rate_night: form.hourly_rate_night || 0, rate_sunday: form.hourly_rate_sunday || 0 }]);
  }

  const totalHT = lines.reduce((s, l) => s + (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday), 0);
  const tva = totalHT * (parseFloat(form.tva_rate) / 100);
  const ttc = totalHT + tva;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const data = { ...form, lines };
      if (quote?.id) { await quotesApi.update(quote.id, data); toast('Devis modifié'); }
      else { await quotesApi.create(data); toast('Devis créé'); }
      onSave();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Client *</label>
          <select className="input" value={form.client_id} onChange={e => { set('client_id', e.target.value); set('site_id', ''); }} required>
            <option value="">Sélectionner...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Site</label>
          <select className="input" value={form.site_id} onChange={e => set('site_id', e.target.value)}>
            <option value="">Aucun</option>
            {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Titre *</label>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} required />
        </div>
        <div>
          <label className="label">Valide jusqu'au</label>
          <input type="date" className="input" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Taux par défaut */}
      <div className="bg-dark-700 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-400 mb-3">Taux horaires par défaut pour ce devis</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label flex items-center gap-1"><Sun className="w-3 h-3 text-yellow-400"/>Jour (€/h)</label>
            <input type="number" step="0.01" className="input" value={form.hourly_rate_day} onChange={e => set('hourly_rate_day', e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><Moon className="w-3 h-3 text-violet-400"/>Nuit (€/h)</label>
            <input type="number" step="0.01" className="input" value={form.hourly_rate_night} onChange={e => set('hourly_rate_night', e.target.value)} />
          </div>
          <div>
            <label className="label">Dimanche (€/h)</label>
            <input type="number" step="0.01" className="input" value={form.hourly_rate_sunday} onChange={e => set('hourly_rate_sunday', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-slate-400">Lignes de prestation</div>
          <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={addLine}><Plus className="w-3 h-3"/>Ajouter</button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-dark-600">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-dark-700 border-b border-dark-600">
                <th className="text-left py-2 px-2 text-slate-400">Description</th>
                <th className="text-right py-2 px-1 text-slate-400">H.Jour</th>
                <th className="text-right py-2 px-1 text-blue-400">Taux</th>
                <th className="text-right py-2 px-1 text-slate-400">H.Nuit</th>
                <th className="text-right py-2 px-1 text-violet-400">Taux</th>
                <th className="text-right py-2 px-1 text-slate-400">H.Dim</th>
                <th className="text-right py-2 px-1 text-amber-400">Taux</th>
                <th className="text-right py-2 px-2 text-slate-400">Total HT</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <LineRow key={i} line={l} idx={i} onChange={updateLine} onRemove={removeLine} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totaux */}
      <div className="flex justify-end">
        <div className="w-56 space-y-1 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Total HT</span><span className="text-white font-medium">{totalHT.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-slate-400 items-center">
            <span>TVA</span>
            <div className="flex items-center gap-2">
              <input type="number" className="input w-14 text-xs text-right py-1 px-2" value={form.tva_rate} onChange={e => set('tva_rate', e.target.value)} />
              <span className="text-white">%</span>
              <span className="text-white font-medium">{tva.toFixed(2)} €</span>
            </div>
          </div>
          <div className="flex justify-between border-t border-dark-500 pt-1 font-semibold">
            <span>Total TTC</span><span className="text-blue-400 text-base">{ttc.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Notes / Conditions</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">{quote?.id ? 'Modifier' : 'Créer le devis'}</button>
      </div>
    </form>
  );
}

function EmailModal({ quoteId, client, onClose }) {
  const toast = useToast();
  const [to, setTo] = useState(client?.email || '');
  const [subject, setSubject] = useState(`Devis — ${client?.name || ''}`);
  const [message, setMessage] = useState('Veuillez trouver ci-joint notre devis.\n\nCordialement,');

  async function handleSend() {
    try {
      await emailApi.sendQuote(quoteId, { to, subject, message });
      toast('Email envoyé avec succès');
      onClose();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title="Envoyer le devis par email" onClose={onClose} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">À</label>
          <input type="email" className="input" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Objet</label>
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea className="input" rows={4} value={message} onChange={e => setMessage(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={handleSend}><Mail className="w-4 h-4"/>Envoyer</button>
        </div>
      </div>
    </Modal>
  );
}

function QuotesInner() {
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [emailModal, setEmailModal] = useState(null);

  async function load() {
    const [q, c, s] = await Promise.all([quotesApi.list(), clientsApi.list(), sitesApi.list()]);
    setQuotes(q);
    setClients(c);
    setSites(s);
  }

  async function openEdit(quote) {
    const full = await quotesApi.get(quote.id);
    setModal({ quote: full });
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    try {
      await quotesApi.delete(deleteId);
      toast('Devis supprimé');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const filtered = quotes.filter(q =>
    (q.title.toLowerCase().includes(search.toLowerCase()) ||
     q.client_name.toLowerCase().includes(search.toLowerCase()) ||
     (q.quote_number || '').includes(search)) &&
    (!filterStatus || q.status === filterStatus)
  );

  const totalAccepted = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total_ht, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Devis</h1>
          <p className="text-slate-400 text-sm mt-1">
            CA accepté : <span className="text-emerald-400 font-semibold">{totalAccepted.toFixed(2)} € HT</span>
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ quote: null })}>
          <Plus className="w-4 h-4" /> Nouveau devis
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 bg-dark-700 rounded-lg p-1">
            <button className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!filterStatus ? 'bg-dark-500 text-white' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setFilterStatus('')}>Tous</button>
            {STATUSES.map(s => (
              <button key={s.value}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterStatus === s.value ? 'bg-dark-500 text-white' : 'text-slate-400 hover:text-white'}`}
                onClick={() => setFilterStatus(s.value)}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 text-xs text-slate-400">
                <th className="text-left py-3 px-3 font-medium">N°</th>
                <th className="text-left py-3 px-3 font-medium">Client / Titre</th>
                <th className="text-left py-3 px-3 font-medium">Site</th>
                <th className="text-right py-3 px-3 font-medium">Total HT</th>
                <th className="text-right py-3 px-3 font-medium">Total TTC</th>
                <th className="text-left py-3 px-3 font-medium">Validité</th>
                <th className="text-center py-3 px-3 font-medium">Statut</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(quote => {
                const tva = quote.total_ht * (parseFloat(quote.tva_rate || 20) / 100);
                const ttc = quote.total_ht + tva;
                const client = clients.find(c => c.id === quote.client_id);
                return (
                  <tr key={quote.id} className="table-row">
                    <td className="py-3 px-3 text-xs font-mono text-slate-400">{quote.quote_number}</td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-medium text-white">{quote.title}</div>
                      <div className="text-xs text-slate-400">{quote.client_name}</div>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-400">{quote.site_name || '—'}</td>
                    <td className="py-3 px-3 text-right text-sm font-medium text-white">{quote.total_ht.toFixed(2)} €</td>
                    <td className="py-3 px-3 text-right text-sm font-semibold text-blue-400">{ttc.toFixed(2)} €</td>
                    <td className="py-3 px-3 text-xs text-slate-400">
                      {quote.valid_until ? format(new Date(quote.valid_until), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`badge ${statusInfo(quote.status).color}`}>{statusInfo(quote.status).label}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => pdfApi.quote(quote.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors" title="PDF">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEmailModal({ quoteId: quote.id, client })}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-600/10 rounded-lg transition-colors" title="Email">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openEdit(quote)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(quote.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-10">Aucun devis</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal.quote?.id ? 'Modifier le devis' : 'Nouveau devis'} onClose={() => setModal(null)} size="xl">
          <QuoteForm quote={modal.quote} clients={clients} sites={sites}
            onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleteId && (
        <Confirm title="Supprimer le devis" message="Supprimer ce devis ?" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
      )}
      {emailModal && (
        <EmailModal quoteId={emailModal.quoteId} client={emailModal.client} onClose={() => setEmailModal(null)} />
      )}
    </div>
  );
}

export default function Quotes() {
  return <ToastProvider><QuotesInner /></ToastProvider>;
}
