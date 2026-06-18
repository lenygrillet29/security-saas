const PDFDocument = require('pdfkit');
const { formatHours } = require('./hoursCalculator');

const COLORS = {
  bg: '#0F1117',
  surface: '#1A1D2E',
  primary: '#3B82F6',
  accent: '#10B981',
  text: '#F1F5F9',
  muted: '#94A3B8',
  border: '#2D3555',
  night: '#8B5CF6',
  sunday: '#F59E0B',
};

function createDoc() {
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    info: { Creator: 'SecuroPlan', Producer: 'SecuroPlan' },
    bufferPages: true,
  });
  return doc;
}

// Pied de page légal — appelé avant doc.end()
function addLegalFooters(doc, settings) {
  const parts = [];
  if (settings.company_name)      parts.push(settings.company_name);
  if (settings.company_siret)     parts.push(`SIRET : ${settings.company_siret}`);
  if (settings.company_tva_number) parts.push(`TVA : ${settings.company_tva_number}`);
  if (settings.company_cnaps)     parts.push(`CNAPS : ${settings.company_cnaps}`);
  if (settings.company_address)   parts.push(settings.company_address);

  const footerText = parts.join('  ·  ');
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    doc.rect(0, pageH - 30, pageW, 30).fill('#1A1D2E');
    doc.fillColor('#475569').fontSize(7).font('Helvetica')
       .text(footerText, 20, pageH - 19, { width: pageW - 40, align: 'center', lineBreak: false });
  }
}

function drawHeader(doc, settings, title, subtitle) {
  const company = typeof settings === 'string' ? settings : (settings.company_name || 'Sécurité Pro');
  const s = typeof settings === 'string' ? {} : settings;

  doc.rect(0, 0, doc.page.width, 90).fill('#1A1D2E');
  doc.fillColor('#3B82F6').fontSize(20).font('Helvetica-Bold').text(company, 40, 18);

  // Ligne légale sous le nom
  const legalParts = [];
  if (s.company_siret)      legalParts.push(`SIRET : ${s.company_siret}`);
  if (s.company_tva_number) legalParts.push(`TVA : ${s.company_tva_number}`);
  if (s.company_cnaps)      legalParts.push(`CNAPS : ${s.company_cnaps}`);
  if (legalParts.length > 0) {
    doc.fillColor('#64748B').fontSize(7).font('Helvetica').text(legalParts.join('   ·   '), 40, 43);
  }

  doc.fillColor('#F1F5F9').fontSize(14).font('Helvetica-Bold')
     .text(title, doc.page.width / 2, 18, { align: 'right', width: doc.page.width / 2 - 40 });
  if (subtitle) {
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica')
       .text(subtitle, doc.page.width / 2, 40, { align: 'right', width: doc.page.width / 2 - 40 });
  }
  doc.moveDown(5);
}

function drawSection(doc, title) {
  const y = doc.y;
  doc.rect(40, y, doc.page.width - 80, 24).fill('#2D3555');
  doc
    .fillColor('#3B82F6')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(title, 50, y + 7);
  doc.y = y + 30;
}

function tableRow(doc, cols, y, bg, textColor) {
  if (bg) doc.rect(40, y, doc.page.width - 80, 20).fill(bg);
  let x = 50;
  const color = textColor || '#F1F5F9';
  doc.fillColor(color).fontSize(8).font('Helvetica');
  for (const col of cols) {
    doc.text(col.text || '', x, y + 6, { width: col.width, align: col.align || 'left', lineBreak: false });
    x += col.width + 10;
  }
  return y + 20;
}

function tableHeader(doc, cols, y) {
  doc.rect(40, y, doc.page.width - 80, 22).fill('#3B82F6');
  let x = 50;
  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  for (const col of cols) {
    doc.text(col.label || '', x, y + 7, { width: col.width, align: col.align || 'left', lineBreak: false });
    x += col.width + 10;
  }
  return y + 22;
}

// Planning agent
function generateAgentPlanning(settings, agent, shifts, startDate, endDate) {
  const doc = createDoc();
  drawHeader(
    doc,
    settings,
    'PLANNING AGENT',
    `${agent.first_name} ${agent.last_name} — ${formatDate(startDate)} au ${formatDate(endDate)}`
  );

  drawSection(doc, `Agent : ${agent.first_name} ${agent.last_name} — N° ${agent.employee_number || '-'}`);
  doc.moveDown(0.5);

  const cols = [
    { label: 'Date', width: 70 },
    { label: 'Site', width: 120 },
    { label: 'Début', width: 45 },
    { label: 'Fin', width: 45 },
    { label: 'H.Jour', width: 45, align: 'right' },
    { label: 'H.Nuit', width: 45, align: 'right' },
    { label: 'H.Dim', width: 45, align: 'right' },
    { label: 'Total', width: 45, align: 'right' },
  ];

  let y = tableHeader(doc, cols, doc.y);
  let totalDay = 0, totalNight = 0, totalSunday = 0;

  shifts.forEach((s, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
    const total = s.hours_day + s.hours_night + s.hours_sunday;
    totalDay += s.hours_day;
    totalNight += s.hours_night;
    totalSunday += s.hours_sunday;
    y = tableRow(doc, [
      { text: formatDate(s.date), width: 70 },
      { text: s.site_name || '-', width: 120 },
      { text: s.start_time, width: 45 },
      { text: s.end_time, width: 45 },
      { text: formatHours(s.hours_day), width: 45, align: 'right' },
      { text: formatHours(s.hours_night), width: 45, align: 'right' },
      { text: formatHours(s.hours_sunday), width: 45, align: 'right' },
      { text: formatHours(total), width: 45, align: 'right' },
    ], y, i % 2 === 0 ? '#1A1D2E' : '#21253A');
  });

  // Totaux
  if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
  doc.rect(40, y, doc.page.width - 80, 24).fill('#10B981');
  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
  doc.text('TOTAUX', 50, y + 8);
  const totalAll = totalDay + totalNight + totalSunday;
  const tw = doc.page.width - 80;
  doc.text(formatHours(totalDay), 40 + tw - 200, y + 8, { width: 45, align: 'right' });
  doc.text(formatHours(totalNight), 40 + tw - 145, y + 8, { width: 45, align: 'right' });
  doc.text(formatHours(totalSunday), 40 + tw - 90, y + 8, { width: 45, align: 'right' });
  doc.text(formatHours(totalAll), 40 + tw - 35, y + 8, { width: 45, align: 'right' });

  addLegalFooters(doc, settings);
  return doc;
}

