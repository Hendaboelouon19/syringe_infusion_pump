import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

export default function AlarmsScreen({ navigation }) {
  const [alarms, setAlarms] = useState([
    { id: '1', title: 'Occlusion Detected', active: false, icon: 'warning', desc: 'Blocked tube or high pressure.' },
    { id: '2', title: 'Syringe Empty', active: false, icon: 'medical', desc: 'Plunger reached end.' },
    { id: '3', title: 'Tube Empty', active: false, icon: 'water', desc: 'Flow reading 0 for 30s.' },
  ]);
  
  // This simulates an alarm tripping
  const handleTestAlarm = (id) => {
    setAlarms(current => current.map(a => a.id === id ? { ...a, active: true } : a));
  };

  const handleDismiss = (id) => {
    setAlarms(current => current.map(a => a.id === id ? { ...a, active: false } : a));
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.card, item.active && styles.cardActive]} 
      onPress={() => !item.active && handleTestAlarm(item.id)}
      activeOpacity={0.9}
    >
      <View style={{flexDirection: 'row', alignItems: 'center', width: '100%'}}>
        <View style={[styles.iconBox, item.active && styles.iconBoxActive]}>
          <Ionicons name={item.icon} size={28} color={item.active ? colors.white : colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.title, item.active && styles.titleActive]}>{item.title}</Text>
          <Text style={[styles.desc, item.active && styles.descActive]}>{item.desc}</Text>
        </View>
        <View style={styles.status}>
          {item.active ? (
            <Ionicons name="alert-circle" size={28} color={colors.white} />
          ) : (
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          )}
        </View>
      </View>
      
      {item.active && (
        <TouchableOpacity style={styles.dismissBtn} onPress={() => handleDismiss(item.id)}>
           <Ionicons name="refresh" size={18} color={colors.danger} style={{marginRight: 6}} />
           <Text style={styles.dismissText}>Reset Alarm</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
         <Ionicons name="arrow-back" size={28} color={colors.white} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>System Alarms</Text>
        <Text style={styles.headerSubtitle}>Monitor ESP32 Sensors</Text>
      </View>

      <FlatList 
        data={alarms}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 },
  header: { paddingTop: 100, paddingHorizontal: 20, marginBottom: 20, alignItems: 'center' },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: colors.white, textShadowColor: '#000', textShadowOffset: {width:0, height:0}, textShadowRadius: 10 },
  headerSubtitle: { fontSize: 16, color: colors.accent, marginTop: 5 },
  list: { padding: 20 },
  card: { backgroundColor: colors.surface, padding: 20, borderRadius: 15, marginBottom: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: {width:0, height:5}, shadowRadius: 10, shadowOpacity: 0.1, elevation: 5 },
  cardActive: { backgroundColor: colors.danger, borderColor: colors.danger, shadowColor: colors.danger, shadowOpacity: 0.8 },
  iconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: colors.border },
  iconBoxActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: colors.white },
  info: { flex: 1 },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 }, // Fixed to dark
  titleActive: { color: colors.white, textShadowColor: '#000', textShadowRadius: 5 },
  desc: { fontSize: 13, color: colors.textSecondary }, // Fixed to darker fade
  descActive: { color: '#ffeaec' },
  status: { marginLeft: 10 },
  dismissBtn: { marginTop: 15, backgroundColor: colors.white, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  dismissText: { color: colors.danger, fontWeight: 'bold' }
});
