import React, { useEffect, useRef, useCallback } from 'react';
// FIX #1: Removed unused 'Alert' import
import { StatusBar, AppState, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './src/navigation/AppNavigator';
import { AppProvider, useAppContext } from './src/store/AppContext';
import { SMSService } from './src/services/SMSService';
import { NotificationService } from './src/services/NotificationService';
import { PermissionsService } from './src/services/PermissionsService';
import { CommunityAlertService } from './src/services/CommunityAlertService';

LogBox.ignoreLogs([
  'Possible unhandled promise rejection',
]);

function AppInner() {
  const { state, dispatch } = useAppContext();
  const appState = useRef(AppState.currentState);
  const navigationRef = useRef(null);
  const lastCommunityAlertIdRef = useRef('');

  // FIX #2: Wrap broadcastCommunityAlert in useCallback so it has a stable
  // reference and doesn't cause stale closure bugs when captured by BLE/SMS
  // callbacks that are registered once on mount.
  const broadcastCommunityAlert = useCallback(
    async (eventPayload) => {
      if (!state.alertServerUrl) return;
      try {
        await CommunityAlertService.broadcastSOS({
          serverUrl: state.alertServerUrl,
          payload: {
            ...eventPayload,
            senderToken: state.expoPushToken,
          },
        });
      } catch (error) {
        console.warn('[CommunityAlerts] Broadcast failed:', error.message || error);
      }
    },
    [state.alertServerUrl, state.expoPushToken],
  );

  // FIX #3: handleIncomingCommunityAlert wrapped in useCallback so it can be
  // safely passed to NotificationService.subscribe without re-subscribing on
  // every render.
  const handleIncomingCommunityAlert = useCallback(
    (payload = {}) => {
      if (payload?.lat === undefined || payload?.lng === undefined) return;

      dispatch({ type: 'SET_SOS_ACTIVE', payload: true });
      dispatch({ type: 'SET_TRIGGER_SOURCE', payload: payload.source || 'APP_USER' });
      dispatch({
        type: 'SET_LOCATION',
        payload: {
          latitude: Number(payload.lat),
          longitude: Number(payload.lng),
        },
      });
      dispatch({
        type: 'ADD_HISTORY_EVENT',
        payload: {
          source: payload.source || 'APP_USER',
          lat: Number(payload.lat),
          lng: Number(payload.lng),
          timestamp: payload.timestamp || new Date().toISOString(),
          remoteBroadcast: true,
        },
      });

      // FIX #4: Use optional chaining consistently on navigationRef
      navigationRef.current?.navigate('Emergency');
    },
    [dispatch],
  );

  // FIX #5: Use a ref to hold the latest broadcastCommunityAlert so that BLE
  // and SMS callbacks (registered once) always call the latest version without
  // needing re-registration (avoids stale closure).
  const broadcastRef = useRef(broadcastCommunityAlert);
  useEffect(() => {
    broadcastRef.current = broadcastCommunityAlert;
  }, [broadcastCommunityAlert]);

  useEffect(() => {
    async function initializeApp() {
      try {
        await PermissionsService.requestAll();
      } catch (error) {
        console.error('[App] Permission initialization failed:', error);
      }

      try {
        await NotificationService.initialize();
      } catch (error) {
        console.error('[App] Notification initialization failed:', error);
      }

      SMSService.startListening((smsData) => {
        const timestamp = new Date().toISOString();
        console.log('[App] SMS SOS received:', smsData);
        dispatch({ type: 'SET_SOS_ACTIVE', payload: true });
        dispatch({ type: 'SET_TRIGGER_SOURCE', payload: 'SMS' });
        dispatch({ type: 'SET_LOCATION', payload: { latitude: smsData.lat, longitude: smsData.lng } });
        dispatch({ type: 'ADD_HISTORY_EVENT', payload: { ...smsData, source: 'SMS', timestamp } });

        NotificationService.sendEmergencyNotification({ ...smsData, source: 'SMS', timestamp }).catch((error) => {
          console.error('[App] Failed to send SMS emergency notification:', error);
        });

        // FIX #5 continued: call via ref so we always have latest serverUrl
        broadcastRef.current({ ...smsData, source: 'SMS', timestamp });

        // FIX #4: optional chaining
        navigationRef.current?.navigate('Emergency');
      });
    }

    initializeApp();
    // FIX #3: subscribe with stable callback reference
    NotificationService.subscribe(handleIncomingCommunityAlert);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      SMSService.stopListening();
      NotificationService.unsubscribe();
    };
    // FIX #2: dispatch is stable from context, handleIncomingCommunityAlert is
    // memoized — safe to include. initializeApp is defined inside, so no dep needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleIncomingCommunityAlert]);

  // FIX #6: Added dispatch to dependency array (it is stable but ESLint requires it)
  useEffect(() => {
    async function registerCurrentDevice() {
      if (!state.alertServerUrl) return;
      try {
        const pushToken = await CommunityAlertService.registerForPushAsync();
        dispatch({ type: 'SET_EXPO_PUSH_TOKEN', payload: pushToken });
        await CommunityAlertService.registerDevice({
          serverUrl: state.alertServerUrl,
          pushToken,
          label: 'SafeGuard User',
        });
      } catch (error) {
        console.warn('[CommunityAlerts] Registration skipped:', error.message || error);
      }
    }

    registerCurrentDevice();
  }, [state.alertServerUrl, dispatch]);

  useEffect(() => {
    if (!state.alertServerUrl) return undefined;

    let cancelled = false;

    async function pollCommunityAlerts() {
      try {
        const alerts = await CommunityAlertService.fetchAlerts({
          serverUrl: state.alertServerUrl,
          since: lastCommunityAlertIdRef.current,
        });
        if (cancelled || alerts.length === 0) return;

        const newestFirst = [...alerts].sort((a, b) => String(a.id).localeCompare(String(b.id)));
        for (const alert of newestFirst) {
          if (!alert?.id || alert.senderToken === state.expoPushToken) {
            lastCommunityAlertIdRef.current = alert?.id || lastCommunityAlertIdRef.current;
            continue;
          }

          lastCommunityAlertIdRef.current = alert.id;
          handleIncomingCommunityAlert({
            ...alert,
            remoteBroadcast: true,
          });
        }
      } catch (error) {
        console.warn('[CommunityAlerts] Poll skipped:', error.message || error);
      }
    }

    pollCommunityAlerts();
    const timer = setInterval(pollCommunityAlerts, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.alertServerUrl, state.expoPushToken, handleIncomingCommunityAlert]);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <AppInner />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
