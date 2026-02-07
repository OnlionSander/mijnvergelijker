const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const RAW_SERVICE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 0);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = (process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const SMTP_REQUIRE_TLS = (process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true';
const MAIL_TO = process.env.MAIL_TO || 'sander@onlion.be';
const MAIL_FROM = process.env.MAIL_FROM || 'no-reply@mijnvergelijker.com';

function normalizePrivateKey(key) {
    if (!key) return null;
    // Accept either literal with \n or base64
    const cleaned = key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
    if (cleaned.includes('BEGIN PRIVATE KEY')) return cleaned;
    try {
        const decoded = Buffer.from(key, 'base64').toString('utf8');
        if (decoded.includes('BEGIN PRIVATE KEY')) return decoded.replace(/\\n/g, '\n');
    } catch (_) {
        /* ignore */
    }
    return cleaned;
}

function validate(body = {}) {
    const { postal, boilerType, name, phone } = body;
    if (!postal || !boilerType || !name || !phone) return 'Alle velden zijn verplicht.';
    if (!/^[0-9]{4}$/.test(postal.trim())) return 'Postcode moet 4 cijfers bevatten.';
    const allowed = [
        'Herstelling/interventies CV-ketel',
        'Onderhoud CV-ketel',
        'Installatie CV-ketel',
        'Installatie Airco',
        'Installatie Warmtepomp',
    ];
    if (!allowed.includes((boilerType || '').trim())) return 'Ongeldig keteltype.';
    if (String(name).trim().length < 2) return 'Naam is te kort.';
    if (String(phone).trim().length < 8) return 'Telefoonnummer is te kort.';
    return null;
}

async function appendToSheet(auth, row) {
    const sheets = google.sheets({ version: 'v4', auth });
    return sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
    });
}

async function sendEmail(payload) {
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP-config ontbreekt: zet SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in Vercel.');
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE || SMTP_PORT === 465, // SSL
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        requireTLS: SMTP_REQUIRE_TLS || SMTP_PORT === 587,
    });

    const { name, phone, postal, boilerType } = payload;
    const msg = {
        to: MAIL_TO,
        from: MAIL_FROM,
        subject: `Nieuwe onderhoudsaanvraag (${postal})`,
        text: [
            `Naam: ${name}`,
            `Telefoon: ${phone}`,
            `Postcode: ${postal}`,
            `Ketel: ${boilerType}`,
        ].join('\n'),
        html: `
            <p><strong>Naam:</strong> ${name}</p>
            <p><strong>Telefoon:</strong> ${phone}</p>
            <p><strong>Postcode:</strong> ${postal}</p>
            <p><strong>Ketel:</strong> ${boilerType}</p>
        `,
    };
    return transporter.sendMail(msg);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            if (!data) return resolve({});
            try {
                resolve(JSON.parse(data));
            } catch (err) {
                reject(new Error('Ongeldige JSON'));
            }
        });
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let body;
    try {
        body = typeof req.body === 'object' && req.body !== null ? req.body : await parseBody(req);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const error = validate(body);
    if (error) return res.status(400).json({ error });

    const hasSheetsConfig = SHEET_ID && SERVICE_EMAIL && RAW_SERVICE_KEY;
    let jwt = null;
    if (hasSheetsConfig) {
        const privateKey = normalizePrivateKey(RAW_SERVICE_KEY);
        jwt = new google.auth.JWT({
            email: SERVICE_EMAIL,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }

    const now = new Date().toISOString();
    const row = [
        now,
        body.name,
        body.phone,
        body.postal,
        body.boilerType,
        req.headers['user-agent'] || '',
    ];

    try {
        if (jwt) {
            await jwt.authorize();
            await appendToSheet(jwt, row);
        }
        await sendEmail(body);
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Submission error', err);
        const msg = err && err.message ? err.message : 'Verwerking mislukt';
        return res.status(500).json({ error: msg });
    }
};
