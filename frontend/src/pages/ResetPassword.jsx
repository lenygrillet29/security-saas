import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { authApi } from '../api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');
    if (password.length < 8)  return setError('Minimum 8 caractères');
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
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
              <h1 className="text-xl font-bold text-white">Mot de passe modifié !</h1>
              <p className="text-sm text-slate-400">
                Vous allez être redirigé vers la connexion…
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Nouveau mot de passe</h1>
              <p className="text-sm text-slate-400 mb-6">Choisissez un mot de passe sécurisé (8 caractères minimum).</p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-600/50 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPwd(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmer le mot de passe</label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-dark-600 text-center">
                <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200">
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