// Planning site
function generateSitePlanning(settings, site, client, shifts, startDate, endDate) {
  const doc = createDoc();
  drawHeader(
    doc,
    settings,
    'PLANNING SITE',
    `${site.name} — ${formatDate(startDate)} au ${formatDate(endDate)}`
  );

  drawSection(doc, `Site : ${site.name} | Client : ${client.name}`);
  doc.moveDown(0.5);

  const cols = [
    { label: 'Date', width: 70 },
    { label: 'Agent', width: 120 },
    { label: 'Début', width: 45 },
    { label: 'Fin', width: 45 },
    { label: 'H.Jour', width: 45, align: 'right' },
    { label: 'H.Nuit', width: 45, align: 'right' },
    { label: 'H.Dim', width: 45, align: 'right' },
    { label: 'Total', width: 45, align: 'right' },
  ];

  let y = tableHeader(doc, cols, doc.y);

  shifts.forEach((s, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
    const total = s.hours_day + s.hours_night + s.hours_sunday;
    y = tableRow(doc, [
      { text: formatDate(s.date), width: 70 },
      { text: `${s.agent_first_name} ${s.agent_last_name}`, width: 120 },
      { text: s.start_time, width: 45 },
      { text: s.end_time, width: 45 },
      { text: formatHours(s.hours_day), width: 45, align: 'right' },
      { text: formatHours(s.hours_night), width: 45, align: 'right' },
      { text: formatHours(s.hours_sunday), width: 45, align: 'right' },
      { text: formatHours(total), width: 45, align: 'right' },
    ], y, i % 2 === 0 ? '#1A1D2E' : '#21253A');
  });

  addLegalFooters(doc, settings);
  return doc;
}

// Planning client
function generateClientPlanning(settings, client, sites, shifts, startDate, endDate) {
  const doc = createDoc();
  drawHeader(
    doc,
    settings,
    'PLANNING CLIENT',
    `${client.name} — ${formatDate(startDate)} au ${formatDate(endDate)}`
  );

  drawSection(doc, `Client : ${client.name}`);
  doc.moveDown(0.5);

  const cols = [
    { label: 'Date', width: 65 },
    { label: 'Site', width: 100 },
    { label: 'Agent', width: 100 },
    { label: 'Début', width: 40 },
    { label: 'Fin', width: 40 },
    { label: 'H.Jour', width: 40, align: 'right' },
    { label: 'H.Nuit', width: 40, align: 'right' },
    { label: 'H.Dim', width: 40, align: 'right' },
    { label: 'Total', width: 40, align: 'right' },
  ];

  let y = tableHeader(doc, cols, doc.y);

  shifts.forEach((s, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
    const total = s.hours_day + s.hours_night + s.hours_sunday;
    y = tableRow(doc, [
      { text: formatDate(s.date), width: 65 },
      { text: s.site_name || '-', width: 100 },
      { text: `${s.agent_first_name} ${s.agent_last_name}`, width: 100 },
      { text: s.start_time, width: 40 },
      { text: s.end_time, width: 40 },
      { text: formatHours(s.hours_day), width: 40, align: 'right' },
      { text: formatHours(s.hours_night), width: 40, align: 'right' },
      { text: formatHours(s.hours_sunday), width: 40, align: 'right' },
      { text: formatHours(total), width: 40, align: 'right' },
    ], y, i % 2 === 0 ? '#1A1D2E' : '#21253A');
  });

  addLegalFooters(doc, settings);
  return doc;
}

