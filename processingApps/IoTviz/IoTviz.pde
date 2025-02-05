import controlP5.*;

ControlP5 cp5; // Declare ControlP5 object
Textfield maxTField, minTField, samplesField; // Declare textfields for maxT and minT
int maxT = 70;
int minT = 0;
int refreshRate = 300; // Set refresh rate
int dataSize = 300;
ArrayList<Float> tempKY = new ArrayList<Float>();
ArrayList<Float> tempDHT = new ArrayList<Float>();
ArrayList<Float> humidity = new ArrayList<Float>();
ArrayList<Float> light = new ArrayList<Float>();
ArrayList<String> timestamps = new ArrayList<String>();
String filePath = "D:/Dev/IoT/IoTlogging.csv";
Table table;

void setup() {
  size(1600, 800);
  cp5 = new ControlP5(this); // Initialize ControlP5
  loadCSV();
  
  // Create input fields for maxT and minT
  maxTField = cp5.addTextfield("maxT")
                 .setPosition(10, 36)
                 .setSize(23, 20)
                 .setText(str(maxT)) // Set initial value
                 .setFont(createFont("Arial", 12))
                 .setColor(color(255))          // Text color
                 .setColorBackground(color(150)) // Background color
                 .setColorForeground(color(100, 100, 100)) // Border color when active
                 .setColorActive(color(255, 0, 0)); // Cursor color
                 
  minTField = cp5.addTextfield("minT")
                 .setPosition(10, 736)
                 .setSize(23, 20)
                 .setText(str(minT)) // Set initial value
                 .setFont(createFont("Arial", 12))
                 .setColor(color(255))          // Text color
                 .setColorBackground(color(150)) // Background color
                 .setColorForeground(color(100, 100, 100)) // Border color when active
                 .setColorActive(color(255, 0, 0)); // Cursor color
 
   samplesField = cp5.addTextfield("Samples")
                 .setPosition(800, 755)
                 .setSize(40, 20)
                 .setText(str(dataSize)) // Set initial value
                 .setFont(createFont("Arial", 12))
                 .setColor(color(255))          // Text color
                 .setColorBackground(color(150)) // Background color
                 .setColorForeground(color(100, 100, 100)) // Border color when active
                 .setColorActive(color(255, 0, 0)); // Cursor color
}

void draw() {
  background(230);
  drawGraph();
  if (frameCount % refreshRate == 0) {
    loadCSV();
  }
  
  // Update maxT and minT if changed
  try {
    maxT = Integer.parseInt(maxTField.getText());
  } catch (Exception e) {
    // Handle parsing error (e.g., non-numeric input)
  }
  
  try {
    minT = Integer.parseInt(minTField.getText());
  } catch (Exception e) {
    // Handle parsing error (e.g., non-numeric input)
  }
  try {
    dataSize = Integer.parseInt(samplesField.getText());
  } catch (Exception e) {
    // Handle parsing error (e.g., non-numeric input)
  }
}

void loadCSV() {
  table = loadTable(filePath, "header");  // Now 'table' is recognized
  tempKY.clear();
  tempDHT.clear();
  humidity.clear();
  light.clear();
  timestamps.clear();
  
  for (TableRow row : table.rows()) {
    timestamps.add(row.getString("datetime"));
    tempKY.add(row.getFloat("tempKY"));
    tempDHT.add(row.getFloat("tempDHT"));
    humidity.add(row.getFloat("humidity"));
    light.add(row.getFloat("light"));
  }
  
  while (tempKY.size() > dataSize) {
    timestamps.remove(0);
    tempKY.remove(0);
    tempDHT.remove(0);
    humidity.remove(0);
    light.remove(0);
  }
}

void drawGraph() {
  strokeWeight(2);
  
  // Temperature axis between minT and maxT
  drawData(tempKY, color(255, 102, 102), "TempKY", minT, maxT, 0);  // Lighter red for TempKY
  drawData(tempDHT, color(204, 0, 0), "TempDHT", minT, maxT, 1);  // Darker red for TempDHT
  
  // Humidity and light axis between 0% and 100%
  drawData(humidity, color(102, 255, 102), "Humidity", 0, 100, 2);  // Lighter green for Humidity
  drawData(light, color(0, 204, 0), "Light", 0, 100, 3);  // Darker green for Light
  
  drawTimestamps();
  drawAxes();
  drawGrid();
  drawLegend();
}

