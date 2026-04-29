#include <WiFi.h>
#include <WebServer.h>

// ===== Access Point =====
const char* AP_SSID     = "SyringePump";
const char* AP_PASSWORD = "hend12345";

// ===== Pins =====
#define IN3       25
#define IN4       32
#define EN_PIN    33
#define FLOW_PIN  27
#define STOP_BUTTON_PIN 26

// ===== PWM CONFIG =====
#define PWM_FREQ 1000
#define PWM_RES  8

// ===== Flow Sensor Calibration =====
#define CALIBRATION_FACTOR 1.63f

// ===== NEW Motor Calibration =====
// 10 mL syringe timing calibration  (flow = 600 / time_seconds)
const int NUM_CAL_POINTS = 10;

float calFlow[NUM_CAL_POINTS] = {
  38.71f,   // 120 PWM -> 15.5 s
  43.80f,   // 135 PWM -> 13.7 s
  51.28f,   // 150 PWM -> 11.7 s
  54.55f,   // 165 PWM -> 11.0 s
  56.60f,   // 180 PWM -> 10.6 s
  58.82f,   // 195 PWM -> 10.2 s
  60.00f,   // 210 PWM -> 10.0 s
  61.22f,   // 225 PWM ->  9.8 s
  63.16f,   // 240 PWM ->  9.5 s
  71.43f    // 255 PWM ->  8.4 s
};

int calSpeed[NUM_CAL_POINTS] = {
  120,
  135,
  150,
  165,
  180,
  195,
  210,
  225,
  240,
  255
};

// ===== REVERSE Draw Calibration (PWM 255 reverse) =====
// Time required to draw a given volume into the syringe
const int NUM_DRAW_POINTS = 5;
float calDrawVol[NUM_DRAW_POINTS]   = { 2.0f, 4.0f, 6.0f, 8.0f, 10.0f };
float calDrawTime[NUM_DRAW_POINTS]  = { 2.8f, 5.3f, 7.2f, 9.8f, 10.9f };

#define DRAW_PWM 255   // fixed reverse speed for drawing
#define MAX_DRAW_VOL 10.0f
#define MIN_DRAW_VOL 2.0f

// Draw state
bool drawingActive = false;
unsigned long drawEndMillis = 0;
float lastDrawVol = 0.0f;

// ===== Variables =====
volatile int pulseCount = 0;

float flowRate = 0.0f;
float targetFlowRate = 36.0f;
int targetSpeed = 210;

bool motorRunning = false;
bool isManualMode = false;
bool syringeEmpty = false;
bool occlusionDetected = false;
char currentDirection = 'S';

// ===== Occlusion detection (self-baseline + absolute floor) =====
// Strategy: ignore absolute mL/min, watch for sudden drop in raw pulses
// after building a baseline from the actual operating speed.
// Also fires if pulses drop near zero regardless of baseline.
#define OCC_STABILIZE_SEC     3       // skip the first N seconds after start
#define OCC_BASELINE_SEC      3       // average pulses over this window for baseline
#define OCC_MIN_VIABLE_PULSES 20      // baseline must exceed this to arm detection
#define OCC_DROP_RATIO        0.50f   // alarm if pulses < baseline * this (50% drop)
#define OCC_HARD_MIN_PULSES   5       // absolute floor — pulses <= this = blocked regardless of baseline
#define OCC_CONFIRM_SEC       2       // consecutive low seconds before alarm fires

int   occElapsedSec      = 0;     // seconds since forward motor started
long  occBaselineSum     = 0;     // sum during baseline window
float occBaseline        = 0.0f;  // computed pulses/sec baseline
bool  occMonitoring      = false; // true once baseline established
int   occLowCount        = 0;     // consecutive low-pulse seconds

WebServer server(80);

unsigned long lastMeasurement = 0;
unsigned long lastButtonPress = 0;

// =====================================================
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

// =====================================================
// FLOW -> SPEED
// =====================================================
int flowToSpeed(float targetFlow) {
  if (targetFlow <= calFlow[0]) return calSpeed[0];
  if (targetFlow >= calFlow[NUM_CAL_POINTS - 1]) return calSpeed[NUM_CAL_POINTS - 1];

  for (int i = 0; i < NUM_CAL_POINTS - 1; i++) {
    if (targetFlow >= calFlow[i] && targetFlow <= calFlow[i + 1]) {
      float r = (targetFlow - calFlow[i]) / (calFlow[i + 1] - calFlow[i]);
      float speed = calSpeed[i] + r * (calSpeed[i + 1] - calSpeed[i]);
      return constrain((int)(speed + 0.5f), 0, 255);
    }
  }

  return 210;
}