// Devis
function generateQuote(settings, quote, client, site, lines) {
  const doc = createDoc();
  drawHeader(doc, settings, 'DEVIS', `N° ${quote.quote_number || quote.id}`);

  // Info colonnes
  const colW = (doc.page.width - 80) / 2 - 10;
  let y = doc.y;

  // Colonne émetteur (hauteur augmentée pour les mentions légales)
  const emitterH = 120;
  doc.rect(40, y, colW, emitterH).fill('#1A1D2E');
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text('ÉMETTEUR', 50, y + 10);
  doc.fillColor('#F1F5F9').fontSize(10).font('Helvetica-Bold').text(settings.company_name || '', 50, y + 22);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(settings.company_address || '', 50, y + 36)
    .text(settings.company_phone || '', 50, y + 48)
    .text(settings.company_email || '', 50, y + 60);
  // Mentions légales émetteur
  let legalY = y + 74;
  if (settings.company_siret) {
    doc.text(`SIRET : ${settings.company_siret}`, 50, legalY); legalY += 11;
  }
  if (settings.company_tva_number) {
    doc.text(`TVA : ${settings.company_tva_number}`, 50, legalY); legalY += 11;
  }
  if (settings.company_cnaps) {
    doc.text(`CNAPS : ${settings.company_cnaps}`, 50, legalY);
  }

  // Colonne destinataire
  const x2 = 40 + colW + 20;
  doc.rect(x2, y, colW, emitterH).fill('#1A1D2E');
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text('CLIENT', x2 + 10, y + 10);
  doc.fillColor('#F1F5F9').fontSize(10).font('Helvetica-Bold').text(client.name || '', x2 + 10, y + 22);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(client.address || '', x2 + 10, y + 36)
    .text(client.email || '', x2 + 10, y + 48)
    .text(client.phone || '', x2 + 10, y + 60);
  if (client.siret) doc.text(`SIRET : ${client.siret}`, x2 + 10, y + 74);

  doc.y = y + emitterH + 10;

  // Infos devis
  doc.rect(40, doc.y, doc.page.width - 80, 40).fill('#2D3555');
  const iy = doc.y;
  doc.fillColor('#3B82F6').fontSize(16).font('Helvetica-Bold')
    .text(quote.title || 'Devis', 50, iy + 12);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(`Date : ${formatDate(quote.created_at?.split('T')[0] || new Date().toISOString().split('T')[0])}`, doc.page.width - 200, iy + 10)
    .text(`Valide jusqu'au : ${quote.valid_until ? formatDate(quote.valid_until) : '-'}`, doc.page.width - 200, iy + 22);
  if (site) {
    doc.fillColor('#94A3B8').fontSize(8)
      .text(`Site : ${site.name}`, 50, iy + 28);
  }
  doc.y = iy + 50;
  doc.moveDown(0.5);

  // Lignes
  const cols = [
    { label: 'Description', width: 160 },
    { label: 'H.Jour', width: 55, align: 'right' },
    { label: 'Taux/h jour', width: 65, align: 'right' },
    { label: 'H.Nuit', width: 55, align: 'right' },
    { label: 'Taux/h nuit', width: 65, align: 'right' },
    { label: 'H.Dim', width: 55, align: 'right' },
    { label: 'Taux/h dim', width: 65, align: 'right' },
    { label: 'Total HT', width: 60, align: 'right' },
  ];

  let ty = tableHeader(doc, cols, doc.y);
  let grandTotal = 0;

  lines.forEach((l, i) => {
    if (ty > doc.page.height - 100) { doc.addPage(); ty = 60; }
    const total = (l.hours_day * l.rate_day) + (l.hours_night * l.rate_night) + (l.hours_sunday * l.rate_sunday);
    grandTotal += total;
    ty = tableRow(doc, [
      { text: l.description, width: 160 },
      { text: formatHours(l.hours_day), width: 55, align: 'right' },
      { text: `${l.rate_day}€`, width: 65, align: 'right' },
      { text: formatHours(l.hours_night), width: 55, align: 'right' },
      { text: `${l.rate_night}€`, width: 65, align: 'right' },
      { text: formatHours(l.hours_sunday), width: 55, align: 'right' },
      { text: `${l.rate_sunday}€`, width: 65, align: 'right' },
      { text: `${total.toFixed(2)}€`, width: 60, align: 'right' },
    ], ty, i % 2 === 0 ? '#1A1D2E' : '#21253A');
  });

  // Totaux TVA
  if (ty > doc.page.height - 120) { doc.addPage(); ty = 60; }
  ty += 10;
  const tvaRate = parseFloat(quote.tva_rate || settings.tva_rate || 20);
  const tvaAmount = grandTotal * tvaRate / 100;
  const totalTTC = grandTotal + tvaAmount;

  const totalX = doc.page.width - 200;
  doc.rect(totalX, ty, 160, 22).fill('#2D3555');
  doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text('Total HT', totalX + 10, ty + 7);
  doc.fillColor('#F1F5F9').text(`${grandTotal.toFixed(2)} €`, totalX + 10, ty + 7, { align: 'right', width: 140 });
  ty += 22;

  doc.rect(totalX, ty, 160, 22).fill('#21253A');
  doc.fillColor('#94A3B8').fontSize(9).text(`TVA ${tvaRate}%`, totalX + 10, ty + 7);
  doc.fillColor('#F1F5F9').text(`${tvaAmount.toFixed(2)} €`, totalX + 10, ty + 7, { align: 'right', width: 140 });
  ty += 22;

  doc.rect(totalX, ty, 160, 28).fill('#3B82F6');
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('Total TTC', totalX + 10, ty + 8);
  doc.text(`${totalTTC.toFixed(2)} €`, totalX + 10, ty + 8, { align: 'right', width: 140 });

  // Notes
  if (quote.notes) {
    doc.y = ty + 50;
    drawSection(doc, 'Notes');
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text(quote.notes, 50, doc.y);
  }

  addLegalFooters(doc, settings);
  return doc;
}

