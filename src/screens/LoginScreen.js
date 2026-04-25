import React, { useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

export default function LoginScreen({ navigation }) {
  const { doctorName, setDoctorName, patientInfo, setPatientInfo } = useContext(AppContext);

  const handleContinue = () => {
    Keyboard.dismiss();
    navigation.navigate('Home');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={styles.iconWrapper}>
           <FontAwesome5 name="user-md" size={60} color={colors.white} />
        </View>
      </View>
      
      <View style={styles.formCard}>
        <Text style={styles.title}>Session Authentication</Text>
        <Text style={styles.subtitle}>Enter clinician and patient details to initialize the workspace.</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Clinician ID / Name</Text>
          <View style={styles.inputRow}>
            <Ionicons name="medical" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="e.g. Dr. Roberts"
              placeholderTextColor={colors.textSecondary}
              value={doctorName}
              onChangeText={setDoctorName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Patient Profile ID</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="e.g. PT-4091"
              placeholderTextColor={colors.textSecondary}
              value={patientInfo}
              onChangeText={setPatientInfo}
            />
          </View>
        </View>

        <TouchableOpacity 
           style={[styles.btn, (!doctorName || !patientInfo) && styles.btnDisabled]} 
           onPress={handleContinue}
           disabled={!doctorName || !patientInfo}
        >
          <Text style={styles.btnText}>Start Session</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: -40, // break into card
    zIndex: 10,
  },
  iconWrapper: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: colors.background,
    shadowColor: '#000', shadowOffset:{width:0,height:10}, shadowRadius: 15, shadowOpacity: 0.3, elevation: 10
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: 25,
    paddingTop: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center', marginBottom: 5
  },
  subtitle: {
    fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 30, paddingHorizontal: 10
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14, fontWeight: 'bold', color: colors.primary, marginBottom: 8, marginLeft: 5
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.textPrimary,
  },
  btn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: colors.primary, shadowOffset:{width:0,height:5}, shadowRadius: 10, shadowOpacity: 0.4, elevation: 5
  },
  btnDisabled: {
    backgroundColor: colors.secondary, shadowOpacity: 0, elevation: 0
  },
  btnText: {
    color: colors.white, fontSize: 18, fontWeight: 'bold', marginRight: 10
  }
});
