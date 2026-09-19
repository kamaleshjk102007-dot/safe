import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityAlertService } from '../services/CommunityAlertService';
import { useAppContext } from '../store/AppContext';

const ICONS = { FIRE_RESCUE:'🚒', AMBULANCE:'🚑', POLICE:'👮', DISASTER_RESPONSE:'🛟', SEARCH_AND_RESCUE:'🔎', MEDICAL:'⚕️' };

export default function AuthorityResourcesScreen({ navigation }) {
  const { state } = useAppContext();
  const [authorityKey, setAuthorityKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadIncidents() {
    setLoading(true);
    try {
      const result = await CommunityAlertService.listPublicIncidents({ serverUrl: state.alertServerUrl, authorityKey });
      setIncidents(result.incidents || []);
      setUnlocked(true);
    } catch (error) { Alert.alert('Authority Access Unavailable', error.message || 'Check the authority key and server configuration.'); }
    finally { setLoading(false); }
  }

  async function openIncident(incident) {
    setLoading(true); setSelected(incident); setDetails(null);
    try {
      const result = await CommunityAlertService.getNearbyResources({ serverUrl: state.alertServerUrl, authorityKey, incidentId: incident.id });
      setDetails(result);
    } catch (error) { Alert.alert('Resource Search Failed', error.message || 'Try again.'); }
    finally { setLoading(false); }
  }

  async function coordinate(resource) {
    Alert.alert('Coordinate response', `Record coordination with ${resource.name}? This will not dispatch an agency.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Record coordination', onPress: async () => {
        try {
          const result = await CommunityAlertService.coordinatePublicResponse({ serverUrl: state.alertServerUrl, authorityKey, incidentId: selected.id, resourceId: resource.id });
          Alert.alert('Response coordination initiated', result.message);
          await openIncident(selected);
        } catch (error) { Alert.alert('Could Not Coordinate', error.message || 'Try again.'); }
      } },
    ]);
  }

  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
    <Text style={styles.title}>Authority resources</Text>
    <Text style={styles.hint}>Registered demo resources only. No live government availability or automatic dispatch.</Text>
    {!unlocked ? <View style={styles.card}>
      <Text style={styles.label}>AUTHORITY ACCESS KEY</Text>
      <TextInput style={styles.input} value={authorityKey} onChangeText={setAuthorityKey} secureTextEntry autoCapitalize="none" placeholder="Enter configured key" placeholderTextColor="#78909C" />
      <TouchableOpacity style={styles.button} onPress={loadIncidents} disabled={loading || !authorityKey}><Text style={styles.buttonText}>OPEN AUTHORITY VIEW</Text></TouchableOpacity>
    </View> : <>
      <TouchableOpacity onPress={loadIncidents} style={styles.back}><Text style={styles.link}>Refresh incidents</Text></TouchableOpacity>
      {incidents.length === 0 && <Text style={styles.hint}>No public incidents reported yet.</Text>}
      {incidents.map(incident => <TouchableOpacity key={incident.id} style={[styles.card, selected?.id===incident.id && styles.activeCard]} onPress={() => openIncident(incident)}>
        <Text style={styles.cardTitle}>{incident.incidentType.replace(/_/g,' ')} · {incident.severity}</Text>
        <Text style={styles.text}>{incident.description || 'No description supplied'}</Text>
        <Text style={styles.hint}>{incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)} · {incident.status}{incident.demoMode?' · DEMO LOCATION':''}</Text>
      </TouchableOpacity>)}
      {loading && <ActivityIndicator color="#00C2A8" style={{marginTop:20}} />}
      {details && <View style={styles.section}>
        <Text style={styles.sectionTitle}>NEARBY RESPONSE RESOURCES</Text>
        <Text style={styles.hint}>Within {details.radiusKm} km · registered demo data · authority decision support</Text>
        <Text style={styles.hint}>{details.recommendation.source === 'AI_ASSISTED' ? 'AI-assisted suggestion' : 'Rule-based suggestion'}: {details.recommendation.reason}</Text>
        <TouchableOpacity style={styles.mapButton} onPress={() => navigation.navigate('Main', { screen:'Map', params:{ publicIncident: details.incident, resources: details.resources } })}><Text style={styles.buttonText}>VIEW ON EXISTING MAP</Text></TouchableOpacity>
        {details.resources.length === 0 && <Text style={styles.hint}>{details.message}</Text>}
        {details.resources.map(resource => <View key={resource.id} style={styles.card}>
          <Text style={styles.cardTitle}>{ICONS[resource.type] || '🛟'} {resource.name}</Text>
          <Text style={styles.text}>{resource.distanceKm} km · {resource.type.replace(/_/g,' ')}</Text>
          <Text style={styles.hint}>{resource.matchingCapabilities.join(' • ')}</Text>
          <Text style={[styles.status, {color:resource.available?'#36D399':'#FFB020'}]}>{resource.status} · DEMO REGISTRY</Text>
          {resource.available && <TouchableOpacity style={styles.button} onPress={() => coordinate(resource)}><Text style={styles.buttonText}>COORDINATE RESPONSE</Text></TouchableOpacity>}
        </View>)}
        {(details.incident.coordinationActions || []).map(action => <Text key={action.id} style={styles.hint}>✓ {action.resourceName}: response coordination initiated at {action.at}</Text>)}
      </View>}
    </>}
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#06131F'},content:{padding:16,paddingBottom:40},back:{minHeight:44,justifyContent:'center'},backText:{color:'#91A9B8',fontSize:16},title:{color:'#fff',fontSize:22,fontWeight:'800',marginTop:8},hint:{color:'#91A9B8',fontSize:12,lineHeight:18,marginTop:8},link:{color:'#00C2A8',fontWeight:'700'},card:{backgroundColor:'#0C2233',borderWidth:1,borderColor:'#1C4057',borderRadius:12,padding:16,marginTop:12},activeCard:{borderColor:'#00C2A8'},label:{color:'#91A9B8',fontSize:11,fontWeight:'700',marginBottom:8},input:{backgroundColor:'#06131F',color:'#fff',borderWidth:1,borderColor:'#1C4057',borderRadius:10,minHeight:48,paddingHorizontal:12},button:{minHeight:44,backgroundColor:'#1565C0',borderRadius:10,justifyContent:'center',alignItems:'center',marginTop:12,paddingHorizontal:12},mapButton:{minHeight:44,backgroundColor:'#12645D',borderRadius:10,justifyContent:'center',alignItems:'center',marginTop:12},buttonText:{color:'#fff',fontSize:12,fontWeight:'800'},cardTitle:{color:'#fff',fontSize:15,fontWeight:'800'},text:{color:'#F4FAFC',fontSize:12,marginTop:6},status:{fontSize:11,fontWeight:'800',marginTop:8},section:{marginTop:24},sectionTitle:{color:'#fff',fontSize:14,fontWeight:'800'}});