// Badge agent (format carte ID, 243 × 390 pts ≈ 86 × 137 mm)
function generateAgentBadge(settings, agent) {
  const W = 244, H = 390;
  const doc = new PDFDocument({ size: [W, H], margin: 0, bufferPages: true, info: { Creator: 'SecuroPlan' } });

  // Fond dégradé sombre
  doc.rect(0, 0, W, H).fill('#0F1117');

  // Bande supérieure société
  doc.rect(0, 0, W, 60).fill('#1A1D2E');
  doc.fillColor('#3B82F6').fontSize(13).font('Helvetica-Bold')
     .text(settings.company_name || 'SecuroPlan', 0, 14, { align: 'center', width: W });
  if (settings.company_cnaps) {
    doc.fillColor('#64748B').fontSize(7).font('Helvetica')
       .text(`CNAPS : ${settings.company_cnaps}`, 0, 32, { align: 'center', width: W });
  }
  doc.fillColor('#3B82F6').fontSize(8).font('Helvetica-Bold')
     .text('AGENT DE SÉCURITÉ', 0, 44, { align: 'center', width: W });

  // Photo
  const photoSize = 90;
  const photoX = (W - photoSize) / 2;
  const photoY = 74;

  if (agent.photo) {
    try {
      // data URL → Buffer
      const base64 = agent.photo.replace(/^data:image\/\w+;base64,/, '');
      const imgBuf = Buffer.from(base64, 'base64');
      doc.save();
      // Cercle de découpe
      doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2).clip();
      doc.image(imgBuf, photoX, photoY, { width: photoSize, height: photoSize, cover: [photoSize, photoSize] });
      doc.restore();
      // Bordure cercle
      doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2)
         .lineWidth(2).stroke('#3B82F6');
    } catch (_) {
      // Fallback avatar initiales
      drawInitialsAvatar(doc, agent, photoX, photoY, photoSize);
    }
  } else {
    drawInitialsAvatar(doc, agent, photoX, photoY, photoSize);
  }

  // Nom
  let y = photoY + photoSize + 14;
  doc.fillColor('#F1F5F9').fontSize(16).font('Helvetica-Bold')
     .text(`${agent.first_name} ${agent.last_name}`.toUpperCase(), 0, y, { align: 'center', width: W });
  y += 22;

  // Matricule
  if (agent.employee_number) {
    doc.fillColor('#64748B').fontSize(8).font('Helvetica')
       .text(`N° Matricule : ${agent.employee_number}`, 0, y, { align: 'center', width: W });
    y += 14;
  }

  // Ligne séparatrice
  y += 4;
  doc.rect(20, y, W - 40, 1).fill('#2D3555');
  y += 10;

  // Infos clés
  const rows = [
    agent.carte_pro    && ['Carte Pro CNAPS', agent.carte_pro],
    agent.contract_type && ['Contrat', agent.contract_type],
    agent.entry_date   && ['Entrée', formatDate(agent.entry_date)],
    agent.exit_date    && ['Sortie', formatDate(agent.exit_date)],
    agent.nationality  && ['Nationalité', agent.nationality],
  ].filter(Boolean);

  for (const [label, val] of rows) {
    if (y > H - 60) break;
    doc.fillColor('#64748B').fontSize(7).font('Helvetica').text(label, 20, y);
    doc.fillColor('#E2E8F0').fontSize(8).font('Helvetica-Bold').text(val, 110, y, { width: W - 130 });
    y += 14;
  }

  // QR-code fictif ou pied de page
  y = H - 44;
  doc.rect(0, y, W, 44).fill('#1A1D2E');
  const legalLine = [settings.company_name, settings.company_siret && `SIRET ${settings.company_siret}`].filter(Boolean).join(' · ');
  doc.fillColor('#475569').fontSize(6.5).font('Helvetica')
     .text(legalLine, 10, y + 8, { width: W - 20, align: 'center', lineBreak: false });
  doc.fillColor('#334155').fontSize(6).font('Helvetica')
     .text(`Document généré par SecuroPlan — ${new Date().toLocaleDateString('fr-FR')}`, 10, y + 22, { width: W - 20, align: 'center' });

  return doc;
}

function drawInitialsAvatar(doc, agent, x, y, size) {
  doc.circle(x + size / 2, y + size / 2, size / 2).fill('#1E3A5F');
  doc.circle(x + size / 2, y + size / 2, size / 2).lineWidth(2).stroke('#3B82F6');
  const initials = `${agent.first_name?.[0] || ''}${agent.last_name?.[0] || ''}`.toUpperCase();
  doc.fillColor('#93C5FD').fontSize(size * 0.35).font('Helvetica-Bold')
     .text(initials, x, y + size * 0.3, { width: size, align: 'center' });
}

