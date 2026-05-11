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
  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    return "1970-01-01T00:00:00.000Z";
  }

  char timestamp[30];

  strftime(timestamp, sizeof(timestamp),
           "%Y-%m-%dT%H:%M:%S.000Z",
           &timeinfo);

  return String(timestamp);
}

// =====================================================
// SEND DATA
// =====================================================
void sendData(int x, int y, int z) {

  if (client.connect(server, port)) {

    String timestamp = getTimestamp();

    String json =
      "{"
      "\"node_id\":\"" + String(node_id) + "\","
      "\"x\":" + String(x) + ","
      "\"y\":" + String(y) + ","
      "\"z\":" + String(z) + ","
      "\"sampling_rate\":100,"
      "\"timestamp\":\"" + timestamp + "\""
      "}";

    // ================= HTTP REQUEST =================
    client.println("POST /api/sensors/data HTTP/1.1");

    client.print("Host: ");
    client.println(server);

    client.println("Content-Type: application/json");

    client.print("Content-Length: ");
    client.println(json.length());

    client.println();
    client.println(json);

    // ================= SERIAL DEBUG =================
    Serial.println("\n===== SENT JSON =====");
    Serial.println(json);

    // ================= SERVER RESPONSE =================
    Serial.println("\n===== SERVER RESPONSE =====");

    unsigned long timeout = millis();

    while (client.connected() && millis() - timeout < 3000) {

      while (client.available()) {
        String response = client.readStringUntil('\n');
        Serial.println(response);

        timeout = millis();
      }
    }

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
  int x = ax / 16384;
  int y = ay / 16384;
  int z = az / 16384;

  // ================= RAW VALUES =================
  Serial.print("Raw -> X: ");
  Serial.print(ax);

  Serial.print(" Y: ");
  Serial.print(ay);

  Serial.print(" Z: ");
  Serial.println(az);

  // ================= SCALED VALUES =================
  Serial.print("Scaled -> X: ");
  Serial.print(x);

  Serial.print(" Y: ");
  Serial.print(y);

  Serial.print(" Z: ");
  Serial.println(z);

  // Send data
  sendData(x, y, z);

  delay(2000);
}