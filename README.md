# SecuritySaaS — Gestion Sécurité Privée

Application SaaS complète de gestion pour entreprise de sécurité privée.

## Stack technique

- **Frontend** : Vite + React 18 + React Router DOM v6 + Tailwind CSS
- **Backend** : Node.js + Express
- **Base de données** : SQLite (via better-sqlite3)
- **PDF** : PDFKit
- **Email** : Nodemailer

## Prérequis

- Node.js >= 18 (https://nodejs.org)

## Installation

```bash
# 1. Installer les dépendances backend
cd backend
npm install

# 2. Installer les dépendances frontend
cd ../frontend
npm install
```

## Démarrage

### Démarrage séparé (recommandé en développement)

**Terminal 1 — Backend (port 3001) :**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend (port 3000) :**
```bash
cd frontend
npm run dev
```

Ouvrir http://localhost:3000

### Démarrage simultané (depuis la racine)

```bash
# Depuis le dossier security-saas/
npm install        # installe concurrently
npm run install:all
npm run dev
```

## Fonctionnalités

### Planning
- Vue **hebdomadaire** (par agent, avec shift par jour)
- Vue **mensuelle** (calendrier complet)
- Création/modification/suppression de shifts en un clic
- Affichage des absences dans le planning

### Calcul automatique des heures
- **Heures jour** : 06h00 – 21h00 (hors dimanche)
- **Heures nuit** : 21h00 – 06h00 (hors dimanche)
- **Heures dimanche** : toutes les heures du dimanche
- Gestion des shifts à cheval sur minuit

### Gestion
- **Agents** : CRUD, couleur planning, type de contrat, taux horaire
- **Clients** : CRUD, coordonnées, SIRET
- **Sites** : CRUD, rattachés à un client, taux jour/nuit/dimanche configurables
- **Absences** : Congés payés, arrêt maladie, formation, avec statut (approuvé/en attente/refusé)
- **Devis** : Lignes de prestation avec heures × taux, TVA, numérotation auto

### Export PDF
- Planning par agent
- Planning par site
- Planning par client
- Devis avec détail des lignes et totaux TVA

### Email
- Envoi du planning agent par email (PDF en pièce jointe)
- Envoi du devis par email (PDF en pièce jointe)
- Configuration SMTP dans les paramètres

## Structure du projet

```
security-saas/
├── backend/
│   ├── db/database.js          # SQLite + schéma
│   ├── routes/                  # API REST
│   │   ├── agents.js
│   │   ├── clients.js
│   │   ├── sites.js
│   │   ├── shifts.js
│   │   ├── absences.js
│   │   ├── quotes.js
│   │   ├── pdf.js
│   │   ├── email.js
│   │   └── settings.js
│   ├── utils/
│   │   ├── hoursCalculator.js   # Calcul heures jour/nuit/dimanche
│   │   ├── pdfGenerator.js      # Génération PDF (PDFKit)
│   │   └── emailSender.js       # Envoi email (Nodemailer)
│   └── server.js
└── frontend/
    └── src/
        ├── api/index.js          # Couche API centralisée
        ├── components/
        │   ├── Layout.jsx
        │   ├── Sidebar.jsx
        │   ├── Modal.jsx
        │   ├── Confirm.jsx
        │   └── Toast.jsx
        └── pages/
            ├── Dashboard.jsx
            ├── Planning.jsx      # Vue hebdo + mensuel
            ├── Agents.jsx
            ├── Clients.jsx
            ├── Sites.jsx
            ├── Absences.jsx
            ├── Quotes.jsx
            └── Settings.jsx
```

## Configuration email (Gmail)

1. Activer l'authentification à 2 facteurs sur votre compte Google
2. Créer un "Mot de passe d'application" (Paramètres Google > Sécurité)
3. Dans Paramètres de l'app :
   - Hôte SMTP : `smtp.gmail.com`
   - Port : `587`
   - Utilisateur : `votre@gmail.com`
   - Mot de passe : le mot de passe d'application généré

## API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/api/agents` | Liste / Créer agents |
| GET/PUT/DELETE | `/api/agents/:id` | Détail / Modifier / Supprimer |
| GET/POST | `/api/clients` | Liste / Créer clients |
| GET/POST | `/api/sites` | Liste / Créer sites |
| GET/POST | `/api/shifts` | Liste / Créer shifts |
| GET | `/api/shifts/stats/summary` | Stats heures par agent |
| GET/POST | `/api/absences` | Liste / Créer absences |
| GET/POST | `/api/quotes` | Liste / Créer devis |
| GET | `/api/pdf/planning/agent/:id` | PDF planning agent |
| GET | `/api/pdf/planning/site/:id` | PDF planning site |
| GET | `/api/pdf/planning/client/:id` | PDF planning client |
| GET | `/api/pdf/quote/:id` | PDF devis |
| POST | `/api/email/planning/agent/:id` | Email planning agent |
| POST | `/api/email/quote/:id` | Email devis |
| GET/PUT | `/api/settings` | Paramètres app |
