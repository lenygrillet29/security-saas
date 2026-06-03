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
  });
  return doc;
}

function drawHeader(doc, company, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 80).fill('#1A1D2E');
  doc
    .fillColor('#3B82F6')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(company || 'Sécurité Pro', 40, 22);
  doc
    .fillColor('#F1F5F9')
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(title, doc.page.width / 2, 22, { align: 'right', width: doc.page.width / 2 - 40 });
  if (subtitle) {
    doc
      .fillColor('#94A3B8')
      .fontSize(9)
      .font('Helvetica')
      .text(subtitle, doc.page.width / 2, 42, { align: 'right', width: doc.page.width / 2 - 40 });
  }
  doc.moveDown(4);
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
    settings.company_name,
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

  return doc;
}

// Planning site
function generateSitePlanning(settings, site, client, shifts, startDate, endDate) {
  const doc = createDoc();
  drawHeader(
    doc,
    settings.company_name,
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

  return doc;
}

// Planning client
function generateClientPlanning(settings, client, sites, shifts, startDate, endDate) {
  const doc = createDoc();
  drawHeader(
    doc,
    settings.company_name,
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

  return doc;
}

// Devis
function generateQuote(settings, quote, client, site, lines) {
  const doc = createDoc();
  drawHeader(doc, settings.company_name, 'DEVIS', `N° ${quote.quote_number || quote.id}`);

  // Info colonnes
  const colW = (doc.page.width - 80) / 2 - 10;
  let y = doc.y;

  // Colonne émetteur
  doc.rect(40, y, colW, 100).fill('#1A1D2E');
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text('ÉMETTEUR', 50, y + 10);
  doc.fillColor('#F1F5F9').fontSize(10).font('Helvetica-Bold').text(settings.company_name || '', 50, y + 22);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(settings.company_address || '', 50, y + 36)
    .text(settings.company_phone || '', 50, y + 48)
    .text(settings.company_email || '', 50, y + 60);

  // Colonne destinataire
  const x2 = 40 + colW + 20;
  doc.rect(x2, y, colW, 100).fill('#1A1D2E');
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text('CLIENT', x2 + 10, y + 10);
  doc.fillColor('#F1F5F9').fontSize(10).font('Helvetica-Bold').text(client.name || '', x2 + 10, y + 22);
  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
    .text(client.address || '', x2 + 10, y + 36)
    .text(client.email || '', x2 + 10, y + 48)
    .text(client.phone || '', x2 + 10, y + 60);

  doc.y = y + 110;

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

  return doc;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

module.exports = {
  generateAgentPlanning,
  generateSitePlanning,
  generateClientPlanning,
  generateQuote,
};
