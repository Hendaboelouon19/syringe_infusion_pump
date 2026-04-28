import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { Asset } from 'expo-asset';
import { Audio } from 'expo-av';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ControlScreen from './src/screens/ControlScreen';
import AlarmsScreen from './src/screens/AlarmsScreen';
import TimerScreen from './src/screens/TimerScreen';
import ManualControlScreen from './src/screens/ManualControlScreen';
import GlobalAlarmHandler from './src/components/GlobalAlarmHandler';

const Stack = createNativeStackNavigator();

// Initialize Audio mode for alarms
Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  staysActiveInBackground: true,
  interruptionModeIOS: 1, 
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
  interruptionModeAndroid: 1, 
  playThroughEarpieceAndroid: false,
}).catch(err => console.warn('Audio mode error:', err));

// Pre-load assets for offline use
Asset.loadAsync([require('./assets/alarm.wav')])
  .then(() => console.log('[Assets] Alarm sound pre-loaded for offline use'))
  .catch(err => console.warn('[Assets] Pre-load failed:', err));

export default function App() {
  return (
    <AppProvider>
      <SafeAreaProvider>
        <GlobalAlarmHandler />
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
              headerShown: false,
              animation: 'fade', 
            }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Control" component={ControlScreen} />
            <Stack.Screen name="Alarms" component={AlarmsScreen} />
            <Stack.Screen name="Timer" component={TimerScreen} />
            <Stack.Screen name="Manual" component={ManualControlScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AppProvider>
  );
}
