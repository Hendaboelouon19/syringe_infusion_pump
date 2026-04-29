# Syringe Infusion Pump — Full Project Context

## Overview
A **React Native (Expo)** mobile app that controls a **DIY syringe infusion pump** over WiFi.
The ESP32 hosts an HTTP server (Access Point mode). The app connects to it and sends commands / reads sensor data every second.

---

## Tech Stack
- **Frontend:** React Native with Expo ~54, React 19
- **Navigation:** `@react-navigation/native-stack`
- **Audio:** `expo-av`
- **Hardware:** ESP32 + L298N motor driver + water flow sensor + limit switch (syringe empty)
- **Comms:** HTTP REST over WiFi AP (`192.168.4.1`)

---

## File Structure

```
syringe_infusion_pump/
├── App.js
├── index.js
├── app.json
├── package.json
├── assets/
│   └── alarm.wav
├── esp32_firmware/
│   └── esp32_firmware.ino
└── src/
    ├── components/
    │   ├── GlobalAlarmHandler.js
    │   └── HourglassTimer.js
    ├── context/
    │   └── AppContext.js
    ├── screens/
    │   ├── LoginScreen.js
    │   ├── HomeScreen.js
    │   ├── ControlScreen.js
    │   ├── TimerScreen.js
    │   ├── AlarmsScreen.js
    │   └── ManualControlScreen.js
    ├── services/
    │   └── esp32Service.js
    └── theme/
        └── colors.js
```

---

## Color Theme (`src/theme/colors.js`)

```js
background:   '#471A5D'  // American Purple
primary:      '#7760A3'  // Royal Purple
secondary:    '#908894'  // Philippine Gray
accent:       '#C6BDBE'  // Pale Silver
surface:      '#ffffff'
textPrimary:  '#471A5D'
textSecondary:'#908894'
danger:       '#ff5252'
warning:      '#ffc600'
success:      '#2C3206'  // Pullman Green
border:       '#C6BDBE'
```

---

## Navigation (`App.js`)

Stack navigator (no headers, fade animation):
```
Login → Home → Control | Timer | Alarms | Manual
```
`GlobalAlarmHandler` lives **outside** NavigationContainer so the alarm modal works on any screen.
Audio mode set at startup: plays in silent mode / background (iOS & Android).
`assets/alarm.wav` is pre-loaded at startup for offline use.

---

## Screens

### LoginScreen
- Fields: Clinician ID / Name, Patient Profile ID
- "Start Session" button disabled until both fields filled
- Navigates to Home on submit

### HomeScreen
- Dark purple background with decorative dots
- Animated horizontal FlatList carousel — 4 cards:
  1. **Infusion Config** → ControlScreen
  2. **Countdown** → TimerScreen
  3. **Alarms** → AlarmsScreen
  4. **Manual Override** → ManualControlScreen
- Slide-out sidebar modal with same navigation + "End Session" (back to Login)

### ControlScreen
- Toggle between two input modes:
  - **Volume & Flow** (Option1): Total Volume (ml) + Flow Rate (ml/min). Min/Max shortcut buttons for flow (38.71 / 71.43 ml/min).
  - **Dose & Time** (Option2): Dose (mL of water) + Target Time (mins). Concentration removed (water-only testing). Two-step workflow:
    1. **Draw** — sends `draw` command with mL value; ESP32 runs reverse at PWM 255 for the calibrated time, auto-stops itself.
    2. **Infuse** — once draw completes, "Start Infusion" button appears with calculated flow rate.
  - **Live validation** in Option2: shows whether dose ∈ [2, 10] mL and required flow ∈ [38.71, 71.43] mL/min, otherwise shows red error chip listing each issue.
- Glow ring shows calculated flow rate (ml/min)
- Motor status badge: shows ESP32 online/offline + calculated RPM + direction
- **Manual Override panel** (Prime / Stop / Retract) with PWM speed stepper (0–255, step 15) — sends `manual` command to ESP32 independently from infusion timer
- "Send & Start" button (Option1) / two-step Draw→Infuse (Option2) → sends `start` command + starts app-side countdown → navigates to TimerScreen