void drawData(ArrayList<Float> data, color c, String label, float minVal, float maxVal, int markerType) {
  stroke(c);
  noFill();
  
  // Draw continuous line
  beginShape();
  for (int i = 0; i < data.size(); i++) {
    float x = map(i, 0, data.size(), 50, width - 50);
    float y = map(data.get(i), minVal, maxVal, height - 50, 50);
    vertex(x, y);  // Connect the points with a line
  }
  endShape();
  
  //// Draw the data points
  //for (int i = 0; i < data.size(); i++) {
  //  float x = map(i, 0, data.size(), 50, width - 50);
  //  float y = map(data.get(i), minVal, maxVal, height - 50, 50);
    
  //  // Draw rounded dots for the first series
  //  if (markerType == 0 && i % 2 == 0) {
  //    ellipse(x, y, 8, 8); // Rounded dots for the first series
  //  } 
  //  // Draw crosses for the second series
  //  else if (markerType == 1 && i % 2 != 0) {
  //    line(x - 5, y - 5, x + 5, y + 5);  // Diagonal line for cross
  //    line(x - 5, y + 5, x + 5, y - 5);  // Diagonal line for cross
  //  }
  //  // For humidity and light series
  //  else if (markerType == 2 && i % 2 == 0) {
  //    ellipse(x, y, 8, 8); // Rounded dots for the first series
  //  } else if (markerType == 3 && i % 2 != 0) {
  //    line(x - 5, y - 5, x + 5, y + 5);  // Diagonal line for cross
  //    line(x - 5, y + 5, x + 5, y - 5);  // Diagonal line for cross
  //  }
  //}
  
  fill(c);
  text(label,(width/2)-100+100*(markerType), 30);
}

void drawAxes() {
  stroke(0);
  
  // Temperature axis label (left side)
  stroke(255, 102, 102);  // Color the temperature axis with a lighter red
  line(50, 50, 50, height - 50); // Y-axis left (temperature)
  textAlign(LEFT);
  text("Temp (°C)", 60, 60);
  
  // Humidity/Light axis label (right side)
  stroke(102, 255, 102);  // Color the humidity/light axis with a lighter green
  line(width - 50, 50, width - 50, height - 50); // Y-axis right (humidity/light)
  textAlign(RIGHT);
  text("Humidity/Light (%)", width - 60, 60);
}

void drawGrid() {
  // Use paler versions of the axis colors for the grid lines
  stroke(255, 150, 150, 150); // Light red for temperature grid lines
  // Draw horizontal grid lines for the temperature axis (10°C to 40°C)
  for (float i = minT; i <= maxT; i += 10) {
    float y = map(i, minT, maxT, height - 50, 50);
    line(50, y, width - 50, y); // Horizontal lines for temperature
    textAlign(RIGHT);
    text(i + "°C", 45, y);
  }
  
  stroke(150, 255, 150, 150); // Light green for humidity/light grid lines
  // Draw horizontal grid lines for the humidity and light axis (0% to 100%)
  float[] gridPositions = {0, 30, 50, 70, 100}; // Specific grid positions for humidity/light
  for (float i : gridPositions) {
    float y = map(i, 0, 100, height - 50, 50);
    line(50, y, width - 50, y); // Horizontal lines for humidity/light
    textAlign(RIGHT);
    text(i + "%", width - 55, y);
  }
}

void drawTimestamps() {
  fill(0);
  textAlign(CENTER);
  int step = max(1, timestamps.size() / 5);
  for (int i = 0; i < timestamps.size(); i += step) {
    float x = map(i, 0, timestamps.size(), 50, width - 50);
    text(timestamps.get(i).substring(11), x, height - 30);
  }
}

void drawLegend() {
  float legendY = height - 50;
  float xStart = 50;
  float spacing = 120;
  
  // You can continue adding your legend code here if needed
}
