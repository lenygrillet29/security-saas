const APP_URL = process.env.APP_URL || 'https://securitysaas.vercel.app';

function base(title, content) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Logo -->
      <tr><td style="padding-bottom:32px;text-align:center;">
        <table cellpadding="0" cellspacing="0" align="center">
          <tr>
            <td style="background:#2563eb;border-radius:12px;padding:10px 14px;vertical-align:middle;">
              <span style="color:white;font-size:18px;font-weight:bold;">🛡</span>
            </td>
            <td style="padding-left:12px;vertical-align:middle;text-align:left;">
              <div style="color:white;font-size:18px;font-weight:700;line-height:1.2;">SecuritySaaS</div>
              <div style="color:#64748b;font-size:11px;">Gestion Sécurité Privée</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <!-- Card -->
      <tr><td style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px 36px;">
        ${content}
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding-top:24px;text-align:center;color:#475569;font-size:11px;line-height:1.8;">
        SecuritySaaS — Gestion Sécurité Privée<br>
        <a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">${APP_URL.replace('https://', '')}</a><br>
        <span style="color:#334155;">Vous recevez cet email car vous êtes client SecuritySaaS.</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(text, url, color = '#2563eb') {
  return `<a href="${url}" style="display:block;background:${color};color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${text}</a>`;
}

function row(label, value, valueColor = 'white') {
  return `<tr>
    <td style="color:#94a3b8;font-size:13px;padding:7px 0;border-bottom:1px solid #1e293b;">${label}</td>
    <td style="text-align:right;color:${valueColor};font-size:13px;font-weight:600;padding:7px 0;border-bottom:1px solid #1e293b;">${value}</td>
  </tr>`;
}

// ─── Bienvenue ─────────────────────────────────────────────────────────────────
function welcome({ companyName, firstName, trialEndDate }) {
  return base('Bienvenue sur SecuritySaaS 🎉', `
    <h1 style="color:white;font-size:24px;margin:0 0 6px;">Bienvenue, ${firstName} ! 👋</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      Votre compte <strong style="color:white;">${companyName}</strong> a été créé avec succès.
      Voici un récapitulatif de votre offre.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px;font-weight:600;">Récapitulatif de votre offre</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#10b981;font-weight:700;font-size:14px;padding:8px 0;border-bottom:1px solid #1e293b;">Mois 1 — Gratuit</td>
            <td style="text-align:right;color:#64748b;font-size:13px;padding:8px 0;border-bottom:1px solid #1e293b;">0 € · fin le ${trialEndDate}</td>
          </tr>
          <tr>
            <td style="color:white;font-weight:700;font-size:14px;padding:8px 0;border-bottom:1px solid #1e293b;">Mois 2 &amp; 3</td>
            <td style="text-align:right;color:#64748b;font-size:13px;padding:8px 0;border-bottom:1px solid #1e293b;">79 €/mois · engagement obligatoire</td>
          </tr>
          <tr>
            <td style="color:#60a5fa;font-weight:700;font-size:14px;padding:8px 0;">Mois 4+</td>
            <td style="text-align:right;color:#64748b;font-size:13px;padding:8px 0;">79 €/mois · résiliable 30 j préavis</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <div style="margin-bottom:16px;">${btn('Accéder à mon tableau de bord →', `${APP_URL}/dashboard`)}</div>
    <p style="color:#475569;font-size:12px;margin:0;text-align:center;">
      Des questions ? Répondez directement à cet email.
    </p>
  `);
}

// ─── Fin d'essai J-7 / J-1 ────────────────────────────────────────────────────
function trialEnding({ firstName, companyName, daysLeft, trialEndDate }) {
  const urgent = daysLeft <= 1;
  const color  = urgent ? '#ef4444' : '#f59e0b';
  const label  = urgent ? '⚠️ Dernière chance' : `⏳ Plus que ${daysLeft} jours`;

  return base(`Essai gratuit : ${daysLeft <= 1 ? 'se termine demain' : `${daysLeft} jours restants`}`, `
    <div style="background:${color}22;border:1px solid ${color}55;border-radius:10px;padding:14px 18px;margin-bottom:24px;text-align:center;">
      <span style="color:${color};font-weight:700;font-size:15px;">${label} — fin de votre essai gratuit</span>
    </div>

    <h1 style="color:white;font-size:21px;margin:0 0 12px;">Bonjour ${firstName},</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 12px;line-height:1.6;">
      La période d'essai gratuit de <strong style="color:white;">${companyName}</strong> se termine le
      <strong style="color:white;">${trialEndDate}</strong>.
    </p>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      Votre abonnement passera automatiquement à <strong style="color:white;">79 €/mois</strong>
      et sera prélevé sur la carte enregistrée à cette date.
    </p>

    <div style="margin-bottom:12px;">${btn('Gérer mon abonnement →', `${APP_URL}/billing`)}</div>
    <p style="color:#475569;font-size:12px;margin:0;text-align:center;">
      Pour annuler, rendez-vous dans l'espace <em>Abonnement</em> avant la date de fin.
    </p>
  `);
}

