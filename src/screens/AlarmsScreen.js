import React, { useContext, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { sendCommand } from '../services/esp32Service';

export default function AlarmsScreen({ navigation }) {
  const {
    esp32Connected,
    isInfusing,
    dismissAlarm,
    alarmActive,
    esp32FlowRate,
    syringeEmpty,
  } = useContext(AppContext);

  // Pulsing animation for active alarms
  const pulseAnim = new Animated.Value(1);
  useEffect(() => {
    if (syringeEmpty || (!esp32Connected && isInfusing)) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.00, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [syringeEmpty, esp32Connected, isInfusing]);

  const alarms = [
    {
      id: 'connection',
      title: 'ESP32 Connection Lost',
      icon: 'wifi',
      desc: 'Cannot reach the pump controller over WiFi.',
      active: !esp32Connected && isInfusing,
      detail: !esp32Connected && isInfusing
        ? 'Check WiFi and verify ESP32 IP in esp32Service.js'
        : null,
    },
    {
      id: 'empty',
      title: 'Syringe Empty',
      icon: 'medical',
      desc: 'Plunger reached end. Replace syringe.',
      active: syringeEmpty,
      detail: syringeEmpty ? 'Hardware limit switch triggered — motor stopped.' : null,
    },
  ];

  const handleDismiss = async () => {
    await dismissAlarm();
  };

  const renderItem = ({ item }) => (
    <Animated.View style={{ transform: [{ scale: item.active ? pulseAnim : 1 }] }}>
      <View style={[styles.card, item.active && styles.cardActive]}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBox, item.active && styles.iconBoxActive]}>
            <Ionicons name={item.icon} size={28} color={item.active ? colors.white : colors.primary} />
          </View>

          <View style={styles.info}>
            <Text style={[styles.title, item.active && styles.titleActive]}>{item.title}</Text>
            <Text style={[styles.desc,  item.active && styles.descActive]}>{item.desc}</Text>
            {item.active && item.detail && (
              <Text style={styles.detailText}>{item.detail}</Text>
            )}
          </View>

          <View style={styles.status}>
            {item.active ? (
              <Ionicons name="alert-circle" size={28} color={colors.white} />
            ) : (
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            )}
          </View>
        </View>

        {/* Dismiss button for active alarms */}
        {item.id === 'empty' && item.active && (
          <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
            <Ionicons name="refresh" size={18} color={colors.danger} style={{ marginRight: 6 }} />
            <Text style={styles.dismissText}>Reset & Resume</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  const anyActive = alarms.some((a) => a.active);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color={colors.white} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>System Alarms</Text>
        <Text style={styles.headerSubtitle}>
          {anyActive ? '⚠️  Action Required' : '✅  All Systems Normal'}
        </Text>

        {/* Connection badge */}
        <View style={[styles.badge, esp32Connected ? styles.badgeOn : styles.badgeOff]}>
          <Ionicons
            name={esp32Connected ? 'wifi' : 'wifi-outline'}
            size={14}
            color={colors.white}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.badgeText}>
            {esp32Connected ? 'ESP32 Connected' : 'ESP32 Offline'}
          </Text>
        </View>
      </View>

      {/* Live flow summary card (shown when infusing and connected) */}
      {isInfusing && esp32Connected && (
        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>Live Sensor Feed</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveStat}>
              <Text style={styles.liveValue}>{esp32FlowRate.toFixed(3)}</Text>
              <Text style={styles.liveLabel}>ml/min (live)</Text>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={alarms}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.background },
  backBtn:         { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 },
  header:          { paddingTop: 100, paddingHorizontal: 20, marginBottom: 10, alignItems: 'center' },
  headerTitle:     { fontSize: 32, fontWeight: 'bold', color: colors.white },
  headerSubtitle:  { fontSize: 15, color: colors.accent, marginTop: 5 },

  badge:           { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  badgeOn:         { backgroundColor: colors.success ?? '#27ae60' },
  badgeOff:        { backgroundColor: '#555' },
  badgeText:       { color: colors.white, fontSize: 13, fontWeight: '600' },

  liveCard:        { marginHorizontal: 20, marginBottom: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  liveTitle:       { fontSize: 13, color: colors.primary, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  liveRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveStat:        { flex: 1, alignItems: 'center' },
  liveValue:       { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  liveLabel:       { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  liveDivider:     { width: 1, height: 40, backgroundColor: colors.border },

  list:            { padding: 20 },
  card:            { backgroundColor: colors.surface, padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: colors.border, elevation: 5 },
  cardActive:      { backgroundColor: colors.danger, borderColor: colors.danger, shadowColor: colors.danger, shadowOpacity: 0.8, elevation: 10 },
  cardRow:         { flexDirection: 'row', alignItems: 'center', width: '100%' },
  iconBox:         { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: colors.border },
  iconBoxActive:   { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: colors.white },
  info:            { flex: 1 },
  title:           { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 3 },
  titleActive:     { color: colors.white },
  desc:            { fontSize: 13, color: colors.textSecondary },
  descActive:      { color: '#ffeaec' },
  detailText:      { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 6, fontFamily: 'monospace' },
  status:          { marginLeft: 10 },
  dismissBtn:      { marginTop: 14, backgroundColor: colors.white, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', elevation: 2 },
  dismissText:     { color: colors.danger, fontWeight: 'bold' },
});
