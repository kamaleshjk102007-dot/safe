import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
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
import * as KeepAwake from 'expo-keep-awake';

import { useAppContext } from '../store/AppContext';

const COLORS = {
  bg: '#0d0000',
  card: '#1a0000',
  border: '#3d0000',
  primary: '#ff1744',
  text: '#ffffff',
  muted: '#ff8a80',
};

export default function EmergencyScreen() {
  const { state, dispatch } = useAppContext();
  const navigation = useNavigation();
  const flashAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync().catch(() => {});
    startAnimations();
    startVibrationPattern();

    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => {
      clearInterval(timer);
      Vibration.cancel();
      KeepAwake.deactivateKeepAwake().catch(() => {});
    };
  }, []);

  function startAnimations() {
    // Flash background
    Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ])
    ).start();

    // Pulse alert icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    // Slide in content
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }

  function startVibrationPattern() {
    Vibration.vibrate([0, 500, 200, 500, 200, 500, 1000, 500], true);
  }

  function handleDismiss() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Vibration.cancel();
    dispatch({ type: 'DISMISS_SOS' });
    setDismissed(true);
    navigation.goBack();
  }

  function callContact(phone) {
    Linking.openURL(`tel:${phone}`);
  }

  function openMap() {
    if (!state.currentLocation) return;
    const { latitude, longitude } = state.currentLocation;
    Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}(SOS Location)`);
  }

  const bgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#0d0000', '#1a0000'],
  });

  const lat = state.currentLocation?.latitude;
  const lng = state.currentLocation?.longitude;

  const sourceLabel = {
    SMS: 'SMS Alert (GSM)',
    MANUAL: 'Manual (App)',
  }[state.triggerSource] || 'Unknown';

  const elapsed = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0000" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Alert Header */}
          <Animated.View style={[styles.alertHeader, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.alertIconBg}>
                <Ionicons name="warning" size={48} color="#fff" />
              </View>
            </Animated.View>

            <Text style={styles.alertTitle}>SOS ALERT</Text>
            <Text style={styles.alertSubtitle}>EMERGENCY TRIGGERED</Text>
            <Text style={styles.elapsedText}>{elapsed}</Text>
          </Animated.View>

          {/* Source */}
          <Animated.View style={[styles.sourceCard, { opacity: opacityAnim }]}>
            <Text style={styles.cardLabel}>TRIGGER SOURCE</Text>
            <Text style={styles.sourceText}>{sourceLabel}</Text>
          </Animated.View>

          {/* Location */}
          <Animated.View style={[styles.locationCard, { opacity: opacityAnim }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text style={styles.cardLabel}>LOCATION</Text>
            </View>

            {lat !== undefined && lat !== null && lng !== undefined && lng !== null ? (
              <>
                <Text style={styles.coordText}>
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </Text>
                {state.locationAddress ? (
                  <Text style={styles.addressText}>{state.locationAddress}</Text>
                ) : null}
                <TouchableOpacity style={styles.mapBtn} onPress={openMap}>
                  <Ionicons name="map" size={14} color={COLORS.primary} />
                  <Text style={styles.mapBtnText}>Open in Maps</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noLocation}>Location not available</Text>
            )}
          </Animated.View>

          {/* Emergency Contacts */}
          {state.contacts.length > 0 && (
            <Animated.View style={[styles.contactsCard, { opacity: opacityAnim }]}>
              <Text style={styles.cardLabel}>EMERGENCY CONTACTS</Text>
              {state.contacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.contactRow}
                  onPress={() => callContact(contact.phone)}
                >
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactPhone}>{contact.phone}</Text>
                  </View>
                  <View style={styles.callBtn}>
                    <Ionicons name="call" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Dismiss Button */}
          <Animated.View style={[{ opacity: opacityAnim }]}>
            <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.dismissText}>I'M SAFE - Dismiss Alert</Text>
            </TouchableOpacity>

            <Text style={styles.dismissWarning}>
              Only dismiss if you are safe
            </Text>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 10 },

  alertHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
  },
  alertIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  alertTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  alertSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 4,
    marginTop: 4,
  },
  elapsedText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    fontFamily: 'monospace',
  },

  sourceCard: {
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
  sourceText: { fontSize: 16, color: COLORS.text, fontWeight: '700' },

  locationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  coordText: {
    fontSize: 15,
    color: COLORS.text,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  addressText: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  noLocation: { fontSize: 14, color: COLORS.muted },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#ff174420',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  mapBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  contactsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  contactPhone: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00c853',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dismissBtn: {
    backgroundColor: '#1a2a1a',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#00c85355',
  },
  dismissText: { color: '#00c853', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  dismissWarning: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});