// ─── Paiement réussi ──────────────────────────────────────────────────────────
function paymentSucceeded({ firstName, companyName, amount, date, invoiceUrl }) {
  return base('Confirmation de paiement ✅', `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:8px;">✅</div>
      <h1 style="color:white;font-size:22px;margin:0 0 6px;">Paiement confirmé</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0;">Merci pour votre confiance, ${firstName}.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px;font-weight:600;">Détail du paiement</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('Entreprise', companyName)}
          ${row('Montant', `${amount} €`, '#10b981')}
          ${row('Date', date)}
          ${row('Plan', 'SecuritySaaS Pro')}
        </table>
      </td></tr>
    </table>

    ${invoiceUrl ? `<div style="margin-bottom:12px;"><a href="${invoiceUrl}" style="display:block;background:#1e293b;border:1px solid #334155;color:#60a5fa;text-align:center;padding:12px;border-radius:10px;text-decoration:none;font-size:14px;">📄 Télécharger la facture PDF</a></div>` : ''}
    ${btn('Accéder au tableau de bord →', `${APP_URL}/dashboard`)}
  `);
}

// ─── Paiement échoué ──────────────────────────────────────────────────────────
function paymentFailed({ firstName, companyName, amount }) {
  return base('⚠️ Échec de paiement', `
    <div style="background:#ef444422;border:1px solid #ef444455;border-radius:10px;padding:14px 18px;margin-bottom:24px;text-align:center;">
      <span style="color:#ef4444;font-weight:700;font-size:15px;">⚠️ Votre paiement a échoué</span>
    </div>

    <h1 style="color:white;font-size:21px;margin:0 0 12px;">Bonjour ${firstName},</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 12px;line-height:1.6;">
      Le paiement de <strong style="color:white;">${amount} €</strong> pour l'abonnement
      <strong style="color:white;">${companyName}</strong> a échoué.
    </p>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      Votre accès sera suspendu si la situation n'est pas régularisée rapidement.
      Vérifiez vos informations de paiement depuis votre espace abonnement.
    </p>

    ${btn('Régulariser maintenant →', `${APP_URL}/billing`, '#ef4444')}
  `);
}

// ─── Résiliation confirmée ────────────────────────────────────────────────────
function cancellationConfirmed({ firstName, companyName, cancelAt }) {
  return base('Résiliation planifiée', `
    <h1 style="color:white;font-size:22px;margin:0 0 12px;">Résiliation confirmée</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 12px;line-height:1.6;">
      Bonjour ${firstName}, la résiliation du compte <strong style="color:white;">${companyName}</strong>
      a bien été enregistrée.
    </p>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
      Votre accès reste actif jusqu'au <strong style="color:white;">${cancelAt}</strong>.
    </p>

    <div style="background:#f59e0b22;border:1px solid #f59e0b55;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="color:#f59e0b;font-size:13px;font-weight:600;margin:0 0 10px;">⚠️ Pensez à exporter vos données avant cette date</p>
      <ul style="color:#94a3b8;font-size:13px;margin:0;padding-left:18px;line-height:1.9;">
        <li>Planning et historique des prestations</li>
        <li>Fiches agents et contrats de travail</li>
        <li>Devis et documents clients</li>
      </ul>
    </div>

    <div style="margin-bottom:10px;"><a href="${APP_URL}/billing" style="display:block;background:#1e293b;border:1px solid #334155;color:#60a5fa;text-align:center;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Annuler la résiliation →</a></div>
    ${btn('Accéder à mon espace →', `${APP_URL}/dashboard`)}
  `);
}

// ─── Nouvelle fonctionnalité (newsletter) ─────────────────────────────────────
function newFeature({ features, ctaUrl }) {
  const featureList = features.map(f =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #1e293b;">
      <div style="color:white;font-weight:600;font-size:14px;">✨ ${f.title}</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:3px;">${f.description}</div>
    </td></tr>`
  ).join('');

  return base('Nouveautés SecuritySaaS 🚀', `
    <h1 style="color:white;font-size:24px;margin:0 0 8px;">Nouvelles fonctionnalités disponibles 🚀</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      Nous avons mis à jour votre logiciel avec de nouvelles fonctionnalités.
      Tout est déjà disponible dans votre espace.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">${featureList}</table>
      </td></tr>
    </table>

    ${btn('Découvrir les nouveautés →', ctaUrl || `${APP_URL}/dashboard`)}
  `);
}

// ─── Email de signature de contrat ────────────────────────────────────────────
function contractSignRequest({ agentName, companyName, contractType, signUrl }) {
  const typeLabels = { CDI: 'CDI', CDD: 'CDD', avenant: 'Avenant' };
  return base(`Votre contrat ${typeLabels[contractType] || contractType} à signer`, `
    <h1 style="color:white;font-size:22px;margin:0 0 12px;">Contrat à signer 📝</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 12px;line-height:1.6;">
      Bonjour ${agentName},
    </p>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      <strong style="color:white;">${companyName}</strong> vous invite à signer votre contrat
      <strong style="color:white;">${typeLabels[contractType] || contractType}</strong>.
      Cliquez sur le bouton ci-dessous pour consulter et signer votre document.
    </p>

    ${btn('Consulter et signer mon contrat →', signUrl)}

    <p style="color:#475569;font-size:12px;margin:16px 0 0;text-align:center;">
      Ce lien est valable 30 jours. En cas de problème, contactez votre employeur.
    </p>
  `);
}

module.exports = { welcome, trialEnding, paymentSucceeded, paymentFailed, cancellationConfirmed, newFeature, contractSignRequest };
