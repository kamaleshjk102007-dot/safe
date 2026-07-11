import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REQUEST_TIMEOUT_MS = 10000;
const FALLBACK_EAS_PROJECT_ID = 'b0ddfa23-d2bc-4882-8704-3b47ffa69bfc';
const ALERT_API_KEY = '';

function firstNonEmpty(...values) {
  return values.find(value => typeof value === 'string' && value.trim().length > 0)?.trim() || null;
}

function resolveProjectId() {
  const runtimeProjectId = firstNonEmpty(
    Constants?.expoConfig?.extra?.eas?.projectId,
    Constants?.easConfig?.projectId,
    Constants?.manifest2?.extra?.expoClient?.extra?.eas?.projectId,
    Constants?.manifest2?.extra?.eas?.projectId,
    Constants?.manifest?.extra?.eas?.projectId,
  );

  if (runtimeProjectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runtimeProjectId)) {
    return runtimeProjectId;
  }

  return FALLBACK_EAS_PROJECT_ID;
}

function normalizeUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

async function postJson(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ALERT_API_KEY ? { 'X-SafeGuard-API-Key': ALERT_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

class CommunityAlertServiceClass {
  async registerForPushAsync() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('community-alerts', {
        name: 'Community Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: '#FF1744',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    const projectId = resolveProjectId() || FALLBACK_EAS_PROJECT_ID;

    try {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return token.data;
    } catch (error) {
      const message = error?.message || String(error);

      if (/projectid/i.test(message)) {
        throw new Error(`Could not register this phone for community alerts yet: ${message}`);
      }

      throw error;
    }
  }

  async registerDevice({ serverUrl, pushToken, label }) {
    const baseUrl = normalizeUrl(serverUrl);
    if (!baseUrl || !pushToken) return null;

    return postJson(`${baseUrl}/register-token`, {
      token: pushToken,
      label,
      platform: Platform.OS,
    });
  }

  async broadcastSOS({ serverUrl, payload }) {
    const baseUrl = normalizeUrl(serverUrl);
    if (!baseUrl) return null;

    return postJson(`${baseUrl}/broadcast-sos`, payload);
  }

  async fetchAlerts({ serverUrl, since }) {
    const baseUrl = normalizeUrl(serverUrl);
    if (!baseUrl) return [];

    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    const response = await fetch(`${baseUrl}/alerts${query}`, {
      headers: {
        ...(ALERT_API_KEY ? { 'X-SafeGuard-API-Key': ALERT_API_KEY } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return Array.isArray(data.alerts) ? data.alerts : [];
  }
}

export const CommunityAlertService = new CommunityAlertServiceClass();
