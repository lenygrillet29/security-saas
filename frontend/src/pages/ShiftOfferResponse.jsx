import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Shield } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ShiftOfferResponse() {
  const { token, status } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action'); // 'accept' | 'decline'

  // Ce composant peut être rendu dans 3 cas :
  // /offer/:token/done?action=accept  → réponse traitée
  // /offer/:token/already             → déjà répondu
  // /offer/invalid ou /offer/error    → token invalide

  const isAlready = status === 'already';
  const isInvalid = token === 'invalid' || token === 'error';
  const isDone    = status === 'done';

  let icon, color, title, subtitle;

  if (isInvalid) {
    icon  = <AlertTriangle className="w-12 h-12" />;
    color = 'text-amber-400';
    title = 'Lien invalide';
    subtitle = 'Ce lien de réponse est invalide ou a expiré. Contactez votre responsable.';
  } else if (isAlready) {
    icon  = <AlertTriangle className="w-12 h-12" />;
    color = 'text-amber-400';
    title = 'Déjà répondu';
    subtitle = 'Vous avez déjà répondu à cette proposition de vacation.';
  } else if (action === 'accept') {
    icon  = <CheckCircle className="w-12 h-12" />;
    color = 'text-emerald-400';
    title = 'Vacation acceptée !';
    subtitle = 'Votre réponse a bien été enregistrée. Vous êtes planifié sur ce poste. Votre responsable a été informé.';
  } else {
    icon  = <XCircle className="w-12 h-12" />;
    color = 'text-red-400';
    title = 'Vacation déclinée';
    subtitle = 'Votre réponse a bien été enregistrée. Votre responsable a été informé.';
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-blue-600 rounded-xl p-2.5">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">SecuroPlan</div>
            <div className="text-slate-500 text-xs">Gestion Sécurité Privée</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center space-y-4">
          <div className={`flex justify-center ${color}`}>{icon}</div>
          <h1 className="text-white text-xl font-bold">{title}</h1>
          <p className="text-slate-400 text-sm leading-relaxed">{subtitle}</p>

          {action === 'accept' && (
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 text-xs text-emerald-300">
              Pensez à consulter votre planning sur votre espace agent pour voir les détails.
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          SecuroPlan — Gestion Sécurité Privée
        </p>
      </div>
    </div>
  );
}
