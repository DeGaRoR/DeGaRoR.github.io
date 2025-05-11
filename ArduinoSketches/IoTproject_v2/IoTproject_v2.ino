#include <LiquidCrystal.h>
#include <RTClib.h>
#include <Wire.h>
#include <DHT.h>
#include <DHT_U.h>
#include <esp_task_wdt.h>  // For watchdog

#define DHTTYPE DHT11
#define PIN_DHT 2
#define PIN_BUTTON 4
#define PIN_KY 34
#define PIN_SOUND 27
#define PIN_PHOTO 35
#define PIN_LCD_RS 17
#define PIN_LCD_E 16
#define PIN_LCD_D4 32
#define PIN_LCD_D5 33
#define PIN_LCD_D6 25
#define PIN_LCD_D7 26
#define PIN_SD_CS 5
#define PIN_SD_SCK 18
#define PIN_SD_MISO 19
#define PIN_SD_MOSI 23
#define PIN_BOOT 0  // GPIO0 is BOOT on most ESP32 boards

// Parameters
#define timeIntervalDisplay 1000
#define timeIntervalLogging 10000
#define introTime 5000
#define bootWaitDelay 1500 // Delay for power stabilization

float tempCorrection = 4.2;

int currentPage = 0;
bool buttonPressed = false;
unsigned long previousMillisDisplay = 0;
unsigned long previousMillisLogging = 0;
unsigned long initMillis = 0;
unsigned long currentMillis = 0;

float KYValue = 0;
float voltage = 0;
int lux = 0;
int lightSensorValue = 0;

LiquidCrystal lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);
RTC_DS1307 rtc;
DHT dht(PIN_DHT, DHTTYPE);

void setup() {
  delay(bootWaitDelay);  // Let things stabilize
  Serial.begin(115200);
  Serial.println("Booting...");

  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);  // Prevent SPI from interfering

  Wire.begin();
  lcd.begin(16, 2);
  lcd.clear();
  dht.begin();
  initRTC();

  // Set up watchdog timer with correct configuration
  esp_task_wdt_config_t config = {
    .timeout_ms = 10000,  // Set timeout to 10 seconds
    .task_id = ESP_TASK_MAIN,  // Specify the task (main task in this case)
  };
  esp_task_wdt_init(&config);  // Initialize watchdog with config
  esp_task_wdt_add(NULL);  // Add the current task to the watchdog

  initMillis = millis();
}

void loop() {
  currentMillis = millis();
  esp_task_wdt_reset();  // Feed watchdog

  checkPageButton();

  if (currentMillis - initMillis < introTime) {
    intro();
  } else {
    if (currentMillis - previousMillisDisplay >= timeIntervalDisplay) {
      previousMillisDisplay = currentMillis;
      switch (currentPage) {
        case 0:
          displayTime();
          break;
        case 1:
          displayTempKY();
          break;
        case 2:
          displayDHT();
          break;
      }
    }

    if (currentMillis - previousMillisLogging >= timeIntervalLogging) {
      previousMillisLogging = currentMillis;
      DateTime now = rtc.now();
      float tempKY = getTempKY();
      int luminosity = getLux();
      float DHThumidity = dht.readHumidity();
      float DHTtemperature = dht.readTemperature(); 

      char timeStamp[20];
      snprintf(timeStamp, sizeof(timeStamp), "%04d-%02d-%02dT%02d:%02d:%02d",
               now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());

      String jsonData = "{";
      jsonData += "\"datetime\":\"" + String(timeStamp) + "\",";
      jsonData += "\"tempKY\":" + String(tempKY, 2) + ","; 
      jsonData += "\"tempDHT\":" + String(DHTtemperature, 2) + ","; 
      jsonData += "\"humidity\":" + String(DHThumidity) + ","; 
      jsonData += "\"light\":" + String(luminosity);
      jsonData += "}";

      Serial.println(jsonData);
    }
  }
}

void displayTime() {
  DateTime now = rtc.now();
  char dateStr[11];
  sprintf(dateStr, "%02d/%02d/%04d", now.day(), now.month(), now.year());
  char timeStr[9];
  sprintf(timeStr, "%02d:%02d:%02d", now.hour(), now.minute(), now.second());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(dateStr);
  lcd.setCursor(0, 1);
  lcd.print(timeStr);
}

void displayTempKY() {
  float tempKY = getTempKY();
  int luminosity = getLux();
  displayLCD("T: ", tempKY, " C KY", "L: ", luminosity, " %");
}

void displayDHT() {
  float DHThumidity = dht.readHumidity();
  float DHTtemperature = dht.readTemperature(); 
  displayLCD("T: ", DHTtemperature, " C DHT", "H: ", DHThumidity, " %");
}

void displayLCD(String nameA, float valueA, String unitA, String nameB, float valueB, String unitB) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(nameA);
  lcd.print(valueA);
  lcd.print(unitA);
  lcd.setCursor(0, 1);
  lcd.print(nameB);
  lcd.print(valueB);
  lcd.print(unitB);
}

float getTempKY() {
  int KYValue = analogRead(PIN_KY);
  float voltage = (KYValue / 1023.0) * 3.3;
  float resistance = voltage / (3.3 - voltage) * 10000;
  float temperature = 1.0 / ((log(resistance / 10000.0) / 3950.0) + (1.0 / 298.15)) - 273.15;
  return temperature + tempCorrection;
}

int getLux() {
  int lightSensorValue = analogRead(PIN_PHOTO);
  lux = map(lightSensorValue, 0, 4000, 100, 0); 
  return lux;
}

void intro() {
  lcd.setCursor(0, 0);
  lcd.print("Waking up :-o");
  lcd.setCursor(0, 1);
  lcd.print("Ready in ");
  lcd.print(introTime / 1000 - (currentMillis - initMillis) / 1000);
}

void checkPageButton() {
  if (digitalRead(PIN_BUTTON) == LOW && !buttonPressed) {
    buttonPressed = true;
    currentPage = (currentPage + 1) % 3;
  } 
  if (digitalRead(PIN_BUTTON) == HIGH) {
    buttonPressed = false;
  }
}

void initRTC() {
  if (!rtc.begin()) {
    Serial.println("Couldn't find RTC. Restarting...");
    delay(5000);
    ESP.restart();
  }

  DateTime now = rtc.now();
  if (now.year() < 2025) {
    Serial.println("RTC lost power, setting time to compile time!");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
}