// =====================================================
// VOLUME -> DRAW TIME (ms)
// =====================================================
unsigned long volumeToDrawMs(float volumeMl) {
  if (volumeMl <= calDrawVol[0])
    return (unsigned long)(calDrawTime[0] * 1000.0f);
  if (volumeMl >= calDrawVol[NUM_DRAW_POINTS - 1])
    return (unsigned long)(calDrawTime[NUM_DRAW_POINTS - 1] * 1000.0f);

  for (int i = 0; i < NUM_DRAW_POINTS - 1; i++) {
    if (volumeMl >= calDrawVol[i] && volumeMl <= calDrawVol[i + 1]) {
      float r = (volumeMl - calDrawVol[i]) / (calDrawVol[i + 1] - calDrawVol[i]);
      float seconds = calDrawTime[i] + r * (calDrawTime[i + 1] - calDrawTime[i]);
      return (unsigned long)(seconds * 1000.0f);
    }
  }
  return 5000UL;
}

// =====================================================
// MOTOR CONTROL
// =====================================================
void applyMotor(char direction, int speedValue) {
  speedValue = constrain(speedValue, 0, 255);

  // Safety: block forward if syringe switch is pressed
  if (direction == 'F' && digitalRead(STOP_BUTTON_PIN) == LOW) {
    Serial.println("[SAFETY] Syringe Empty - Forward Blocked");
    direction = 'S';
    speedValue = 0;
  }

  if (speedValue == 0 || direction == 'S') {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, LOW);
    ledcWrite(EN_PIN, 0);

    motorRunning = false;
    currentDirection = 'S';

    Serial.println("[Motor] STOPPED");
    return;
  }

  if (direction == 'F') {
    digitalWrite(IN3, HIGH);
    digitalWrite(IN4, LOW);
    Serial.print("[Motor] FORWARD");
  }
  else if (direction == 'R') {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, HIGH);
    Serial.print("[Motor] REVERSE");
  }

  currentDirection = direction;
  ledcWrite(EN_PIN, speedValue);
  motorRunning = true;

  Serial.print(" | PWM: ");
  Serial.println(speedValue);
}

void motorOnWithFlow(float requestedFlow) {
  isManualMode = false;

  targetFlowRate = requestedFlow;
  targetSpeed = flowToSpeed(targetFlowRate);

  Serial.print("[Target Flow] ");
  Serial.print(targetFlowRate);
  Serial.print(" mL/min -> PWM ");
  Serial.println(targetSpeed);

  applyMotor('F', targetSpeed);
}

void motorOff() {
  applyMotor('S', 0);
  occElapsedSec   = 0;
  occBaselineSum  = 0;
  occBaseline     = 0.0f;
  occMonitoring   = false;
  occLowCount     = 0;
  drawingActive   = false;
}

// =====================================================
void resetSystemState() {
  syringeEmpty = (digitalRead(STOP_BUTTON_PIN) == LOW);
  occlusionDetected = false;
  occElapsedSec   = 0;
  occBaselineSum  = 0;
  occBaseline     = 0.0f;
  occMonitoring   = false;
  occLowCount     = 0;
}

// =====================================================
void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// =====================================================
// JSON HELPERS
// =====================================================
float extractFloatValue(String body, String key, float defaultValue) {
  int idx = body.indexOf("\"" + key + "\":");
  if (idx == -1) return defaultValue;

  int startIdx = idx + key.length() + 3;
  int endIdx = body.indexOf(",", startIdx);

  if (endIdx == -1) endIdx = body.indexOf("}", startIdx);
  if (endIdx == -1) endIdx = body.length();

  return body.substring(startIdx, endIdx).toFloat();
}

int extractIntValue(String body, String key, int defaultValue) {
  int idx = body.indexOf("\"" + key + "\":");
  if (idx == -1) return defaultValue;

  int startIdx = idx + key.length() + 3;
  int endIdx = body.indexOf(",", startIdx);

  if (endIdx == -1) endIdx = body.indexOf("}", startIdx);
  if (endIdx == -1) endIdx = body.length();

  return body.substring(startIdx, endIdx).toInt();
}

char extractDirection(String body) {
  if (body.indexOf("\"direction\":\"F\"") != -1) return 'F';
  if (body.indexOf("\"direction\":\"R\"") != -1) return 'R';
  if (body.indexOf("\"direction\":\"S\"") != -1) return 'S';
  return 'S';
}

