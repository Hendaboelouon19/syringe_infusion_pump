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

// ===== Flow Sensor Calibration =====
#define CALIBRATION_FACTOR 1.63f

// ===== Motor Speed Calibration Table (Merged from User) =====
const int NUM_CAL_POINTS = 7;
float calFlow[NUM_CAL_POINTS] = { 41.88f, 46.82f, 47.19f, 49.00f, 51.72f, 59.55f, 66.37f };
int calSpeed[NUM_CAL_POINTS]  = { 165, 175, 185, 195, 205, 245, 255 };

volatile int pulseCount = 0;

// ===== State Variables =====
float flowRate = 0.0f;       // smoothed ml/min
float targetFlowRate = 51.5f;
int targetSpeed = 205;

bool motorRunning = false;
bool isManualMode = false;
bool syringeEmpty = false;
char currentDirection = 'S';

WebServer server(80);

unsigned long lastMeasurement = 0;
unsigned long lastButtonPress = 0;

// =====================================================
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

// =====================================================
// FLOW -> SPEED (Calibration Lookup)
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
  return 205;
}

// =====================================================
// MOTOR CONTROL
// =====================================================
void applyMotor(char direction, int speedValue) {
  // Safety: Block forward movement if syringe is empty (switch triggered)
  if (direction == 'F' && digitalRead(STOP_BUTTON_PIN) == LOW) {
    Serial.println("[SAFETY] Blocked forward move - Syringe Empty");
    applyMotor('S', 0); // Force stop
    return;
  }

  speedValue = constrain(speedValue, 0, 255);

  if (speedValue == 0 || direction == 'S') {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, LOW);
    analogWrite(EN_PIN, 0);
    motorRunning = false;
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
  analogWrite(EN_PIN, speedValue);
  motorRunning = true;
  Serial.print(" | Speed: ");
  Serial.println(speedValue);
}

void motorOnWithFlow(float requestedFlow) {
  isManualMode = false;
  targetFlowRate = requestedFlow;
  targetSpeed = flowToSpeed(targetFlowRate);
  
  Serial.print("[Target Flow] ");
  Serial.print(targetFlowRate);
  Serial.print(" -> Speed ");
  Serial.println(targetSpeed);

  applyMotor('F', targetSpeed);
}

void motorOff() {
  applyMotor('S', 0);
  isManualMode = false;
}

// =====================================================
void resetSystemState() {
  syringeEmpty = (digitalRead(STOP_BUTTON_PIN) == LOW);
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
// HTTP HANDLERS
// =====================================================
void handleControl() {
  sendCorsHeaders();
  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
    return;
  }

  String body = server.arg("plain");

  // ===== START / FLOW UPDATE =====
  if (body.indexOf("start") != -1 || body.indexOf("flowRate") != -1) {
    if (body.indexOf("start") != -1) resetSystemState();
    
    float requestedFlow = extractFloatValue(body, "flowRate", targetFlowRate);
    motorOnWithFlow(requestedFlow);

    server.send(200, "application/json", "{\"success\":true,\"action\":\"flow_update\"}");
  }

  // ===== STOP =====
  else if (body.indexOf("stop") != -1) {
    motorOff();
    server.send(200, "application/json", "{\"success\":true,\"action\":\"stop\"}");
  }

  // ===== MANUAL MODE =====
  else if (body.indexOf("manual") != -1) {
    isManualMode = true;
    
    char dir = extractDirection(body);
    int speedValue = extractIntValue(body, "speed", 255); // Use raw speed, default 255
    applyMotor(dir, speedValue);

    server.send(200, "application/json", "{\"success\":true,\"action\":\"manual\"}");
  }

  // ===== RESET SYSTEM =====
  else if (body.indexOf("reset_system") != -1) {
    resetSystemState();
    server.send(200, "application/json", "{\"success\":true,\"action\":\"reset\"}");
  }

  else {
    server.send(400, "application/json", "{\"success\":false}");
  }
}

void handleSensors() {
  sendCorsHeaders();
  String json = "{";
  json += "\"flowRate\":" + String(flowRate, 2) + ",";
  json += "\"targetFlowRate\":" + String(targetFlowRate, 2) + ",";
  json += "\"targetSpeed\":" + String(targetSpeed) + ",";
  json += "\"syringeEmpty\":" + String(syringeEmpty ? "true" : "false") + ",";
  json += "\"motorRunning\":" + String(motorRunning ? "true" : "false") + ",";
  json += "\"direction\":\"" + String(currentDirection) + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

void handlePing() {
  sendCorsHeaders();
  server.send(200, "application/json", "{\"status\":\"ok\"}");
}

// =====================================================
void setup() {
  Serial.begin(115200);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  motorOff();

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);
  pinMode(STOP_BUTTON_PIN, INPUT_PULLUP);

  WiFi.mode(WIFI_AP);
  WiFi.disconnect(true);
  delay(500);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  server.on("/control", HTTP_POST, handleControl);
  server.on("/sensors", HTTP_GET, handleSensors);
  server.on("/ping", HTTP_GET, handlePing);
  server.begin();
  Serial.println("[HTTP] Server Started with Flow-to-Speed Table");
}

void loop() {
  server.handleClient();

  // Trigger alarm once on press (LOW)
  if (digitalRead(STOP_BUTTON_PIN) == LOW) {
    if (!syringeEmpty && millis() - lastButtonPress > 250) {
      lastButtonPress = millis();
      syringeEmpty = true;
      Serial.println("[BUTTON] STOP TRIGGERED");
      
      // ONLY force stop if moving forward
      if (currentDirection == 'F' || currentDirection == 'S') {
        motorOff();
      }
    }
  } else if (digitalRead(STOP_BUTTON_PIN) == HIGH) {
    // Debounce the release to prevent motor vibrations from causing false triggers
    if (millis() - lastButtonPress > 500) {
      syringeEmpty = false;
    }
  }

  unsigned long now = millis();
  if (now - lastMeasurement >= 1000) {
    lastMeasurement = now;
    noInterrupts();
    int pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    float instantFlow = (float)pulses / CALIBRATION_FACTOR;
    flowRate = (flowRate * 0.85f) + (instantFlow * 0.15f);
    // Occlusion detection removed.
  }
}