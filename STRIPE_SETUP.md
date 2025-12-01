# Stripe Setup Guide för EnorEtt Pro

## Steg 1: Stripe Webhook Events

När du skapar webhook:en i Stripe Dashboard, välj följande **8 händelser**:

### Obligatoriska Events:
1. **`checkout.session.completed`** - När en användare slutför betalning
2. **`customer.subscription.created`** - När en prenumeration skapas
3. **`customer.subscription.updated`** - När en prenumeration uppdateras (t.ex. planändring)
4. **`customer.subscription.deleted`** - När en prenumeration avbryts
5. **`invoice.payment_succeeded`** - När månadsfakturan betalas
6. **`invoice.payment_failed`** - När betalning misslyckas
7. **`customer.subscription.trial_will_end`** - 3 dagar innan provperioden slutar
8. **`customer.subscription.past_due`** - När prenumerationen är förfallen

### Ytterligare Rekommenderade (valfria):
- `payment_intent.succeeded` - För extra bekräftelse
- `customer.created` - När ny kund skapas

## Steg 2: Webhook URL

### För Lokal Utveckling (Testning):
```
http://localhost:3000/api/subscription/webhook
```

**Viktigt:** För lokal testning behöver du använda **Stripe CLI** för att tunnla webhooks:
```bash
stripe listen --forward-to localhost:3000/api/subscription/webhook
```

### För Produktion:
```
https://api.enorett.se/api/subscription/webhook
```

## Steg 3: Konfigurera Environment Variables

Skapa en `.env` fil i `api/` mappen:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=https://enorett.se,chrome-extension://*

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_din_secret_key_här
STRIPE_PUBLISHABLE_KEY=pk_live_din_publishable_key_här
STRIPE_WEBHOOK_SECRET=whsec_din_webhook_secret_här

# API URLs
ENORETT_API_URL=https://api.enorett.se
ENORETT_UPGRADE_URL=https://enorett.se/upgrade
```

### Hitta Webhook Secret:
1. Gå till Stripe Dashboard → Developers → Webhooks
2. Klicka på din webhook
3. Klicka på "Reveal" under "Signing secret"
4. Kopiera `whsec_...` värdet till `STRIPE_WEBHOOK_SECRET`

## Steg 4: Testa Webhook Lokalt

### Installera Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Eller ladda ner från: https://stripe.com/docs/stripe-cli
```

### Logga in:
```bash
stripe login
```

### Starta tunneln:
```bash
stripe listen --forward-to localhost:3000/api/subscription/webhook
```

Detta ger dig en webhook signing secret som börjar med `whsec_`. Använd denna för lokal utveckling.

### Testa en event:
```bash
stripe trigger checkout.session.completed
```

## Steg 5: Deploy API till Produktion

### Alternativ 1: Railway.app (Rekommenderat)
1. Skapa konto på [railway.app](https://railway.app)
2. Skapa nytt projekt → "Deploy from GitHub repo"
3. Välj din `api/` mapp
4. Lägg till environment variables i Railway dashboard
5. Railway ger dig en URL som `https://your-app.railway.app`
6. Uppdatera Stripe webhook URL till: `https://your-app.railway.app/api/subscription/webhook`

### Alternativ 2: Heroku
```bash
cd api
heroku create enorett-api
heroku config:set STRIPE_SECRET_KEY=sk_live_...
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
heroku config:set ALLOWED_ORIGINS=https://enorett.se
git push heroku main
```

### Alternativ 3: Vercel/Netlify Functions
Se `api/README.md` för instruktioner.

## Steg 6: Verifiera Webhook i Produktion

1. Gå till Stripe Dashboard → Developers → Webhooks
2. Klicka på din webhook
3. Klicka på "Send test webhook"
4. Välj `checkout.session.completed`
5. Verifiera att du får `200 OK` response

## Steg 7: Testa Hela Flödet

### Testa Checkout:
1. Öppna `https://enorett.se/upgrade`
2. Klicka "Upgrade Now"
3. Använd Stripe test card: `4242 4242 4242 4242`
4. Fyll i valfritt framtida datum för expiration
5. CVV: valfritt 3-siffrigt nummer
6. Slutför betalning

### Verifiera:
1. Kontrollera Stripe Dashboard → Customers → Se att kund skapades
2. Kontrollera Stripe Dashboard → Subscriptions → Se att prenumeration är aktiv
3. Kontrollera webhook logs → Se att events mottogs
4. Testa extension → Verifiera att Pro features är aktiverade

## Steg 8: Hantera Webhook Events

Webhook handler finns i `api/routes/subscription.js`. Den hanterar automatiskt:

- ✅ `checkout.session.completed` - Skapar/uppdaterar subscription
- ✅ `customer.subscription.created` - Loggar ny prenumeration
- ✅ `customer.subscription.updated` - Uppdaterar prenumerationsstatus
- ✅ `customer.subscription.deleted` - Markerar som avbruten

**Viktigt:** I produktion behöver du spara subscription data i en databas. För nu sparas det i extension storage, men för produktion bör du:

1. Spara subscription i databas när webhook mottas
2. Koppla subscription till user ID
3. Uppdatera extension storage när subscription ändras

## Felsökning

### Webhook returnerar 400:
- Kontrollera att `STRIPE_WEBHOOK_SECRET` är korrekt
- Verifiera att webhook URL är tillgänglig från internet
- Kontrollera att request body är raw (inte parsed JSON)

### Webhook mottas men subscription uppdateras inte:
- Kontrollera webhook logs i Stripe Dashboard
- Kontrollera server logs för fel
- Verifiera att `handlePaymentSuccess` funktionen körs korrekt

### Extension visar inte Pro status:
- Kontrollera att subscription sparas i `chrome.storage.local`
- Verifiera att `isProUser()` funktionen fungerar
- Kontrollera att subscription sync körs i background script

## Nästa Steg Efter Setup

1. ✅ Sätt upp databas för subscription storage
2. ✅ Implementera user authentication
3. ✅ Lägg till subscription management page
4. ✅ Implementera email notifications
5. ✅ Lägg till analytics tracking
