import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { useAppContext } from '../store/AppContext';

const COLORS = {
  bg: '#0a0a0a',
  card: '#111111',
  border: '#1e1e1e',
  primary: '#ff1744',
  text: '#ffffff',
  muted: '#666',
};

function buildMapHTML(lat, lng, label = 'Emergency Location') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; }
    #map { width: 100vw; height: 100vh; }
    .custom-icon {
      background: #ff1744;
      border-radius: 50%;
      width: 20px; height: 20px;
      border: 3px solid #fff;
      box-shadow: 0 0 15px #ff1744aa;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 16,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    var icon = L.divIcon({
      className: '',
      html: '<div class="custom-icon"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    var marker = L.marker([${lat}, ${lng}], { icon: icon })
      .addTo(map)
      .bindPopup('<b>${label}</b><br>Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}', { maxWidth: 200 })
      .openPopup();

    // Accuracy circle
    L.circle([${lat}, ${lng}], {
      color: '#ff1744',
      fillColor: '#ff174420',
      fillOpacity: 0.3,
      radius: 50,
    }).addTo(map);

    // Listen for update messages
    window.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.lat !== undefined && data.lat !== null && data.lng !== undefined && data.lng !== null) {
          var newLatLng = L.latLng(data.lat, data.lng);
          marker.setLatLng(newLatLng);
          map.panTo(newLatLng);
        }
      } catch(err) {}
    });

    // Dark tile layer alternative (CARTO)
    // Uncomment for dark mode map:
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    //   attribution: '©OSM ©CARTO', maxZoom: 19,
    // }).addTo(map);
  </script>
</body>
</html>
`;
}

export default function MapScreen() {
  const { state } = useAppContext();
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [liveTracking, setLiveTracking] = useState(false);
  const trackingRef = useRef(null);

  const lat = state.currentLocation?.latitude || 12.9716;
  const lng = state.currentLocation?.longitude || 77.5946;
  const isSOS = state.sosActive;

  useEffect(() => {
    if (state.currentLocation && webviewRef.current) {
      webviewRef.current.postMessage(
        JSON.stringify({ lat: state.currentLocation.latitude, lng: state.currentLocation.longitude })
      );
    }
  }, [state.currentLocation]);

  useEffect(() => {
    if (liveTracking) {
      trackingRef.current = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          if (webviewRef.current) {
            webviewRef.current.postMessage(
              JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude })
            );
          }
        } catch (e) {}
      }, 5000);
    } else {
      clearInterval(trackingRef.current);
    }
    return () => clearInterval(trackingRef.current);
  }, [liveTracking]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live Map</Text>
          {isSOS && <Text style={styles.sosBadge}>EMERGENCY ACTIVE</Text>}
        </View>
        <TouchableOpacity
          style={[styles.trackBtn, liveTracking && styles.trackBtnActive]}
          onPress={() => setLiveTracking(!liveTracking)}
        >
          <Ionicons
            name={liveTracking ? 'radio' : 'radio-outline'}
            size={16}
            color={liveTracking ? '#fff' : COLORS.muted}
          />
          <Text style={[styles.trackText, liveTracking && styles.trackTextActive]}>
            {liveTracking ? 'LIVE' : 'Track'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Coords bar */}
      <View style={styles.coordBar}>
        <Ionicons name="location" size={12} color={COLORS.primary} />
        <Text style={styles.coordText}>
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
        {isSOS && (
          <View style={styles.sosDot}>
            <Text style={styles.sosText}>SOS</Text>
          </View>
        )}
      </View>

      {/* Map */}
      <View style={{ flex: 1 }}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading OpenStreetMap...</Text>
          </View>
        )}
        <WebView
          ref={webviewRef}
          source={{ html: buildMapHTML(lat, lng, isSOS ? 'SOS LOCATION' : 'My Location') }}
          style={{ flex: 1, backgroundColor: '#0a0a0a' }}
          onLoad={() => setLoading(false)}
          javaScriptEnabled
          scrollEnabled={false}
          onError={(e) => console.error('[Map] WebView error:', e.nativeEvent)}
        />
      </View>

      {/* History locations overlay */}
      {state.historyEvents.length > 0 && (
        <View style={styles.historyBar}>
          <Ionicons name="time-outline" size={12} color={COLORS.muted} />
          <Text style={styles.historyText}>
            {state.historyEvents.length} past event{state.historyEvents.length !== 1 ? 's' : ''} logged
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  sosBadge: { fontSize: 10, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  trackBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  trackText: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  trackTextActive: { color: '#fff' },

  coordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  coordText: { fontSize: 12, color: COLORS.muted, fontFamily: 'monospace', flex: 1 },
  sosDot: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sosText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 12,
  },
  loadingText: { color: COLORS.muted, fontSize: 13 },

  historyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  historyText: { fontSize: 11, color: COLORS.muted },
});
