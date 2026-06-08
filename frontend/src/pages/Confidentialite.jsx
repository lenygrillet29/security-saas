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
        <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-10">Conformément au RGPD (Règlement UE 2016/679)</p>
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

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité">

      <Section title="1. Responsable du traitement">
        <p>
          Le responsable du traitement des données personnelles collectées via SecuroPlan est
          {' '}<strong className="text-white">[NOM SOCIÉTÉ]</strong>, dont le siège social est à <strong className="text-white">[ADRESSE]</strong>.
        </p>
        <p className="mt-2">
          Pour toute question relative à vos données personnelles : <a href="mailto:contact@securoplan.fr" className="text-blue-400 hover:underline">contact@securoplan.fr</a>
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Dans le cadre de l'utilisation de SecuroPlan, nous collectons les données suivantes :</p>
        <div className="mt-3 space-y-3">
          {[
            {
              cat: "Données de compte",
              items: "Nom, prénom, adresse email, nom de la société, numéro de téléphone, SIRET"
            },
            {
              cat: "Données de facturation",
              items: "Coordonnées de facturation, historique des paiements (les données bancaires sont gérées directement par Stripe et ne transitent pas par nos serveurs)"
            },
            {
              cat: "Données opérationnelles",
              items: "Planning des agents, informations sur les agents (nom, prénom, email, téléphone, numéro employé), données clients et sites, contrats de travail, feuilles de présence"
            },
            {
              cat: "Données de géolocalisation",
              items: "Coordonnées GPS lors du pointage des agents (check-in / check-out), collectées uniquement avec le consentement explicite de l'agent"
            },
            {
              cat: "Données techniques",
              items: "Adresse IP, type de navigateur, journal d'audit des actions effectuées dans l'application"
            },
          ].map(({ cat, items }) => (
            <div key={cat} className="bg-dark-800 border border-dark-700 rounded-lg p-4 text-sm">
              <div className="font-semibold text-white mb-1">{cat}</div>
              <div className="text-slate-400">{items}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="3. Finalités du traitement">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>Fourniture et amélioration du service SecuroPlan</li>
          <li>Gestion de la relation client et du support</li>
          <li>Facturation et gestion des abonnements</li>
          <li>Envoi de notifications push aux agents (rappels de vacation)</li>
          <li>Envoi d'emails transactionnels (confirmation de compte, liens de portail, contrats)</li>
          <li>Respect des obligations légales et comptables</li>
          <li>Prévention de la fraude et sécurité des comptes</li>
        </ul>
      </Section>

      <Section title="4. Base légale des traitements">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li><strong className="text-white">Exécution du contrat</strong> : traitement nécessaire à la fourniture du service (art. 6.1.b RGPD)</li>
          <li><strong className="text-white">Consentement</strong> : géolocalisation des agents, notifications push (art. 6.1.a RGPD)</li>
          <li><strong className="text-white">Obligation légale</strong> : conservation des factures et journaux comptables (art. 6.1.c RGPD)</li>
          <li><strong className="text-white">Intérêt légitime</strong> : sécurité du service, prévention de la fraude (art. 6.1.f RGPD)</li>
        </ul>
      </Section>

      <Section title="5. Durée de conservation">
        <div className="space-y-2 text-sm mt-2">
          {[
            ["Données de compte actif", "Durée de l'abonnement + 30 jours après résiliation"],
            ["Données de facturation", "10 ans (obligation comptable légale)"],
            ["Données opérationnelles", "Durée de l'abonnement + 30 jours après résiliation"],
            ["Données de géolocalisation", "90 jours glissants"],
            ["Journaux d'audit", "1 an"],
            ["Tokens de réinitialisation de mot de passe", "1 heure après génération"],
          ].map(([type, duree]) => (
            <div key={type} className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-dark-700 last:border-0">
              <span className="text-slate-300">{type}</span>
              <span className="text-slate-500 text-xs sm:text-sm sm:text-right">{duree}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="6. Sous-traitants et destinataires">
        <p>Vos données sont susceptibles d'être transmises aux sous-traitants suivants :</p>
        <div className="space-y-2 mt-3 text-sm">
          {[
            ["Stripe", "Paiements en ligne", "États-Unis (clauses contractuelles types UE)"],
            ["Railway", "Hébergement backend et base de données", "États-Unis (clauses contractuelles types UE)"],
            ["Vercel", "Hébergement frontend", "États-Unis (clauses contractuelles types UE)"],
            ["Nodemailer / SMTP", "Envoi d'emails transactionnels", "France / UE"],
          ].map(([nom, role, localisation]) => (
            <div key={nom} className="bg-dark-800 border border-dark-700 rounded-lg p-3 flex flex-col gap-0.5">
              <span className="font-semibold text-white">{nom}</span>
              <span className="text-slate-400">{role}</span>
              <span className="text-slate-500 text-xs">{localisation}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="7. Vos droits (RGPD)">
        <p>Conformément au RGPD, vous disposez des droits suivants concernant vos données personnelles :</p>
        <ul className="list-disc list-inside space-y-1.5 mt-3 text-sm">
          <li><strong className="text-white">Droit d'accès</strong> : obtenir une copie des données vous concernant</li>
          <li><strong className="text-white">Droit de rectification</strong> : corriger des données inexactes</li>
          <li><strong className="text-white">Droit à l'effacement</strong> : demander la suppression de vos données</li>
          <li><strong className="text-white">Droit d'opposition</strong> : vous opposer à certains traitements</li>
          <li><strong className="text-white">Droit à la limitation</strong> : restreindre le traitement de vos données</li>
          <li><strong className="text-white">Droit à la portabilité</strong> : recevoir vos données dans un format lisible</li>
          <li><strong className="text-white">Droit de retrait du consentement</strong> : retirer votre consentement à tout moment pour les traitements fondés sur celui-ci</li>
        </ul>
        <p className="mt-4">
          Pour exercer ces droits, contactez-nous à <a href="mailto:contact@securoplan.fr" className="text-blue-400 hover:underline">contact@securoplan.fr</a>. Nous répondrons dans un délai maximum de 30 jours.
        </p>
        <p className="mt-2">
          Vous pouvez également introduire une réclamation auprès de la <strong className="text-white">CNIL</strong> : <a href="https://www.cnil.fr" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">cnil.fr</a>
        </p>
      </Section>

      <Section title="8. Sécurité des données">
        <p>
          Nous mettons en oeuvre les mesures techniques et organisationnelles appropriées pour protéger vos données :
        </p>
        <ul className="list-disc list-inside space-y-1.5 mt-3 text-sm">
          <li>Chiffrement des mots de passe (bcrypt)</li>
          <li>Communications chiffrées via HTTPS/TLS</li>
          <li>Authentification par jeton JWT à durée limitée</li>
          <li>Isolation stricte des données entre clients (architecture multi-tenant)</li>
          <li>Accès aux données limité au personnel autorisé</li>
        </ul>
      </Section>

      <Section title="9. Cookies">
        <p>
          SecuroPlan n'utilise pas de cookies de suivi ou publicitaires. Seuls des cookies techniques strictement nécessaires au fonctionnement de l'application (session, authentification) peuvent être utilisés.
        </p>
      </Section>

      <Section title="10. Modification de cette politique">
        <p>
          Cette politique de confidentialité peut être mise à jour. La date de dernière modification est indiquée en bas de page. En cas de modification substantielle, vous serez informé par email.
        </p>
      </Section>

      <p className="text-xs text-slate-500 pt-4 border-t border-dark-700">
        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </LegalPage>
  );
}
