# Snabb Stripe Setup - Checklista

## ✅ Steg-för-Steg Guide

### 1. Stripe Webhook Konfiguration

**I Stripe Dashboard → Webhooks → Add endpoint:**

- **URL:** `https://api.enorett.se/api/subscription/webhook` (eller din produktions-URL)
- **Beskrivning:** `EnorEtt Pro subscription webhook`
- **Events att lyssna på:** Välj dessa 8:

```
☑ checkout.session.completed
☑ customer.subscription.created  
☑ customer.subscription.updated
☑ customer.subscription.deleted
☑ invoice.payment_succeeded
☑ invoice.payment_failed
☑ customer.subscription.trial_will_end
☑ customer.subscription.past_due
```

- **API Version:** `2025-09-30.clover` (eller senaste)
- **Payload format:** `JSON`

### 2. Kopiera Webhook Secret

Efter att du skapat webhook:en:
1. Klicka på webhook:en i listan
2. Under "Signing secret" → Klicka "Reveal"
3. Kopiera värdet som börjar med `whsec_...`
4. Spara detta i din `.env` fil som `STRIPE_WEBHOOK_SECRET`

### 3. Sätt upp Environment Variables

Skapa `.env` fil i `api/` mappen:

```env
# Stripe Keys (från Stripe Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_live_ditt_secret_key_här
STRIPE_PUBLISHABLE_KEY=pk_live_ditt_publishable_key_här
STRIPE_WEBHOOK_SECRET=whsec_ditt_webhook_secret_här

# Server
PORT=3000
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://enorett.se,chrome-extension://*

# URLs
ENORETT_API_URL=https://api.enorett.se
ENORETT_UPGRADE_URL=https://enorett.se/upgrade
```

### 4. Testa Lokalt Först

```bash
# Installera Stripe CLI
brew install stripe/stripe-cli/stripe

# Logga in
stripe login

# Starta webhook tunnel
stripe listen --forward-to localhost:3000/api/subscription/webhook

# I ett annat terminal-fönster, starta servern
cd api
npm install
npm start

# Testa webhook
stripe trigger checkout.session.completed
```

### 5. Deploy till Produktion

**Railway (enklast):**
1. Gå till [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Välj din repo och `api/` mapp
4. Lägg till environment variables i Railway dashboard
5. Railway ger dig en URL → Uppdatera Stripe webhook URL

**Eller Heroku:**
```bash
cd api
heroku create enorett-api
heroku config:set STRIPE_SECRET_KEY=sk_live_...
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
git push heroku main
```

### 6. Verifiera Webhook

1. I Stripe Dashboard → Webhooks
2. Klicka på din webhook
3. "Send test webhook"
4. Välj `checkout.session.completed`
5. Kontrollera att du får `200 OK`

### 7. Testa Hela Flödet

1. Öppna `https://enorett.se/upgrade`
2. Klicka "Upgrade Now"
3. Använd test card: `4242 4242 4242 4242`
4. Slutför betalning
5. Kontrollera Stripe Dashboard → Se subscription skapad
6. Kontrollera webhook logs → Se events mottagna
7. Testa extension → Verifiera Pro features aktiverade

## 🐛 Vanliga Problem

**Problem:** Webhook returnerar 400
- ✅ Kontrollera att `STRIPE_WEBHOOK_SECRET` är korrekt
- ✅ Verifiera att webhook URL är tillgänglig från internet
- ✅ Kontrollera att servern använder `express.raw()` för webhook endpoint

**Problem:** Webhook mottas men inget händer
- ✅ Kontrollera server logs
- ✅ Verifiera att subscription sparas korrekt
- ✅ Kontrollera att extension sync fungerar

**Problem:** Extension visar inte Pro status
- ✅ Kontrollera `chrome.storage.local` i DevTools
- ✅ Verifiera att `isProUser()` fungerar
- ✅ Kontrollera background script logs

## 📝 Nästa Steg

Efter att Stripe är konfigurerat:
1. ✅ Sätt upp databas för subscription storage
2. ✅ Implementera user authentication  
3. ✅ Skapa subscription management sida
4. ✅ Lägg till email notifications
5. ✅ Implementera analytics