// Facture
function generateInvoice(settings, invoice, client, lines) {
  const doc = createDoc();
  drawHeader(doc, settings, 'FACTURE', `N° ${invoice.invoice_number || invoice.id}`);

  const colW = (doc.page.width - 80) / 2 - 10;
  let y = doc.y;
  const emitterH = 120;

  // Colonne émetteur
  doc.rect(40, y, colW, emitterH).fill('#1A1D2E');
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text('ÉMETTEUR', 50, y + 10);
  doc.fillColor('#F1F5F9').fontSize(10).font('Helvetica-Bold').text(settings.company_name || '', 50, y + 22);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(settings.company_address || '', 50, y + 36)
    .text(settings.company_phone || '', 50, y + 48)
    .text(settings.company_email || '', 50, y + 60);
  let legalY = y + 74;
  if (settings.company_siret)      { doc.text(`SIRET : ${settings.company_siret}`, 50, legalY); legalY += 11; }
  if (settings.company_tva_number) { doc.text(`TVA : ${settings.company_tva_number}`, 50, legalY); legalY += 11; }
  if (settings.company_cnaps)      { doc.text(`CNAPS : ${settings.company_cnaps}`, 50, legalY); }

  // Colonne client
  const x2 = 40 + colW + 20;
  doc.rect(x2, y, colW, emitterH).fill('#1A1D2E');
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text('CLIENT', x2 + 10, y + 10);
  doc.fillColor('#F1F5F9').fontSize(10).font('Helvetica-Bold').text(client.name || '', x2 + 10, y + 22);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(client.address || '', x2 + 10, y + 36)
    .text(client.email || '', x2 + 10, y + 48)
    .text(client.phone || '', x2 + 10, y + 60);
  if (client.siret) doc.text(`SIRET : ${client.siret}`, x2 + 10, y + 74);

  doc.y = y + emitterH + 10;

  // Bandeau infos facture
  doc.rect(40, doc.y, doc.page.width - 80, 46).fill('#2D3555');
  const iy = doc.y;
  doc.fillColor('#3B82F6').fontSize(16).font('Helvetica-Bold').text(invoice.title || 'Facture', 50, iy + 12);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(`Date d'émission : ${formatDate(invoice.issue_date)}`, doc.page.width - 200, iy + 8)
    .text(`Échéance : ${invoice.due_date ? formatDate(invoice.due_date) : '-'}`, doc.page.width - 200, iy + 20)
    .text(`Statut : ${invoice.status === 'paid' ? '✓ Payée' : invoice.status === 'sent' ? 'Envoyée' : 'Brouillon'}`, doc.page.width - 200, iy + 32);
  doc.y = iy + 56;
  doc.moveDown(0.5);

  // Tableau des lignes
  const cols = [
    { label: 'Description', width: 220 },
    { label: 'Qté', width: 50, align: 'right' },
    { label: 'Prix unit. HT', width: 80, align: 'right' },
    { label: 'Total HT', width: 80, align: 'right' },
  ];

  let ty = tableHeader(doc, cols, doc.y);
  let grandTotal = 0;

  lines.forEach((l, i) => {
    if (ty > doc.page.height - 120) { doc.addPage(); ty = 60; }
    const total = l.quantity * l.unit_price;
    grandTotal += total;
    ty = tableRow(doc, [
      { text: l.description, width: 220 },
      { text: String(l.quantity), width: 50, align: 'right' },
      { text: `${parseFloat(l.unit_price).toFixed(2)} €`, width: 80, align: 'right' },
      { text: `${total.toFixed(2)} €`, width: 80, align: 'right' },
    ], ty, i % 2 === 0 ? '#1A1D2E' : '#21253A');
  });

  // Totaux TVA
  if (ty > doc.page.height - 140) { doc.addPage(); ty = 60; }
  ty += 10;
  const tvaRate = parseFloat(invoice.tva_rate || settings.tva_rate || 20);
  const tvaAmount = grandTotal * tvaRate / 100;
  const totalTTC = grandTotal + tvaAmount;

  const totalX = doc.page.width - 200;
  doc.rect(totalX, ty, 160, 22).fill('#2D3555');
  doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text('Total HT', totalX + 10, ty + 7);
  doc.fillColor('#F1F5F9').text(`${grandTotal.toFixed(2)} €`, totalX + 10, ty + 7, { align: 'right', width: 140 });
  ty += 22;

  doc.rect(totalX, ty, 160, 22).fill('#21253A');
  doc.fillColor('#94A3B8').fontSize(9).text(`TVA ${tvaRate}%`, totalX + 10, ty + 7);
  doc.fillColor('#F1F5F9').text(`${tvaAmount.toFixed(2)} €`, totalX + 10, ty + 7, { align: 'right', width: 140 });
  ty += 22;

  doc.rect(totalX, ty, 160, 28).fill('#3B82F6');
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('Total TTC', totalX + 10, ty + 8);
  doc.text(`${totalTTC.toFixed(2)} €`, totalX + 10, ty + 8, { align: 'right', width: 140 });

  // Mentions de paiement
  ty += 44;
  if (ty > doc.page.height - 120) { doc.addPage(); ty = 60; }
  doc.fillColor('#64748B').fontSize(8).font('Helvetica')
     .text('Paiement par virement bancaire. En cas de retard, des pénalités de retard au taux légal en vigueur seront appliquées.', 40, ty, { width: doc.page.width - 80 });

  if (invoice.notes) {
    ty += 30;
    drawSection(doc, 'Notes');
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text(invoice.notes, 50, doc.y);
  }

  addLegalFooters(doc, settings);
  return doc;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Rapport d'incident ────────────────────────────────────────────────────────
function generateIncidentReport(settings, incident) {
  const doc = createDoc();
  const W   = doc.page.width - 80;
  const L   = 40;

  const SEV_COLORS = {
    critique: '#EF4444',
    majeur:   '#F97316',
    modere:   '#F59E0B',
    mineur:   '#94A3B8',
  };
  const SEV_LABELS = { critique: 'CRITIQUE', majeur: 'MAJEUR', modere: 'MODÉRÉ', mineur: 'MINEUR' };
  const TYPE_LABELS = { intrusion: 'Intrusion', vol: 'Vol', vandalisme: 'Vandalisme', accident: 'Accident', incendie: 'Incendie', agression: 'Agression', technique: 'Défaillance technique', autre: 'Autre' };

  const sevColor = SEV_COLORS[incident.severity] || COLORS.muted;
  const sevLabel = SEV_LABELS[incident.severity] || incident.severity;
  const typeLabel = TYPE_LABELS[incident.type] || incident.type;
  const statusLabel = incident.status === 'clos' ? 'CLOS' : 'OUVERT';

  drawHeader(doc, settings, "Rapport d'incident", `N° ${incident.id} — ${incident.date || ''}`);

  // Badge gravité
  const badgeY = doc.y;
  doc.rect(L, badgeY, 120, 28).fill(sevColor + '22');
  doc.rect(L, badgeY, 4, 28).fill(sevColor);
  doc.fillColor(sevColor).fontSize(11).font('Helvetica-Bold')
     .text(sevLabel, L + 12, badgeY + 8, { width: 108 });

  doc.rect(L + 130, badgeY, 100, 28).fill('#1A1D2E');
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
     .text('TYPE  ', L + 142, badgeY + 5, { continued: true });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').text(typeLabel);
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
     .text('STATUT  ', L + 142, badgeY + 16, { continued: true });
  doc.fillColor(incident.status === 'clos' ? COLORS.accent : COLORS.sunday)
     .font('Helvetica-Bold').text(statusLabel);

  doc.y = badgeY + 38;

  // Infos générales
  drawSection(doc, 'Informations générales');
  const infoFields = [
    ['Date & heure', `${incident.date || '—'}${incident.time ? ' à ' + incident.time : ''}`],
    ['Site',         incident.site_name  || '—'],
    ['Client',       incident.client_name || '—'],
    ['Agent',        incident.agent_first ? `${incident.agent_last} ${incident.agent_first}` : '—'],
  ];
  const colW = (W - 20) / 2;
  infoFields.forEach(([label, val], i) => {
    const x  = L + (i % 2) * (colW + 20);
    const y  = doc.y + (i % 2 === 0 && i > 0 ? 0 : 0);
    if (i % 2 === 0 && i > 0) doc.moveDown(0.1);
    const rowY = doc.y;
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica').text(label, x, rowY);
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica-Bold').text(val, x, rowY + 11, { width: colW });
    if (i % 2 === 1) doc.moveDown(1.5);
  });
  doc.moveDown(0.5);

  // Titre de l'incident
  drawSection(doc, "Intitulé de l'incident");
  doc.fillColor(COLORS.text).fontSize(13).font('Helvetica-Bold').text(incident.title || '—', L, doc.y, { width: W });
  doc.moveDown(1);

  // Description
  if (incident.description) {
    drawSection(doc, 'Description des faits');
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica')
       .text(incident.description, L, doc.y, { width: W, lineGap: 3 });
    doc.moveDown(1);
  }

  // Mesures prises
  if (incident.actions_taken) {
    drawSection(doc, 'Mesures prises / Actions engagées');
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica')
       .text(incident.actions_taken, L, doc.y, { width: W, lineGap: 3 });
    doc.moveDown(1);
  }

  // Notes internes
  if (incident.notes) {
    drawSection(doc, 'Notes internes');
    doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica').italic
       .text(incident.notes, L, doc.y, { width: W, lineGap: 3 });
    doc.moveDown(1);
  }

  // Zone signature
  if (doc.y > doc.page.height - 120) doc.addPage();
  const sigY = Math.max(doc.y + 20, doc.page.height - 140);
  doc.rect(L, sigY, W, 80).fill('#1A1D2E');
  const halfW = (W - 20) / 2;
  doc.rect(L + 10, sigY + 40, halfW, 24).fill('#0F1117');
  doc.rect(L + 20 + halfW, sigY + 40, halfW, 24).fill('#0F1117');
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
     .text("Signature de l'agent", L + 10, sigY + 8, { width: halfW, align: 'center' })
     .text("Signature du responsable", L + 20 + halfW, sigY + 8, { width: halfW, align: 'center' });
  doc.fillColor('#475569').fontSize(7)
     .text('Date : _______________', L + 10, sigY + 68, { width: halfW, align: 'center' })
     .text('Date : _______________', L + 20 + halfW, sigY + 68, { width: halfW, align: 'center' });

  addLegalFooters(doc, settings);
  return doc;
}

// ── Rapport RH mensuel ────────────────────────────────────────────────────────
function generateRHReport(settings, month, agents) {
  const doc = createDoc();
  const W   = doc.page.width - 80; // 40px margin chaque côté
  const L   = 40;

  // Titre mois
  const [y, m] = month.split('-');
  const monthLabel = new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  drawHeader(doc, settings, 'Bilan RH', monthLabel);

  // ── Totaux globaux ────────────────────────────────────────────────────────
  const totalH    = agents.reduce((s, a) => s + (parseFloat(a.total_hours) || 0), 0);
  const totalAbs  = agents.reduce((s, a) => s + (parseFloat(a.absence_days) || 0), 0);
  const totalExp  = agents.reduce((s, a) => s + (parseFloat(a.expenses_total) || 0), 0);
  const alerts    = agents.filter(a => a.carte_pro_expired || a.cp_balance < 0);

  const fmtH = (h) => {
    if (!h || isNaN(h)) return '—';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h${mm > 0 ? String(mm).padStart(2, '0') : ''}`;
  };

  // Bandeaux résumé
  const kwW = W / 4;
  const kwY = doc.y;
  const kws = [
    { label: 'Agents', value: String(agents.length), color: COLORS.primary },
    { label: 'Total heures', value: fmtH(totalH), color: COLORS.accent },
    { label: 'Jours absents', value: `${totalAbs} j`, color: COLORS.sunday },
    { label: 'Notes de frais', value: `${totalExp.toFixed(0)} €`, color: COLORS.night },
  ];
  kws.forEach((kw, i) => {
    doc.rect(L + i * kwW, kwY, kwW - 6, 44).fill(COLORS.surface);
    doc.fillColor(kw.color).fontSize(16).font('Helvetica-Bold')
       .text(kw.value, L + i * kwW + 8, kwY + 6, { width: kwW - 16 });
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
       .text(kw.label, L + i * kwW + 8, kwY + 26, { width: kwW - 16 });
  });
  doc.y = kwY + 56;

  // ── Tableau ───────────────────────────────────────────────────────────────
  drawSection(doc, 'Détail par agent');

  // Colonnes : [label, width, align]
  const cols = [
    { label: 'Agent',       w: 130, align: 'left'  },
    { label: 'Total',       w: 50,  align: 'center' },
    { label: 'Jour',        w: 45,  align: 'center' },
    { label: 'Nuit',        w: 45,  align: 'center' },
    { label: 'Dim/Fér',    w: 50,  align: 'center' },
    { label: 'Absences',   w: 55,  align: 'center' },
    { label: 'CP solde',   w: 55,  align: 'center' },
    { label: 'Frais',      w: 55,  align: 'center' },
  ];

  // En-tête tableau
  let x = L;
  const headerY = doc.y;
  doc.rect(L, headerY, W, 20).fill('#2D3555');
  cols.forEach(col => {
    doc.fillColor(COLORS.muted).fontSize(7.5).font('Helvetica-Bold')
       .text(col.label, x + 4, headerY + 6, { width: col.w - 8, align: col.align });
    x += col.w;
  });
  doc.y = headerY + 22;

  // Lignes
  agents.forEach((a, idx) => {
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
      doc.y = 50;
    }
    const rowY = doc.y;
    const rowH = 22;
    if (idx % 2 === 0) doc.rect(L, rowY, W, rowH).fill('#141824');

    const night   = (parseFloat(a.hours_breakdown?.night) || 0)
                  + (parseFloat(a.hours_breakdown?.sunday_night) || 0);
    const special = (parseFloat(a.hours_breakdown?.sunday) || 0)
                  + (parseFloat(a.hours_breakdown?.holiday) || 0)
                  + (parseFloat(a.hours_breakdown?.holiday_night) || 0);
    const cpColor = a.cp_balance < 0 ? '#EF4444' : a.cp_balance < 5 ? '#F59E0B' : COLORS.accent;
    const alertIcon = a.carte_pro_expired ? ' ⚠' : '';

    const cells = [
      { val: `${a.last_name} ${a.first_name}${alertIcon}`, color: COLORS.text  },
      { val: fmtH(a.total_hours),   color: a.total_hours > 0 ? COLORS.primary : COLORS.muted },
      { val: fmtH(a.hours_breakdown?.day || 0), color: COLORS.sunday },
      { val: night > 0 ? fmtH(night) : '—',    color: COLORS.night  },
      { val: special > 0 ? fmtH(special) : '—', color: '#EC4899'    },
      { val: a.absence_days > 0 ? `${a.absence_days} j` : '—', color: a.absence_days > 0 ? '#F87171' : COLORS.muted },
      { val: `${parseFloat(a.cp_balance || 0).toFixed(1)} j`, color: cpColor },
      { val: a.expenses_total > 0 ? `${parseFloat(a.expenses_total).toFixed(0)} €` : '—', color: COLORS.accent },
    ];

    let cx = L;
    cells.forEach((cell, ci) => {
      doc.fillColor(cell.color).fontSize(8).font(ci === 0 ? 'Helvetica-Bold' : 'Helvetica')
         .text(cell.val, cx + 4, rowY + 7, { width: cols[ci].w - 8, align: cols[ci].align, lineBreak: false });
      cx += cols[ci].w;
    });
    doc.y = rowY + rowH;
  });

  // Ligne totaux
  const totY = doc.y + 4;
  doc.rect(L, totY, W, 22).fill('#1E2942');
  const totCells = [
    { val: `TOTAL (${agents.length} agents)`, color: COLORS.text },
    { val: fmtH(totalH), color: COLORS.primary },
    { val: '—', color: COLORS.muted },
    { val: '—', color: COLORS.muted },
    { val: '—', color: COLORS.muted },
    { val: `${totalAbs} j`, color: '#F87171' },
    { val: '—', color: COLORS.muted },
    { val: `${totalExp.toFixed(0)} €`, color: COLORS.accent },
  ];
  let tx = L;
  totCells.forEach((cell, ci) => {
    doc.fillColor(cell.color).fontSize(8).font('Helvetica-Bold')
       .text(cell.val, tx + 4, totY + 7, { width: cols[ci].w - 8, align: cols[ci].align, lineBreak: false });
    tx += cols[ci].w;
  });
  doc.y = totY + 30;

  // ── Alertes ───────────────────────────────────────────────────────────────
  if (alerts.length > 0) {
    drawSection(doc, 'Alertes');
    alerts.forEach(a => {
      const msgs = [];
      if (a.carte_pro_expired) msgs.push('Carte pro expirée');
      if (a.cp_balance < 0) msgs.push(`CP négatif : ${parseFloat(a.cp_balance).toFixed(1)} j`);
      doc.fillColor('#F87171').fontSize(9).font('Helvetica-Bold')
         .text(`${a.last_name} ${a.first_name}  `, L, doc.y, { continued: true });
      doc.fillColor(COLORS.muted).font('Helvetica').text(msgs.join(' · '));
      doc.moveDown(0.3);
    });
  }

  addLegalFooters(doc, settings);
  return doc;
}

// ── Tableau de service hebdomadaire (tous agents, format paysage) ─────────────
function generateWeeklyOverview(settings, startDate, endDate, shifts, agents) {
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape',
    margins: { top: 40, bottom: 40, left: 30, right: 30 },
    bufferPages: true,
    info: { Creator: 'SecuroPlan', Producer: 'SecuroPlan' },
  });

  const W = doc.page.width - 60; // 841 - 60 = 781

  // ── En-tête ────────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 50).fill(COLORS.primary);
  doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
    .text('TABLEAU DE SERVICE', 30, 14, { align: 'left', lineBreak: false });
  doc.fontSize(9).font('Helvetica')
    .text(`${formatDate(startDate)} — ${formatDate(endDate)}`, 30, 32, { lineBreak: false });

  const company = settings?.company_name || 'SecuroPlan';
  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
    .text(company, 0, 20, { width: doc.page.width - 30, align: 'right', lineBreak: false });

  // ── Construction calendrier ────────────────────────────────────────────────
  const DAY_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  // Colonnes
  const AGENT_W = 110;
  const GAP = 4;
  const dayW = Math.floor((W - AGENT_W - GAP * days.length) / days.length);
  const ROW_H = 38;
  const HEADER_H = 28;

  // Indexer shifts par agent + date
  const byAgentDate = {};
  shifts.forEach(s => {
    if (!s.agent_id) return;
    const key = `${s.agent_id}_${s.date}`;
    if (!byAgentDate[key]) byAgentDate[key] = [];
    byAgentDate[key].push(s);
  });

  let y = 60;

  // ── En-tête colonnes jours ─────────────────────────────────────────────────
  doc.rect(30, y, AGENT_W, HEADER_H).fill('#21253A');
  doc.fillColor(COLORS.muted).fontSize(7).font('Helvetica-Bold')
    .text('AGENT', 30, y + 10, { width: AGENT_W, align: 'center', lineBreak: false });

  days.forEach((d, i) => {
    const x = 30 + AGENT_W + GAP + i * (dayW + GAP);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    doc.rect(x, y, dayW, HEADER_H).fill(isWeekend ? '#2D2040' : '#21253A');
    doc.fillColor(isWeekend ? COLORS.sunday : COLORS.text).fontSize(7).font('Helvetica-Bold')
      .text(DAY_FR[d.getDay()], x, y + 4, { width: dayW, align: 'center', lineBreak: false });
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    doc.fillColor(COLORS.muted).fontSize(6).font('Helvetica')
      .text(`${dd}/${mm}`, x, y + 15, { width: dayW, align: 'center', lineBreak: false });
  });
  y += HEADER_H;

  // ── Lignes agents ──────────────────────────────────────────────────────────
  agents.forEach((agent, ai) => {
    if (y + ROW_H > doc.page.height - 50) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      y = 40;
    }
    const rowBg = ai % 2 === 0 ? COLORS.surface : '#21253A';

    // Cellule agent
    doc.rect(30, y, AGENT_W, ROW_H).fill(rowBg);
    doc.fillColor(COLORS.text).fontSize(7.5).font('Helvetica-Bold')
      .text(`${agent.first_name} ${agent.last_name}`, 33, y + 6, { width: AGENT_W - 6, lineBreak: false, ellipsis: true });
    if (agent.employee_number) {
      doc.fillColor(COLORS.muted).fontSize(6).font('Helvetica')
        .text(`N° ${agent.employee_number}`, 33, y + 17, { width: AGENT_W - 6, lineBreak: false });
    }

    // Cellules jours
    days.forEach((d, i) => {
      const x = 30 + AGENT_W + GAP + i * (dayW + GAP);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dateStr = d.toISOString().slice(0, 10);
      const dayShifts = byAgentDate[`${agent.id}_${dateStr}`] || [];

      const cellBg = isWeekend ? (rowBg === COLORS.surface ? '#1E1830' : '#241C38') : rowBg;
      doc.rect(x, y, dayW, ROW_H).fill(cellBg);

      if (dayShifts.length > 0) {
        const s = dayShifts[0];
        const hasNight = s.hours_night > 0;
        doc.fillColor(hasNight ? COLORS.night : COLORS.accent).fontSize(7).font('Helvetica-Bold')
          .text(`${s.start_time}–${s.end_time}`, x + 2, y + 5, { width: dayW - 4, align: 'center', lineBreak: false });
        const siteName = (s.site_name || '').slice(0, 14);
        doc.fillColor(COLORS.muted).fontSize(5.5).font('Helvetica')
          .text(siteName, x + 2, y + 16, { width: dayW - 4, align: 'center', lineBreak: false });
        if (dayShifts.length > 1) {
          doc.fillColor(COLORS.sunday).fontSize(5.5).font('Helvetica-Bold')
            .text(`+${dayShifts.length - 1}`, x + 2, y + 26, { width: dayW - 4, align: 'center', lineBreak: false });
        }
      }
    });

    // Séparateur horizontal
    doc.rect(30, y + ROW_H - 1, AGENT_W + days.length * (dayW + GAP), 1).fill(COLORS.border);
    y += ROW_H;
  });

  // ── Légende ────────────────────────────────────────────────────────────────
  y += 8;
  if (y < doc.page.height - 40) {
    doc.fillColor(COLORS.muted).fontSize(6.5).font('Helvetica')
      .text('● Vert = vacation de jour  ● Violet = vacation de nuit  ● +n = plusieurs vacations ce jour',
        30, y, { lineBreak: false });
  }

  addLegalFooters(doc, settings);
  return doc;
}

module.exports = {
  generateAgentPlanning,
  generateSitePlanning,
  generateClientPlanning,
  generateQuote,
  generateInvoice,
  generateAgentBadge,
  generateRHReport,
  generateIncidentReport,
  generateWeeklyOverview,
};
