import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calculator, Lock, Check, Plus, Trash2, FileText,
  Sun, Moon, Star, Euro, TrendingUp, Download, Zap,
} from 'lucide-react';
import { addonsApi, settingsApi, quotesApi, clientsApi, sitesApi } from '../api';
import { ToastProvider, useToast } from '../components/Toast';

// ─── Gate / Page d'upsell ─────────────────────────────────────────────────────
function UpsellGate({ onActivated }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const { url } = await addonsApi.checkout('chiffrage');
      window.location.href = url;
    } catch (err) {
      toast(err.message, 'error');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Calculator className="w-5 h-5 text-violet-400" />
          Outil de chiffrage
        </h1>
      </div>

      <div className="card p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-violet-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Option payante — +49 €/mois</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
          Calculez précisément vos appels d'offres, simulez vos marges et générez vos devis complexes en quelques secondes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 text-left">
          {[
            { icon: Calculator, label: 'Simulation multi-postes', desc: 'Jour, nuit, dimanche, jours fériés' },
            { icon: TrendingUp, label: 'Calcul de marge en temps réel', desc: 'CA, coûts, marge brute' },
            { icon: FileText, label: 'Génération devis en 1 clic', desc: 'Depuis votre chiffrage directement' },
            { icon: Download, label: 'Export PDF détaillé', desc: 'Chiffrage complet pour l\'appel d\'offres' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 bg-dark-700 rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-dark-700 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-semibold">Outil de chiffrage</span>
            <span className="text-2xl font-bold text-violet-400">49 €<span className="text-sm font-normal text-slate-400">/mois</span></span>
          </div>
          <p className="text-xs text-slate-400">Résiliable à tout moment. S'ajoute à votre abonnement SecuroPlan.</p>
        </div>

        <button
          className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 transition-all flex items-center justify-center gap-2"
          onClick={handleCheckout}
          disabled={loading}
        >
          <Zap className="w-4 h-4" />
          {loading ? 'Redirection...' : 'Activer l\'outil de chiffrage'}
        </button>
        <p className="text-xs text-slate-500 mt-3">Paiement sécurisé via Stripe. Sans engagement minimum.</p>
      </div>
    </div>
  );
}

// ─── Outil de chiffrage ───────────────────────────────────────────────────────
const JOURS = { jour: 'Jour (06h–21h)', nuit: 'Nuit (21h–06h)', dimanche: 'Dimanche' };

const newPoste = (id) => ({
  id,
  nom: `Poste ${id}`,
  type: 'jour',
  nbAgents: 1,
  heuresParJour: 12,
  nbJoursSemaine: 5,
  nbSemaines: 4,
  tauxClient: 0,
  tauxAgent: 0,
});

function ChiffrageInner() {
  const toast = useToast();
  const [searchParams] = useSearchParams();

  // addon status
  const [addonActive, setAddonActive]   = useState(null); // null = chargement
  const [checkingAddon, setCheckingAddon] = useState(true);

  // settings par défaut
  const [defaults, setDefaults] = useState({ day: 18, night: 22, sunday: 25, tva: 20, agentDay: 13, agentNight: 16, agentSun: 18 });

  // form chiffrage
  const [title, setTitle]     = useState('Chiffrage sans titre');
  const [postes, setPostes]   = useState([newPoste(1)]);
  const [nextId, setNextId]   = useState(2);
  const [tvaRate, setTvaRate] = useState(20);
  const [marginTarget, setMarginTarget] = useState(30);

  // données pour créer devis
  const [clients, setClients] = useState([]);
  const [sites, setSites]     = useState([]);
  const [quoteModal, setQuoteModal] = useState(false);
  const [quoteClientId, setQuoteClientId] = useState('');
  const [quoteSiteId, setQuoteSiteId] = useState('');

  useEffect(() => {
    // Vérifie si l'add-on est actif
    addonsApi.list()
      .then(({ active }) => { setAddonActive(active.includes('chiffrage')); })
      .catch(() => setAddonActive(false))
      .finally(() => setCheckingAddon(false));

    // Charge les paramètres par défaut
    settingsApi.get().then(s => {
      setDefaults({
        day:      parseFloat(s.hourly_rate_day)    || 18,
        night:    parseFloat(s.hourly_rate_night)  || 22,
        sunday:   parseFloat(s.hourly_rate_sunday) || 25,
        tva:      parseFloat(s.tva_rate)           || 20,
        agentDay:   13,
        agentNight: 16,
        agentSun:   18,
      });
      setTvaRate(parseFloat(s.tva_rate) || 20);
    }).catch(() => {});

    clientsApi.list().then(setClients).catch(() => {});
    sitesApi.list().then(setSites).catch(() => {});
  }, []);

  // Pré-remplissage depuis les params URL (retour Stripe)
  useEffect(() => {
    if (searchParams.get('addon_success') === '1') {
      toast('✅ Outil de chiffrage activé ! Bienvenue.', 'success');
      // Recheck addon status
      addonsApi.list()
        .then(({ active }) => setAddonActive(active.includes('chiffrage')))
        .catch(() => {});
    }
  }, []);

  if (checkingAddon) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        Vérification...
      </div>
    );
  }

  if (!addonActive) return <UpsellGate />;

  // ── Logique calcul ────────────────────────────────────────────────────────
  function calcPoste(p) {
    const hTotal     = p.heuresParJour * p.nbJoursSemaine * p.nbSemaines;
    const revenue    = hTotal * p.nbAgents * p.tauxClient;
    const cout       = hTotal * p.nbAgents * p.tauxAgent;
    const marge      = revenue - cout;
    const margePct   = revenue > 0 ? (marge / revenue * 100) : 0;
    return { hTotal, revenue, cout, marge, margePct };
  }

  const totaux = postes.reduce((acc, p) => {
    const c = calcPoste(p);
    return {
      revenue: acc.revenue + c.revenue,
      cout:    acc.cout    + c.cout,
      marge:   acc.marge   + c.marge,
    };
  }, { revenue: 0, cout: 0, marge: 0 });

  const totalTTC    = totaux.revenue * (1 + tvaRate / 100);
  const margePctTot = totaux.revenue > 0 ? (totaux.marge / totaux.revenue * 100) : 0;
  const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

  function setPoste(id, key, val) {
    setPostes(ps => ps.map(p => p.id === id ? { ...p, [key]: val } : p));
  }

  function applyDefaults() {
    setPostes(ps => ps.map(p => ({
      ...p,
      tauxClient: p.type === 'dimanche' ? defaults.sunday : p.type === 'nuit' ? defaults.night : defaults.day,
      tauxAgent:  p.type === 'dimanche' ? defaults.agentSun : p.type === 'nuit' ? defaults.agentNight : defaults.agentDay,
    })));
  }

  async function createQuote() {
    if (!quoteClientId) { toast('Sélectionnez un client', 'error'); return; }
    try {
      const lines = postes.map(p => {
        const c = calcPoste(p);
        return {
          description: `${p.nom} — ${JOURS[p.type]} — ${p.nbAgents} agent(s) × ${p.heuresParJour}h × ${p.nbJoursSemaine}j/sem × ${p.nbSemaines} sem.`,
          hours_day:    p.type === 'jour'     ? c.hTotal * p.nbAgents : 0,
          hours_night:  p.type === 'nuit'     ? c.hTotal * p.nbAgents : 0,
          hours_sunday: p.type === 'dimanche' ? c.hTotal * p.nbAgents : 0,
          rate_day:     p.type === 'jour'     ? p.tauxClient : 0,
          rate_night:   p.type === 'nuit'     ? p.tauxClient : 0,
          rate_sunday:  p.type === 'dimanche' ? p.tauxClient : 0,
          total: c.revenue,
        };
      });

      await quotesApi.create({
        client_id: parseInt(quoteClientId),
        site_id:   quoteSiteId ? parseInt(quoteSiteId) : null,
        title,
        tva_rate:  tvaRate,
        total_ht:  totaux.revenue,
        lines,
      });

      toast('Devis créé avec succès !');
      setQuoteModal(false);
    } catch (err) { toast(err.message, 'error'); }
  }

  const margColor = margePctTot >= marginTarget ? 'text-emerald-400' : margePctTot >= 20 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calculator className="w-5 h-5 text-violet-400" />
            Outil de chiffrage
          </h1>
          <input
            className="mt-1 text-sm text-slate-400 bg-transparent border-b border-dashed border-dark-500 focus:outline-none focus:border-blue-400 w-72"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre du chiffrage..."
          />
        </div>
        <div className="flex gap-2">
          <button onClick={applyDefaults} className="btn-secondary text-sm">
            <Zap className="w-4 h-4" /> Taux par défaut
          </button>
          <button onClick={() => setQuoteModal(true)} className="btn-primary">
            <FileText className="w-4 h-4" /> Créer le devis
          </button>
        </div>
      </div>

      {/* Postes */}
      <div className="space-y-3">
        {postes.map((p, idx) => {
          const c = calcPoste(p);
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center text-xs font-bold text-violet-400">
                  {idx + 1}
                </div>
                <input
                  className="flex-1 text-sm font-medium text-white bg-transparent border-b border-dashed border-dark-500 focus:outline-none focus:border-blue-400"
                  value={p.nom}
                  onChange={e => setPoste(p.id, 'nom', e.target.value)}
                />
                <select
                  className="input text-xs py-1 px-2 w-36"
                  value={p.type}
                  onChange={e => setPoste(p.id, 'type', e.target.value)}
                >
                  <option value="jour">☀️ Jour</option>
                  <option value="nuit">🌙 Nuit</option>
                  <option value="dimanche">⭐ Dimanche</option>
                </select>
                {postes.length > 1 && (
                  <button
                    onClick={() => setPostes(ps => ps.filter(x => x.id !== p.id))}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {[
                  { key: 'nbAgents',       label: 'Nb agents',      unit: '' },
                  { key: 'heuresParJour',  label: 'H/jour',         unit: 'h' },
                  { key: 'nbJoursSemaine', label: 'Jours/semaine',  unit: 'j' },
                  { key: 'nbSemaines',     label: 'Semaines',       unit: 'sem' },
                  { key: 'tauxClient',     label: 'Taux client',    unit: '€/h' },
                  { key: 'tauxAgent',      label: 'Coût agent',     unit: '€/h' },
                ].map(({ key, label, unit }) => (
                  <div key={key}>
                    <label className="label text-xs">{label}</label>
                    <div className="relative">
                      <input
                        type="number"
                        step={key.startsWith('taux') ? '0.5' : '1'}
                        min="0"
                        className="input text-sm pr-8"
                        value={p[key]}
                        onChange={e => setPoste(p.id, key, parseFloat(e.target.value) || 0)}
                      />
                      {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">{unit}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Résultats du poste */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-dark-700 rounded-lg p-3 text-sm">
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Total heures</div>
                  <div className="font-bold text-white">{(c.hTotal * p.nbAgents).toFixed(0)}h</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">CA HT</div>
                  <div className="font-bold text-white">{fmt(c.revenue)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Coût agents</div>
                  <div className="font-bold text-amber-400">{fmt(c.cout)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Marge</div>
                  <div className={`font-bold ${c.margePct >= marginTarget ? 'text-emerald-400' : c.margePct >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                    {fmt(c.marge)} <span className="text-xs font-normal">({c.margePct.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ajouter poste */}
      <button
        onClick={() => { setPostes(ps => [...ps, newPoste(nextId)]); setNextId(n => n + 1); }}
        className="w-full py-3 border-2 border-dashed border-dark-600 rounded-xl text-slate-400 hover:text-blue-400 hover:border-blue-600/40 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <Plus className="w-4 h-4" /> Ajouter un poste
      </button>

      {/* Résumé total */}
      <div className="card p-5">
        <h2 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" /> Récapitulatif
        </h2>

        {/* Curseur marge cible */}
        <div className="mb-4 flex items-center gap-4">
          <label className="label text-xs whitespace-nowrap">Marge cible</label>
          <input
            type="range" min="5" max="60" step="1"
            value={marginTarget}
            onChange={e => setMarginTarget(parseInt(e.target.value))}
            className="flex-1 accent-violet-500"
          />
          <span className="text-sm font-bold text-violet-400 w-12 text-right">{marginTarget}%</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-dark-700 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">CA HT total</div>
            <div className="text-xl font-bold text-white">{fmt(totaux.revenue)}</div>
            <div className="text-xs text-slate-500 mt-0.5">TTC : {fmt(totalTTC)}</div>
          </div>
          <div className="bg-dark-700 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Coût agents</div>
            <div className="text-xl font-bold text-amber-400">{fmt(totaux.cout)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{totaux.revenue > 0 ? ((totaux.cout/totaux.revenue)*100).toFixed(1) : 0}% du CA</div>
          </div>
          <div className="bg-dark-700 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Marge brute</div>
            <div className={`text-xl font-bold ${margColor}`}>{fmt(totaux.marge)}</div>
            <div className={`text-xs mt-0.5 ${margColor}`}>{margePctTot.toFixed(1)}%</div>
          </div>
          <div className="bg-dark-700 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Objectif marge</div>
            <div className={`text-xl font-bold ${margePctTot >= marginTarget ? 'text-emerald-400' : 'text-red-400'}`}>
              {margePctTot >= marginTarget ? '✓ Atteint' : '✗ Insuffisant'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {margePctTot >= marginTarget
                ? `+${(margePctTot - marginTarget).toFixed(1)}% au-dessus`
                : `${(marginTarget - margePctTot).toFixed(1)}% manquants`}
            </div>
          </div>
        </div>

        {/* Barre marge */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>0%</span>
            <span className="text-violet-400">Cible : {marginTarget}%</span>
            <span>60%</span>
          </div>
          <div className="relative h-3 bg-dark-600 rounded-full overflow-hidden">
            {/* Cible */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-violet-400/70 z-10"
              style={{ left: `${Math.min(marginTarget / 60 * 100, 100)}%` }}
            />
            {/* Marge réelle */}
            <div
              className={`h-full rounded-full transition-all ${margePctTot >= marginTarget ? 'bg-emerald-500' : margePctTot >= 20 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.max(margePctTot, 0), 60) / 60 * 100}%` }}
            />
          </div>
        </div>

        {/* TVA */}
        <div className="mt-4 flex items-center gap-3">
          <label className="label text-xs whitespace-nowrap">TVA (%)</label>
          <input
            type="number" step="0.1" min="0" max="100"
            className="input w-24 text-sm"
            value={tvaRate}
            onChange={e => setTvaRate(parseFloat(e.target.value) || 0)}
          />
          <span className="text-sm text-slate-400">→ TTC : <strong className="text-white">{fmt(totalTTC)}</strong></span>
        </div>
      </div>

      {/* Modal création devis */}
      {quoteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-full max-w-md p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Créer un devis depuis ce chiffrage
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">Client *</label>
                <select className="input" value={quoteClientId} onChange={e => { setQuoteClientId(e.target.value); setQuoteSiteId(''); }}>
                  <option value="">Sélectionner un client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {quoteClientId && (
                <div>
                  <label className="label">Site (optionnel)</label>
                  <select className="input" value={quoteSiteId} onChange={e => setQuoteSiteId(e.target.value)}>
                    <option value="">Aucun site spécifique</option>
                    {sites.filter(s => s.client_id === parseInt(quoteClientId)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="bg-dark-700 rounded-lg p-3 text-sm">
                <div className="text-slate-400 mb-2">Récapitulatif du devis :</div>
                <div className="flex justify-between"><span className="text-slate-300">CA HT</span><span className="text-white font-bold">{fmt(totaux.revenue)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">TVA {tvaRate}%</span><span className="text-slate-300">{fmt(totaux.revenue * tvaRate / 100)}</span></div>
                <div className="flex justify-between border-t border-dark-600 mt-1 pt-1"><span className="text-slate-300">TTC</span><span className="text-white font-bold">{fmt(totalTTC)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-slate-300">Nb lignes</span><span className="text-slate-300">{postes.length} poste(s)</span></div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setQuoteModal(false)}>Annuler</button>
              <button className="btn-primary flex-1" onClick={createQuote}>
                <Check className="w-4 h-4" /> Créer le devis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Chiffrage() {
  return <ToastProvider><ChiffrageInner /></ToastProvider>;
}