// =====================================================
// HTTP HANDLER
// =====================================================
void handleControl() {
  sendCorsHeaders();

  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
    return;
  }

  String body = server.arg("plain");

  Serial.print("[HTTP] Body: ");
  Serial.println(body);

  // START or FLOW CHANGE
  if (body.indexOf("start") != -1 || body.indexOf("flowRate") != -1) {
    if (body.indexOf("start") != -1) {
      resetSystemState();
    }

    float requestedFlow = extractFloatValue(body, "flowRate", targetFlowRate);
    motorOnWithFlow(requestedFlow);

    server.send(200, "application/json",
      "{\"success\":true,\"action\":\"flow_update\"}");
  }

  // STOP
  else if (body.indexOf("stop") != -1) {
    motorOff();

    server.send(200, "application/json",
      "{\"success\":true,\"action\":\"stop\"}");
  }

  // DRAW (reverse to load N mL using the reverse calibration table)
  else if (body.indexOf("draw") != -1) {
    isManualMode = false;
    resetSystemState();

    float vol = extractFloatValue(body, "volume", 0.0f);
    if (vol < MIN_DRAW_VOL) vol = MIN_DRAW_VOL;
    if (vol > MAX_DRAW_VOL) vol = MAX_DRAW_VOL;

    unsigned long durationMs = volumeToDrawMs(vol);
    lastDrawVol = vol;
    drawEndMillis = millis() + durationMs;
    drawingActive = true;

    Serial.print("[DRAW] volume = ");
    Serial.print(vol, 2);
    Serial.print(" mL  duration = ");
    Serial.print(durationMs);
    Serial.println(" ms");

    applyMotor('R', DRAW_PWM);

    String resp = "{\"success\":true,\"action\":\"draw\",\"volume\":";
    resp += String(vol, 2);
    resp += ",\"durationMs\":";
    resp += String(durationMs);
    resp += "}";
    server.send(200, "application/json", resp);
  }

  // MANUAL
  else if (body.indexOf("manual") != -1) {
    isManualMode = true;

    char dir = extractDirection(body);
    int speedValue = extractIntValue(body, "speed", 255);

    applyMotor(dir, speedValue);

    server.send(200, "application/json",
      "{\"success\":true,\"action\":\"manual\"}");
  }

  // RESET
  else if (body.indexOf("reset") != -1 || body.indexOf("reset_baseline") != -1) {
    resetSystemState();

    server.send(200, "application/json",
      "{\"success\":true,\"action\":\"reset\"}");
  }

  else {
    server.send(400, "application/json",
      "{\"success\":false,\"error\":\"unknown_command\"}");
  }
}

// =====================================================
void handleSensors() {
  sendCorsHeaders();

  String json = "{";
  json += "\"flowRate\":" + String(flowRate, 2) + ",";
  json += "\"targetFlowRate\":" + String(targetFlowRate, 2) + ",";
  json += "\"targetSpeed\":" + String(targetSpeed) + ",";
  json += "\"unit\":\"mL/min\",";
  json += "\"motorRunning\":" + String(motorRunning ? "true" : "false") + ",";
  json += "\"syringeEmpty\":" + String(syringeEmpty ? "true" : "false") + ",";
  json += "\"occlusionDetected\":" + String(occlusionDetected ? "true" : "false") + ",";
  json += "\"drawingActive\":" + String(drawingActive ? "true" : "false") + ",";
  json += "\"lastDrawVol\":" + String(lastDrawVol, 2) + ",";
  json += "\"direction\":\"" + String(currentDirection) + "\"";
  json += "}";

  server.send(200, "application/json", json);
}

void handlePing() {
  sendCorsHeaders();
  server.send(200, "application/json", "{\"status\":\"ok\"}");
}

void handleRoot() {
  sendCorsHeaders();

  String html = "";
  html += "<html><body>";
  html += "<h2>Syringe Pump ESP32</h2>";
  html += "<p>Server running.</p>";
  html += "<p>Unit: mL/min</p>";
  html += "<p>POST /control {\"action\":\"start\",\"flowRate\":36}</p>";
  html += "<p>GET /sensors</p>";
  html += "</body></html>";

  server.send(200, "text/html", html);
}

// =====================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  pinMode(STOP_BUTTON_PIN, INPUT_PULLUP);

  // ESP32 core v3 style PWM
  ledcAttach(EN_PIN, PWM_FREQ, PWM_RES);

  motorOff();

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);

  WiFi.mode(WIFI_AP);
  WiFi.disconnect(true);
  delay(500);

  bool apStatus = WiFi.softAP(AP_SSID, AP_PASSWORD, 1, false, 4);

  if (apStatus) {
    Serial.println("[WiFi] AP Started");
    Serial.print("[WiFi] SSID: ");
    Serial.println(AP_SSID);
    Serial.print("[WiFi] Password: ");
    Serial.println(AP_PASSWORD);
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.softAPIP());
  } else {
    Serial.println("[WiFi] AP FAILED");
  }

  server.on("/", HTTP_GET, handleRoot);
  server.on("/control", HTTP_POST, handleControl);
  server.on("/control", HTTP_OPTIONS, handleControl);
  server.on("/sensors", HTTP_GET, handleSensors);
  server.on("/ping", HTTP_GET, handlePing);

  server.begin();

  Serial.println("[READY] FINAL SYSTEM RUNNING");
}

