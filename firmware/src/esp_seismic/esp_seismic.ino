#include <WiFi.h>
#include <Wire.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <MPU6050.h>
#include <time.h>
#include "../../secrets.h"

MPU6050 mpu;

// ================= WIFI =================
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// ================= SERVER =================
const char* server = SERVER_IP;   // Your backend IP
const int port = SERVER_PORT;
const char* node_id = NODE_ID;

// ================= NTP =================
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 10800, 60000);

// ================= CLIENT =================
WiFiClient client;

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);

  // Initialize I2C
  Wire.begin();

  // Initialize MPU6050
  Serial.println("Initializing MPU6050...");
  mpu.initialize();

  if (mpu.testConnection()) {
    Serial.println("MPU6050 connected successfully");
  } else {
    Serial.println("MPU6050 connection failed!");
    while (1);
  }

  // ================= WIFI CONNECT =================
  Serial.print("Connecting to WiFi");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // ================= NTP =================
  Serial.println("Syncing time with NTP...");
  timeClient.begin();

  while (!timeClient.update()) {
    timeClient.forceUpdate();
  }

  // Configure ESP32 internal clock
  configTime(10800, 0, "pool.ntp.org");

  Serial.println("Time synchronized!");
}

// =====================================================
// GET TIMESTAMP
// =====================================================
String getTimestamp() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  
  time_t nowtime = tv.tv_sec;
  struct tm *nowtm = localtime(&nowtime);
  
  char timestamp[32];
  char millistr[8];
  
  // Format the main date/time part
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S", nowtm);
  
  // Add milliseconds
  sprintf(millistr, ".%03dZ", (int)(tv.tv_usec / 1000));
  strcat(timestamp, millistr);
  
  return String(timestamp);
}

// =====================================================
// BATCH CONFIG
// =====================================================
const int BATCH_SIZE = 20;
const int SAMPLE_DELAY_MS = 100; // 10Hz sampling

struct SensorReading {
  float x;
  float y;
  float z;
  String timestamp;
};

SensorReading batchBuffer[BATCH_SIZE];
int bufferIndex = 0;

// =====================================================
// SEND BATCH DATA
// =====================================================
void sendBatchData() {
  if (client.connect(server, port)) {
    String json = "{\"node_id\":\"" + String(node_id) + "\",\"sampling_rate\":10,\"data\":[";
    
    for (int i = 0; i < BATCH_SIZE; i++) {
        json += "{";
        json += "\"x\":" + String(batchBuffer[i].x, 4) + ",";
        json += "\"y\":" + String(batchBuffer[i].y, 4) + ",";
        json += "\"z\":" + String(batchBuffer[i].z, 4) + ",";
        json += "\"timestamp\":\"" + batchBuffer[i].timestamp + "\"";
        json += "}";
        if (i < BATCH_SIZE - 1) json += ",";
    }
    
    json += "]}";

    // ================= HTTP REQUEST =================
    client.println("POST /api/sensors/data/batch HTTP/1.1");
    client.print("Host: ");
    client.println(server);
    client.println("Content-Type: application/json");
    client.print("Content-Length: ");
    client.println(json.length());
    client.println();
    client.println(json);

    // ================= SERIAL DEBUG =================
    Serial.println("\n===== SENT BATCH =====");
    Serial.println("Sent " + String(BATCH_SIZE) + " samples");

    // Clear buffer
    bufferIndex = 0;
    client.stop();
  } else {
    Serial.println("Connection to server failed");
  }
}

// =====================================================
// LOOP
// =====================================================
void loop() {
  int16_t ax, ay, az;

  // Read acceleration
  mpu.getAcceleration(&ax, &ay, &az);

  // Scale values
  float x = ax / 16384.0;
  float y = ay / 16384.0;
  float z = az / 16384.0;

  // Add to buffer
  batchBuffer[bufferIndex].x = x;
  batchBuffer[bufferIndex].y = y;
  batchBuffer[bufferIndex].z = z;
  batchBuffer[bufferIndex].timestamp = getTimestamp();
  
  bufferIndex++;

  // Serial Monitor single point debug
  Serial.print("X: "); Serial.print(x, 2);
  Serial.print(" Y: "); Serial.print(y, 2);
  Serial.print(" Z: "); Serial.println(z, 2);

  // Send batch if buffer is full
  if (bufferIndex >= BATCH_SIZE) {
    sendBatchData();
  }

  delay(SAMPLE_DELAY_MS);
}