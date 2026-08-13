import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

class EvidenceServiceClass {
  recording = null;
  locations = [];
  startedAt = null;

  async start() {
    if (this.recording) return;
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Microphone permission not granted');
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
    this.recording = result.recording;
    this.locations = [];
    this.startedAt = new Date().toISOString();
  }

  addLocation(location) {
    if (!this.startedAt || !location) return;
    this.locations.push({ ...location, timestamp: new Date().toISOString() });
    this.locations = this.locations.slice(-100);
  }

  async stop() {
    if (!this.startedAt) return null;
    let audioUri = '';
    if (this.recording) {
      await this.recording.stopAndUnloadAsync().catch(() => {});
      const source = this.recording.getURI();
      if (source) {
        const folder = `${FileSystem.documentDirectory}evidence/`;
        await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
        audioUri = `${folder}sos-${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: source, to: audioUri });
        const files = (await FileSystem.readDirectoryAsync(folder)).sort().reverse();
        await Promise.all(files.slice(20).map(file => FileSystem.deleteAsync(`${folder}${file}`, { idempotent: true })));
      }
    }
    const evidence = { id: String(Date.now()), startedAt: this.startedAt, endedAt: new Date().toISOString(), audioUri, locations: this.locations };
    this.recording = null; this.locations = []; this.startedAt = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    return evidence;
  }

  async clear() {
    await this.stop().catch(() => null);
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}evidence/`, { idempotent: true });
  }
}

export const EvidenceService = new EvidenceServiceClass();
