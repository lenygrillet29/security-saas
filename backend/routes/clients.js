const express = require('express');
const router = require('express').Router();
const { db } = require('../db/database');
const { requireWriter } = require('../middleware/auth');
const { randomUUID } = require('crypto');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');

router.get('/', async (req, res) => {
  try {
    res.json(await db.all('SELECT * FROM clients WHERE company_id = ? ORDER BY name', [req.user.companyId]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await db.get('SELECT * FROM clients WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });
    res.json(client);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireWriter, async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, city, postal_code, siret, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    if (!email) return res.status(400).json({ error: 'Email requis' });
    const result = await db.insert(
      `INSERT INTO clients (company_id, name, contact_name, email, phone, address, city, postal_code, siret, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyId, name, contact_name || null, email || null, phone || null,
        address || null, city || null, postal_code || null, siret || null, notes || null]
    );
    res.status(201).json(await db.get('SELECT * FROM clients WHERE id = ?', [result.lastInsertRowid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireWriter, async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, city, postal_code, siret, active, notes } = req.body;
    const existing = await db.get('SELECT id FROM clients WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Client non trouvé' });
    await db.run(
      `UPDATE clients SET name=?, contact_name=?, email=?, phone=?, address=?, city=?, postal_code=?, siret=?, active=?, notes=?
       WHERE id=?`,
      [name, contact_name || null, email || null, phone || null,
        address || null, city || null, postal_code || null, siret || null,
        active !== undefined ? (active ? 1 : 0) : 1, notes || null, req.params.id]
    );
    res.json(await db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireWriter, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM clients WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!existing) return res.status(404).json({ error: 'Client non trouvé' });
    await db.run('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Portail client : génération / révocation du token ───────────────────────
router.post('/:id/portal-token', requireWriter, async (req, res) => {
  try {
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });
    const token = randomUUID();
    await db.run('UPDATE clients SET portal_token = ? WHERE id = ?', [token, client.id]);
    const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
    res.json({ token, url: `${appUrl}/portal/${token}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/portal-token', requireWriter, async (req, res) => {
  try {
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });
    await db.run('UPDATE clients SET portal_token = NULL WHERE id = ?', [client.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Portail client : envoi par email ────────────────────────────────────────
// Génère le token si besoin, puis envoie le lien au client par email
router.post('/:id/portal-send', requireWriter, async (req, res) => {
  try {
    const client = await db.get(
      'SELECT c.*, co.name AS company_name FROM clients c JOIN companies co ON co.id = c.company_id WHERE c.id = ? AND c.company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });
    if (!client.email) return res.status(400).json({ error: 'Ce client n\'a pas d\'adresse email renseignée' });

    // Générer ou réutiliser le token
    let token = client.portal_token;
    if (!token) {
      token = randomUUID();
      await db.run('UPDATE clients SET portal_token = ? WHERE id = ?', [token, client.id]);
    }

    const appUrl = process.env.APP_URL || 'https://securoplan.vercel.app';
    const portalUrl = `${appUrl}/portal/${token}`;

    await sendSystemEmail({
      to: client.email,
      subject: `Votre espace planning — ${client.company_name}`,
      html: templates.clientPortalLink({
        clientName:  client.name,
        companyName: client.company_name,
        portalUrl,
      }),
    });

    res.json({ token, url: portalUrl, sent_to: client.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
