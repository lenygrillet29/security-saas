import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { authApi } from '../api';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-white">Email envoyé !</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Si un compte existe avec <strong className="text-slate-300">{email}</strong>,
                vous recevrez un email avec un lien pour réinitialiser votre mot de passe.<br />
                <span className="text-slate-500">Le lien expire dans 1 heure.</span>
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-2">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Mot de passe oublié</h1>
              <p className="text-sm text-slate-400 mb-6">
                Entrez votre email et nous vous enverrons un lien de réinitialisation.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-600/50 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="vous@entreprise.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-dark-600 text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
                  <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
