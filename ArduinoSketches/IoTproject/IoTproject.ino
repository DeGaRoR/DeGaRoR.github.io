#include <LiquidCrystal.h>
#include <RTClib.h>
#include <Wire.h>
#include <DHT.h>
#include <DHT_U.h>

#define DHTTYPE DHT11   // Define the sensor type (DHT11)
#define PIN_DHT 2        // Define the pin where the DHT11 sensor is connected
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

// parameters
#define timeIntervalDisplay 1000  // Refresh rate for sensor data on LCD
#define timeIntervalLogging 10000  // Rate for logging through serial or other
#define introTime 5000  // Logging time interval

float tempCorrection = 4.2; // bias to apply to the KY temp reading

// Global state variables initialization
int currentPage = 0;  // Tracks the active page
bool buttonPressed = false;
bool buttonLCDPressed = false;
unsigned long previousMillisDisplay = 0;
unsigned long previousMillisLogging = 0;
unsigned long initMillis = 0;
unsigned long currentMillis = 0;
float KYValue = 0;
float voltage = 0;
int lux = 0;           // Light intensity in lux
int lightSensorValue = 0;       // Sensor value

// Objects creation
LiquidCrystal lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);
RTC_DS1307 rtc;
DHT dht(PIN_DHT, DHTTYPE);

void setup() {
    // Initializing protocols
    Serial.begin(115200);
    Wire.begin();
    initRTC();
    lcd.begin(16, 2);
    dht.begin();
    // Pin mode setup
    pinMode(PIN_BUTTON, INPUT_PULLUP);
}

void loop() {
  currentMillis = millis(); // update the time
  checkPageButton(); // Check button press to switch pages
  if (currentMillis - initMillis < introTime) {intro();} // Show welcome message for first 10 seconds
  else {
    if (currentMillis - previousMillisDisplay >= timeIntervalDisplay) { // Actions to be triggered at LCD display refresh interval
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
    if (currentMillis - previousMillisLogging >= timeIntervalLogging) { // Actions to be triggered at logging rate
      previousMillisLogging = currentMillis;
      
      // get all the sensor readings
      DateTime now = rtc.now();
      float tempKY = getTempKY();
      int luminosity = getLux();
      float DHThumidity = dht.readHumidity();
      float DHTtemperature = dht.readTemperature(); 
      
      // Format the timestamp string
      char timeStamp[20];
      snprintf(timeStamp, sizeof(timeStamp), "%04d-%02d-%02dT%02d:%02d:%02d",now.year(), now.month(), now.day(),now.hour(), now.minute(), now.second());
      
      // Build and format the JSON string
      String jsonData = "{";
      jsonData += "\"datetime\":\"" + String(timeStamp) + "\",";
      jsonData += "\"tempKY\":" + String(tempKY, 2) + ",";
      jsonData += "\"tempDHT\":" + String(DHTtemperature, 2) + ",";
      jsonData += "\"humidity\":" + String(DHThumidity) + ",";
      jsonData += "\"light\":" + String(luminosity);
      jsonData += "}";

      // Output the JSON to serial
      Serial.println(jsonData);
    }
  }
}

void displayTime() {
    DateTime now = rtc.now();
    // Build the date string
    char dateStr[11];  // Buffer to hold the date (DD-MM-YYYY)
    sprintf(dateStr, "%02d/%02d/%04d", now.day(), now.month(), now.year());
    // Build the time string
    char timeStr[9];  // Buffer to hold time (HH:MM:SS)
    sprintf(timeStr, "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
    // Update LCD Display
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(dateStr);
    lcd.setCursor(0, 1);
    lcd.print(timeStr);
}

// Page 2: KY-028 Temperature
void displayTempKY() {
    float tempKY = getTempKY();
    int luminosity = getLux();
    displayLCD("T: ",tempKY," C KY","L: ",luminosity," %");
}

// Page 3: DHT 11 data
void displayDHT() {
    float DHThumidity = dht.readHumidity();
    float DHTtemperature = dht.readTemperature(); 
    displayLCD("T: ",DHTtemperature," C DHT","H: ",DHThumidity," % DHT");
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
  int KYValue = analogRead(PIN_KY);// Read the raw sensor value (ESP32 uses 12-bit ADC, so max value is 4095) - remapped to 1023, probably the sensor does not support so high?
  float voltage = (KYValue / 1023.0) * 3.3;  // Adjust for 3.3V
  float resistance = voltage / (3.3 - voltage) * 10000;// Calculate the resistance of the thermistor, assuming 10kΩ pull-up resistor
  float temperature = 1.0 / ( (log(resistance / 10000.0) / 3950.0) + (1.0 / 298.15) ) - 273.15;// Calculate temperature using the Steinhart-Hart equation (or a simplified version)
  temperature = temperature + tempCorrection;// Correct for known bias, still very janky
  return temperature;  // Return the calibrated temperature
}

int getLux() {
  // Read the raw sensor value (ESP32 uses 12-bit ADC, so max value is 4095)
  int lightSensorValue = analogRead(PIN_PHOTO);
  lux = map(lightSensorValue, 0, 4000, 100, 0); 
  return lux;  // Return the calibrated temperature
}

void intro() {
  lcd.setCursor(0, 0);
  lcd.print("Waking up :-o");
  lcd.setCursor(0, 1);
  lcd.print("Ready in ");
  lcd.print(introTime/1000 - (currentMillis - initMillis) / 1000);
}

void checkPageButton() {
  if (digitalRead(PIN_BUTTON) == LOW && !buttonPressed) {
    buttonPressed = true;
    currentPage = (currentPage + 1) % 3;  // Cycle through 3 pages (adjustable)
    //lcd.clear();
  } 
  if (digitalRead(PIN_BUTTON) == HIGH) {
    buttonPressed = false;  // Reset button state
  }
}

void initRTC() {
  if (!rtc.begin()) {
        Serial.println("Couldn't find RTC.");
        while (1);
    } else {
        Serial.println("RTC found.");
    }

    DateTime now = rtc.now();
    if (now.year() < 2025) {  
        Serial.println("RTC lost power, setting time to compile time!");
        rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    }
}
