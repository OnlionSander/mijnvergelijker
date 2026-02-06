# mijnvergelijker landing

Static landing met serverless endpoint voor formulier-verwerking (Sheets + e-mail).

## Deploy (Vercel)
1. Zet deze environment variables in Vercel Project Settings → Environment Variables:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_KEY` (volledige private key; mag met `\n` of base64)
   - `GOOGLE_SHEETS_ID` (ID van de spreadsheet)
   - `SENDGRID_API_KEY`
   - `MAIL_FROM` (bv. `no-reply@mijnvergelijker.com`)
   - `MAIL_TO` (ontvanger, standaard `sander@onlion.be`)
2. Geef de service-account toegang tot de sheet (Editor).
3. Deploy of redeploy `main`.

## Lokale run
```bash
npm install
vercel dev
```

## Wat gebeurt er bij submit?
- `/api/submit` valideert invoer.
- Schrijft een rij naar de sheet: timestamp, naam, telefoon, postcode, keteltype, user-agent.
- Stuurt een e-mail via SendGrid met dezelfde info.
