import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Calendar, Smartphone, Bell, Users, FileText, BarChart3,
  MapPin, CheckCircle, ChevronRight, Menu, X, Zap, Lock, Clock,
} from 'lucide-react';

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-dark-900/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">SecuroPlan</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
          <a href="#how" className="hover:text-white transition-colors">Comment ça marche</a>
          <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5">
            Se connecter
          </Link>
          <Link
            to="/register"
            className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Essai gratuit
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-slate-400 hover:text-white p-1" onClick={() => setOpen(o => !o)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-dark-900 border-t border-white/5 px-4 pb-4 space-y-3 pt-3">
          <a href="#features" className="block text-sm text-slate-400 hover:text-white py-1.5" onClick={() => setOpen(false)}>Fonctionnalités</a>
          <a href="#how" className="block text-sm text-slate-400 hover:text-white py-1.5" onClick={() => setOpen(false)}>Comment ça marche</a>
          <a href="#pricing" className="block text-sm text-slate-400 hover:text-white py-1.5" onClick={() => setOpen(false)}>Tarifs</a>
          <div className="pt-2 flex flex-col gap-2">
            <Link to="/login" className="block text-center text-sm text-slate-300 border border-dark-600 rounded-lg py-2 hover:bg-dark-800">Se connecter</Link>
            <Link to="/register" className="block text-center text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2">Essai gratuit</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-6">
          <Zap className="w-3.5 h-3.5" />
          Conçu pour les sociétés de sécurité privée
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
          Gérez votre société<br />
          <span className="text-blue-400">sans prise de tête</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Planning, agents, clients, facturation — tout centralisé dans un seul outil.
          Vos agents pointent depuis leur téléphone, vos clients suivent leurs sites en temps réel.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-105 active:scale-100"
          >
            Démarrer l'essai gratuit
            <ChevronRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-dark-600 hover:border-dark-500 text-slate-300 hover:text-white font-medium px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Voir les fonctionnalités
          </a>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          14 jours gratuits · Sans carte bancaire · Résiliable à tout moment
        </p>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {[
            { value: '100%', label: 'En ligne, partout' },
            { value: '24/7', label: 'Notifications push' },
            { value: '0€', label: 'Pour démarrer' },
          ].map(s => (
            <div key={s.label} className="bg-dark-800/60 border border-dark-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-600/10',
    title: 'Planning visuel',
    desc: "Créez et modifiez les vacations en quelques clics. Vue semaine ou mensuelle, gestion des remplacements, détection des conflits.",
  },
  {
    icon: Smartphone,
    color: 'text-violet-400',
    bg: 'bg-violet-600/10',
    title: 'App mobile agents',
    desc: "Chaque agent reçoit un lien unique par email. Check-in et check-out géolocalisés depuis n'importe quel téléphone, sans installation.",
  },
  {
    icon: Bell,
    color: 'text-amber-400',
    bg: 'bg-amber-600/10',
    title: 'Rappels automatiques',
    desc: "Notifications push envoyées 24h et 2h avant chaque vacation. Vos agents n'oublient plus jamais une prestation.",
  },
  {
    icon: Users,
    color: 'text-emerald-400',
    bg: 'bg-emerald-600/10',
    title: 'Portail client',
    desc: "Chaque client dispose d'un espace en ligne pour suivre ses sites et les agents en poste, en temps réel.",
  },
  {
    icon: FileText,
    color: 'text-rose-400',
    bg: 'bg-rose-600/10',
    title: 'Devis & Facturation',
    desc: "Générez devis et factures en PDF directement depuis votre planning. Suivi des paiements et export comptable inclus.",
  },
  {
    icon: BarChart3,
    color: 'text-cyan-400',
    bg: 'bg-cyan-600/10',
    title: 'Tableau de bord',
    desc: "Taux d'occupation, heures planifiées, chiffre d'affaires prévisionnel. Pilotez votre activité avec des données claires.",
  },
];

function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            SecuroPlan regroupe tous les outils de gestion d'une société de sécurité privée en une seule plateforme.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-dark-800 border border-dark-700 hover:border-dark-600 rounded-2xl p-6 transition-colors group">
              <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    icon: Lock,
    title: 'Créez votre compte',
    desc: "Inscrivez-vous en 2 minutes. Aucune carte bancaire requise. 14 jours d'essai complet offerts.",
  },
  {
    num: '02',
    icon: Users,
    title: 'Ajoutez vos équipes',
    desc: "Enregistrez vos agents, clients et sites. Chaque agent reçoit automatiquement son lien d'accès mobile.",
  },
  {
    num: '03',
    icon: Calendar,
    title: 'Planifiez vos vacations',
    desc: "Créez le planning et laissez SecuroPlan envoyer les rappels, collecter les pointages et générer les factures.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="py-20 px-4 sm:px-6 bg-dark-800/40 border-y border-dark-700">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Opérationnel en 10 minutes
          </h2>
          <p className="text-slate-400 text-lg">
            Pas de formation, pas d'installation. Votre équipe est opérationnelle le jour même.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex flex-col items-center text-center md:items-start md:text-left relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-5 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-dark-600" />
              )}
              <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center mb-4 shrink-0 relative z-10">
                <s.icon className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-xs font-mono text-blue-500/60 mb-1">{s.num}</div>
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const PRO_FEATURES = [
  'Planning illimité',
  'Portail mobile agents (check-in/check-out)',
  'Notifications push 24h et 2h avant',
  'Portail client en temps réel',
  'Devis et factures PDF',
  'Contrats de travail + signature électronique',
  "Journal d'audit",
  'Export comptable CSV',
  'Support par email',
];

