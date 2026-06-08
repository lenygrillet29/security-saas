import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

function LegalPage({ title, children }) {
  return (
    <div className="min-h-screen bg-dark-900 text-white">
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
        <div className="space-y-8 text-slate-300 leading-relaxed">
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

export default function CGV() {
  return (
    <LegalPage title="Conditions Générales de Vente">

      <Section title="1. Objet">
        <p>
          Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre
          {' '}<strong className="text-white">[NOM SOCIÉTÉ]</strong> (ci-après "le Prestataire") et toute personne morale ou physique
          souscrivant à l'abonnement SecuroPlan (ci-après "le Client").
        </p>
        <p className="mt-2">
          SecuroPlan est un logiciel de gestion en ligne (SaaS) destiné aux sociétés de sécurité privée, accessible via internet à l'adresse <strong className="text-white">securoplan.fr</strong>.
        </p>
      </Section>

      <Section title="2. Accès au service">
        <p>
          L'accès à SecuroPlan est conditionné à la création d'un compte et à la souscription d'un abonnement. Le Client accède au service via un navigateur web, sans installation de logiciel.
        </p>
        <p className="mt-2">
          Le Prestataire s'engage à faire ses meilleurs efforts pour assurer la disponibilité du service 24h/24 et 7j/7, sauf interruptions de maintenance programmées ou cas de force majeure.
        </p>
      </Section>

      <Section title="3. Tarifs et modalités de facturation">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 space-y-3 text-sm mt-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Mois 1 (offert)</span>
            <span className="text-emerald-400 font-semibold">0,00 €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Mois 2 et 3 (engagement)</span>
            <span className="text-white font-semibold">79,00 € HT / mois</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">À partir du mois 4</span>
            <span className="text-white font-semibold">79,00 € HT / mois — résiliable</span>
          </div>
          <div className="border-t border-dark-600 pt-3 text-xs text-slate-500">
            TVA applicable au taux en vigueur (20 %). Prix TTC : 94,80 € / mois à partir du mois 2.
          </div>
        </div>
        <p className="mt-4">
          Le premier mois d'utilisation est offert sans condition. L'abonnement mensuel débute au deuxième mois. Le Client s'engage pour une période minimale de 3 mois (soit 2 mois facturés après le mois offert).
        </p>
        <p className="mt-2">
          La facturation est mensuelle, par prélèvement automatique via la plateforme de paiement sécurisé Stripe. Le Client accepte les conditions d'utilisation de Stripe lors de la saisie de ses coordonnées bancaires.
        </p>
      </Section>

      <Section title="4. Durée et résiliation">
        <p>
          <strong className="text-white">Engagement initial :</strong> Le Client s'engage sur une durée minimale de 3 mois à compter de la date de création de son compte. La résiliation est impossible au cours des 3 premiers mois, sauf manquement grave du Prestataire à ses obligations.
        </p>
        <p className="mt-2">
          <strong className="text-white">Après l'engagement :</strong> À l'issue des 3 mois, l'abonnement est reconduit tacitement de mois en mois. Le Client peut résilier à tout moment avec un préavis de 30 jours, sans frais ni pénalité, depuis son espace de facturation ou par email à <a href="mailto:contact@securoplan.fr" className="text-blue-400 hover:underline">contact@securoplan.fr</a>.
        </p>
        <p className="mt-2">
          <strong className="text-white">Résiliation par le Prestataire :</strong> Le Prestataire se réserve le droit de suspendre ou résilier l'accès en cas de non-paiement persistant (plus de 15 jours après relance) ou d'utilisation frauduleuse du service.
        </p>
      </Section>

      <Section title="5. Options et add-ons">
        <p>
          Des options payantes peuvent être souscrites en complément de l'abonnement principal :
        </p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-slate-400">
          <li>Outil de chiffrage : 49,00 € HT / mois</li>
          <li>Packs agents supplémentaires : de 9 à 39 € HT / mois selon le pack</li>
          <li>Packs collaborateurs supplémentaires : de 5 à 25 € HT / mois selon le pack</li>
        </ul>
        <p className="mt-2">
          Ces options sont résiliables à tout moment, indépendamment de l'abonnement principal, depuis l'espace de facturation.
        </p>
      </Section>

      <Section title="6. Données et confidentialité">
        <p>
          Le Prestataire s'engage à ne pas divulguer les données du Client à des tiers, sauf obligation légale. Les données sont hébergées sur des serveurs sécurisés dans le cadre défini par la politique de confidentialité consultable à l'adresse <Link to="/confidentialite" className="text-blue-400 hover:underline">securoplan.fr/confidentialite</Link>.
        </p>
        <p className="mt-2">
          En cas de résiliation, le Client dispose d'un délai de 30 jours pour exporter ses données. Passé ce délai, les données sont supprimées définitivement.
        </p>
      </Section>

      <Section title="7. Responsabilité">
        <p>
          Le Prestataire est soumis à une obligation de moyens et non de résultat. Sa responsabilité ne pourra être engagée en cas d'interruption de service due à un tiers (hébergeur, réseau internet) ou à un cas de force majeure.
        </p>
        <p className="mt-2">
          En tout état de cause, la responsabilité du Prestataire est limitée au montant des sommes effectivement encaissées au cours des 3 derniers mois.
        </p>
      </Section>

      <Section title="8. Droit de rétractation">
        <p>
          Conformément à l'article L.221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux prestations de services pleinement exécutées avant la fin du délai de rétractation, ni aux contrats B2B. L'accès immédiat au service vaut renonciation au droit de rétractation pour les clients particuliers.
        </p>
      </Section>

      <Section title="9. Modification des CGV">
        <p>
          Le Prestataire se réserve le droit de modifier les présentes CGV à tout moment. Le Client sera informé par email au moins 30 jours avant l'entrée en vigueur des nouvelles conditions. L'absence d'opposition dans ce délai vaut acceptation.
        </p>
      </Section>

      <Section title="10. Litiges et droit applicable">
        <p>
          Les présentes CGV sont soumises au droit français. En cas de litige, les parties s'efforceront de trouver une solution amiable. À défaut, le tribunal compétent sera celui du siège social du Prestataire.
        </p>
        <p className="mt-2">
          Conformément à l'article L.616-1 du Code de la consommation, en cas de litige non résolu amiablement, le consommateur peut recourir gratuitement au médiateur de la consommation.
        </p>
      </Section>

      <p className="text-xs text-slate-500 pt-4 border-t border-dark-700">
        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </LegalPage>
  );
}
