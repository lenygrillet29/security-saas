import { useEffect, useState } from 'react';
import { Plus, FileText, CheckCircle, Clock, AlertCircle, XCircle, Trash2, Edit2, ArrowRight, Download } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
import { invoicesApi, clientsApi, quotesApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';

const STATUS = {
  draft:     { label: 'Brouillon',  color: 'text-slate-400 bg-slate-400/10',   icon: FileText },
  sent:      { label: 'Envoyée',    color: 'text-blue-400 bg-blue-400/10',     icon: Clock },
  paid:      { label: 'Payée',      color: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle },
  overdue:   { label: 'En retard',  color: 'text-red-400 bg-red-400/10',       icon: AlertCircle },
  cancelled: { label: 'Annulée',    color: 'text-slate-500 bg-slate-500/10',   icon: XCircle },
};

function InvoiceForm({ invoice, clients, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    client_id:  invoice?.client_id || '',
    title:      invoice?.title || '',
    issue_date: invoice?.issue_date || new Date().toISOString().split('T')[0],
    due_date:   invoice?.due_date || '',
    tva_rate:   invoice?.tva_rate ?? 20,
    notes:      invoice?.notes || '',
  });
  const [lines, setLines] = useState(
    invoice?.lines || [{ description: '', quantity: 1, unit_price: 0, total: 0 }]
  );

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setLine = (i, k, v) => {
    const updated = lines.map((l, idx) => {
      if (idx !== i) return l;
      const nl = { ...l, [k]: v };
      if (k === 'quantity' || k === 'unit_price') nl.total = parseFloat(nl.quantity || 0) * parseFloat(nl.unit_price || 0);
      return nl;
    });
    setLines(updated);
  };
  const addLine = () => setLines(l => [...l, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));

  const totalHT  = lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
  const tva      = totalHT * (parseFloat(form.tva_rate) / 100);
  const totalTTC = totalHT + tva;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (invoice?.id) {
        await invoicesApi.update(invoice.id, { ...form, lines });
        toast('Facture modifiée');
      } else {
        await invoicesApi.create({ ...form, lines });
        toast('Facture créée');
      }
      onSave();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Client *</label>
          <select className="input" value={form.client_id} onChange={e => setF('client_id', e.target.value)} required>
            <option value="">Sélectionner...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Objet *</label>
          <input className="input" value={form.title} onChange={e => setF('title', e.target.value)} required placeholder="Ex : Prestations de sécurité — Juin 2026" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Date d'émission *</label>
          <input type="date" className="input" value={form.issue_date} onChange={e => setF('issue_date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Date d'échéance</label>
          <input type="date" className="input" value={form.due_date} onChange={e => setF('due_date', e.target.value)} />
        </div>
        <div>
          <label className="label">TVA (%)</label>
          <input type="number" className="input" value={form.tva_rate} onChange={e => setF('tva_rate', e.target.value)} />
        </div>
      </div>

      {/* Lignes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Lignes de facturation</label>
          <button type="button" onClick={addLine} className="text-xs text-blue-400 hover:text-blue-300">+ Ajouter une ligne</button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-1">
            <span className="col-span-5">Description</span>
            <span className="col-span-2 text-right">Qté</span>
            <span className="col-span-2 text-right">Prix unit.</span>
            <span className="col-span-2 text-right">Total</span>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className="input col-span-5 text-sm" value={l.description} onChange={e => setLine(i, 'description', e.target.value)} placeholder="Description..." />
              <input type="number" step="0.01" className="input col-span-2 text-sm text-right" value={l.quantity} onChange={e => setLine(i, 'quantity', e.target.value)} />
              <input type="number" step="0.01" className="input col-span-2 text-sm text-right" value={l.unit_price} onChange={e => setLine(i, 'unit_price', e.target.value)} />
              <div className="col-span-2 text-right text-sm text-white font-medium">{(parseFloat(l.total)||0).toFixed(2)} €</div>
              <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-slate-500 hover:text-red-400 text-center">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Totaux */}
      <div className="bg-dark-700 rounded-lg p-4 space-y-1.5">
        <div className="flex justify-between text-sm"><span className="text-slate-400">Total HT</span><span className="text-white">{totalHT.toFixed(2)} €</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-400">TVA ({form.tva_rate}%)</span><span className="text-white">{tva.toFixed(2)} €</span></div>
        <div className="flex justify-between font-bold border-t border-dark-500 pt-1.5 mt-1.5"><span className="text-white">Total TTC</span><span className="text-emerald-400 text-lg">{totalTTC.toFixed(2)} €</span></div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
      </div>

      <div className="flex justify-between items-center pt-2">
        {invoice?.id ? (
          <a
            href={`${API_BASE}/pdf/invoice/${invoice.id}?token=${localStorage.getItem('auth_token')}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Télécharger PDF
          </a>
        ) : <div />}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn-primary">{invoice?.id ? 'Modifier' : 'Créer'}</button>
        </div>
      </div>
    </form>
  );
}

function InvoicesInner() {
  const toast = useToast();
  const [invoices, setInvoices]   = useState([]);
  const [clients, setClients]     = useState([]);
  const [quotes, setQuotes]       = useState([]);
  const [modal, setModal]         = useState(null);
  const [deleteId, setDeleteId]   = useState(null);
  const [filter, setFilter]       = useState('all');
  const [converting, setConverting] = useState(null);

  const load = async () => {
    const [inv, cl, qu] = await Promise.all([invoicesApi.list(), clientsApi.list(), quotesApi.list({ status: 'accepted' })]);
    setInvoices(inv);
    setClients(cl);
    setQuotes(qu.filter ? qu.filter(q => !q.invoice_created) : qu);
  };

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    try { await invoicesApi.delete(id); toast('Facture supprimée'); await load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function handleStatusChange(inv, newStatus) {
    try {
      const body = { status: newStatus };
      if (newStatus === 'paid') body.payment_date = new Date().toISOString().split('T')[0];
      await invoicesApi.update(inv.id, body);
      toast(newStatus === 'paid' ? 'Facture marquée comme payée ✅' : 'Statut mis à jour');
      await load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleFromQuote(quoteId) {
    setConverting(quoteId);
    try {
      await invoicesApi.fromQuote(quoteId);
      toast('Facture créée depuis le devis ✅');
      await load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setConverting(null); }
  }

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const totalCA  = filtered.filter(i => i.status === 'paid').reduce((s, i) => s + (parseFloat(i.total_ht) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Facturation</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gérez vos factures et suivez les paiements</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ type: 'create' })}>
          <Plus className="w-4 h-4" /> Nouvelle facture
        </button>
      </div>

      {/* Convertir devis */}
      {quotes.length > 0 && (
        <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-300 mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> Devis acceptés à convertir en facture
          </p>
          <div className="flex flex-wrap gap-2">
            {quotes.slice(0, 5).map(q => (
              <button
                key={q.id}
                onClick={() => handleFromQuote(q.id)}
                disabled={converting === q.id}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/40 text-blue-300 text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                {converting === q.id ? '…' : `${q.quote_number || `#${q.id}`} — ${q.client_name}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtres + stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'].map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-dark-700 text-slate-400 hover:text-white'}`}
            >
              {f === 'all' ? 'Toutes' : STATUS[f]?.label || f}
              <span className="ml-1.5 text-xs opacity-60">
                {f === 'all' ? invoices.length : invoices.filter(i => i.status === f).length}
              </span>
            </button>
          ))}
        </div>
        {totalCA > 0 && (
          <div className="text-sm text-emerald-400 font-semibold">
            CA encaissé : {totalCA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT
          </div>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune facture</p>
          <button className="mt-4 btn-primary" onClick={() => setModal({ type: 'create' })}>Créer la première facture</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const st = STATUS[inv.status] || STATUS.draft;
            const StIcon = st.icon;
            const totalTTC = (parseFloat(inv.total_ht) || 0) * (1 + (parseFloat(inv.tva_rate) || 20) / 100);
            const isOverdue = inv.status === 'sent' && inv.due_date && new Date(inv.due_date) < new Date();
            return (
              <div key={inv.id} className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center shrink-0">
                  <StIcon className={`w-5 h-5 ${st.color.split(' ')[0]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{inv.invoice_number}</span>
                    <span className="text-slate-400 text-sm">— {inv.client_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${isOverdue ? 'text-red-400 bg-red-400/10' : st.color}`}>
                      {isOverdue ? 'En retard' : st.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {inv.title} · Émise le {new Date(inv.issue_date).toLocaleDateString('fr-FR')}
                    {inv.due_date && ` · Échéance ${new Date(inv.due_date).toLocaleDateString('fr-FR')}`}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-white font-bold">{totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                  <div className="text-xs text-slate-500">{(parseFloat(inv.total_ht)||0).toFixed(2)} € HT</div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`${API_BASE}/pdf/invoice/${inv.id}?token=${localStorage.getItem('auth_token')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                    title="Télécharger PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  {inv.status === 'draft' && (
                    <button onClick={() => handleStatusChange(inv, 'sent')}
                      className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/40 transition-colors">
                      Envoyer
                    </button>
                  )}
                  {(inv.status === 'sent' || isOverdue) && (
                    <button onClick={() => handleStatusChange(inv, 'paid')}
                      className="px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/40 transition-colors">
                      Payée ✓
                    </button>
                  )}
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button onClick={() => setModal({ type: 'edit', data: inv })}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {inv.status !== 'paid' && (
                    <button onClick={() => setDeleteId(inv.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.type === 'create' ? 'Nouvelle facture' : 'Modifier la facture'} onClose={() => setModal(null)}>
          <InvoiceForm invoice={modal.data} clients={clients} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleteId && (
        <Confirm message="Supprimer cette facture ?" onConfirm={() => { handleDelete(deleteId); setDeleteId(null); }} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}

export default function Invoices() {
  return <ToastProvider><InvoicesInner /></ToastProvider>;
}