function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Un tarif simple et transparent
          </h2>
          <p className="text-slate-400 text-lg">
            Tout est inclus. Pas de surprise, pas de frais cachés.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trial */}
          <div className="bg-dark-800 border border-dark-700 rounded-2xl p-8 flex flex-col">
            <div className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Essai gratuit</div>
            <div className="text-4xl font-bold text-white mb-1">0€</div>
            <div className="text-slate-500 text-sm mb-6">pendant 14 jours</div>
            <ul className="space-y-3 mb-8 flex-1">
              {['Accès complet à toutes les fonctionnalités', 'Sans carte bancaire', 'Résiliable à tout moment'].map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="block text-center bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Commencer gratuitement
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-blue-600/10 border-2 border-blue-500/40 rounded-2xl p-8 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              POPULAIRE
            </div>
            <div className="text-sm font-semibold text-blue-300 uppercase tracking-wide mb-3">Pro</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-white">79€</span>
              <span className="text-slate-400 text-sm">/mois</span>
            </div>
            <div className="text-slate-500 text-sm mb-6">par société, tout compris</div>
            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="block text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Démarrer l'essai gratuit
            </Link>
          </div>
        </div>

        {/* Add-ons note */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Des options supplémentaires sont disponibles : outil de chiffrage, packs agents et collaborateurs.
        </p>
      </div>
    </section>
  );
}

// ── CTA final ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="bg-gradient-to-br from-blue-600/20 to-violet-600/10 border border-blue-500/20 rounded-3xl p-12">
          <Shield className="w-12 h-12 text-blue-400 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à simplifier votre gestion ?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Rejoignez les sociétés de sécurité qui font confiance à SecuroPlan pour gérer leur planning et leurs équipes.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-105 active:scale-100"
          >
            Démarrer gratuitement
            <ChevronRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-sm text-slate-500">14 jours gratuits · Sans carte bancaire</p>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-dark-700 py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">SecuroPlan</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <Link to="/login" className="hover:text-slate-300 transition-colors">Se connecter</Link>
            <Link to="/register" className="hover:text-slate-300 transition-colors">S'inscrire</Link>
            <Link to="/mentions-legales" className="hover:text-slate-300 transition-colors">Mentions légales</Link>
            <Link to="/cgv" className="hover:text-slate-300 transition-colors">CGV</Link>
            <Link to="/confidentialite" className="hover:text-slate-300 transition-colors">Confidentialité</Link>
          </div>

          <div className="text-sm text-slate-600">
            © {new Date().getFullYear()} SecuroPlan
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
