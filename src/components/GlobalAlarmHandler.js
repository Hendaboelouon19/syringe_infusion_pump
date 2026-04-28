import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function GlobalAlarmHandler() {
  const { alarmActive, syringeEmpty, dismissAlarm } = useContext(AppContext);
  const soundRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAndPlay() {
      // Don't play if already playing
      if (soundRef.current) return;

      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/alarm.wav'),
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        
        if (isMounted && alarmActive) {
          soundRef.current = sound;
          await sound.playAsync();
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error('[Alarm] Failed to load sound:', error);
      }
    }

    async function stopAndUnload() {
      if (soundRef.current) {
        const s = soundRef.current;
        soundRef.current = null;
        try {
          await s.stopAsync();
          await s.unloadAsync();
        } catch (e) {
          console.warn('[Alarm] Error unloading sound:', e);
        }
      }
    }

    if (alarmActive) {
      loadAndPlay();
    } else {
      stopAndUnload();
    }

    return () => {
      isMounted = false;
      // Note: We don't stop sound on unmount here to keep it persistent 
      // if the component somehow re-renders, but since it's global it should stay.
    };
  }, [alarmActive]);

  return (
    <Modal
      visible={alarmActive}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.banner}>
          <View style={styles.headerRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={36} color={colors.white} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>CRITICAL ALARM</Text>
              <Text style={styles.subtitle}>
                {syringeEmpty ? 'SYRINGE EMPTY / STOP TRIGGERED' : 'INFUSION COMPLETE'}
              </Text>
            </View>
          </View>

          <View style={styles.detailsContainer}>
             <Text style={styles.detailsText}>
               {syringeEmpty 
                 ? 'The hardware limit switch has been triggered. The system has stopped for safety.' 
                 : 'The target volume has been delivered or the timer has finished.'}
             </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.resetBtn} 
            onPress={dismissAlarm}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={24} color={colors.danger} style={{ marginRight: 10 }} />
            <Text style={styles.resetText}>RESET & RESUME SYSTEM</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  banner: {
    backgroundColor: colors.danger,
    borderRadius: 24,
    width: '100%',
    padding: 30,
    elevation: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  iconContainer: {
    marginRight: 18,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 1.5,
  },
  subtitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    opacity: 0.95,
  },
  detailsContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  detailsText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  resetBtn: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  resetText: {
    color: colors.danger,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
