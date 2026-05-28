import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company_name: '', email: '', password: '', confirm_password: '',
    first_name: '', last_name: '', phone: '', siret: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      return setError('Les mots de passe ne correspondent pas');
    }
    if (form.password.length < 8) {
      return setError('Le mot de passe doit contenir au moins 8 caractères');
    }
    setLoading(true);
    try {
      const { token, user } = await authApi.register({
        company_name: form.company_name,
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        siret: form.siret || undefined,
      });
      localStorage.setItem('auth_token', token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ label, field, type = 'text', placeholder, required = false }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={form[field]}
        onChange={set(field)}
        className="w-full px-3 py-2.5 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">SecuritySaaS</div>
            <div className="text-xs text-slate-500">Gestion Sécurité Privée</div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-1">Créer votre compte</h1>
          <p className="text-sm text-slate-400 mb-6">Essai gratuit 14 jours — sans carte bancaire</p>

          {/* Avantages */}
          <div className="flex gap-4 mb-6 flex-wrap">
            {['14 jours gratuits', 'Multi-utilisateurs', 'Support inclus'].map(t => (
              <div key={t} className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {t}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-600/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField label="Nom de l'entreprise" field="company_name" placeholder="Ma Sécurité SARL" required />

            <div className="grid grid-cols-2 gap-3">
              <InputField label="Prénom" field="first_name" placeholder="Jean" required />
              <InputField label="Nom" field="last_name" placeholder="Dupont" required />
            </div>

            <InputField label="Email professionnel" field="email" type="email" placeholder="contact@masecurite.fr" required />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Mot de passe <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={set('password')}
                    className="w-full px-3 py-2.5 pr-10 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="8 caractères minimum"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirmation <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={form.confirm_password}
                  onChange={set('confirm_password')}
                  className="w-full px-3 py-2.5 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Répétez le mot de passe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField label="Téléphone" field="phone" placeholder="06 12 34 56 78" />
              <InputField label="SIRET" field="siret" placeholder="123 456 789 00012" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Création en cours…' : 'Créer mon compte gratuitement'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-600 text-center text-sm text-slate-400">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
