// ─────────────────────────────────────────────────────────────
//  ESP32 Service — Real HTTP communication layer
//  Change ESP32_IP to match the IP printed in your Serial Monitor
// ─────────────────────────────────────────────────────────────

const ESP32_IP = 'http://192.168.4.1'; // <-- default IP when ESP32 is in AP mode

const TIMEOUT_MS = 5000; // 5-second request timeout

// Helper: fetch with timeout
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

// ── sendCommand ───────────────────────────────────────────────
// command: 'start' | 'stop' | 'reset_baseline'
// data:    optional extra fields (currently unused)
export const sendCommand = async (command, data = {}) => {
  try {
    const res = await fetchWithTimeout(`${ESP32_IP}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, ...data }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.log(`[ESP32] Command "${command}" → `, json);
    return json;
  } catch (error) {
    console.warn(`[ESP32] sendCommand "${command}" failed:`, error.message);
    return null; // caller checks for null = connection failure
  }
};

// ── fetchSensors ──────────────────────────────────────────────
// Returns:
//   { flowRate, baselineFlow, ratio, occlusion, baselineCaptured, motorRunning }
// Returns null on network error.
export const fetchSensors = async () => {
  try {
    const res = await fetchWithTimeout(`${ESP32_IP}/sensors`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch (error) {
    console.warn('[ESP32] fetchSensors failed:', error.message);
    return null;
  }
};

// ── ping ──────────────────────────────────────────────────────
// Quick connectivity check. Returns true if ESP32 is reachable.
export const pingESP32 = async () => {
  try {
    const res = await fetchWithTimeout(`${ESP32_IP}/ping`);
    return res.ok;
  } catch {
    return false;
  }
};
