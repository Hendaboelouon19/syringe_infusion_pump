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
// 10 mL syringe timing calibration
const int NUM_CAL_POINTS = 7;

float calFlow[NUM_CAL_POINTS] = {
  28.57f,
  30.00f,
  32.97f,
  36.36f,
  38.46f,
  41.96f,
  47.62f
};

int calSpeed[NUM_CAL_POINTS] = {
  165,
  180,
  195,
  210,
  225,
  240,
  255
};

// ===== Variables =====
volatile int pulseCount = 0;

float flowRate = 0.0f;
float targetFlowRate = 36.0f;
int targetSpeed = 210;

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