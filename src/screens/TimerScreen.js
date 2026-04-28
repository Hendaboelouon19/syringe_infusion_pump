import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors } from '../theme/colors';
import HourglassTimer from '../components/HourglassTimer';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { Audio } from 'expo-av';

export default function TimerScreen({ navigation }) {
  const {
    timeRemaining, totalTime,
    isInfusing, stopInfusion, startInfusion,
    alarmActive, dismissAlarm,
    syringeEmpty,
    esp32FlowRate, calculatedFlowRate,
    esp32Connected,
  } = useContext(AppContext);

  const [sound, setSound] = useState(null);

  // Flash animation for syringe empty
  const flashAnim = new Animated.Value(0);
  useEffect(() => {
    if (syringeEmpty) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    } else {
      flashAnim.setValue(0);
    }
  }, [syringeEmpty]);

  const alarmBg = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(220,53,69,0)', 'rgba(220,53,69,0.18)'],
  });

  // Alarm audio handled globally by GlobalAlarmHandler


  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    if (h > 0 && h !== '00') return `${h}:${m}:${s}`;
    return `${m}:${s}`;
  };

  const toggleTimer = () => {
    if (isInfusing) stopInfusion();
    else if (!alarmActive) startInfusion();
  };

  const safeTotal = totalTime > 0 ? totalTime : 1;
  const progress = 1 - (timeRemaining / safeTotal);

  // Determine live vs target flow comparison
  const targetFlow = calculatedFlowRate; // ml/min from config
  // ESP32 sends ml/min directly
  const liveMlMin = esp32FlowRate;

  return (
    <Animated.View style={[styles.container, syringeEmpty && { backgroundColor: alarmBg }]}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={colors.white} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Infusion Timer</Text>
          <Text style={styles.subtitle}>Time until completion</Text>
        </View>

        {/* Connection + alarm banner */}
        {(isInfusing || alarmActive) && (
          <View style={styles.statusRow}>
            {/* ESP32 connection badge */}
            <View style={[styles.badge, esp32Connected ? styles.badgeOn : styles.badgeOff]}>
              <Ionicons
                name={esp32Connected ? 'radio' : 'radio-outline'}
                size={12}
                color={colors.white}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.badgeText}>
                {esp32Connected ? 'LIVE' : 'OFFLINE'}
              </Text>
            </View>


            {/* Syringe Empty warning banner */}
            {syringeEmpty && (
              <View style={styles.alarmBadge}>
                <Ionicons name="medical" size={14} color={colors.white} style={{ marginRight: 4 }} />
                <Text style={styles.badgeText}>SYRINGE EMPTY</Text>
              </View>
            )}
          </View>
        )}

        {/* Hourglass */}
        <View style={styles.hourglassWrapper}>
          <HourglassTimer isRunning={isInfusing} progress={progress} />
        </View>

        {/* Countdown */}
        <Text style={[styles.timeText, alarmActive && { color: colors.danger, textShadowColor: colors.danger }]}>
          {formatTime(timeRemaining)}
        </Text>

        {/* Live flow panel (shown when infusing/alarm & connected) */}
        {(isInfusing || alarmActive) && esp32Connected && (
          <View style={styles.livePanel}>
            <View style={styles.liveStat}>
              <Text style={styles.liveValue}>
                {liveMlMin.toFixed(2)}
              </Text>
              <Text style={styles.liveLabel}>ml/min (measured)</Text>
            </View>
            <View style={styles.liveDivider} />
            <View style={styles.liveStat}>
              <Text style={styles.liveValue}>
                {targetFlow.toFixed(2)}
              </Text>
              <Text style={styles.liveLabel}>ml/min (target)</Text>
            </View>
          </View>
        )}

        {/* Controls */}
        {alarmActive ? (
          <TouchableOpacity style={styles.dismissBtn} onPress={dismissAlarm}>
            <Ionicons name="close-circle" size={32} color={colors.white} style={{ marginRight: 10 }} />
            <Text style={styles.dismissText}>Dismiss Alarm</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.controls}>
            <TouchableOpacity style={[styles.btnStart, isInfusing && styles.btnStop]} onPress={toggleTimer}>
              <Ionicons name={isInfusing ? 'pause' : 'play'} size={32} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  backBtn:        { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 },
  header:         { width: '100%', paddingTop: 100, paddingHorizontal: 20, marginBottom: 20, alignItems: 'center' },
  title:          { fontSize: 32, fontWeight: 'bold', color: colors.white, textAlign: 'center' },
  subtitle:       { fontSize: 16, color: colors.white, textAlign: 'center', marginTop: 5, opacity: 0.8 },

  statusRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeOn:        { backgroundColor: '#27ae60' },
  badgeOff:       { backgroundColor: '#666' },
  alarmBadge:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.danger },
  badgeText:      { color: colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  hourglassWrapper: { width: 200, height: 280, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  timeText:       { fontSize: 64, fontWeight: 'bold', color: colors.white, fontFamily: 'monospace', textShadowColor: colors.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 },

  livePanel:      { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, marginTop: 16, borderWidth: 1, borderColor: colors.border, width: '88%', justifyContent: 'space-between', alignItems: 'center' },
  liveStat:       { flex: 1, alignItems: 'center' },
  liveValue:      { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  liveLabel:      { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  liveDivider:    { width: 1, height: 36, backgroundColor: colors.border },

  controls:       { flexDirection: 'row', marginTop: 30, alignItems: 'center' },
  btnStart:       { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 15, borderWidth: 2, borderColor: colors.accent },
  btnStop:        { backgroundColor: colors.secondary },
  dismissBtn:     { marginTop: 30, flexDirection: 'row', backgroundColor: colors.danger, paddingVertical: 18, paddingHorizontal: 35, borderRadius: 30, alignItems: 'center', elevation: 10 },
  dismissText:    { color: colors.white, fontSize: 20, fontWeight: 'bold' },
});
