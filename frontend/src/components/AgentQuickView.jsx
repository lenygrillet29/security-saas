import { useEffect, useState } from 'react';
import { X, Phone, Mail, Shield, CreditCard, Calendar, Hash, FileText, Clock, ExternalLink } from 'lucide-react';
import { agentsApi } from '../api';
import { useNavigate } from 'react-router-dom';

const CONTRACT_LABELS = {
  CDI: 'CDI', CDD: 'CDD', interim: 'Intérim',
  vacation: 'Vacataire', apprenti: 'Apprenti',
};

function frDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Row({ icon: Icon, label, value, valueClass = 'text-white' }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-dark-700/50 last:border-0">
      <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
      <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
      <span className={`text-xs ${valueClass} flex-1`}>{value}</span>
    </div>
  );
}

export default function AgentQuickView({ agentId, onClose }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!agentId) return;
    agentsApi.get(agentId)
      .then(setAgent)
      .catch(() => setAgent(null))
      .finally(() => setLoading(false));
  }, [agentId]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!agentId) return null;

  const today = new Date().toISOString().slice(0, 10);
  const expiry = agent?.carte_pro_expiry;
  const expiryExpired = expiry && expiry < today;
  const expiryDaysLeft = expiry ? Math.ceil((new Date(expiry) - new Date(today)) / 86400000) : null;
  const expirySoon = !expiryExpired && expiryDaysLeft !== null && expiryDaysLeft <= 30;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleOverlayClick}
    >
      <div className="h-full w-full max-w-sm bg-dark-800 border-l border-dark-600 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-600 shrink-0">
          <span className="text-sm font-semibold text-white">Fiche agent</span>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Chargement…</div>
        ) : !agent ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Agent introuvable</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Avatar + nom */}
            <div className="px-5 py-5 flex items-center gap-4 border-b border-dark-600">
              {agent.photo ? (
                <img src={agent.photo} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-dark-500" />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                  style={{ background: agent.color || '#3B82F6' }}
                >
                  {agent.first_name?.[0]}{agent.last_name?.[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-base font-bold text-white">{agent.first_name} {agent.last_name}</div>
                {agent.employee_number && (
                  <div className="text-xs text-slate-500 mt-0.5">N° {agent.employee_number}</div>
                )}
                <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 font-medium ${agent.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                  {agent.active ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>

            {/* Infos */}
            <div className="px-5 py-3 space-y-0">
              <Row icon={Mail}     label="Email"    value={agent.email} />
              <Row icon={Phone}    label="Téléphone" value={agent.phone} />
              <Row icon={FileText} label="Contrat"  value={CONTRACT_LABELS[agent.contract_type] || agent.contract_type} />
              {agent.hourly_rate > 0 && (
                <Row icon={Clock} label="Taux horaire" value={`${agent.hourly_rate} €/h`} valueClass="text-emerald-400" />
              )}
              <Row icon={Calendar} label="Entrée"   value={frDate(agent.entry_date)} />
              {agent.exit_date && (
                <Row icon={Calendar} label="Sortie" value={frDate(agent.exit_date)} valueClass="text-red-400" />
              )}
            </div>

            {/* Carte pro */}
            {(agent.carte_pro || agent.carte_pro_expiry) && (
              <div className={`mx-4 my-3 rounded-xl p-3 border ${
                expiryExpired ? 'bg-red-500/10 border-red-500/30' :
                expirySoon    ? 'bg-amber-500/10 border-amber-500/30' :
                                'bg-dark-700 border-dark-600'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-3.5 h-3.5 ${expiryExpired ? 'text-red-400' : expirySoon ? 'text-amber-400' : 'text-rose-400'}`} />
                  <span className="text-xs font-semibold text-slate-300">Carte professionnelle CNAPS</span>
                  {expiryExpired && <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-bold">EXPIRÉE</span>}
                  {expirySoon    && <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-bold">J-{expiryDaysLeft}</span>}
                </div>
                {agent.carte_pro && <div className="text-xs text-slate-400 mb-1">{agent.carte_pro}</div>}
                {agent.carte_pro_expiry && (
                  <div className={`text-xs font-medium ${expiryExpired ? 'text-red-400' : expirySoon ? 'text-amber-400' : 'text-slate-400'}`}>
                    Expiration : {frDate(agent.carte_pro_expiry)}
                  </div>
                )}
              </div>
            )}

            {/* Carte vitale */}
            {agent.carte_vitale && (
              <div className="mx-4 mb-3 rounded-xl p-3 border bg-dark-700 border-dark-600">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-300">Carte Vitale</span>
                </div>
                <div className="text-xs text-slate-400">{agent.carte_vitale}</div>
              </div>
            )}

            {/* Notes */}
            {agent.notes && (
              <div className="mx-4 mb-3 rounded-xl p-3 border bg-dark-700 border-dark-600">
                <div className="text-xs font-semibold text-slate-300 mb-1">Notes</div>
                <div className="text-xs text-slate-400 whitespace-pre-wrap">{agent.notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Pied — lien vers la fiche complète */}
        {agent && (
          <div className="px-5 py-4 border-t border-dark-600 shrink-0">
            <button
              onClick={() => { navigate('/agents'); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors border border-blue-400/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Voir la fiche complète
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
