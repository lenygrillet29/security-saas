const APP_URL = process.env.APP_URL || 'https://securoplan.vercel.app';

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
              <div style="color:white;font-size:18px;font-weight:700;line-height:1.2;">SecuroPlan</div>
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
        SecuroPlan — Gestion Sécurité Privée<br>
        <a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">${APP_URL.replace('https://', '')}</a><br>
        <span style="color:#334155;">Vous recevez cet email car vous êtes client SecuroPlan.</span>
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
  return base('Bienvenue sur SecuroPlan 🎉', `
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
          ${row('Plan', 'SecuroPlan Pro')}
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

  return base('Nouveautés SecuroPlan 🚀', `
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

// ─── Portail client ────────────────────────────────────────────────────────────
function clientPortalLink({ clientName, companyName, portalUrl }) {
  return base(`Votre espace planning — ${companyName}`, `
    <h1 style="color:white;font-size:22px;margin:0 0 12px;">Votre espace planning 📅</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 12px;line-height:1.6;">
      Bonjour,
    </p>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      <strong style="color:white;">${companyName}</strong> vous donne accès à votre espace de suivi des prestations.
      Vous pouvez consulter en temps réel les agents planifiés sur vos sites.
    </p>

    ${btn('Voir mon planning →', portalUrl, '#10b981')}

    <p style="color:#475569;font-size:12px;margin:20px 0 0;text-align:center;line-height:1.8;">
      Ce lien est personnel et réservé à <strong style="color:#64748b;">${clientName}</strong>.<br>
      Enregistrez-le dans vos favoris pour y accéder à tout moment.
    </p>
  `);
}

// ─── Accès agent mobile ────────────────────────────────────────────────────────
function agentPortalLink({ agentFirstName, companyName, portalUrl }) {
  return base(`Votre espace agent — ${companyName}`, `
    <h1 style="color:white;font-size:22px;margin:0 0 12px;">Bienvenue ${agentFirstName} ! 👋</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 12px;line-height:1.6;">
      <strong style="color:white;">${companyName}</strong> vous a créé un espace personnel pour consulter
      votre planning et pointer vos prises de service.
    </p>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      Cliquez sur le bouton ci-dessous depuis votre téléphone pour accéder à votre espace.
      Vous pouvez l'installer sur votre écran d'accueil comme une application.
    </p>

    ${btn('Accéder à mon espace →', portalUrl, '#2563eb')}

    <p style="color:#475569;font-size:12px;margin:20px 0 0;text-align:center;line-height:1.8;">
      Ce lien est personnel — ne le partagez pas.<br>
      En cas de problème, contactez votre responsable.
    </p>
  `);
}

// ─── Réinitialisation mot de passe ────────────────────────────────────────────
function passwordReset({ resetUrl }) {
  return base('Réinitialisation de votre mot de passe', `
    <h1 style="color:white;font-size:22px;margin:0 0 12px;">Mot de passe oublié ? 🔑</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
      Vous avez demandé à réinitialiser votre mot de passe SecuroPlan.<br>
      Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.<br>
      <strong style="color:#64748b;">Ce lien expire dans 1 heure.</strong>
    </p>

    ${btn('Réinitialiser mon mot de passe →', resetUrl)}

    <p style="color:#475569;font-size:12px;margin:20px 0 0;text-align:center;line-height:1.8;">
      Si vous n'avez pas fait cette demande, ignorez cet email.<br>
      Votre mot de passe ne sera pas modifié.
    </p>
  `);
}

// ─── Offre de vacation ─────────────────────────────────────────────────────────
function shiftOffer({ agentFirstName, companyName, date, startTime, endTime, siteName, portalUrl }) {
  return base(`Proposition de vacation — ${companyName}`, `
    <h1 style="color:white;font-size:22px;margin:0 0 12px;">Nouvelle proposition de vacation 📋</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
      Bonjour ${agentFirstName},<br><br>
      <strong style="color:white;">${companyName}</strong> vous propose une vacation.
      Consultez les détails et répondez depuis votre espace agent.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px;font-weight:600;">Détail de la vacation</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('Date', date)}
          ${row('Horaires', `${startTime} – ${endTime}`)}
          ${row('Site', siteName)}
        </table>
      </td></tr>
    </table>

    ${btn('Voir et répondre à la demande →', portalUrl, '#2563eb')}

    <p style="color:#475569;font-size:12px;margin:16px 0 0;text-align:center;line-height:1.8;">
      Acceptez ou déclinez depuis votre espace agent.<br>
      En cas de problème, contactez votre responsable directement.
    </p>
  `);
}

function invoiceOverdue({ clientName, companyName, invoiceNumber, totalTtc, dueDate, daysLate, appUrl }) {
  const urgency = daysLate >= 30 ? '🔴 URGENT — ' : daysLate >= 7 ? '⚠️ ' : '';
  return base(`${urgency}Facture impayée — ${invoiceNumber}`, `
    <h1 style="color:white;font-size:22px;margin:0 0 12px;">Rappel de paiement 📄</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
      Bonjour,<br><br>
      Sauf erreur de votre part, la facture ci-dessous n'a pas encore été réglée.
      Nous vous remercions de bien vouloir procéder au paiement dans les meilleurs délais.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px;font-weight:600;">Détail de la facture</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('N° facture', invoiceNumber)}
          ${row('Montant TTC', `<strong style="color:#f59e0b;">${totalTtc} €</strong>`)}
          ${row('Échéance', dueDate, '#f87171')}
          ${row('Retard', `${daysLate} jour${daysLate > 1 ? 's' : ''}`, '#f87171')}
        </table>
      </td></tr>
    </table>

    ${appUrl ? btn('Voir la facture →', appUrl, '#2563eb') : ''}

    <p style="color:#475569;font-size:12px;margin:16px 0 0;text-align:center;line-height:1.8;">
      Si vous avez déjà effectué le paiement, veuillez ignorer ce message.<br>
      Pour toute question, contactez <strong style="color:#94a3b8;">${companyName}</strong>.
    </p>
  `);
}

// ─── Demande d'absence (pour le gestionnaire) ─────────────────────────────────
function absenceRequest({ managerName, agentName, type, startDate, endDate, notes, appUrl }) {
  const fmt = d => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : d;
  return base('Nouvelle demande d\'absence', `
    <h1 style="color:white;font-size:22px;margin:0 0 6px;">📋 Nouvelle demande d'absence</h1>
    <p style="color:#94a3b8;margin:0 0 28px;font-size:14px;">Bonjour ${managerName}, une demande est en attente de validation.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <tbody>
        ${row('Agent', agentName)}
        ${row('Type', type)}
        ${row('Du', fmt(startDate))}
        ${row('Au', fmt(endDate))}
        ${notes ? row('Notes', notes) : ''}
      </tbody>
    </table>
    ${appUrl ? btn('Voir la demande →', `${appUrl}/absences`, '#f59e0b') : ''}
  `);
}

// ─── Décision sur une absence (pour l'agent) ──────────────────────────────────
function absenceDecision({ agentName, approved, type, startDate, endDate, reason, appUrl }) {
  const fmt = d => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : d;
  const color  = approved ? '#10b981' : '#ef4444';
  const icon   = approved ? '✅' : '❌';
  const title  = approved ? 'Absence approuvée' : 'Absence refusée';
  const msg    = approved
    ? `Votre demande de ${type} a été <strong style="color:#10b981;">approuvée</strong>.`
    : `Votre demande de ${type} a été <strong style="color:#ef4444;">refusée</strong>.`;
  return base(title, `
    <h1 style="color:white;font-size:22px;margin:0 0 6px;">${icon} ${title}</h1>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:14px;">Bonjour ${agentName},</p>
    <p style="color:#e2e8f0;font-size:15px;margin:0 0 24px;">${msg}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <tbody>
        ${row('Type', type)}
        ${row('Du', fmt(startDate))}
        ${row('Au', fmt(endDate))}
        ${reason ? row('Motif du refus', reason, '#f87171') : ''}
      </tbody>
    </table>
    ${appUrl ? btn('Voir mon planning →', `${appUrl}/absences`, color) : ''}
  `);
}

module.exports = { welcome, trialEnding, paymentSucceeded, paymentFailed, cancellationConfirmed, newFeature, contractSignRequest, clientPortalLink, agentPortalLink, passwordReset, shiftOffer, invoiceOverdue, absenceRequest, absenceDecision };