### TimerScreen
- Hourglass animation (sand drains top→bottom as time passes)
- Large countdown display (MM:SS or HH:MM:SS)
- ESP32 connection badge (LIVE / OFFLINE)
- Syringe Empty warning banner (flashes when triggered)
- Live flow panel when connected: measured ml/min vs target ml/min
- Play/Pause button to toggle infusion
- When alarm active: "Dismiss Alarm" button shown instead

### AlarmsScreen
- ESP32 connection badge in header
- Live flow sensor card (shown when infusing + connected)
- 3 alarm cards (pulsing animation when active):
  1. **Occlusion Detected** — flow dropped to near-zero while pumping
  2. **Syringe Empty** — hardware limit switch triggered
  3. **ESP32 Connection Lost** — WiFi unreachable during infusion
- "Reset & Resume" button for occlusion and syringe empty alarms

### ManualControlScreen
- Live data panel: measured flow (ml/min), motor speed (PWM), connection status
- Warning badge if automated timer is still running
- PWM speed stepper (0–255, step 15)
- Three full-width direction buttons: FORWARD (Infuse) / STOP / REVERSE (Retract)
- Uses `useFocusEffect` to enable polling only while screen is visible

---

## Global State (`src/context/AppContext.js`)

### Input state
| Variable | Default | Description |
|---|---|---|
| `doctorName` | `''` | Clinician name |
| `patientInfo` | `''` | Patient ID |
| `volume` | `'10'` | Total volume ml (Option1) |
| `flowRate` | `'60.0'` | Flow rate ml/min (Option1) |
| `dose` | `''` | Dose mL of water (Option2) |
| `concentration` | `''` | (kept for backward compat, unused) |
| `targetTime` | `''` | Target time mins (Option2) |
| `mode` | `'Option1'` | Input mode |

### Hardware constants (exported from AppContext)
| Constant | Value | Source |
|---|---|---|
| `MIN_FLOW_ML_MIN` | 38.71 | Forward calibration min |
| `MAX_FLOW_ML_MIN` | 71.43 | Forward calibration max |
| `MIN_DRAW_VOL` | 2.0 | Reverse calibration min |
| `MAX_DRAW_VOL` | 10.0 | Syringe capacity |

### Calculated / timer state
| Variable | Description |
|---|---|
| `calculatedFlowRate` | Auto-derived from inputs (ml/min) |
| `timeRemaining` | Countdown seconds (live tick) |
| `totalTime` | Full duration in seconds |
| `isInfusing` | Whether countdown is active |
| `alarmActive` | Whether global alarm modal is shown |

### ESP32 live state
| Variable | Description |
|---|---|
| `esp32FlowRate` | Measured flow from sensor (ml/min) |
| `targetSpeed` | PWM value reported by firmware |
| `syringeEmpty` | Hardware limit switch state |
| `occlusionDetected` | Occlusion alarm from flow sensor (currently disabled in firmware) |
| `esp32Connected` | True if last poll succeeded |
| `hardwareDirection` | 'F' / 'R' / 'S' from firmware |
| `manualPolling` | Enables polling on manual screens |
| `drawingActive` | True while firmware is running the reverse draw |
| `lastDrawVol` | Last volume drawn (mL) reported by firmware |

### Draw phase state machine (Option2)
| Phase | Meaning | Transition |
|---|---|---|
| `'idle'` | User entering values | → `'drawing'` when `startDraw()` succeeds |
| `'drawing'` | Reverse motor running | → `'ready'` automatically when sensor poll sees `drawingActive=false` |
| `'ready'` | Draw complete, syringe loaded | → `'infusing'` when `startInfusion()` is called |
| `'infusing'` | Forward infusion running | → `'idle'` on `stopInfusion()` / `resetApp()` |

### Polling logic
- Polls `/sensors` every **1 second** when `isInfusing || manualPolling || alarmActive || esp32Connected`
- Otherwise polls every **5 seconds**
- 3 consecutive failures → `esp32Connected = false`

### Auto-calculation (runs when not infusing)
- **Option1:** `timeRemaining = round((volume / flowRate) * 60)` seconds
- **Option2:** `flowRate = dose / targetTime`, `timeRemaining = round(targetTime * 60)` seconds

