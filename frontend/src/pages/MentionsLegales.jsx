import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

function LegalPage({ title, children }) {
  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-800/60">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">SecuroPlan</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-10">{title}</h1>
        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
          {children}
        </div>
      </main>

      <footer className="border-t border-dark-700 py-8 mt-16">
        <div className="max-w-3xl mx-auto px-4 flex flex-wrap gap-4 text-sm text-slate-500">
          <Link to="/mentions-legales" className="hover:text-slate-300">Mentions légales</Link>
          <Link to="/cgv" className="hover:text-slate-300">CGV</Link>
          <Link to="/confidentialite" className="hover:text-slate-300">Confidentialité</Link>
          <Link to="/" className="hover:text-slate-300">Retour à l'accueil</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">

      <Section title="1. Éditeur du site">
        <p>
          Le site <strong className="text-white">securoplan.fr</strong> est édité par la société
          {' '}<strong className="text-white">[NOM SOCIÉTÉ]</strong>, dont le siège social est situé à
          {' '}<strong className="text-white">[ADRESSE]</strong>.
        </p>
        <ul className="list-none space-y-1 mt-3 text-sm">
          <li>SIRET : <span className="text-white">[NUMÉRO SIRET]</span></li>
          <li>RCS : <span className="text-white">[VILLE RCS] [NUMÉRO RCS]</span></li>
          <li>Email : <a href="mailto:contact@securoplan.fr" className="text-blue-400 hover:underline">contact@securoplan.fr</a></li>
          <li>Directeur de la publication : <span className="text-white">[NOM DIRECTEUR]</span></li>
        </ul>
      </Section>

      <Section title="2. Hébergement">
        <p>
          Le site et ses données sont hébergés par les prestataires suivants :
        </p>
        <ul className="list-none space-y-2 mt-3 text-sm">
          <li>
            <strong className="text-white">Frontend :</strong> Vercel Inc., 340 Pine Street Suite 701, San Francisco, CA 94104, États-Unis — <a href="https://vercel.com" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">vercel.com</a>
          </li>
          <li>
            <strong className="text-white">Backend & base de données :</strong> Railway Corp., San Francisco, CA, États-Unis — <a href="https://railway.app" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">railway.app</a>
          </li>
        </ul>
      </Section>

      <Section title="3. Propriété intellectuelle">
        <p>
          L'ensemble du contenu de ce site (textes, images, logo, interface, code source) est la propriété exclusive de <strong className="text-white">[NOM SOCIÉTÉ]</strong> et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
        </p>
        <p className="mt-2">
          Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable de <strong className="text-white">[NOM SOCIÉTÉ]</strong>.
        </p>
      </Section>

      <Section title="4. Responsabilité">
        <p>
          <strong className="text-white">[NOM SOCIÉTÉ]</strong> s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur ce site, dont elle se réserve le droit de corriger le contenu à tout moment. Toutefois, elle ne peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à la disposition sur ce site.
        </p>
        <p className="mt-2">
          En conséquence, <strong className="text-white">[NOM SOCIÉTÉ]</strong> décline toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur ce site.
        </p>
      </Section>

      <Section title="5. Liens hypertextes">
        <p>
          Le site peut contenir des liens vers des sites tiers. Ces liens sont fournis à titre informatif uniquement. <strong className="text-white">[NOM SOCIÉTÉ]</strong> n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
        </p>
      </Section>

      <Section title="6. Droit applicable">
        <p>
          Les présentes mentions légales sont régies par le droit français. En cas de litige, et à défaut de résolution amiable, les tribunaux français seront seuls compétents.
        </p>
      </Section>

      <p className="text-xs text-slate-500 pt-4 border-t border-dark-700">
        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </LegalPage>
  );
}
