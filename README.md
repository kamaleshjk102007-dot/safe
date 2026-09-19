# RESQ 360 — Personal Emergency Response System

## Public emergency resource-identification prototype

The Home screen also offers **Report Public Emergency**. This is separate from personal SOS: it records incident type, severity, description, and a fresh GPS fix without calling contacts or dispatching an agency. The authority resource view requires the backend environment variable `RESQ_AUTHORITY_KEY` (set a long random value in Render's environment settings); the key is entered in the app and is not bundled in the APK. If the variable is absent, authority endpoints fail closed.

For a lab demonstration away from Coimbatore, the report form has an explicit **Use Coimbatore demo location** option. It marks the incident as a simulation and sends test coordinates instead of the phone's GPS. Leave it off for a real-location report.

The backend uses the registered **demo-only** resources in `server/demo-resources.json`. They are fictional units around Coimbatore, not government registrations, live availability, or verified contacts. Set `RESOURCE_SEARCH_RADIUS_KM` to change the default 10 km search radius. The server calculates Haversine distance, capability matches, availability, and transparent ranking. An authority can review the list on the existing map and record “Response coordination initiated”; no external agency is contacted. Incident records and coordination actions use the existing server's JSON-file storage pattern (`public-incidents.json` in `SAFEGUARD_DATA_DIR` or the server directory). Render's ephemeral filesystem is not suitable for durable production records; use a persistent datastore before real deployment.

An optional AI recommendation service can be configured with `RESQ_RESOURCE_AI_URL` (HTTPS) and `RESQ_RESOURCE_AI_API_KEY`. It receives only structured incident and ranked-resource facts and must return JSON `{ "recommendedResourceIds": ["demo_fire_01"] }`. The backend accepts only IDs of available registered results and writes its own factual explanation. If the service is unset, unavailable, or returns invalid IDs, the response is explicitly `RULE_BASED`. No pretrained model is bundled. The authority must make the final decision.

API: `POST /public-incidents` is the public report endpoint. `GET /public-incidents`, `GET /public-incidents/:id/nearby-resources`, and `POST /public-incidents/:id/coordinate` require the `X-RESQ-Authority-Key` header. There is intentionally no public resource-management endpoint.

Run all backend tests (including Reacher Verification):

```bash
node --test server/reacher-verification.test.js server/reacher-integration.test.js server/resource-matching.test.js server/public-incidents.test.js
```

This build removes the ESP32 / BLE physical panic-button dependency. SOS alerts
are triggered entirely from the phone: a tap on the SOS button, or an incoming
SMS in the app's supported formats. No microcontroller, GPS module, or GSM
module is required.

---

## 📁 Project Structure

```
SafeGuard/
|-- App.js                          <- Root app entry
|-- index.js                        <- Expo entry
|-- app.json                        <- Expo config + permissions
|-- package.json                    <- All dependencies
|-- babel.config.js
|-- src/
|   |-- store/
|   |   |-- AppContext.js           <- Global state management
|   |-- navigation/
|   |   |-- AppNavigator.js         <- Tab + Stack navigator
|   |-- screens/
|   |   |-- HomeScreen.js           <- Dashboard + SOS button
|   |   |-- EmergencyScreen.js      <- Full red alert UI
|   |   |-- MapScreen.js            <- OpenStreetMap display
|   |   |-- ContactsScreen.js       <- Emergency contacts CRUD
|   |   |-- HistoryScreen.js        <- Alert event log
|   |   |-- SettingsScreen.js       <- SMS config + community alert setup
|   |-- services/
|       |-- SMSService.js           <- Incoming SMS SOS parsing
|       |-- NotificationService.js  <- Push notifications
|       |-- PermissionsService.js   <- Android permissions
|       |-- CommunityAlertService.js<- Broadcast SOS to other app users
|-- server/
    |-- alert-broadcast-server.js   <- Optional Node server for community broadcast
```

---

## How SOS triggers now work

1. **Manual (App button)** — tap the big SOS button on the Home screen. Captures
   current GPS location, vibrates, opens the Emergency screen, and (if a
   broadcast server URL is configured) notifies other registered app users.
2. **SMS** — if another phone (a friend, or any SMS sender) texts one of the
   supported formats to this phone, the app detects it and triggers the same
   flow:
   - `SOS ALERT | LAT:12.9716 | LNG:77.5946`
   - `SOS|12.9716|77.5946`
   - `EMERGENCY LAT=12.9716 LNG=77.5946`

Both paths are pure software — no physical device pairing is needed.

---

## STEP 1: Install dependencies

```bash
npm install
```

## STEP 2: Configure Firebase (for push notifications)

Add your own `google-services.json` to the project root (referenced in
`app.json` under `expo.android.googleServicesFile`). Firebase Cloud Messaging
is used for community SOS broadcast push notifications — see the "Best Free
Stack" note below.

## STEP 3: (Optional) Run the community alert broadcast server

```bash
npm run alerts:server
```

This starts a small local Node server (`server/alert-broadcast-server.js`)
that registers device push tokens and relays SOS broadcasts to everyone
registered. Set the server's URL in the app's Settings screen
("Broadcast Server URL") to enable this. If you skip this step, the app still
works standalone — Manual and SMS SOS triggers, contacts, history, and maps
all function without it.

## STEP 4: Run the app

```bash
npm run android
```

---

## Android Permissions (current)

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

No Bluetooth permissions and no `android.hardware.bluetooth_le` feature
requirement — the app now installs on any Android device regardless of BLE
support.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| SMS SOS not detected | Ensure the incoming SMS matches one of the supported formats exactly; test formats via Settings → "Test SMS Format" |
| Location not showing | Grant Location permission in system Settings; check GPS is enabled |
| Community alerts not received | Confirm the broadcast server is running and reachable, and that "Broadcast Server URL" is saved in Settings |
| Push notifications not arriving | Verify `google-services.json` is present and Firebase project is configured |

---

## What was removed from the original build

- `src/services/BLEService.js` and all BLE state/UI (device scanning, pairing,
  characteristic monitoring)
- `esp32_firmware/SafeGuard_ESP32.ino` (Arduino sketch)
- `react-native-ble-plx` dependency and its Expo config plugin
- Bluetooth permissions from `app.json` and `AndroidManifest.xml`
- The `android.hardware.bluetooth_le required="true"` hardware feature flag,
  which previously blocked installation on devices without BLE