### Actions
| Function | Behaviour |
|---|---|
| `startInfusion()` | POST `/control` `{command:"start", flowRate}`, sets `isInfusing=true`, `drawPhase='infusing'` |
| `stopInfusion()` | POST `/control` `{command:"stop"}`, clears infusing + alarm, `drawPhase='idle'` |
| `startDraw(mL)` | POST `/control` `{command:"draw", volume}`, sets `drawPhase='drawing'`. Returns `{ok, durationMs}` or `{ok:false, reason}` |
| `cancelDraw()` | POST `/control` `{command:"stop"}`, `drawPhase='idle'` |
| `resetDrawPhase()` | Manually returns `drawPhase` to `'idle'` |
| `dismissAlarm()` | POST `/control` `{command:"reset_baseline"}` if syringeEmpty or occlusion, clears alarm flags |
| `resetApp()` | Stops motor, clears all state including `drawPhase` |

---

## GlobalAlarmHandler (`src/components/GlobalAlarmHandler.js`)

- Renders **outside** the navigator so it is always on top
- Watches `alarmActive` from context
- When `alarmActive=true`: loads and loops `assets/alarm.wav`
- When `alarmActive=false`: stops and unloads audio
- Shows a full-screen red modal with:
  - Title: **CRITICAL ALARM**
  - Subtitle: `OCCLUSION DETECTED` | `SYRINGE EMPTY / STOP TRIGGERED` | `INFUSION COMPLETE`
  - Detail message explaining the cause
  - **RESET & RESUME SYSTEM** button → calls `dismissAlarm()`

---

## HourglassTimer (`src/components/HourglassTimer.js`)

Props: `progress` (0→1), `isRunning` (bool)
- Top half: sand height = `(1 - progress) * 100%` (drains as time passes)
- Bottom half: sand height = `progress * 100%` (fills as time passes)
- Neck shows a falling-sand strip when `isRunning && 0 < progress < 1`
- Sand color: `#FDEE87` (butter yellow)

---

## ESP32 Service (`src/services/esp32Service.js`)

Base URL: `http://192.168.4.1` (ESP32 AP mode default IP)
Timeout: 5 seconds (AbortController)
Returns `null` on network error (callers check for null).

| Export | Method | Endpoint | Payload |
|---|---|---|---|
| `sendCommand(cmd, data)` | POST | `/control` | `{command, ...data}` |
| `fetchSensors()` | GET | `/sensors` | — |
| `pingESP32()` | GET | `/ping` | — |

---

## ESP32 Firmware (`esp32_firmware/esp32_firmware.ino`)

### Hardware pins
| Pin | GPIO | Role |
|---|---|---|
| IN3 | 25 | L298N direction |
| IN4 | 32 | L298N direction |
| EN_PIN | 33 | L298N PWM enable |
| FLOW_PIN | 27 | Flow sensor interrupt |
| STOP_BUTTON_PIN | 26 | Syringe limit switch (INPUT_PULLUP) |

### WiFi
- Mode: **Access Point**
- SSID: `SyringePump`
- Password: `hend12345`
- IP: `192.168.4.1`

### Forward motor calibration (10 mL syringe)
Lookup table (linear interpolation between points). Formula: `flow_mL_per_min = 600 / time_seconds_to_empty_10mL`.

| PWM (0–255) | Time (s) | Flow (ml/min) |
|---|---|---|
| 120 | 15.5 | 38.71 |
| 135 | 13.7 | 43.80 |
| 150 | 11.7 | 51.28 |
| 165 | 11.0 | 54.55 |
| 180 | 10.6 | 56.60 |
| 195 | 10.2 | 58.82 |
| 210 | 10.0 | 60.00 |
| 225 | 9.8  | 61.22 |
| 240 | 9.5  | 63.16 |
| 255 | 8.4  | 71.43 |

### Reverse draw calibration (PWM 255 reverse)
Time required to draw a given volume into the syringe at full reverse speed.

| Volume (mL) | Time (s) |
|---|---|
| 2  | 2.8  |
| 4  | 5.3  |
| 6  | 7.2  |
| 8  | 9.8  |
| 10 | 10.9 |

