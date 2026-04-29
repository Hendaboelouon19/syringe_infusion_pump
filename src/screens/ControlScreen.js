import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { sendCommand } from '../services/esp32Service';
import {
  AppContext,
  MIN_FLOW_ML_MIN,
  MAX_FLOW_ML_MIN,
  MIN_DRAW_VOL,
  MAX_DRAW_VOL,
} from '../context/AppContext';

export default function ControlScreen({ navigation }) {
  const { 
    mode, setMode,
    volume, setVolume, flowRate, setFlowRate,
    dose, setDose, targetTime, setTargetTime,
    calculatedFlowRate, timeRemaining, startInfusion, isInfusing,
    esp32Connected, targetSpeed, setManualPolling, hardwareDirection,
    drawPhase, drawingActive, lastDrawVol,
    startDraw, cancelDraw, resetDrawPhase,
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
  const setMaxFlow = () => {
    const maxFlow = calFlow[calFlow.length - 1];
    setFlowRate(maxFlow.toString());
  };

  const setMinFlow = () => {
    const minFlow = calFlow[0];
    setFlowRate(minFlow.toString());
  };

  const calFlow = [38.71, 43.80, 51.28, 54.55, 56.60, 58.82, 60.00, 61.22, 63.16, 71.43];
  const calSpeed = [120, 135, 150, 165, 180, 195, 210, 225, 240, 255];

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
    return 210;
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
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Flow Rate (ml/min)</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={setMinFlow}>
                      <Text style={styles.minBtnText}>SET MIN (38.71)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={setMaxFlow}>
                      <Text style={styles.maxBtnText}>SET MAX (71.43)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={flowRate} 
                  onChangeText={setFlowRate} 
                  placeholder="e.g. 60.0" 
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Dose (mL)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={dose} 
                  onChangeText={setDose} 
                  placeholder={`${MIN_DRAW_VOL} - ${MAX_DRAW_VOL}`}
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing && drawPhase === 'idle'}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Target Time (sec)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={targetTime} 
                  onChangeText={setTargetTime} 
                  placeholder="e.g. 8" 
                  placeholderTextColor={colors.textSecondary}
                  editable={!isInfusing && drawPhase === 'idle'}
                />
              </View>

              {/* Live validation */}
              {(() => {
                const d = parseFloat(dose);
                const t = parseFloat(targetTime);
                if (isNaN(d) || isNaN(t) || d <= 0 || t <= 0) return null;

                const f = (d * 60) / t; // mL/min from mL and seconds
                const issues = [];
                if (d < MIN_DRAW_VOL) issues.push(`Dose below min draw (${MIN_DRAW_VOL} mL)`);
                if (d > MAX_DRAW_VOL) issues.push(`Dose above syringe capacity (${MAX_DRAW_VOL} mL)`);
                if (f < MIN_FLOW_ML_MIN) issues.push(`Required flow ${f.toFixed(2)} mL/min is too slow (min ${MIN_FLOW_ML_MIN})`);
                if (f > MAX_FLOW_ML_MIN) issues.push(`Required flow ${f.toFixed(2)} mL/min is too fast (max ${MAX_FLOW_ML_MIN})`);

                return (
                  <View style={[styles.validationBox, issues.length > 0 ? styles.validationBad : styles.validationGood]}>
                    <Ionicons
                      name={issues.length > 0 ? 'alert-circle' : 'checkmark-circle'}
                      size={18}
                      color={colors.white}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      {issues.length > 0 ? (
                        issues.map((msg, i) => (
                          <Text key={i} style={styles.validationText}>{msg}</Text>
                        ))
                      ) : (
                        <Text style={styles.validationText}>
                          Required flow: {f.toFixed(2)} mL/min — within range
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })()}
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

        {mode === 'Option1' ? (
          <TouchableOpacity 
            style={[styles.startBtn, isInfusing && styles.startBtnActive]} 
            onPress={handleStart}
            disabled={isInfusing || timeRemaining <= 0}
          >
            <Ionicons name={isInfusing ? "pulse" : "play"} size={20} color={colors.white} style={{marginRight: 10}}/>
            <Text style={styles.startText}>{isInfusing ? "Infusion Running..." : "Send & Start"}</Text>
          </TouchableOpacity>
        ) : (
          <DoseTimeStepper
            dose={dose}
            targetTime={targetTime}
            calculatedFlowRate={calculatedFlowRate}
            timeRemaining={timeRemaining}
            isInfusing={isInfusing}
            drawPhase={drawPhase}
            drawingActive={drawingActive}
            lastDrawVol={lastDrawVol}
            startDraw={startDraw}
            cancelDraw={cancelDraw}
            resetDrawPhase={resetDrawPhase}
            handleStart={handleStart}
          />
        )}
        
        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Dose & Time stepper component ───────────────────────────────
function DoseTimeStepper({
  dose, targetTime, calculatedFlowRate, timeRemaining, isInfusing,
  drawPhase, drawingActive, lastDrawVol,
  startDraw, cancelDraw, resetDrawPhase, handleStart,
}) {
  const d = parseFloat(dose);
  const t = parseFloat(targetTime); // seconds
  const f = (!isNaN(d) && !isNaN(t) && d > 0 && t > 0) ? (d * 60) / t : 0;

  const validInputs =
    !isNaN(d) && !isNaN(t) &&
    d >= MIN_DRAW_VOL && d <= MAX_DRAW_VOL &&
    f >= MIN_FLOW_ML_MIN && f <= MAX_FLOW_ML_MIN;

  const onDrawPress = () => {
    Alert.alert(
      'Confirm Draw',
      `Make sure the syringe tip is submerged in water. ${d.toFixed(2)} mL will be drawn at PWM 255 reverse.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Draw', onPress: async () => {
            const res = await startDraw(d);
            if (!res.ok) Alert.alert('Draw Failed', res.reason);
          }
        },
      ],
    );
  };

  // Phase: idle → show Draw button
  if (drawPhase === 'idle') {
    return (
      <TouchableOpacity
        style={[styles.startBtn, !validInputs && styles.startBtnDisabled]}
        onPress={onDrawPress}
        disabled={!validInputs}
      >
        <Ionicons name="arrow-down-circle" size={20} color={colors.white} style={{ marginRight: 10 }} />
        <Text style={styles.startText}>Step 1: Draw {validInputs ? d.toFixed(2) : '--'} mL</Text>
      </TouchableOpacity>
    );
  }

  // Phase: drawing → show progress + cancel
  if (drawPhase === 'drawing' || drawingActive) {
    return (
      <View style={styles.phaseCard}>
        <Ionicons name="sync" size={28} color={colors.accent} style={{ marginBottom: 8 }} />
        <Text style={styles.phaseTitle}>Drawing {d.toFixed(2)} mL…</Text>
        <Text style={styles.phaseSub}>Reverse motor running at PWM 255</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelDraw}>
          <Ionicons name="close-circle" size={18} color={colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.cancelText}>Cancel Draw</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Phase: ready → show start infusion button
  if (drawPhase === 'ready') {
    return (
      <View style={{ width: '100%' }}>
        <View style={styles.phaseCard}>
          <Ionicons name="checkmark-circle" size={28} color={colors.success ?? '#27ae60'} style={{ marginBottom: 8 }} />
          <Text style={styles.phaseTitle}>Draw Complete</Text>
          <Text style={styles.phaseSub}>{lastDrawVol.toFixed(2)} mL loaded</Text>
        </View>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart} disabled={timeRemaining <= 0}>
          <Ionicons name="play" size={20} color={colors.white} style={{ marginRight: 10 }} />
          <Text style={styles.startText}>Step 2: Start Infusion ({f.toFixed(2)} mL/min)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelBtn, { alignSelf: 'center', marginTop: 10 }]} onPress={resetDrawPhase}>
          <Ionicons name="refresh" size={16} color={colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.cancelText}>Reset</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Phase: infusing — handled by TimerScreen, but show a status here too
  return (
    <TouchableOpacity style={[styles.startBtn, styles.startBtnActive]} disabled>
      <Ionicons name="pulse" size={20} color={colors.white} style={{ marginRight: 10 }} />
      <Text style={styles.startText}>Infusion Running…</Text>
    </TouchableOpacity>
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 14, color: colors.primary, fontWeight: 'bold' },
  maxBtnText: { fontSize: 12, color: colors.accent, fontWeight: 'bold', textDecorationLine: 'underline' },
  minBtnText: { fontSize: 12, color: colors.secondary, fontWeight: 'bold', textDecorationLine: 'underline' },
  
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

  // Dose & Time validation + phase UI
  validationBox: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginTop: 5 },
  validationGood: { backgroundColor: colors.success ?? '#27ae60' },
  validationBad: { backgroundColor: colors.danger },
  validationText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  phaseCard: { width: '100%', backgroundColor: colors.surface, padding: 20, borderRadius: 15, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: colors.border },
  phaseTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  phaseSub: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.danger, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  cancelText: { color: colors.white, fontWeight: 'bold', fontSize: 14 },
});
