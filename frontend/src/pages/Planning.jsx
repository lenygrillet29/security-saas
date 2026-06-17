import { useEffect, useState, useCallback } from 'react';
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  eachDayOfInterval, isSameDay, parseISO, getDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Download, Mail, Trash2, Edit2, Send, Users, AlertTriangle, RefreshCw, X, ExternalLink, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { shiftsApi, agentsApi, sitesApi, clientsApi, absencesApi, pdfApi, emailApi, shiftOffersApi } from '../api';
import AgentQuickView from '../components/AgentQuickView';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function QuickClientModal({ onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const client = await clientsApi.create({ name });
      toast(`Client "${name}" créé`);
      onCreated(client);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title="Nouveau client" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nom du client *</label>
          <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Mairie de Lyon" required />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Création...' : 'Créer le client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function QuickSiteModal({ onClose, onCreated, defaultClientId }) {
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: '', client_id: defaultClientId || '', address: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.client_id) return;
    setSaving(true);
    try {
      const site = await sitesApi.create(form);
      toast(`Site "${form.name}" créé`);
      onCreated(site);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title="Nouveau site" onClose={onClose} size="sm">
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
          <input className="input" autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex : Siège social" required />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Ex : 12 rue de la Paix, Paris" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Création...' : 'Créer le site'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ShiftForm({ shift, agents, sites: initialSites, onSave, onClose }) {
  const toast = useToast();
  const [sites, setSites] = useState(initialSites);
  const [form, setForm] = useState({
    agent_id: shift?.agent_id || '',
    site_id: shift?.site_id || '',
    date: shift?.date || format(new Date(), 'yyyy-MM-dd'),
    start_time: shift?.start_time || '08:00',
    end_time: shift?.end_time || '20:00',
    notes: shift?.notes || '',
  });
  const [quickClient, setQuickClient] = useState(false);
  const [quickSite, setQuickSite] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, agent_id: form.agent_id || null };
    try {
      if (shift?.id) {
        await shiftsApi.update(shift.id, payload);
        toast('Shift modifié avec succès');
      } else {
        await shiftsApi.create(payload);
        toast('Shift créé avec succès');
      }
      onSave();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleClientCreated() {
    // Rafraîchir les sites après création d'un client
    const updated = await sitesApi.list().catch(() => sites);
    setSites(updated);
  }

  async function handleSiteCreated(newSite) {
    const updated = await sitesApi.list().catch(() => sites);
    setSites(updated);
    // Sélectionner automatiquement le nouveau site
    set('site_id', String(newSite.id));
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Agent <span className="text-slate-500 font-normal">(optionnel)</span></label>
            <select className="input" value={form.agent_id} onChange={e => set('agent_id', e.target.value)}>
              <option value="">— Poste non affecté —</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Site *</label>
            <div className="flex gap-2 mb-1.5">
              <button type="button" onClick={() => setQuickClient(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-blue-500/50 text-xs text-blue-400 hover:bg-blue-600/10 hover:border-blue-400 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nouveau client
              </button>
              <button type="button" onClick={() => setQuickSite(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-blue-500/50 text-xs text-blue-400 hover:bg-blue-600/10 hover:border-blue-400 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nouveau site
              </button>
            </div>
            <select className="input" value={form.site_id} onChange={e => set('site_id', e.target.value)} required>
              <option value="">Sélectionner...</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.client_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Heure début *</label>
            <input type="time" className="input" value={form.start_time} onChange={e => set('start_time', e.target.value)} required />
          </div>
          <div>
            <label className="label">Heure fin *</label>
            <input type="time" className="input" value={form.end_time} onChange={e => set('end_time', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn-primary">
            {shift?.id ? 'Modifier' : 'Créer le shift'}
          </button>
        </div>
      </form>

      {quickClient && (
        <QuickClientModal
          onClose={() => setQuickClient(false)}
          onCreated={handleClientCreated}
        />
      )}
      {quickSite && (
        <QuickSiteModal
          onClose={() => setQuickSite(false)}
          onCreated={handleSiteCreated}
        />
      )}
    </>
  );
}

// ——— Modal d'envoi d'offre de vacation ———
function SendOfferModal({ shift, agents, onClose, onSent }) {
  const toast = useToast();
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const [offers, setOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(true);

  useEffect(() => {
    shiftOffersApi.list({ shift_id: shift.id })
      .then(setOffers)
      .catch(() => {})
      .finally(() => setLoadingOffers(false));
  }, [shift.id]);

  const offerAgentIds = new Set(offers.map(o => o.agent_id));
  const pendingCount  = offers.filter(o => o.status === 'pending').length;
  const acceptedOffer = offers.find(o => o.status === 'accepted');

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSend() {
    if (!selected.length) return toast('Sélectionnez au moins un agent', 'error');
    setSending(true);
    try {
      const res = await shiftOffersApi.send({ shift_id: shift.id, agent_ids: selected });
      const sent = res.results.filter(r => r.status === 'sent').length;
      const noEmail = res.results.filter(r => r.status === 'no_email').length;
      toast(`${sent} demande${sent > 1 ? 's' : ''} envoyée${sent > 1 ? 's' : ''}${noEmail ? ` (${noEmail} sans email)` : ''}`);
      setSelected([]);
      const updated = await shiftOffersApi.list({ shift_id: shift.id });
      setOffers(updated);
      onSent?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSending(false); }
  }

  async function handleCancel(offerId) {
    try {
      await shiftOffersApi.cancel(offerId);
      setOffers(prev => prev.filter(o => o.id !== offerId));
    } catch (err) { toast(err.message, 'error'); }
  }

  const STATUS_LABEL = { pending: 'En attente', accepted: 'Accepté', declined: 'Décliné', auto_declined: 'Annulé' };
  const STATUS_COLOR = { pending: 'text-amber-400', accepted: 'text-emerald-400', declined: 'text-red-400', auto_declined: 'text-slate-500' };

  return (
    <Modal title="Envoyer une demande" onClose={onClose} size="md">
      <div className="space-y-4">
        {/* Info shift */}
        <div className="bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-sm">
          <span className="text-slate-400">{shift.site_name}</span>
          <span className="text-slate-500 mx-2">·</span>
          <span className="text-white font-medium">{shift.date}</span>
          <span className="text-slate-500 mx-2">·</span>
          <span className="text-slate-300">{shift.start_time}–{shift.end_time}</span>
        </div>

        {/* Historique des offres */}
        {!loadingOffers && offers.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Demandes envoyées</p>
            <div className="space-y-1.5">
              {offers.map(o => (
                <div key={o.id} className="flex items-center justify-between bg-dark-700 border border-dark-500 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: o.color || '#3B82F6' }}>
                      {o.first_name?.[0]}{o.last_name?.[0]}
                    </div>
                    <span className="text-sm text-white">{o.first_name} {o.last_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${STATUS_COLOR[o.status] || 'text-slate-400'}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                    {o.status === 'pending' && (
                      <button onClick={() => handleCancel(o.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sélection agents */}
        {!acceptedOffer && (
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Envoyer à</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {agents.filter(a => a.email && !offerAgentIds.has(a.id)).map(a => (
                <button key={a.id} onClick={() => toggle(a.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                    selected.includes(a.id)
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-dark-700 border-dark-500 text-slate-300 hover:border-dark-400'
                  }`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: a.color || '#3B82F6' }}>
                    {a.first_name[0]}{a.last_name[0]}
                  </div>
                  <span className="text-sm flex-1">{a.first_name} {a.last_name}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    selected.includes(a.id) ? 'bg-blue-600 border-blue-500' : 'border-dark-400'
                  }`}>
                    {selected.includes(a.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                </button>
              ))}
              {agents.filter(a => a.email && !offerAgentIds.has(a.id)).length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3">
                  {offerAgentIds.size > 0 ? 'Tous les agents ont déjà été contactés.' : 'Aucun agent avec email disponible.'}
                </p>
              )}
            </div>
          </div>
        )}

        {acceptedOffer && (
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 text-sm text-emerald-300 text-center">
            ✅ {acceptedOffer.first_name} {acceptedOffer.last_name} a accepté cette vacation.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
          {!acceptedOffer && selected.length > 0 && (
            <button className="btn-primary" onClick={handleSend} disabled={sending}>
              <Send className="w-4 h-4" />
              {sending ? 'Envoi...' : `Envoyer (${selected.length})`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ExportModal({ onClose, agents, sites }) {
  const toast = useToast();
  const [type, setType] = useState('agent');
  const [selectedId, setSelectedId] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  async function handleExport() {
    if (!selectedId) return toast('Veuillez sélectionner un élément', 'error');
    const params = { start_date: startDate, end_date: endDate };
    if (!sendEmail) {
      if (type === 'agent') pdfApi.agentPlanning(selectedId, params);
      else if (type === 'site') pdfApi.sitePlanning(selectedId, params);
      onClose();
    } else {
      try {
        await emailApi.sendAgentPlanning(selectedId, { ...params, to: emailTo });
        toast('Email envoyé avec succès');
        onClose();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  }

  const [bulkSending, setBulkSending] = useState(false);

  async function handleBulkEmail() {
    setBulkSending(true);
    try {
      const res = await emailApi.sendBulkPlanning({ start_date: startDate, end_date: endDate });
      toast(`Plannings envoyés : ${res.sent} succès, ${res.failed} échec(s)`);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setBulkSending(false); }
  }

  return (
    <Modal title="Export / Envoi Planning" onClose={onClose} size="md">
      <div className="space-y-4">
        {/* Bulk email banner */}
        <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">Envoi groupé</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Envoie automatiquement le planning par email à <strong className="text-white">tous les agents actifs</strong> ayant une adresse email.</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Date début</label>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Date fin</label>
              <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={handleBulkEmail} disabled={bulkSending}>
            <Send className="w-4 h-4" />
            {bulkSending ? 'Envoi en cours...' : 'Envoyer à tous les agents'}
          </button>
        </div>

        <div className="border-t border-dark-600 pt-4">
          <p className="text-xs text-slate-500 mb-3">Ou exporter / envoyer un planning individuel :</p>
          <div>
            <label className="label">Type d'export</label>
            <div className="flex gap-2">
              {['agent', 'site', 'client'].map(t => (
                <button key={t} onClick={() => { setType(t); setSelectedId(''); }}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize border transition-colors ${
                    type === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-dark-700 border-dark-500 text-slate-300'
                  }`}>
                  {t === 'agent' ? 'Agent' : t === 'site' ? 'Site' : 'Client'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <label className="label">{type === 'agent' ? 'Agent' : type === 'site' ? 'Site' : 'Client'}</label>
            <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Sélectionner...</option>
              {type === 'agent' && agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
              {type === 'site' && sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input type="checkbox" id="sendEmail" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
              className="w-4 h-4 rounded border-dark-500 bg-dark-700 accent-blue-500" />
            <label htmlFor="sendEmail" className="text-sm text-slate-300 cursor-pointer">Envoyer par email</label>
          </div>
          {sendEmail && (
            <div className="mt-3">
              <label className="label">Email destinataire</label>
              <input type="email" className="input" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="agent@email.com" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
          <button className="btn-primary" onClick={handleExport}>
            {sendEmail ? <><Mail className="w-4 h-4" /> Envoyer</> : <><Download className="w-4 h-4" /> Exporter PDF</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ——— Replacement Modal ———
function ReplacementModal({ shift, onClose, onReplaced, toast }) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState([]);
  const [replacing, setReplacing] = useState(null);
  const isUnassigned = !shift.agent_name;

  useEffect(() => {
    shiftsApi.replacements(shift.id)
      .then(data => { setAvailable(data.available || []); setLoading(false); })
      .catch(err => { toast(err.message, 'error'); onClose(); });
  }, [shift.id]);

  async function handleReplace(agent) {
    setReplacing(agent.id);
    try {
      await shiftsApi.update(shift.id, {
        agent_id: agent.id,
        site_id: shift.site_id,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        notes: shift.notes || '',
      });
      toast(`Shift ${isUnassigned ? 'affecté' : 'réaffecté'} à ${agent.first_name} ${agent.last_name}`);
      onReplaced();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setReplacing(null);
    }
  }

  return (
    <Modal title={isUnassigned ? 'Affecter un agent' : 'Proposer un remplaçant'} onClose={onClose} size="sm">
      <div className="space-y-3">
        <div className={`border rounded-lg p-3 text-sm ${isUnassigned ? 'bg-blue-600/10 border-blue-600/30 text-blue-300' : 'bg-amber-600/10 border-amber-600/30 text-amber-300'}`}>
          <div className="font-medium mb-1">{isUnassigned ? 'Poste à pourvoir' : 'Shift concerné'}</div>
          <div className="text-xs text-slate-400">
            {shift.agent_name ? `${shift.agent_name} — ` : ''}{shift.site_name}<br/>
            {shift.date} · {shift.start_time}–{shift.end_time}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-400 text-sm">Recherche des agents disponibles...</div>
        ) : available.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Aucun agent disponible sur ce créneau.
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-400 mb-2">{available.length} agent{available.length > 1 ? 's' : ''} disponible{available.length > 1 ? 's' : ''} — cliquez pour {isUnassigned ? 'affecter' : 'réaffecter'} :</p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {available.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleReplace(agent)}
                  disabled={replacing === agent.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-dark-700 hover:bg-blue-600/20 border border-dark-500 hover:border-blue-500/50 transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: agent.color || '#3B82F6' }}>
                    {agent.first_name[0]}{agent.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-blue-300">
                      {agent.first_name} {agent.last_name}
                    </div>
                    {agent.contract_type && (
                      <div className="text-xs text-slate-500">{agent.contract_type}</div>
                    )}
                  </div>
                  {replacing === agent.id ? (
                    <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Affecter →</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </Modal>
  );
}

// ——— Weekly View ———
function WeeklyView({ days, shifts, absences, agents, onAddShift, onEditShift, onDeleteShift, onOpenAgent, onReplaceShift, onSendOffer, offers = [] }) {
  const getShiftsForDay = (day, agentId) =>
    shifts.filter(s => isSameDay(parseISO(s.date), day) && String(s.agent_id) === String(agentId));

  const getUnassignedForDay = (day) =>
    shifts.filter(s => isSameDay(parseISO(s.date), day) && !s.agent_id);

  // Statut d'offre le plus récent pour un shift donné
  const getOfferStatus = (shiftId) => {
    const shiftOffers = offers.filter(o => o.shift_id === shiftId);
    if (!shiftOffers.length) return null;
    if (shiftOffers.some(o => o.status === 'accepted')) return 'accepted';
    if (shiftOffers.some(o => o.status === 'pending')) return 'pending';
    if (shiftOffers.every(o => o.status === 'declined' || o.status === 'auto_declined')) return 'declined';
    return null;
  };

  const OFFER_BADGE = {
    pending:  { label: 'En attente', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    accepted: { label: 'Accepté', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    declined: { label: 'Décliné', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  };

  const getAbsencesForDay = (day, agentId) =>
    absences.filter(a => {
      const start = parseISO(a.start_date);
      const end = parseISO(a.end_date);
      return a.agent_id === agentId && day >= start && day <= end;
    });

  const ABSENCE_LABELS = { conge: 'Congé', maladie: 'Maladie', autre: 'Absence' };
  const ABSENCE_COLORS = { conge: 'bg-emerald-600/30 text-emerald-300 border-emerald-600/40', maladie: 'bg-red-600/30 text-red-300 border-red-600/40', autre: 'bg-slate-600/30 text-slate-300 border-slate-600/40' };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-36 text-left px-3 py-3 text-xs text-slate-400 font-medium border-b border-dark-600">Agent</th>
            {days.map(day => {
              const isSun = getDay(day) === 0;
              const isSat = getDay(day) === 6;
              return (
                <th key={day.toISOString()} className={`px-2 py-3 text-center border-b border-dark-600 min-w-[100px] ${
                  isSun ? 'bg-amber-900/10' : isSat ? 'bg-dark-700/30' : ''
                }`}>
                  <div className={`text-xs font-medium ${isSun ? 'text-amber-400' : 'text-slate-300'}`}>
                    {format(day, 'EEE', { locale: fr })}
                  </div>
                  <div className={`text-sm font-bold ${isSun ? 'text-amber-300' : 'text-white'}`}>
                    {format(day, 'd')}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, idx) => (
            <tr key={agent.id} className={idx % 2 === 0 ? 'bg-dark-800/30' : ''}>
              <td
                className="px-3 py-2 border-b border-dark-600/50 cursor-pointer select-none group"
                title="Double-clic pour ouvrir la fiche"
                onDoubleClick={() => onOpenAgent?.(agent)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agent.color || '#3B82F6' }} />
                  <span className="text-xs text-slate-300 font-medium truncate group-hover:text-white">
                    {agent.first_name} {agent.last_name}
                  </span>
                </div>
              </td>
              {days.map(day => {
                const isSun = getDay(day) === 0;
                const dayShifts = getShiftsForDay(day, agent.id);
                const dayAbsences = getAbsencesForDay(day, agent.id);
                const conflict = dayAbsences.length > 0 && dayShifts.length > 0;
                return (
                  <td key={day.toISOString()} className={`px-1 py-1.5 border-b border-dark-600/50 align-top ${
                    isSun ? 'bg-amber-900/5' : ''
                  } ${conflict ? 'bg-red-900/10' : ''}`}>
                    <div className="space-y-0.5 min-h-[32px]">
                      {dayAbsences.map(ab => (
                        <div key={ab.id} className={`shift-chip border ${ABSENCE_COLORS[ab.type] || ABSENCE_COLORS.autre}`}>
                          {ABSENCE_LABELS[ab.type] || 'Absence'}
                        </div>
                      ))}
                      {dayShifts.map(shift => {
                        const shiftConflict = dayAbsences.length > 0;
                        return (
                          <div
                            key={shift.id}
                            className={`shift-chip border flex items-center justify-between group ${
                              shiftConflict
                                ? 'border-amber-500/50 bg-amber-900/30 text-amber-300'
                                : 'border-white/10'
                            }`}
                            style={shiftConflict ? {} : { backgroundColor: (agent.color || '#3B82F6') + '33', color: agent.color || '#3B82F6' }}
                          >
                            <span className="flex items-center gap-1">
                              {shiftConflict && (
                                <button
                                  title="Agent absent — cliquer pour trouver un remplaçant"
                                  onClick={() => onReplaceShift?.({ ...shift, agent_name: `${agent.first_name} ${agent.last_name}` })}
                                  className="text-amber-400 hover:text-amber-300 transition-colors"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                </button>
                              )}
                              {shift.start_time}–{shift.end_time}
                            </span>
                            <div className="hidden group-hover:flex gap-0.5 ml-1">
                              <button onClick={() => onEditShift(shift)} className="hover:text-white p-0.5 rounded">
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                              <button onClick={() => onDeleteShift(shift.id)} className="hover:text-red-400 p-0.5 rounded">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => onAddShift(agent.id, day)}
                        className="w-full text-left px-1 py-0.5 rounded text-xs text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}

          {/* ——— Ligne "Postes à pourvoir" (shifts sans agent) ——— */}
          {(() => {
            const hasUnassigned = days.some(day => getUnassignedForDay(day).length > 0);
            if (!hasUnassigned) return null;
            return (
              <tr className="bg-slate-800/40 border-t-2 border-slate-600/50">
                <td className="px-3 py-2 border-b border-dark-600/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0 bg-slate-500" />
                    <span className="text-xs text-slate-400 font-medium italic">Postes à pourvoir</span>
                  </div>
                </td>
                {days.map(day => {
                  const isSun = getDay(day) === 0;
                  const dayShifts = getUnassignedForDay(day);
                  return (
                    <td key={day.toISOString()} className={`px-1 py-1.5 border-b border-dark-600/50 align-top ${isSun ? 'bg-amber-900/5' : ''}`}>
                      <div className="space-y-0.5 min-h-[32px]">
                        {dayShifts.map(shift => {
                          const offerStatus = getOfferStatus(shift.id);
                          const badge = offerStatus ? OFFER_BADGE[offerStatus] : null;
                          return (
                            <div key={shift.id} className="space-y-0.5">
                              <div className="shift-chip border border-slate-500/40 bg-slate-700/40 text-slate-300 flex items-center justify-between group">
                                <span className="flex items-center gap-1">
                                  <button title="Affecter un agent disponible"
                                    onClick={() => onReplaceShift?.({ ...shift, agent_name: null })}
                                    className="text-slate-400 hover:text-blue-400 transition-colors">
                                    <Users className="w-2.5 h-2.5" />
                                  </button>
                                  {shift.start_time}–{shift.end_time}
                                </span>
                                <div className="hidden group-hover:flex gap-0.5 ml-1">
                                  <button title="Envoyer une demande"
                                    onClick={() => onSendOffer?.({ ...shift })}
                                    className="hover:text-blue-400 p-0.5 rounded">
                                    <Send className="w-2.5 h-2.5" />
                                  </button>
                                  <button onClick={() => onEditShift(shift)} className="hover:text-white p-0.5 rounded">
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                  <button onClick={() => onDeleteShift(shift.id)} className="hover:text-red-400 p-0.5 rounded">
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                              {badge && (
                                <div className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${badge.cls}`}>
                                  {badge.label}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => onAddShift(null, day)}
                          className="w-full text-left px-1 py-0.5 rounded text-xs text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

// ——— Monthly View ———
function MonthlyView({ currentDate, shifts, absences, agents, onAddShift, onEditShift, onDeleteShift }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const getShiftsForDay = (day) => shifts.filter(s => isSameDay(parseISO(s.date), day));
  const getAbsencesForDay = (day) => absences.filter(a => {
    return day >= parseISO(a.start_date) && day <= parseISO(a.end_date);
  });

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map(day => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isSun = getDay(day) === 0;
              const isSat = getDay(day) === 6;
              const dayShifts = getShiftsForDay(day);
              const dayAbsences = getAbsencesForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[90px] rounded-lg border p-1.5 ${
                    !isCurrentMonth ? 'bg-dark-900/50 border-dark-700/30' :
                    isSun ? 'bg-amber-900/10 border-amber-800/20' :
                    'bg-dark-800 border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isToday ? 'bg-blue-600 text-white' :
                      isSun ? 'text-amber-400' :
                      isCurrentMonth ? 'text-slate-300' : 'text-slate-600'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    <button
                      onClick={() => onAddShift(null, day)}
                      className="text-slate-600 hover:text-blue-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {dayAbsences.slice(0, 2).map(ab => {
                      const a = agentMap[ab.agent_id];
                      return (
                        <div key={ab.id} className="shift-chip bg-red-600/20 text-red-300 border border-red-600/30">
                          {a ? `${a.first_name[0]}. ${a.last_name}` : '?'} — Abs.
                        </div>
                      );
                    })}
                    {dayShifts.slice(0, 3).map(shift => {
                      const a = shift.agent_id ? agentMap[shift.agent_id] : null;
                      const unassigned = !shift.agent_id;
                      return (
                        <div
                          key={shift.id}
                          className={`shift-chip group flex items-center justify-between ${
                            unassigned
                              ? 'border border-slate-500/40 bg-slate-700/40 text-slate-400 italic'
                              : 'border border-white/10'
                          }`}
                          style={unassigned ? {} : {
                            backgroundColor: (a?.color || '#3B82F6') + '33',
                            color: a?.color || '#3B82F6'
                          }}
                          onClick={() => onEditShift(shift)}
                        >
                          <span className="truncate">
                            {unassigned ? `À pourvoir` : a ? `${a.first_name[0]}. ${a.last_name}` : shift.agent_first_name ? `${shift.agent_first_name[0]}. ${shift.agent_last_name}` : '?'}
                          </span>
                          <span className="ml-1 opacity-70 shrink-0">{shift.start_time}</span>
                        </div>
                      );
                    })}
                    {dayShifts.length > 3 && (
                      <div className="text-xs text-slate-500 px-1">+{dayShifts.length - 3} autres</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ——— Modal copie de jour ———
function CopyDayModal({ defaultFrom, onClose, onCopied }) {
  const toast = useToast();
  const [fromDate, setFromDate] = useState(defaultFrom || format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate]     = useState('');
  const [copyAgents, setCopyAgents] = useState(true);
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!fromDate) { setPreview(null); return; }
    setLoading(true);
    shiftsApi.list({ start_date: fromDate, end_date: fromDate })
      .then(shifts => setPreview(shifts))
      .catch(() => setPreview([]))
      .finally(() => setLoading(false));
  }, [fromDate]);

  async function handleCopy() {
    if (!toDate) return toast('Sélectionnez une date cible', 'error');
    setSaving(true);
    try {
      const res = await shiftsApi.copyDay(fromDate, toDate, copyAgents);
      toast(`${res.created} vacation${res.created > 1 ? 's' : ''} copiée${res.created > 1 ? 's' : ''} ✅`);
      onCopied();
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Copier le planning d'un jour" onClose={onClose} size="md">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Jour source</label>
            <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Jour cible</label>
            <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)}
              min={fromDate !== toDate ? undefined : undefined} />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setCopyAgents(v => !v)}
            className={`w-10 h-6 rounded-full transition-colors relative ${copyAgents ? 'bg-blue-600' : 'bg-dark-500'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${copyAgents ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-slate-300">Copier aussi les agents assignés</span>
        </label>

        {/* Aperçu */}
        <div className="bg-dark-900 rounded-xl border border-dark-600 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-dark-600 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Aperçu — {fromDate ? format(parseISO(fromDate), 'd MMMM yyyy', { locale: fr }) : '—'}
            </span>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
          </div>
          {!preview || loading ? (
            <div className="px-4 py-6 text-center text-slate-500 text-sm">Chargement…</div>
          ) : preview.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-500 text-sm">Aucune vacation ce jour-là</div>
          ) : (
            <div className="divide-y divide-dark-700">
              {preview.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  {copyAgents && s.agent_color ? (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.agent_color }} />
                  ) : (
                    <span className="w-2 h-2 rounded-full shrink-0 bg-slate-600" />
                  )}
                  <span className="text-sm text-white flex-1">
                    {copyAgents && s.agent_first_name ? `${s.agent_first_name} ${s.agent_last_name} — ` : ''}{s.site_name}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</span>
                </div>
              ))}
            </div>
          )}
          {preview?.length > 0 && (
            <div className="px-4 py-2 border-t border-dark-600 text-xs text-slate-500">
              {preview.length} vacation{preview.length > 1 ? 's' : ''} seront copiées vers le {toDate ? format(parseISO(toDate), 'd MMMM yyyy', { locale: fr }) : '…'}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button
            onClick={handleCopy}
            disabled={saving || !toDate || !preview?.length}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Copier {preview?.length > 0 ? `(${preview.length})` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ——— Main Planning ———
function PlanningInner() {
  const toast = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState('week'); // 'week' | 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [agents, setAgents] = useState([]);
  const [sites, setSites] = useState([]);
  const [shiftModal, setShiftModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [exportModal, setExportModal] = useState(false);
  const [replacementShift, setReplacementShift] = useState(null);
  const [offerShift, setOfferShift] = useState(null); // shift pour lequel envoyer des offres
  const [offers, setOffers] = useState([]); // toutes les offres de la période
  const [loading, setLoading] = useState(false);
  const [copyModal, setCopyModal] = useState(null); // { fromDate }
  const [quickViewId, setQuickViewId] = useState(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const rangeStart = view === 'week' ? weekStart : monthStart;
  const rangeEnd = view === 'week' ? weekEnd : monthEnd;

  const days = view === 'week'
    ? eachDayOfInterval({ start: weekStart, end: weekEnd })
    : [];

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = {
      start_date: format(rangeStart, 'yyyy-MM-dd'),
      end_date: format(rangeEnd, 'yyyy-MM-dd'),
    };
    const [s, ab, ag, si, of] = await Promise.all([
      shiftsApi.list(params),
      absencesApi.list(params),
      agentsApi.list(true),
      sitesApi.list(),
      shiftOffersApi.list().catch(() => []),
    ]);
    setShifts(s);
    setAbsences(ab);
    setAgents(ag);
    setSites(si);
    setOffers(of);
    setLoading(false);
  }, [format(rangeStart, 'yyyy-MM-dd'), format(rangeEnd, 'yyyy-MM-dd')]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function prev() {
    setCurrentDate(d => view === 'week' ? subWeeks(d, 1) : subMonths(d, 1));
  }
  function next() {
    setCurrentDate(d => view === 'week' ? addWeeks(d, 1) : addMonths(d, 1));
  }

  function openAdd(agentId, day) {
    setShiftModal({
      shift: {
        agent_id: agentId || '',
        date: format(day, 'yyyy-MM-dd'),
        start_time: '08:00',
        end_time: '20:00',
      }
    });
  }

  function openEdit(shift) {
    setShiftModal({ shift });
  }

  async function handleDelete() {
    try {
      await shiftsApi.delete(deleteId);
      toast('Shift supprimé');
      fetchData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const title = view === 'week'
    ? `Semaine du ${format(weekStart, 'd MMM', { locale: fr })} au ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`
    : format(currentDate, 'MMMM yyyy', { locale: fr });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Planning</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setExportModal(true)}>
            <Download className="w-4 h-4" /> Export PDF
          </button>
          <button className="btn-secondary" onClick={() => setCopyModal({ fromDate: format(view === 'week' ? weekStart : currentDate, 'yyyy-MM-dd') })}>
            <Copy className="w-4 h-4" /> Copier un jour
          </button>
          <button className="btn-primary" onClick={() => setShiftModal({ shift: {} })}>
            <Plus className="w-4 h-4" /> Nouveau shift
          </button>
        </div>
      </div>

      <div className="card p-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button className="btn-secondary p-2" onClick={prev}><ChevronLeft className="w-4 h-4" /></button>
            <button className="btn-secondary text-sm px-3 py-2" onClick={() => setCurrentDate(new Date())}>
              Aujourd'hui
            </button>
            <button className="btn-secondary p-2" onClick={next}><ChevronRight className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-white ml-2 capitalize">{title}</span>
          </div>
          <div className="flex gap-1 bg-dark-700 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'week' ? 'bg-dark-500 text-white' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setView('week')}
            >
              Semaine
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'month' ? 'bg-dark-500 text-white' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setView('month')}
            >
              Mois
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"/>Jour (06h–21h)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500"/>Nuit (21h–06h)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"/>Dimanche</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"/>Absence</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Chargement...</div>
        ) : view === 'week' ? (
          <WeeklyView
            days={days}
            shifts={shifts}
            absences={absences}
            agents={agents}
            onAddShift={openAdd}
            onEditShift={openEdit}
            onDeleteShift={setDeleteId}
            onOpenAgent={agent => setQuickViewId(agent.id)}
            onReplaceShift={setReplacementShift}
            onSendOffer={setOfferShift}
            offers={offers}
          />
        ) : (
          <MonthlyView
            currentDate={currentDate}
            shifts={shifts}
            absences={absences}
            agents={agents}
            onAddShift={openAdd}
            onEditShift={openEdit}
            onDeleteShift={setDeleteId}
          />
        )}
      </div>

      {shiftModal && (
        <Modal title={shiftModal.shift?.id ? 'Modifier le shift' : 'Nouveau shift'} onClose={() => setShiftModal(null)}>
          <ShiftForm
            shift={shiftModal.shift}
            agents={agents}
            sites={sites}
            onSave={() => { setShiftModal(null); fetchData(); }}
            onClose={() => setShiftModal(null)}
          />
        </Modal>
      )}

      {deleteId && (
        <Confirm
          title="Supprimer le shift"
          message="Êtes-vous sûr de vouloir supprimer ce shift ?"
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
        />
      )}

      {exportModal && (
        <ExportModal
          onClose={() => setExportModal(false)}
          agents={agents}
          sites={sites}
        />
      )}

      {replacementShift && (
        <ReplacementModal
          shift={replacementShift}
          onClose={() => setReplacementShift(null)}
          onReplaced={fetchData}
          toast={toast}
        />
      )}

      {offerShift && (
        <SendOfferModal
          shift={offerShift}
          agents={agents}
          onClose={() => setOfferShift(null)}
          onSent={fetchData}
        />
      )}
      {copyModal && (
        <CopyDayModal
          defaultFrom={copyModal.fromDate}
          onClose={() => setCopyModal(null)}
          onCopied={fetchData}
        />
      )}
      {quickViewId && <AgentQuickView agentId={quickViewId} onClose={() => setQuickViewId(null)} />}
    </div>
  );
}

export default function Planning() {
  return (
    <ToastProvider>
      <PlanningInner />
    </ToastProvider>
  );
}