### Flow sensor
- Interrupt on RISING edge of FLOW_PIN
- Calibration factor: `1.63` pulses per ml/min (per second)
- Smoothed with EMA: `flowRate = flowRate * 0.85 + instantFlow * 0.15`
- **NOT used for accurate flow measurement** (flow rate is too high for the sensor's range)
- **Used only for occlusion detection**

### Occlusion detection (self-baseline)
Active whenever: `motorRunning && direction == 'F' && !occlusionDetected` (auto **and** manual forward).

Doesn't use absolute mL/min (the YF-S201 sensor isn't calibrated at this low flow range). Instead it builds a per-session baseline from raw pulse counts.

Three-phase state machine (1 sample/sec):

| Phase | Duration | Behaviour |
|---|---|---|
| **1. Stabilize** | first 3 s | ignore everything (tube fills, motor ramps) |
| **2. Baseline** | next 3 s | accumulate pulses; baseline = sum / 3 |
| **3. Monitor** | rest of run | if `pulses < baseline*0.50` **OR** `pulses ≤ 5` for **2 consecutive seconds** → alarm |

Constants (firmware):
- `OCC_STABILIZE_SEC = 3`
- `OCC_BASELINE_SEC = 3`
- `OCC_MIN_VIABLE_PULSES = 20` (if baseline below this, monitoring is **not armed** — sensor signal too weak to be reliable)
- `OCC_DROP_RATIO = 0.50`
- `OCC_HARD_MIN_PULSES = 5` (absolute floor — fires regardless of baseline if blocked)
- `OCC_CONFIRM_SEC = 2`

State resets on `motorOff()` and `resetSystemState()` (called by `stop`, `start`, and `reset_baseline` commands).

### HTTP endpoints

**POST /control** — body is JSON string
| Command field | Action |
|---|---|
| `"start"` + `flowRate` | `resetSystemState()`, run motor at computed PWM |
| `"stop"` | `motorOff()` |
| `"manual"` + `direction` + `speed` | `applyMotor(dir, speed)`, sets `isManualMode=true` |
| `"draw"` + `volume` | Reverse at PWM 255 for the calibrated time, auto-stops via `millis()`. Clamps `volume` to `[2, 10]` mL. Returns `{success, action:"draw", volume, durationMs}` |
| `"reset"` / `"reset_baseline"` | `resetSystemState()` — clears occlusion flag |

**GET /sensors** — returns JSON:
```json
{
  "flowRate": 1.23,
  "targetFlowRate": 36.00,
  "targetSpeed": 210,
  "unit": "mL/min",
  "motorRunning": true,
  "syringeEmpty": false,
  "occlusionDetected": false,
  "drawingActive": false,
  "lastDrawVol": 5.00,
  "direction": "F"
}
```

**GET /ping** — returns `{"status":"ok"}`

### Safety logic (loop)
- If `STOP_BUTTON_PIN == LOW` and `direction == 'F'` → immediately calls `motorOff()`, sets `syringeEmpty = true`
- If pin goes HIGH for > 500 ms → `syringeEmpty = false` (auto-reset when syringe replaced)
- `applyMotor()` also blocks forward movement if stop button is pressed (hardware safety layer)

---

## Alarm Flow (end-to-end)

```
ESP32 firmware detects event (occlusion / syringe empty)
  → sets flag in firmware state
  → app polls /sensors every 1s
  → AppContext reads flag → sets alarmActive=true, isInfusing=false
  → GlobalAlarmHandler detects alarmActive → plays alarm.wav + shows modal
  → User taps "RESET & RESUME"
  → dismissAlarm() → POST /control reset_baseline → clears app flags
  → ESP32 resetSystemState() clears firmware flags
  → alarm modal closes, audio stops
```

---

## Known Design Decisions / Notes
- Flow sensor cannot accurately measure ml/min at these motor speeds — it is **repurposed as an occlusion detector only** (pulse drop = blockage)
- The app-side countdown timer runs independently of the ESP32 — if WiFi drops, the timer still counts down
- Manual override commands bypass the occlusion detection (only auto-mode triggers it)
- `GlobalAlarmHandler` is mounted outside `NavigationContainer` so the alarm persists regardless of which screen the user is on
- `startInfusion` in AppContext sends the ESP32 command AND starts the app countdown — if ESP32 is unreachable, the countdown still runs (with `esp32Connected=false`)
