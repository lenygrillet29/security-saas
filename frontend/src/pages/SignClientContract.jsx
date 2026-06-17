import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, CheckCircle, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { clientContractsApi } from '../api';

const BILLING_LABELS = {
  monthly:  'Mensuel',
  yearly:   'Annuel',
  one_time: 'Forfait unique',
  hourly:   'À l\'heure',
};

export default function SignClientContract() {
  const { token } = useParams();
  const [contract, setContract] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [signing, setSigning]   = useState(false);
  const [signed, setSigned]     = useState(false);
  const [error, setError]       = useState('');
  const [agreed, setAgreed]     = useState(false);

  useEffect(() => {
    clientContractsApi.getByToken(token)
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setContract(data);
          if (data.status === 'signed') setSigned(true);
        }
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSign() {
    if (!agreed) return;
    setSigning(true);
    try {
      const result = await clientContractsApi.signByToken(token);
      if (result.error) throw new Error(result.error);
      setSigned(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">SecuroPlan</div>
            <div className="text-xs text-slate-500">Gestion Sécurité Privée</div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 shadow-2xl">
          {error && !contract && (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">Lien invalide</h2>
              <p className="text-slate-400">{error}</p>
            </div>
          )}

          {signed && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-white text-2xl font-bold mb-2">Contrat signé !</h2>
              <p className="text-slate-400">
                Le contrat de prestation a été signé électroniquement.
                {contract?.signed_at && (
                  <> Signature enregistrée le{' '}
                    <span className="text-white">{new Date(contract.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>.
                  </>
                )}
              </p>
            </div>
          )}

          {contract && !signed && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">{contract.title}</h1>
                  <p className="text-sm text-slate-400">{contract.company_name}</p>
                </div>
              </div>

              <div className="bg-dark-700 rounded-xl p-5 space-y-3 mb-6">
                <Row label="Client" value={contract.client_name} />
                {contract.contact_name && <Row label="Contact" value={contract.contact_name} />}
                <Row label="Prestataire" value={contract.company_name} />
                <Row label="Date de début" value={new Date(contract.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
                {contract.end_date && (
                  <Row label="Date de fin" value={new Date(contract.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
                )}
                {contract.amount > 0 && (
                  <Row
                    label="Montant"
                    value={`${Number(contract.amount).toLocaleString('fr-FR')} € HT${contract.billing_type ? ' / ' + (BILLING_LABELS[contract.billing_type] || contract.billing_type).toLowerCase() : ''}`}
                  />
                )}
                {contract.description && (
                  <div className="pt-2 border-t border-dark-600">
                    <p className="text-xs text-slate-500 mb-1">Description des prestations</p>
                    <p className="text-sm text-slate-300 whitespace-pre-line">{contract.description}</p>
                  </div>
                )}
              </div>

              <div className="bg-dark-700 border border-dark-500 rounded-xl p-4 text-xs text-slate-400 leading-relaxed mb-5">
                <p className="font-medium text-slate-300 mb-1">Signature électronique</p>
                En cliquant sur "Signer le contrat", vous acceptez les termes et conditions de ce contrat de prestation et confirmez votre consentement par signature électronique. Cette signature a la même valeur juridique qu'une signature manuscrite conformément au Règlement eIDAS (UE) 910/2014.
              </div>

              <label className="flex items-start gap-3 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-blue-500 rounded shrink-0"
                />
                <span className="text-sm text-slate-300">
                  J'ai lu et j'accepte les termes de ce contrat de prestation. Je consens à le signer électroniquement au nom de {contract.client_name}.
                </span>
              </label>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-600/50 text-red-300 text-sm">{error}</div>
              )}

              <button
                onClick={handleSign}
                disabled={!agreed || signing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {signing ? 'Signature en cours…' : 'Signer le contrat'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Propulsé par SecuroPlan — Gestion Sécurité Privée
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-white font-medium text-right">{value}</span>
    </div>
  );
}
