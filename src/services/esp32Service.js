const ESP32_IP = 'http://192.168.1.100'; // Change to actual IP

export const sendCommand = async (command, data) => {
  console.log(`[ESP32 Mock] Sending command: ${command}`, data);
  // Example for real integration:
  /*
  try {
    const res = await fetch(`${ESP32_IP}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, ...data })
    });
    return await res.json();
  } catch (error) {
    console.error("ESP32 Connection Error:", error);
    return null;
  }
  */
  return { success: true };
};

export const fetchSensors = async () => {
  // console.log(`[ESP32 Mock] Fetching sensors...`);
  // return mocked data for now to avoid errors if ESP isn't connected
  return {
    flowRate: 1.5,
    motorSpeed: 11,
    pulseCount: 15,
    occlusion: false,
    syringeEmpty: false
  };
};
