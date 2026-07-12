const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'registered-tokens.json');
const ALERTS_FILE = path.join(__dirname, 'broadcast-alerts.json');
const MAX_BODY_BYTES = 16 * 1024;
const API_KEY = process.env.SAFEGUARD_ALERT_API_KEY || '';
const MAX_SENDER_NAME_LENGTH = 40;
const DEFAULT_SENDER_NAME = 'Someone';

function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tokens, null, 2));
}

function loadAlerts() {
  try {
    return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
}

function saveAlert(alert) {
  const alerts = [alert, ...loadAlerts()].slice(0, 100);
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
}

async function readJson(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function isAuthorized(req) {
  if (!API_KEY) return true;
  const auth = req.headers.authorization || '';
  const token = req.headers['x-safeguard-api-key'] || '';
  return auth === `Bearer ${API_KEY}` || token === API_KEY;
}

function validateExpoToken(token) {
  return typeof token === 'string' && /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

function validateCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

// Trims whitespace, caps length, and falls back to a default when empty.
function normalizeSenderName(rawName) {
  const trimmed = String(rawName || '').trim().slice(0, MAX_SENDER_NAME_LENGTH);
  return trimmed || DEFAULT_SENDER_NAME;
}

function clientError(res, error) {
  return json(res, error.statusCode || 400, { error: error.message || 'Bad request' });
}

async function sendExpoPushNotifications(messages) {
  if (!messages.length) {
    return { sent: 0 };
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push send failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, service: 'SafeGuard broadcast server' });
  }

  if (req.method === 'GET' && req.url.startsWith('/alerts')) {
    try {
      if (!isAuthorized(req)) {
        return json(res, 401, { error: 'Unauthorized' });
      }

      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const since = url.searchParams.get('since') || '';
      const alerts = loadAlerts();
      const filtered = since ? alerts.filter((alert) => String(alert.id) > since) : alerts.slice(0, 10);
      return json(res, 200, { ok: true, alerts: filtered.slice(0, 20) });
    } catch (error) {
      return clientError(res, error);
    }
  }

  if (req.method === 'POST' && req.url === '/register-token') {
    try {
      if (!isAuthorized(req)) {
        return json(res, 401, { error: 'Unauthorized' });
      }
      const body = await readJson(req);
      if (!validateExpoToken(body.token)) {
        return json(res, 400, { error: 'valid Expo push token is required' });
      }

      const tokens = loadTokens().filter((entry) => entry.token !== body.token);
      tokens.push({
        token: body.token,
        label: String(body.label || 'SafeGuard User').slice(0, 80),
        platform: body.platform || 'unknown',
        updatedAt: new Date().toISOString(),
      });
      saveTokens(tokens);
      return json(res, 200, { ok: true, registered: body.token, total: tokens.length });
    } catch (error) {
      return clientError(res, error);
    }
  }

  if (req.method === 'POST' && req.url === '/broadcast-sos') {
    try {
      if (!isAuthorized(req)) {
        return json(res, 401, { error: 'Unauthorized' });
      }
      const body = await readJson(req);
      if (!validateCoordinate(body.lat, -90, 90) || !validateCoordinate(body.lng, -180, 180)) {
        return json(res, 400, { error: 'valid lat and lng are required' });
      }

      const tokens = loadTokens();
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const source = String(body.source || 'APP_USER').slice(0, 40);
      const timestamp = body.timestamp || new Date().toISOString();
      const senderToken = body.senderToken || '';
      const senderName = normalizeSenderName(body.senderName);
      const alert = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lat,
        lng,
        source,
        timestamp,
        senderToken,
        senderName,
      };
      saveAlert(alert);

      // FIX: exclude the sender's own token from the push fan-out so the
      // person who triggered the SOS doesn't get notified about their own alert.
      const recipientTokens = tokens.filter((entry) => entry.token !== senderToken);

      const messages = recipientTokens.map((entry) => ({
        to: entry.token,
        sound: 'default',
        title: `🚨 ${senderName} needs help!`,
        body: 'Tap to view their location.',
        data: {
          lat,
          lng,
          source,
          timestamp,
          remoteBroadcast: true,
          alertId: alert.id,
          senderToken: alert.senderToken,
          senderName: alert.senderName,
        },
        priority: 'high',
        channelId: 'community-alerts',
      }));

      const result = await sendExpoPushNotifications(messages);
      return json(res, 200, { ok: true, recipients: recipientTokens.length, alert, result });
    } catch (error) {
      return clientError(res, error);
    }
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`SafeGuard broadcast server listening on http://0.0.0.0:${PORT}`);
});
