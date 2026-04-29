import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchSensors, sendCommand, pingESP32 } from '../services/esp32Service';

// ── Hardware limits (must match firmware calibration) ────────────
export const MIN_FLOW_ML_MIN = 38.71;
export const MAX_FLOW_ML_MIN = 71.43;
export const MIN_DRAW_VOL    = 2.0;
export const MAX_DRAW_VOL    = 10.0;

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // ── Profiles ──────────────────────────────────────────────────
  const [doctorName, setDoctorName]   = useState('');
  const [patientInfo, setPatientInfo] = useState('');

  // ── Option 1 Mode ─────────────────────────────────────────────
  const [volume,   setVolume]   = useState('10');
  const [flowRate, setFlowRate] = useState('60.0');

  // ── Option 2 Mode ─────────────────────────────────────────────
  const [dose,          setDose]          = useState('');
  const [concentration, setConcentration] = useState('');
  const [targetTime,    setTargetTime]    = useState('');

  const [mode, setMode] = useState('Option1');

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime,     setTotalTime]     = useState(1);
  const [isInfusing,    setIsInfusing]    = useState(false);
  const [alarmActive,   setAlarmActive]   = useState(false);

  const [calculatedFlowRate, setCalculatedFlowRate] = useState(0);

  // ── ESP32 live sensor state ───────────────────────────────────
  const [esp32FlowRate,      setEsp32FlowRate]      = useState(0);
  const [targetSpeed,        setTargetSpeed]         = useState(0); // Fetched from firmware
  const [syringeEmpty,        setSyringeEmpty]        = useState(false);
  const [occlusionDetected,  setOcclusionDetected]  = useState(false);
  const [esp32Connected,     setEsp32Connected]      = useState(false); // true = reachable
  const [hardwareDirection,  setHardwareDirection]   = useState('S'); // 'F', 'R', 'S'
  const [manualPolling,      setManualPolling]       = useState(false); // Manual trigger for polling

  // ── Dose-and-Time draw state machine ──────────────────────────
  // 'idle' → 'drawing' → 'ready' → 'infusing'
  const [drawPhase,          setDrawPhase]          = useState('idle');
  const [drawingActive,      setDrawingActive]      = useState(false);
  const [lastDrawVol,        setLastDrawVol]        = useState(0);

  // Track consecutive poll failures for "connection lost" logic
  const failCountRef = useRef(0);
  const MAX_FAILURES = 3; // 3 consecutive fails → "disconnected"

  // ── Derived calculations ──────────────────────────────────────
  useEffect(() => {
    if (!isInfusing) {
      if (mode === 'Option1') {
        const v = parseFloat(volume);
        const f = parseFloat(flowRate);
        if (!isNaN(v) && !isNaN(f) && f > 0) {
          const seconds = Math.round((v / f) * 60);
          setTimeRemaining(seconds);
          setTotalTime(seconds);
          setCalculatedFlowRate(f);
        } else {
          setTimeRemaining(0);
          setTotalTime(1);
          setCalculatedFlowRate(0);
        }
      } else if (mode === 'Option2') {
        // Option2: dose (mL) + target time (sec) → flow (mL/min) = dose * 60 / time_sec
        const d = parseFloat(dose);
        const t = parseFloat(targetTime); // seconds
        if (!isNaN(d) && !isNaN(t) && d > 0 && t > 0) {
          const f = (d * 60) / t;
          const seconds = Math.round(t);
          setTimeRemaining(seconds);
          setTotalTime(seconds);
          setCalculatedFlowRate(f);
        } else {
          setTimeRemaining(0);
          setTotalTime(1);
          setCalculatedFlowRate(0);
        }
      }
    }
  }, [volume, flowRate, dose, concentration, targetTime, mode, isInfusing]);

  // ── Countdown tick ────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (isInfusing && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining <= 0 && isInfusing) {
      setIsInfusing(false);
      setAlarmActive(true);
      setDrawPhase('idle');
    }
    return () => clearInterval(interval);
  }, [isInfusing, timeRemaining]);

  // ── ESP32 sensor polling (every 1 s while infusing) ───────────
  const pollSensors = useCallback(async () => {
    const data = await fetchSensors();

    if (data === null) {
      // Network failure
      failCountRef.current += 1;
      if (failCountRef.current >= MAX_FAILURES) {
        setEsp32Connected(false);
        console.warn('[ESP32] Connection lost after', MAX_FAILURES, 'failures');
      }
      return;
    }

    // Successful response — reset failure counter
    failCountRef.current = 0;
    setEsp32Connected(true);

    // Update live sensor state
    setEsp32FlowRate(data.flowRate     ?? 0);
    setTargetSpeed(data.targetSpeed    ?? 0);
    setHardwareDirection(data.direction       ?? 'S');

    // ── Draw phase sync ─────────────────────────────────────────
    const fwDrawing = !!data.drawingActive;
    setDrawingActive(fwDrawing);
    if (data.lastDrawVol !== undefined) setLastDrawVol(data.lastDrawVol);

    // Auto-promote idle/drawing → ready when firmware finishes the draw
    if (drawPhase === 'drawing' && !fwDrawing) {
      setDrawPhase('ready');
      console.log('[Draw] Completed - ready to infuse');
    }

    // ── Syringe Empty alarm ──────────────────────────────────────
    if (data.syringeEmpty && !syringeEmpty) {
      setSyringeEmpty(true);
      setAlarmActive(true);
      setIsInfusing(false);
      console.warn('[ESP32] SYRINGE EMPTY DETECTED');
    } else {
      setSyringeEmpty(data.syringeEmpty ?? false);
    }

    // ── Occlusion alarm ──────────────────────────────────────────
    if (data.occlusionDetected && !occlusionDetected) {
      setOcclusionDetected(true);
      setAlarmActive(true);
      setIsInfusing(false);
      console.warn('[ESP32] OCCLUSION DETECTED');
    } else if (!data.occlusionDetected) {
      setOcclusionDetected(false);
    }
  }, [syringeEmpty, occlusionDetected, isInfusing, drawPhase]);

  useEffect(() => {
    let pollInterval = null;
    const intervalMs = (isInfusing || manualPolling || alarmActive || esp32Connected) ? 1000 : 5000;
    
    pollInterval = setInterval(() => {
      pollSensors();
    }, intervalMs);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isInfusing, manualPolling, alarmActive, esp32Connected, pollSensors]);

  // ── App actions ───────────────────────────────────────────────
  const startInfusion = async () => {
    const result = await sendCommand('start', { flowRate: calculatedFlowRate });
    if (result === null) {
      // ESP32 unreachable — warn but still start the countdown
      setEsp32Connected(false);
      console.warn('[ESP32] Could not reach ESP32 on start. Running timer only.');
    } else {
      setEsp32Connected(true);
    }
    setSyringeEmpty(false);
    setIsInfusing(true);
    setDrawPhase('infusing');
  };

  const stopInfusion = async () => {
    await sendCommand('stop');
    setIsInfusing(false);
    setAlarmActive(false);
    setDrawPhase('idle');
  };

  const resetApp = async () => {
    await sendCommand('stop');
    setIsInfusing(false);
    setAlarmActive(false);
    setTimeRemaining(0);
    setTotalTime(1);
    setSyringeEmpty(false);
    setOcclusionDetected(false);
    setEsp32FlowRate(0);
    setDrawPhase('idle');
  };

  // ── Draw actions (Dose & Time mode) ───────────────────────────
  const startDraw = async (volumeMl) => {
    let v = parseFloat(volumeMl);
    if (isNaN(v)) return { ok: false, reason: 'Invalid volume' };
    if (v < MIN_DRAW_VOL) v = MIN_DRAW_VOL;
    if (v > MAX_DRAW_VOL) v = MAX_DRAW_VOL;

    const result = await sendCommand('draw', { volume: v });
    if (result === null) {
      setEsp32Connected(false);
      return { ok: false, reason: 'ESP32 unreachable' };
    }
    setEsp32Connected(true);
    setDrawPhase('drawing');
    setDrawingActive(true);
    setLastDrawVol(v);
    return { ok: true, durationMs: result.durationMs };
  };

  const cancelDraw = async () => {
    await sendCommand('stop');
    setDrawingActive(false);
    setDrawPhase('idle');
  };

  const resetDrawPhase = () => setDrawPhase('idle');

  const dismissAlarm = async () => {
    if (syringeEmpty || occlusionDetected) {
      await sendCommand('reset_baseline');
    }
    setOcclusionDetected(false);
    setAlarmActive(false);
    if (!isInfusing) setDrawPhase('idle');
  };

  return (
    <AppContext.Provider value={{
      // Profiles
      doctorName, setDoctorName,
      patientInfo, setPatientInfo,
      // Inputs
      volume, setVolume,
      flowRate, setFlowRate,
      dose, setDose,
      concentration, setConcentration,
      targetTime, setTargetTime,
      mode, setMode,
      // Calculated
      calculatedFlowRate,
      timeRemaining, totalTime,
      // App state
      isInfusing, alarmActive,
      startInfusion, stopInfusion, resetApp, dismissAlarm,
      // ESP32 live data
      esp32FlowRate,
      syringeEmpty,
      occlusionDetected,
      esp32Connected,
      hardwareDirection,
      targetSpeed,
      manualPolling, setManualPolling,
      // Draw phase (Option2 dose & time)
      drawPhase, setDrawPhase,
      drawingActive,
      lastDrawVol,
      startDraw, cancelDraw, resetDrawPhase,
    }}>
      {children}
    </AppContext.Provider>
  );
};
