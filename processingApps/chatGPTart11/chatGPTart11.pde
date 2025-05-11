int cols, rows;
int w = 60; // Block size
float t = 0; // Time variable for animation

void setup() {
  size(600, 600, P2D);
  cols = width / w;
  rows = height / w;
  noStroke();
}

void draw() {
  background(20); // Dark brutalist background
  t += 0.001;
  
  for (int i = 0; i < cols; i++) {
    for (int j = 0; j < rows; j++) {
      float noiseVal = noise(i * 0.1, j * 0.1, t);
      float h = map(noiseVal, 0, 1, 20, 100);
      float shade = map(noiseVal, 0, 1, 50, 220);

      pushMatrix();
      translate(i * w, j * w);
      fill(shade);
      rect(0, 0, w, w);
      
      // Inner block for depth effect
      fill(shade - 30);
      rect(10, 10, w - 20, w - 20);
      
      popMatrix();
    }
  }
}