// =====================================================
void loop() {
  server.handleClient();

  // ===== AUTO-STOP DRAW =====
  if (drawingActive && (long)(millis() - drawEndMillis) >= 0) {
    drawingActive = false;
    motorOff();
    Serial.print("[DRAW] Completed ");
    Serial.print(lastDrawVol, 2);
    Serial.println(" mL");
  }


  // ===== BUTTON SAFETY =====
  if (digitalRead(STOP_BUTTON_PIN) == LOW) {
    if (!syringeEmpty && millis() - lastButtonPress > 250) {
      lastButtonPress = millis();
      syringeEmpty = true;

      Serial.println("[BUTTON] SYRINGE EMPTY / STOP");

      if (currentDirection == 'F') {
        motorOff();
      }
    }
  }
  else {
    if (millis() - lastButtonPress > 500) {
      syringeEmpty = false;
    }
  }

  // ===== FLOW MEASUREMENT EVERY 1 SECOND =====
  unsigned long now = millis();

  if (now - lastMeasurement >= 1000) {
    lastMeasurement = now;

    noInterrupts();
    int pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    float instantFlow = (float)pulses / CALIBRATION_FACTOR;

    flowRate = (flowRate * 0.85f) + (instantFlow * 0.15f);

    // ── Occlusion detection (self-baseline) ─────────────────────
    // Active whenever the motor is running FORWARD (auto or manual).
    // Phase 1 (warmup):  ignore N seconds while tube fills / motor ramps
    // Phase 2 (baseline): average pulses for N seconds → personal baseline
    // Phase 3 (monitor):  alarm if pulses drop below baseline*ratio
    //                     for N consecutive seconds.
    if (motorRunning && currentDirection == 'F' && !occlusionDetected) {
      occElapsedSec++;

      if (occElapsedSec <= OCC_STABILIZE_SEC) {
        // warmup — do nothing
      }
      else if (occElapsedSec <= OCC_STABILIZE_SEC + OCC_BASELINE_SEC) {
        // baseline window — accumulate
        occBaselineSum += pulses;
        if (occElapsedSec == OCC_STABILIZE_SEC + OCC_BASELINE_SEC) {
          occBaseline = (float)occBaselineSum / (float)OCC_BASELINE_SEC;
          if (occBaseline >= OCC_MIN_VIABLE_PULSES) {
            occMonitoring = true;
            Serial.print("[Occlusion] Baseline = ");
            Serial.print(occBaseline, 1);
            Serial.print(" pulses/s | trigger threshold = ");
            Serial.println(occBaseline * OCC_DROP_RATIO, 1);
          } else {
            Serial.print("[Occlusion] Baseline too low (");
            Serial.print(occBaseline, 1);
            Serial.println(") - detection disabled");
          }
        }
      }
      else if (occMonitoring) {
        // monitoring phase
        float relThreshold = occBaseline * OCC_DROP_RATIO;
        bool belowRelative = (float)pulses < relThreshold;
        bool belowAbsolute = pulses <= OCC_HARD_MIN_PULSES;

        if (belowRelative || belowAbsolute) {
          occLowCount++;
          Serial.print("[Occlusion] Low pulses ");
          Serial.print(pulses);
          Serial.print(" (rel<");
          Serial.print(relThreshold, 1);
          Serial.print(belowRelative ? " HIT" : " ok");
          Serial.print(", abs<=");
          Serial.print(OCC_HARD_MIN_PULSES);
          Serial.print(belowAbsolute ? " HIT" : " ok");
          Serial.print(") count=");
          Serial.println(occLowCount);
          if (occLowCount >= OCC_CONFIRM_SEC) {
            occlusionDetected = true;
            motorOff();
            Serial.println("[ALARM] OCCLUSION DETECTED - Motor stopped");
          }
        } else {
          occLowCount = 0;
        }
      }
    }

    Serial.print("[Target] ");
    Serial.print(targetFlowRate, 2);
    Serial.print(" mL/min | PWM ");
    Serial.println(targetSpeed);

    Serial.print("[Flow] ");
    Serial.print(flowRate, 2);
    Serial.print(" mL/min | Pulses = ");
    Serial.println(pulses);

    Serial.println("--------------------------------");
  }
}