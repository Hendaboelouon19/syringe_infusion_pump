import React, { useContext } from 'react';
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
    calculatedFlowRate, timeRemaining, startInfusion, isInfusing 
  } = useContext(AppContext);

  const motorSpeed = calculatedFlowRate ? (calculatedFlowRate * 7.5).toFixed(0) : 0;

  const handleStart = async () => {
    if (timeRemaining > 0) {
      await sendCommand('start', { flowRate: calculatedFlowRate });
      startInfusion();
      navigation.navigate('Timer');
    }
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return '0h 0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

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
            disabled={isInfusing}
          >
            <Text style={[styles.toggleText, mode === 'Option1' && styles.toggleTextActive]}>Direct Input</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, mode === 'Option2' && styles.toggleActive]} 
            onPress={() => setMode('Option2')}
            disabled={isInfusing}
          >
            <Text style={[styles.toggleText, mode === 'Option2' && styles.toggleTextActive]}>Dose Calc</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {mode === 'Option1' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Volume (ml)</Text>
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
            <Ionicons name="settings" size={24} color={motorSpeed > 0 ? colors.accent : colors.textSecondary} />
            <Text style={styles.motorText}>Calculated Speed: {motorSpeed || 0} RPM</Text>
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
  
  // Notice text color is now properly dark to be seen on the light background
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 15, fontSize: 18, color: colors.textPrimary, backgroundColor: '#f9f9f9' },
  
  dashboard: { alignItems: 'center', marginVertical: 10 },
  glowRing: { width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, shadowColor: colors.accent, shadowOffset: {width:0,height:0}, shadowRadius: 20, shadowOpacity: 0.8, elevation: 10, marginBottom: 20 },
  ringValue: { fontSize: 32, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' },
  ringLabel: { fontSize: 16, color: colors.primary, marginTop: 5, fontWeight: 'bold' },
  ringLabelTime: { fontSize: 14, color: colors.secondary, marginTop: 5 },

  motorStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  motorText: { marginLeft: 10, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  
  startBtn: { flexDirection: 'row', backgroundColor: colors.primary, width: '100%', padding: 20, borderRadius: 15, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: colors.accent, shadowOffset: {width:0,height:0}, shadowRadius: 10, shadowOpacity: 1, marginTop: 10 },
  startBtnActive: { backgroundColor: '#888' },
  startText: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
});
