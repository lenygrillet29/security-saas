import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, Lock, CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { authApi } from '../api';

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const CARD_STYLE = {
  style: {
    base: {
      color: '#e2e8f0',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: '14px',
      '::placeholder': { color: '#64748b' },
      iconColor: '#94a3b8',
    },
    invalid: { color: '#f87171', iconColor: '#f87171' },
  },
};

// Défini en dehors du composant pour éviter la recréation à chaque render
// (sinon React démonte/remonte l'input à chaque frappe → perte de focus)
const Field = ({ label, field, type = 'text', placeholder, required = false, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    <input
      type={type}
      required={required}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
    />
  </div>
);

function RegisterForm() {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

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

    if (form.password !== form.confirm_password) return setError('Les mots de passe ne correspondent pas');
    if (form.password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères');

    setLoading(true);
    try {
      let payment_method_id;

      // Tokeniser la carte si Stripe est configuré
      if (stripePromise && stripe && elements) {
        const cardElement = elements.getElement(CardElement);
        const { paymentMethod, error: stripeError } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name: `${form.first_name} ${form.last_name}`,
            email: form.email,
          },
        });
        if (stripeError) throw new Error(stripeError.message);
        payment_method_id = paymentMethod.id;
      }

      const { token } = await authApi.register({
        company_name: form.company_name,
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        siret: form.siret || undefined,
        payment_method_id,
      });
      localStorage.setItem('auth_token', token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
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
          <h1 className="text-xl font-bold text-white mb-1">Créer votre compte</h1>

          {/* Récapitulatif offre */}
          <div className="mt-3 mb-6 rounded-xl border border-dark-500 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-dark-500 text-center text-xs">
              <div className="px-3 py-3">
                <div className="font-bold text-emerald-400 text-base">Gratuit</div>
                <div className="text-slate-400 mt-0.5">1er mois</div>
                <div className="text-slate-500 mt-1">Carte enregistrée,<br/>aucun prélèvement</div>
              </div>
              <div className="px-3 py-3">
                <div className="font-bold text-white text-base">79 €/mois</div>
                <div className="text-slate-400 mt-0.5">Mois 2 &amp; 3</div>
                <div className="text-slate-500 mt-1">Engagement<br/>obligatoire</div>
              </div>
              <div className="px-3 py-3">
                <div className="font-bold text-blue-400 text-base">Libre</div>
                <div className="text-slate-400 mt-0.5">Dès le mois 4</div>
                <div className="text-slate-500 mt-1">Résiliation avec<br/>30 j de préavis</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-600/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nom de l'entreprise" field="company_name" placeholder="Ma Sécurité SARL" required value={form.company_name} onChange={set('company_name')} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" field="first_name" placeholder="Jean" required value={form.first_name} onChange={set('first_name')} />
              <Field label="Nom" field="last_name" placeholder="Dupont" required value={form.last_name} onChange={set('last_name')} />
            </div>

            <Field label="Email professionnel" field="email" type="email" placeholder="contact@masecurite.fr" required value={form.email} onChange={set('email')} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Mot de passe<span className="text-red-400 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={set('password')}
                    placeholder="8 caractères minimum"
                    className="w-full px-3 py-2.5 pr-10 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirmation<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={form.confirm_password}
                  onChange={set('confirm_password')}
                  placeholder="Répétez"
                  className="w-full px-3 py-2.5 bg-dark-700 border border-dark-500 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone" field="phone" placeholder="06 12 34 56 78" value={form.phone} onChange={set('phone')} />
              <Field label="SIRET" field="siret" placeholder="123 456 789 00012" value={form.siret} onChange={set('siret')} />
            </div>

            {/* Stripe card element */}
            {stripePromise && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" />
                    Carte bancaire<span className="text-red-400 ml-0.5">*</span>
                  </span>
                </label>
                <div className="px-3 py-3 bg-dark-700 border border-dark-500 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                  <CardElement options={CARD_STYLE} />
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                  <Lock className="w-3 h-3" />
                  Aucun prélèvement pendant le 1er mois — carte enregistrée de façon sécurisée via Stripe
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (stripePromise && !stripe)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Création en cours…' : 'Démarrer mon essai gratuit'}
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

// Wrapper qui charge Stripe si la clé est disponible
export default function Register() {
  if (stripePromise) {
    return (
      <Elements stripe={stripePromise}>
        <RegisterForm />
      </Elements>
    );
  }
  return <RegisterForm />;
}
