import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Profiles
  const [doctorName, setDoctorName] = useState('');
  const [patientInfo, setPatientInfo] = useState('');

  // Option 1 Mode
  const [volume, setVolume] = useState('');
  const [flowRate, setFlowRate] = useState('');
  
  // Option 2 Mode
  const [dose, setDose] = useState('');
  const [concentration, setConcentration] = useState('');
  const [targetTime, setTargetTime] = useState('');
  
  const [mode, setMode] = useState('Option1'); 

  const [timeRemaining, setTimeRemaining] = useState(0); // seconds
  const [totalTime, setTotalTime] = useState(1);
  const [isInfusing, setIsInfusing] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false); // To trigger sound flag globally if needed

  // Derived calculations so UI can access them
  const [calculatedFlowRate, setCalculatedFlowRate] = useState(0);

  // Auto calc
  useEffect(() => {
    if (!isInfusing) {
      if (mode === 'Option1') {
        const v = parseFloat(volume);
        const f = parseFloat(flowRate);
        if (!isNaN(v) && !isNaN(f) && f > 0) {
          const seconds = Math.floor((v / f) * 60);
          setTimeRemaining(seconds);
          setTotalTime(seconds);
          setCalculatedFlowRate(f);
        } else {
          setTimeRemaining(0);
          setTotalTime(1);
          setCalculatedFlowRate(0);
        }
      } else if (mode === 'Option2') {
        const d = parseFloat(dose);
        const c = parseFloat(concentration);
        const t = parseFloat(targetTime); 
        if (!isNaN(d) && !isNaN(c) && !isNaN(t) && c > 0 && t > 0) {
          const v = d / c;       
          const f = v / t;       
          const seconds = Math.floor(t * 60);
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

  // Tick
  useEffect(() => {
    let interval;
    if (isInfusing && timeRemaining > 0) {
      interval = setInterval(() => {
         setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining <= 0 && isInfusing) {
      // Infusion finished organically
      setIsInfusing(false);
      setAlarmActive(true); // Trigger audio alarm
    }
    return () => clearInterval(interval);
  }, [isInfusing, timeRemaining]);

  const startInfusion = () => setIsInfusing(true);
  const stopInfusion = () => { setIsInfusing(false); setAlarmActive(false); };
  const resetApp = () => { setIsInfusing(false); setAlarmActive(false); setTimeRemaining(0); setTotalTime(1); };
  const dismissAlarm = () => setAlarmActive(false);

  return (
    <AppContext.Provider value={{
      doctorName, setDoctorName,
      patientInfo, setPatientInfo,
      volume, setVolume,
      flowRate, setFlowRate,
      dose, setDose,
      concentration, setConcentration,
      targetTime, setTargetTime,
      mode, setMode,
      calculatedFlowRate,
      timeRemaining, totalTime,
      isInfusing, alarmActive,
      startInfusion, stopInfusion, resetApp, dismissAlarm
    }}>
      {children}
    </AppContext.Provider>
  );
};
