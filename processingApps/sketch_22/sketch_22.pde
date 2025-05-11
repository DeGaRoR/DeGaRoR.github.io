int cols, rows;
float scl = 10;
float w = 1400;
float h = 800;

float[][] terrain;
float offset = 0;

void setup() {
  size(1400, 800);
  cols = floor(w / scl);
  rows = floor(h / scl);
  terrain = new float[cols][rows];
  noFill();
}

void draw() {
  background(0);

  float angle = map(mouseX, 0, width, 0, TWO_PI);
  float time = millis() * 0.001;

  // Add gradient effect based on sine wave values
  for (int y = 0; y < rows; y++) {
    beginShape();
    for (int x = 0; x < cols; x++) {
      float xPos = x * scl;
      float yPos = y * scl;
      
      // Generate more complex, layered terrain
      float wave = sin(angle + x * 0.1 + offset) * 100;
      terrain[x][y] = wave + sin(time + x * 0.1) * 50;
      
      // Color based on wave height
      float colorVal = map(terrain[x][y], -150, 150, 0, 255);
      stroke(colorVal, 100, 255 - colorVal, 150);
      
      vertex(xPos, yPos + terrain[x][y]);
    }
    endShape();
  }

  // Smooth motion for the wave and gradual offset shift
  offset += 0.02;
}
