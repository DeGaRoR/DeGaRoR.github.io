int cols, rows;
float scl = 10;
float w = 1400;
float h = 800;

float[][] terrain;

void setup() {
  size(1400, 800);
  cols = floor(w / scl);
  rows = floor(h / scl);
  terrain = new float[cols][rows];
}

void draw() {
  background(0);
  stroke(255);
  noFill();

  float angle = map(mouseX, 0, width, 0, TWO_PI);
  
  // Generate terrain based on sine wave and mouse interaction
  for (int y = 0; y < rows; y++) {
    beginShape();
    for (int x = 0; x < cols; x++) {
      float xPos = x * scl;
      float yPos = y * scl;
      
      // Using sine wave for smooth flowing motion
      terrain[x][y] = sin(angle + x * 0.1) * 100;
      
      vertex(xPos, yPos + terrain[x][y]);
    }
    endShape();
  }
}
