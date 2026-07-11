import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../store/AppContext';
import { SMSService } from '../services/SMSService';
import { CommunityAlertService } from '../services/CommunityAlertService';

const COLORS = {
  bg: '#0a0a0a',
  card: '#111111',
  border: '#1e1e1e',
  primary: '#ff1744',
  text: '#ffffff',
  muted: '#666',
  green: '#00e676',
  input: '#1a1a1a',
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingRow({ icon, iconColor = COLORS.muted, label, value, onPress, isLast }) {
  return (
    <TouchableOpacity
      style={[styles.settingRow, isLast && styles.settingRowLast]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.settingIconBg, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { state, dispatch } = useAppContext();
  const [editingSMS, setEditingSMS] = useState(false);
  const [smsInput, setSmsInput] = useState(state.smsNumber);
  const [serverUrlInput, setServerUrlInput] = useState(state.alertServerUrl);
  const [testSMSInput, setTestSMSInput] = useState('SOS ALERT | LAT:12.9716 | LNG:77.5946');

  function saveSMSNumber() {
    dispatch({ type: 'SET_SMS_NUMBER', payload: smsInput });
    setEditingSMS(false);
  }

  async function saveServerUrl() {
    const trimmed = serverUrlInput.trim();
    dispatch({ type: 'SET_ALERT_SERVER_URL', payload: trimmed });

    if (!trimmed) {
      Alert.alert('Broadcast Server Cleared', 'Community-wide SOS alerts are disabled until you add a server URL again.');
      return;
    }

    try {
      const pushToken = state.expoPushToken || await CommunityAlertService.registerForPushAsync();
      dispatch({ type: 'SET_EXPO_PUSH_TOKEN', payload: pushToken });
      await CommunityAlertService.registerDevice({
        serverUrl: trimmed,
        pushToken,
        label: 'SafeGuard User',
      });
      Alert.alert('Broadcast Enabled', 'This phone is registered to receive SOS alerts from other SafeGuard users.');
    } catch (error) {
      Alert.alert('Registration Incomplete', error.message || 'Could not register this phone yet.');
    }
  }

  function testSMSParsing() {
    const isMatch = SMSService.isSMSAnSOS(testSMSInput);
    if (isMatch) {
      SMSService.simulateSMS(testSMSInput);
      Alert.alert('SMS Matched', 'SOS pattern detected. Emergency screen will open.');
    } else {
      Alert.alert('No Match', `The SMS format did not match any SOS pattern.\n\nExpected formats:\n- SOS ALERT | LAT:xx.xxxx | LNG:yy.yyyy\n- SOS|xx.xxxx|yy.yyyy`);
    }
  }

  function openPermissions() {
    Linking.openSettings();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>SafeGuard Configuration</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Section title="Community Alerts">
          <View style={styles.settingRow}>
            <View style={[styles.settingIconBg, { backgroundColor: '#448aff22' }]}>
              <Ionicons name="notifications" size={16} color="#448aff" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Broadcast Server URL</Text>
              <TextInput
                style={[styles.inlineInput, { marginTop: 6 }]}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
                placeholder="http://192.168.1.10:3001"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.testBtn} onPress={saveServerUrl}>
                <Ionicons name="save" size={14} color="#fff" />
                <Text style={styles.testBtnText}>Save & Register</Text>
              </TouchableOpacity>
            </View>
          </View>
          <SettingRow
            icon="radio"
            iconColor={state.alertServerUrl ? COLORS.green : COLORS.muted}
            label="Current Broadcast Target"
            value={state.alertServerUrl || 'Not configured'}
            isLast
          />
        </Section>

        {/* SMS Configuration */}
        <Section title="SMS Backup">
          <SettingRow
            icon="chatbubble"
            iconColor={COLORS.green}
            label="SMS Listener"
            value="Active"
          />

          <View style={[styles.settingRow]}>
            <View style={[styles.settingIconBg, { backgroundColor: COLORS.green + '22' }]}>
              <Ionicons name="call" size={16} color={COLORS.green} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>SIM800L Number</Text>
              {editingSMS ? (
                <View style={styles.inlineEdit}>
                  <TextInput
                    style={styles.inlineInput}
                    value={smsInput}
                    onChangeText={setSmsInput}
                    placeholder="+91 XXXXXXXXXX"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="phone-pad"
                    autoFocus
                  />
                  <TouchableOpacity onPress={saveSMSNumber}>
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.green} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.settingValue}>{state.smsNumber || 'Not set'}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setEditingSMS(!editingSMS)}>
              <Ionicons name={editingSMS ? 'close' : 'pencil'} size={16} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          {/* SMS Test */}
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Test SMS Format</Text>
              <TextInput
                style={[styles.inlineInput, { marginTop: 6 }]}
                value={testSMSInput}
                onChangeText={setTestSMSInput}
                placeholder="Paste SMS here to test..."
                placeholderTextColor={COLORS.muted}
                multiline
              />
              <TouchableOpacity style={styles.testBtn} onPress={testSMSParsing}>
                <Ionicons name="flask" size={14} color="#fff" />
                <Text style={styles.testBtnText}>Test Parse</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* Permissions */}
        <Section title="Permissions">
          <SettingRow
            icon="location"
            iconColor="#ff9100"
            label="Location"
            value="Required for map & alerts"
            onPress={openPermissions}
          />
          <SettingRow
            icon="chatbubble"
            iconColor={COLORS.green}
            label="Read SMS"
            value="Required for SMS backup"
            onPress={openPermissions}
            isLast
          />
        </Section>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>SafeGuard v1.0.1</Text>
          <Text style={styles.appInfoText}>Women Safety System</Text>
          <Text style={styles.appInfoSubtext}>App-only Mode - No Hardware Required</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  settingValue: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  inlineEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  inlineInput: {
    flex: 1,
    backgroundColor: COLORS.input,
    borderRadius: 8,
    padding: 8,
    color: COLORS.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ff174422',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ff174444',
  },
  testBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  appInfo: { alignItems: 'center', paddingTop: 8, gap: 4 },
  appInfoText: { fontSize: 13, color: COLORS.muted },
  appInfoSubtext: { fontSize: 11, color: '#444' },
});
