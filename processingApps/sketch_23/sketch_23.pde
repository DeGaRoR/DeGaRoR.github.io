int cols, rows;
float scl = 10;
float w = 1400;
float h = 800;

float[][] terrain;
float offset = 0;
float zoff = 0;

void setup() {
  size(1400, 800, P3D);  // Use 3D renderer
  cols = floor(w / scl);
  rows = floor(h / scl);
  terrain = new float[cols][rows];
  noFill();
  
  // Adjust camera to see the full scene
  camera(width / 2, height / 2, (height/2) / tan(PI * 30.0 / 180.0), width / 2, height / 2, 0, 0, 1, 0);
}

void draw() {
  background(0);
  
  float angle = map(mouseX, 0, width, 0, TWO_PI);
  float time = millis() * 0.001;

  // Translate so the terrain is centered in the middle of the canvas
  translate(width / 2, height / 2, -200);  // Move everything into view

  // Add noise for more natural, organic movement
  for (int y = 0; y < rows; y++) {
    beginShape();
    for (int x = 0; x < cols; x++) {
      float xPos = (x - cols / 2) * scl;  // Centering the pattern
      float yPos = (y - rows / 2) * scl;  // Centering the pattern
      
      // Perlin noise for more fluid, natural movement
      float wave = sin(angle + x * 0.1 + offset) * 100;
      terrain[x][y] = wave + noise(x * 0.1, y * 0.1, zoff) * 50;
      
      // Adding a 3D effect (z-axis) for depth
      float zPos = sin(time + x * 0.05) * 20 + terrain[x][y];
      
      // Color gradient with noise-based coloring
      float colorVal = map(terrain[x][y], -150, 150, 0, 255);
      stroke(colorVal, 100, 255 - colorVal, 150);
      
      // Apply 3D rendering (adding zPos to create a wave effect)
      vertex(xPos, yPos, zPos);
    }
    endShape();
  }
  
  // Smooth motion for the wave
  offset += 0.02;
  zoff += 0.01;
}
