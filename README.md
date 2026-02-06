# mijnvergelijker landing

Static landing met serverless endpoint voor formulier-verwerking (Sheets + e-mail).

## Deploy (Vercel)
Minimaal nodig:
- `SENDGRID_API_KEY`
- `MAIL_FROM` (bv. `no-reply@mijnvergelijker.com`)
- `MAIL_TO` (ontvanger, standaard `sander@onlion.be`)

Optioneel (voor logging naar Google Sheets):
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_KEY` (mag met `\n` of base64)
- `GOOGLE_SHEETS_ID`
Als je Sheets gebruikt: geef de service-account Editor-toegang op de sheet.

Na instellen: redeploy `main`.

## Lokale run
```bash
npm install
vercel dev
```

## Wat gebeurt er bij submit?
- `/api/submit` valideert invoer.
- Stuurt een e-mail via SendGrid met naam/telefoon/postcode/keteltype.
- Als Sheets-variabelen aanwezig zijn, logt het ook een rij in de spreadsheet.
