import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Linking,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useAppContext } from '../store/AppContext';

// Deliberately distinct from EmergencyScreen's red — this is "someone else needs
// help", not "I need help", and should never be visually confusable with it.
const COLORS = {
  bg: '#00121d',
  card: '#001c2e',
  border: '#003a56',
  primary: '#29b6f6',
  text: '#ffffff',
  muted: '#7fb8d6',
};

function formatDate(isoString) {
  if (!isoString) return 'Unknown time';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function CommunityAlertScreen() {
  const { state, dispatch } = useAppContext();
  const navigation = useNavigation();

  // Always show the newest remote alert; screen re-renders with the next one
  // in the queue automatically once the current one is dismissed.
  const alert = state.remoteAlerts[0];
  const queuedCount = state.remoteAlerts.length - 1;

  useEffect(() => {
    // Vibration lives ONLY here, scoped to this screen instance — never
    // touches the receiver's own SOS state or EmergencyScreen.
    if (alert) {
      Vibration.vibrate([0, 400, 200, 400], true);
    }
    return () => {
      // Stop vibration on unmount (user navigates away without tapping Close)
      Vibration.cancel();
    };
  }, [alert?.alertId]);

  useEffect(() => {
    // If the queue empties out (e.g. all alerts dismissed elsewhere), leave the screen.
    if (!alert) {
      Vibration.cancel();
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [alert]);

  function handleDismiss() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Vibration.cancel();
    if (alert?.alertId) {
      dispatch({ type: 'DISMISS_REMOTE_ALERT', payload: alert.alertId });
    }
    // Do NOT navigate away here if more alerts remain — the screen will
    // re-render with the next queued alert. Only leave when the queue is empty
    // (handled by the effect above).
    if (queuedCount <= 0) {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }

  function openMap() {
    if (!alert) return;
    const { lat, lng } = alert;
    if (lat === undefined || lat === null || lng === undefined || lng === null) return;
    Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}(Community SOS)`);
  }

  if (!alert) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  const hasLocation =
    alert.lat !== undefined && alert.lat !== null && alert.lng !== undefined && alert.lng !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconBg}>
              <Ionicons name="people" size={40} color="#fff" />
            </View>
            <Text style={styles.title}>Community SOS Alert</Text>
            <Text style={styles.subtitle}>Someone nearby has triggered an emergency</Text>
            {queuedCount > 0 && (
              <Text style={styles.queueBadge}>+{queuedCount} more alert{queuedCount !== 1 ? 's' : ''} waiting</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>REPORTED</Text>
            <Text style={styles.cardValue}>{formatDate(alert.timestamp)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>SOURCE</Text>
            <Text style={styles.cardValue}>{alert.source || 'Unknown'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>LOCATION</Text>
            {hasLocation ? (
              <>
                <Text style={styles.cardValue}>
                  {Number(alert.lat).toFixed(6)}, {Number(alert.lng).toFixed(6)}
                </Text>
                <TouchableOpacity style={styles.mapBtn} onPress={openMap}>
                  <Ionicons name="map" size={16} color={COLORS.primary} />
                  <Text style={styles.mapBtnText}>View Map</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noLocation}>Location not available</Text>
            )}
          </View>

          <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.dismissText}>Close / Dismiss</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            This is an alert about someone else's emergency. It will not change your own
            location or trigger your own SOS.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingTop: 10 },

  header: { alignItems: 'center', paddingVertical: 20, marginBottom: 12 },
  iconBg: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 6, textAlign: 'center' },
  queueBadge: {
    marginTop: 10,
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
    backgroundColor: '#29b6f622',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLabel: {
    fontSize: 10,
    color: COLORS.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardValue: { fontSize: 15, color: COLORS.text, fontWeight: '600', fontFamily: 'monospace' },
  noLocation: { fontSize: 14, color: COLORS.muted },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#29b6f622',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  mapBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  dismissBtn: {
    backgroundColor: '#1a2a1a',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#00c85355',
  },
  dismissText: { color: '#00c853', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  note: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
});
