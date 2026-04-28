import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { sendCommand } from '../services/esp32Service';
import { AppContext } from '../context/AppContext';

export default function ManualControlScreen({ navigation }) {
  const { esp32Connected, isInfusing, esp32FlowRate, setManualPolling, targetSpeed } = useContext(AppContext);
  const [manualSpeed, setManualSpeed] = useState(255);
  const [activeDirection, setActiveDirection] = useState('S'); // 'F', 'R', 'S'

  // Enable polling when screen is active
  useFocusEffect(
    React.useCallback(() => {
      setManualPolling(true);
      return () => setManualPolling(false);
    }, [setManualPolling])
  );

  const adjustManualSpeed = (amount) => {
    setManualSpeed((prev) => {
      const newSpeed = prev + amount;
      if (newSpeed > 255) return 255;
      if (newSpeed < 0) return 0;
      return newSpeed;
    });
  };

  const handleCommand = async (direction) => {
    if (!esp32Connected) {
      console.warn("Cannot send manual command. ESP32 Offline.");
      // Still update UI for testing without hardware
    }
    setActiveDirection(direction);
    await sendCommand('manual', { direction, speed: manualSpeed });
  };

  const isForward = activeDirection === 'F';
  const isReverse = activeDirection === 'R';
  const isStopped = activeDirection === 'S';

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color={colors.white} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Manual Override</Text>
        <Text style={styles.subtitle}>Direct Hardware Control</Text>
      </View>

      {/* Live Data Panel */}
      <View style={styles.liveDataPanel}>
        <View style={styles.liveItem}>
          <Text style={styles.liveLabel}>Measured Flow</Text>
          <Text style={styles.liveValue}>{esp32FlowRate.toFixed(3)}</Text>
          <Text style={styles.liveUnit}>ml/min</Text>
        </View>
        <View style={styles.liveDivider} />
        <View style={styles.liveItem}>
          <Text style={styles.liveLabel}>Motor Speed</Text>
          <Text style={styles.liveValue}>{targetSpeed}</Text>
          <Text style={styles.liveUnit}>RPM (PWM)</Text>
        </View>
        <View style={styles.liveDivider} />
        <View style={styles.liveItem}>
          <Text style={styles.liveLabel}>Status</Text>
          <Text style={[styles.liveStatus, esp32Connected ? styles.connectedText : styles.disconnectedText]}>
            {esp32Connected ? 'Connected' : 'Offline'}
          </Text>
        </View>
      </View>

      {isInfusing && (
        <View style={styles.warningBadge}>
          <Ionicons name="warning" size={14} color={colors.white} style={{ marginRight: 5 }} />
          <Text style={styles.warningText}>Automated Timer is Running!</Text>
        </View>
      )}

      {/* Flow Control Panel -> Changed to Manual Speed Panel */}
      <View style={styles.speedPanel}>
        <Text style={styles.panelTitle}>Manual PWM Speed</Text>
        <View style={styles.speedControls}>
          <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustManualSpeed(-15)}>
            <Ionicons name="remove" size={32} color={colors.white} />
          </TouchableOpacity>
          
          <View style={styles.speedDisplay}>
            <Text style={styles.speedValue}>{manualSpeed}</Text>
            <Text style={styles.speedLabel}>0 - 255</Text>
          </View>

          <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustManualSpeed(15)}>
            <Ionicons name="add" size={32} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Direction Controls */}
      <View style={styles.directionPanel}>
        <TouchableOpacity
          style={[styles.dirBtn, styles.forwardBtn, isForward && styles.activeForward]}
          onPress={() => handleCommand('F')}
        >
          <Ionicons name="arrow-up" size={36} color={isForward ? colors.white : colors.primary} />
          <Text style={[styles.dirText, isForward && styles.activeText]}>FORWARD</Text>
          <Text style={[styles.subText, isForward && styles.activeText]}>Infuse</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dirBtn, styles.stopBtn, isStopped && styles.activeStop]}
          onPress={() => handleCommand('S')}
        >
          <Ionicons name="square" size={32} color={isStopped ? colors.white : colors.danger} />
          <Text style={[styles.dirText, isStopped && styles.activeText, { color: isStopped ? colors.white : colors.danger }]}>STOP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dirBtn, styles.reverseBtn, isReverse && styles.activeReverse]}
          onPress={() => handleCommand('R')}
        >
          <Ionicons name="arrow-down" size={36} color={isReverse ? colors.white : colors.accent} />
          <Text style={[styles.dirText, isReverse && styles.activeText]}>REVERSE</Text>
          <Text style={[styles.subText, isReverse && styles.activeText]}>Retract</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 },
  header: { width: '100%', paddingTop: 100, paddingHorizontal: 20, marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.white, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.accent, textAlign: 'center', marginTop: 5 },
  
  liveDataPanel: { flexDirection: 'row', backgroundColor: colors.surface, width: '85%', padding: 15, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  liveItem: { flex: 1, alignItems: 'center' },
  liveLabel: { fontSize: 12, color: colors.primary, fontWeight: 'bold', marginBottom: 5 },
  liveValue: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  liveUnit: { fontSize: 10, color: colors.textSecondary },
  liveDivider: { width: 1, height: '70%', backgroundColor: colors.border },
  liveStatus: { fontSize: 16, fontWeight: 'bold' },
  connectedText: { color: colors.success ?? '#27ae60' },
  disconnectedText: { color: colors.danger },

  warningBadge: { flexDirection: 'row', backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginBottom: 20, alignItems: 'center' },
  warningText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },

  speedPanel: { width: '85%', backgroundColor: colors.surface, borderRadius: 20, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 25, elevation: 5 },
  panelTitle: { fontSize: 16, color: colors.primary, fontWeight: 'bold', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 },
  speedControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  adjustBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  speedDisplay: { alignItems: 'center', justifyContent: 'center', width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: colors.accent, backgroundColor: colors.background },
  speedValue: { fontSize: 36, fontWeight: 'bold', color: colors.white },
  speedLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  directionPanel: { width: '85%', flexDirection: 'column', gap: 15 },
  dirBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingVertical: 20, paddingHorizontal: 30, borderRadius: 15, borderWidth: 2, elevation: 2 },
  dirText: { fontSize: 22, fontWeight: 'bold', marginLeft: 20, flex: 1, color: colors.textPrimary },
  subText: { fontSize: 14, color: colors.textSecondary },
  
  forwardBtn: { borderColor: colors.primary },
  activeForward: { backgroundColor: colors.primary },
  
  reverseBtn: { borderColor: colors.accent },
  activeReverse: { backgroundColor: colors.accent },

  stopBtn: { borderColor: colors.danger, justifyContent: 'center' },
  activeStop: { backgroundColor: colors.danger },

  activeText: { color: colors.white },
});
