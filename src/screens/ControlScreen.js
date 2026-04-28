import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { sendCommand } from '../services/esp32Service';
import { AppContext } from '../context/AppContext';

export default function ControlScreen({ navigation }) {
  const { 
    mode, setMode,
    volume, setVolume, flowRate, setFlowRate,
    dose, setDose, concentration, setConcentration, targetTime, setTargetTime,
    calculatedFlowRate, timeRemaining, startInfusion, isInfusing,
    esp32Connected, targetSpeed, setManualPolling, hardwareDirection
  } = useContext(AppContext);

  const [activeDirection, setActiveDirection] = useState('S');
  const [manualSpeed, setManualSpeed] = useState(255); // Default to max for quick prime/retract

  // Keep polling active while on this unified control screen
  React.useEffect(() => {
    setManualPolling(true);
    return () => setManualPolling(false);
  }, [setManualPolling]);

  const handleStart = async () => {
    if (timeRemaining > 0) {
      await sendCommand('start', { flowRate: calculatedFlowRate });
      startInfusion();
      navigation.navigate('Timer');
    }
  };

  const handleManualCommand = async (direction) => {
    if (!esp32Connected) {
      console.warn("Cannot send manual command. ESP32 Offline.");
    }
    setActiveDirection(direction);
    await sendCommand('manual', { direction, speed: manualSpeed });
  };

  const adjustManualSpeed = (amount) => {
    setManualSpeed((prev) => {
      const newSpeed = prev + amount;
      if (newSpeed > 255) return 255;
      if (newSpeed < 0) return 0;
      return newSpeed;
    });
  };

  const calFlow = [41.88, 46.82, 47.19, 49.00, 51.72, 59.55, 66.37];
  const calSpeed = [165, 175, 185, 195, 205, 245, 255];

  const calculateSpeed = (targetFlow) => {
    if (!targetFlow) return 0;
    if (targetFlow <= calFlow[0]) return calSpeed[0];
    if (targetFlow >= calFlow[calFlow.length - 1]) return calSpeed[calSpeed.length - 1];

    for (let i = 0; i < calFlow.length - 1; i++) {
      if (targetFlow >= calFlow[i] && targetFlow <= calFlow[i + 1]) {
        const r = (targetFlow - calFlow[i]) / (calFlow[i + 1] - calFlow[i]);
        const speed = calSpeed[i] + r * (calSpeed[i + 1] - calSpeed[i]);
        return Math.round(speed);
      }
    }
    return 205;
  };

  const uiTargetSpeed = calculateSpeed(calculatedFlowRate);

  const formatTime = (seconds) => {
    if (seconds <= 0) return '0h 0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const isForward = activeDirection === 'F';
  const isReverse = activeDirection === 'R';
  const isStopped = activeDirection === 'S';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
         <Ionicons name="arrow-back" size={28} color={colors.white} />
      </TouchableOpacity>
      
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Infusion Config</Text>
        </View>

        {/* Toggle Mode */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleBtn, mode === 'Option1' && styles.toggleActive]}
            onPress={() => setMode('Option1')}
          >
            <Text style={[styles.toggleText, mode === 'Option1' && styles.toggleTextActive]}>Volume & Flow</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, mode === 'Option2' && styles.toggleActive]}
            onPress={() => setMode('Option2')}
          >
            <Text style={[styles.toggleText, mode === 'Option2' && styles.toggleTextActive]}>Dose & Time</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {mode === 'Option1' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Total Volume (ml)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={volume} 
                  onChangeText={setVolume} 
                  placeholder="e.g. 50" 
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Flow Rate (ml/min)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={flowRate} 
                  onChangeText={setFlowRate} 
                  placeholder="e.g. 1.5" 
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Dose (mg)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={dose} 
                  onChangeText={setDose} 
                  placeholder="e.g. 100" 
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Concentration (mg/ml)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={concentration} 
                  onChangeText={setConcentration} 
                  placeholder="e.g. 5" 
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Target Time (mins)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={targetTime} 
                  onChangeText={setTargetTime} 
                  placeholder="e.g. 30" 
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.dashboard}>
          <View style={styles.glowRing}>
            <Text style={styles.ringValue}>{calculatedFlowRate ? calculatedFlowRate.toFixed(2) : 0}</Text>
            <Text style={styles.ringLabel}>ml/min</Text>
            {mode === 'Option2' && <Text style={styles.ringLabelTime}>Time: {formatTime(timeRemaining)}</Text>}
          </View>
          <View style={styles.motorStatus}>
            <Ionicons name="hardware-chip" size={24} color={esp32Connected ? colors.success : colors.textSecondary} />
            <Text style={styles.motorText}>
              {esp32Connected ? `Pump Online - ${uiTargetSpeed} RPM [${hardwareDirection === 'F' ? 'FORWARD' : hardwareDirection === 'R' ? 'REVERSE' : 'STOP'}]` : 'Pump Offline'}
            </Text>
          </View>
        </View>

        {/* Manual Overrides on Same Tab */}
        <View style={styles.directionPanel}>
          <Text style={styles.sectionLabel}>MANUAL OVERRIDE (Independent Speed)</Text>
          
          {/* Manual Speed Stepper */}
          <View style={styles.manualSpeedRow}>
             <Text style={styles.manualSpeedLabel}>Manual PWM Speed (0-255):</Text>
             <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustManualSpeed(-15)}>
                   <Ionicons name="remove" size={20} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{manualSpeed}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustManualSpeed(15)}>
                   <Ionicons name="add" size={20} color={colors.white} />
                </TouchableOpacity>
             </View>
          </View>

          <View style={styles.dirRow}>
            <TouchableOpacity
              style={[styles.dirBtn, styles.forwardBtn, isForward && styles.activeForward]}
              onPress={() => handleManualCommand('F')}
            >
              <Ionicons name="arrow-up" size={24} color={isForward ? colors.white : colors.primary} />
              <Text style={[styles.dirText, isForward && styles.activeText]}>Prime</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dirBtn, styles.stopBtn, isStopped && styles.activeStop]}
              onPress={() => handleManualCommand('S')}
            >
              <Ionicons name="square" size={24} color={isStopped ? colors.white : colors.danger} />
              <Text style={[styles.dirText, isStopped && styles.activeText, { color: isStopped ? colors.white : colors.danger }]}>Stop</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dirBtn, styles.reverseBtn, isReverse && styles.activeReverse]}
              onPress={() => handleManualCommand('R')}
            >
              <Ionicons name="arrow-down" size={24} color={isReverse ? colors.white : colors.accent} />
              <Text style={[styles.dirText, isReverse && styles.activeText]}>Retract</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.startBtn, isInfusing && styles.startBtnActive]} 
          onPress={handleStart}
          disabled={isInfusing || timeRemaining <= 0}
        >
          <Ionicons name={isInfusing ? "pulse" : "play"} size={20} color={colors.white} style={{marginRight: 10}}/>
          <Text style={styles.startText}>{isInfusing ? "Infusion Running..." : "Send & Start"}</Text>
        </TouchableOpacity>
        
        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 },
  scroll: { padding: 20, paddingTop: 100, alignItems: 'center' },
  header: { width: '100%', marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.white, textShadowColor: colors.primary, textShadowOffset:{width:0, height:0}, textShadowRadius: 10 },
  
  toggleContainer: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 20, marginBottom: 20, width: '100%', padding: 5 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 15 },
  toggleActive: { backgroundColor: colors.primary, elevation: 2 },
  toggleText: { color: colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: colors.white },

  card: { width: '100%', backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: colors.primary, marginBottom: 8, fontWeight: 'bold' },
  
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 15, fontSize: 18, color: colors.textPrimary, backgroundColor: '#f9f9f9' },
  
  dashboard: { alignItems: 'center', marginVertical: 10 },
  glowRing: { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20 },
  ringValue: { fontSize: 40, fontWeight: 'bold', color: colors.textPrimary },
  ringLabel: { fontSize: 14, color: colors.textSecondary, marginTop: 5 },
  ringLabelTime: { fontSize: 12, color: colors.accent, marginTop: 5, fontWeight: 'bold' },
  
  motorStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 25, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  motorText: { color: colors.textPrimary, fontWeight: 'bold', marginLeft: 10 },
  
  startBtn: { backgroundColor: colors.success, padding: 18, borderRadius: 15, alignItems: 'center', width: '100%', flexDirection: 'row', justifyContent: 'center' },
  startBtnActive: { backgroundColor: colors.danger },
  startBtnDisabled: { opacity: 0.5 },
  startText: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  
  directionPanel: { width: '100%', marginTop: 10, marginBottom: 20, padding: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15 },
  sectionLabel: { color: colors.white, fontSize: 14, fontWeight: 'bold', marginBottom: 15, alignSelf: 'center', opacity: 0.8 },
  manualSpeedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 5 },
  manualSpeedLabel: { color: colors.white, fontSize: 13, opacity: 0.9 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  stepperBtn: { padding: 8, backgroundColor: colors.primary, borderRadius: 8 },
  stepperValue: { color: colors.white, fontWeight: 'bold', width: 40, textAlign: 'center', fontSize: 16 },
  
  dirRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dirBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', backgroundColor: colors.surface, paddingVertical: 15, marginHorizontal: 5, borderRadius: 12, borderWidth: 2, elevation: 2 },
  dirText: { fontSize: 13, fontWeight: 'bold', marginTop: 8, color: colors.textPrimary },
  
  forwardBtn: { borderColor: colors.primary },
  activeForward: { backgroundColor: colors.primary },
  
  reverseBtn: { borderColor: colors.accent },
  activeReverse: { backgroundColor: colors.accent },

  stopBtn: { borderColor: colors.danger },
  activeStop: { backgroundColor: colors.danger },

  activeText: { color: colors.white },
});
