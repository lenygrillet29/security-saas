import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { billingApi } from '../api';
import { useAuth } from '../contexts/AuthContext';

function StatusBadge({ status }) {
  const MAP = {
    trialing:  { label: 'Essai gratuit', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
    active:    { label: 'Actif',         color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
    past_due:  { label: 'Paiement en retard', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
    canceled:  { label: 'Résilié',       color: 'text-red-400 bg-red-400/10 border-red-400/30' },
    trial:     { label: 'Essai gratuit', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  };
  const info = MAP[status] || { label: status, color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${info.color}`}>
      {info.label}
    </span>
  );
}

function ProgressBar({ value, max, color = 'bg-blue-500' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Billing() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getSubscription();
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async () => {
    if (!window.confirm('Confirmer la résiliation avec 30 jours de préavis ?')) return;
    setActionLoading(true);
    setError('');
    try {
      await billingApi.cancel();
      setSuccess('Résiliation planifiée avec 30 jours de préavis.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    setError('');
    try {
      await billingApi.reactivate();
      setSuccess('Résiliation annulée. Votre abonnement continue normalement.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Abonnement &amp; Facturation</h1>
        <p className="text-slate-400 text-sm mt-1">Gérez votre abonnement SecuroPlan</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-600/50 text-red-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg bg-emerald-900/40 border border-emerald-600/50 text-emerald-300 text-sm flex items-start gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      {data && (
        <>
          {/* Carte statut */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-slate-400 mb-1">Statut de l'abonnement</div>
                <StatusBadge status={data.plan_status} />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {data.phase === 'trial' ? '0 €' : '79 €'}
                  <span className="text-sm font-normal text-slate-400">/mois</span>
                </div>
                {data.phase === 'trial' && (
                  <div className="text-xs text-slate-500 mt-0.5">79 €/mois à partir du mois 2</div>
                )}
              </div>
            </div>

            {/* Timeline des 3 phases */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Mois 1', sublabel: 'Essai gratuit', done: data.period.daysSinceSignup >= 30, current: data.period.isTrialing },
                { label: 'Mois 2-3', sublabel: 'Engagement (79 €/mois)', done: data.period.daysSinceSignup >= 90, current: data.period.isMandatory },
                { label: 'Mois 4+', sublabel: 'Résiliable (préavis 30 j)', done: false, current: data.period.canCancel },
              ].map(({ label, sublabel, done, current }) => (
                <div key={label}
                  className={`rounded-lg border p-3 text-center transition-colors ${
                    current ? 'border-blue-500/50 bg-blue-500/10' :
                    done ? 'border-emerald-500/30 bg-emerald-500/5' :
                    'border-dark-500 bg-dark-700/50'
                  }`}
                >
                  {done ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  ) : current ? (
                    <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-dark-400 mx-auto mb-1" />
                  )}
                  <div className={`text-xs font-semibold ${current ? 'text-blue-300' : done ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{sublabel}</div>
                </div>
              ))}
            </div>

            {/* Barre de progression période en cours */}
            {data.period.isTrialing && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Essai gratuit</span>
                  <span>{data.period.trialEndsIn} jour(s) restant(s)</span>
                </div>
                <ProgressBar value={30 - data.period.trialEndsIn} max={30} color="bg-emerald-500" />
              </div>
            )}

            {data.period.isMandatory && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Période d'engagement obligatoire</span>
                  <span>{data.period.daysUntilCanCancel} jour(s) avant résiliation possible</span>
                </div>
                <ProgressBar value={data.period.daysSinceSignup - 30} max={60} color="bg-amber-500" />
              </div>
            )}

            {/* Résiliation planifiée */}
            {data.cancel_at && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-900/30 border border-amber-600/40">
                <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-amber-300">Résiliation planifiée</div>
                  <div className="text-xs text-amber-400/80 mt-0.5">
                    Votre accès se terminera le{' '}
                    <strong>{new Date(data.cancel_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Annuler la résiliation
                  </button>
                )}
              </div>
            )}

            {/* Prochain paiement */}
            {data.stripe?.current_period_end && data.phase !== 'trial' && (
              <div className="flex items-center justify-between text-sm border-t border-dark-600 pt-4">
                <span className="text-slate-400">Prochain prélèvement</span>
                <span className="text-white font-medium">
                  {new Date(data.stripe.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          {isAdmin && data.period.canCancel && !data.cancel_at && (
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Résilier l'abonnement</h3>
              <p className="text-sm text-slate-400 mb-4">
                Un préavis de 30 jours sera appliqué. Vous gardez l'accès jusqu'à la date de résiliation.
              </p>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 border border-red-500/40 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Résilier avec 30 jours de préavis
              </button>
            </div>
          )}

          {/* Engagement en cours */}
          {data.period.isMandatory && (
            <div className="bg-dark-800 border border-amber-600/30 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Période d'engagement en cours</h3>
                  <p className="text-sm text-slate-400">
                    La résiliation sera disponible dans <strong className="text-amber-400">{data.period.daysUntilCanCancel} jour(s)</strong>{' '}
                    (fin de la période d'engagement de 3 mois).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Essai gratuit info */}
          {data.period.isTrialing && (
            <div className="bg-dark-800 border border-emerald-600/30 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Essai gratuit en cours</h3>
                  <p className="text-sm text-slate-400">
                    Votre carte est enregistrée mais <strong className="text-emerald-400">aucun prélèvement</strong> ne sera effectué
                    pendant les {data.period.trialEndsIn} jour(s) restant(s) de votre essai.
                    Le premier prélèvement de <strong className="text-white">79 €</strong> interviendra à la fin du mois 1.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Paiement en retard */}
          {data.plan_status === 'past_due' && (
            <div className="bg-dark-800 border border-red-600/40 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Paiement en retard</h3>
                  <p className="text-sm text-slate-400">
                    Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement dans Stripe
                    pour éviter la suspension de votre compte.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
