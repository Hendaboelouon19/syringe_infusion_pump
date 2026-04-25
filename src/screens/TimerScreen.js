import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import HourglassTimer from '../components/HourglassTimer';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { Audio } from 'expo-av';

export default function TimerScreen({ navigation }) {
  const { timeRemaining, totalTime, isInfusing, stopInfusion, startInfusion, alarmActive, dismissAlarm } = useContext(AppContext);
  const [sound, setSound] = useState(null);

  useEffect(() => {
    let currentSound;
    const playAudio = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
          { shouldPlay: true, isLooping: true }
        );
        currentSound = newSound;
        setSound(newSound);
      } catch (e) {
        console.error("Audio playback failed", e);
      }
    };

    if (alarmActive && !sound) {
      playAudio();
    } else if (!alarmActive && sound) {
      sound.stopAsync();
      sound.unloadAsync();
      setSound(null);
    }

    return () => {
      if (currentSound) {
        currentSound.unloadAsync();
      }
    };
  }, [alarmActive]);

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

  const handleDismiss = () => {
    dismissAlarm();
  };

  const safeTotal = totalTime > 0 ? totalTime : 1;
  const progress = 1 - (timeRemaining / safeTotal);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
         <Ionicons name="arrow-back" size={28} color={colors.white} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Infusion Timer</Text>
        <Text style={styles.subtitle}>Time until completion</Text>
      </View>

      <View style={styles.hourglassWrapper}>
        <HourglassTimer isRunning={isInfusing} progress={progress} />
      </View>
      
      <Text style={[styles.timeText, alarmActive && { color: colors.danger, textShadowColor: colors.danger }]}>
        {formatTime(timeRemaining)}
      </Text>

      {alarmActive ? (
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
          <Ionicons name="close-circle" size={32} color={colors.white} style={{marginRight: 10}} />
          <Text style={styles.dismissText}>Dismiss Alarm</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.btnStart, isInfusing && styles.btnStop]} onPress={toggleTimer}>
            <Ionicons name={isInfusing ? "pause" : "play"} size={32} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 },
  header: { width: '100%', paddingTop: 100, paddingHorizontal: 20, marginBottom: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.white, textAlign: 'center', textShadowColor: '#000', textShadowOffset:{width:0, height:0}, textShadowRadius: 10 },
  subtitle: { fontSize: 16, color: colors.white, textAlign: 'center', marginTop: 5, opacity: 0.8 },
  hourglassWrapper: {
    width: 200, height: 300, justifyContent: 'center', alignItems: 'center', marginBottom: 40,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 10,
  },
  timeText: { fontSize: 64, fontWeight: 'bold', color: colors.white, fontFamily: 'monospace', textShadowColor: colors.accent, textShadowOffset:{width:0, height:0}, textShadowRadius: 15 },
  controls: { flexDirection: 'row', marginTop: 40, alignItems: 'center' },
  btnStart: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 15, borderWidth: 2, borderColor: colors.accent },
  btnStop: { backgroundColor: colors.secondary },
  dismissBtn: { marginTop: 40, flexDirection: 'row', backgroundColor: colors.danger, paddingVertical: 18, paddingHorizontal: 35, borderRadius: 30, alignItems: 'center', elevation: 10, shadowColor: colors.danger, shadowOpacity: 1, shadowRadius: 20 },
  dismissText: { color: colors.white, fontSize: 20, fontWeight: 'bold' }
});
