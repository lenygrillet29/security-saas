#!/usr/bin/env node
/**
 * setup-stripe-packs.js
 * Crée tous les produits & prix Stripe pour les packs SecuroPlan.
 *
 * Usage :
 *   STRIPE_SECRET_KEY=sk_live_xxx node setup-stripe-packs.js
 *
 * Copiez les variables affichées dans Railway → Variables.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌  STRIPE_SECRET_KEY manquant. Usage : STRIPE_SECRET_KEY=sk_... node setup-stripe-packs.js');
  process.exit(1);
}

const MODE = process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE 🔴' : 'TEST 🟡';
console.log(`\n🚀 Création des produits SecuroPlan en mode ${MODE}\n`);

const PACKS = [
  // ── Pack Agents ──────────────────────────────────────────────────────────────
  { envKey: 'STRIPE_PACK_AGENTS_S_PRICE_ID',        name: 'SecuroPlan — Pack Agents S',        desc: '+50 agents actifs',       price_eur: 9,  packType: 'agents', packSize: 's'        },
  { envKey: 'STRIPE_PACK_AGENTS_M_PRICE_ID',        name: 'SecuroPlan — Pack Agents M',        desc: '+100 agents actifs',      price_eur: 15, packType: 'agents', packSize: 'm'        },
  { envKey: 'STRIPE_PACK_AGENTS_L_PRICE_ID',        name: 'SecuroPlan — Pack Agents L',        desc: '+200 agents actifs',      price_eur: 25, packType: 'agents', packSize: 'l'        },
  { envKey: 'STRIPE_PACK_AGENTS_ILLIMITE_PRICE_ID', name: 'SecuroPlan — Pack Agents Illimité', desc: 'Agents illimités',        price_eur: 39, packType: 'agents', packSize: 'illimite' },

  // ── Pack Collaborateurs ───────────────────────────────────────────────────────
  { envKey: 'STRIPE_PACK_COLLAB_S_PRICE_ID',        name: 'SecuroPlan — Pack Collab S',        desc: '+5 collaborateurs',       price_eur: 5,  packType: 'collab', packSize: 's'        },
  { envKey: 'STRIPE_PACK_COLLAB_M_PRICE_ID',        name: 'SecuroPlan — Pack Collab M',        desc: '+10 collaborateurs',      price_eur: 9,  packType: 'collab', packSize: 'm'        },
  { envKey: 'STRIPE_PACK_COLLAB_L_PRICE_ID',        name: 'SecuroPlan — Pack Collab L',        desc: '+20 collaborateurs',      price_eur: 15, packType: 'collab', packSize: 'l'        },
  { envKey: 'STRIPE_PACK_COLLAB_ILLIMITE_PRICE_ID', name: 'SecuroPlan — Pack Collab Illimité', desc: 'Collaborateurs illimités', price_eur: 25, packType: 'collab', packSize: 'illimite' },
];

async function main() {
  const results = {};

  for (const pack of PACKS) {
    process.stdout.write(`  Création "${pack.name}" (${pack.price_eur} €/mois)...`);
    try {
      const product = await stripe.products.create({
        name:        pack.name,
        description: pack.desc,
        metadata:    { pack_type: pack.packType, pack_size: pack.packSize, app: 'securoplan' },
      });

      const price = await stripe.prices.create({
        product:    product.id,
        unit_amount: pack.price_eur * 100,
        currency:   'eur',
        recurring:  { interval: 'month' },
        metadata:   { pack_type: pack.packType, pack_size: pack.packSize, app: 'securoplan' },
      });

      results[pack.envKey] = price.id;
      console.log(` ✅ ${price.id}`);
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('📋  Variables à copier dans Railway → Variables :\n');
  for (const [key, value] of Object.entries(results)) {
    console.log(`${key}=${value}`);
  }
  console.log('─────────────────────────────────────────────────────────────────\n');
  console.log('✅  Terminé ! Ajoutez ces 8 variables dans Railway puis redéployez.\n');
}

main().catch(err => {
  console.error('\n❌  Erreur :', err.message);
  process.exit(1);
});
