int gridSize = 5;
float offset = 0;

void setup() {
  size(800, 600);
  noFill();
  stroke(255); // White lines
  strokeWeight(2);
  rectMode(CENTER);
}

void draw() {
  background(0); // Black background
  translate(width / 2, height / 2); // Move to center
  
  // Draw a grid of rectangles that shift slightly to create movement
  for (int i = -gridSize; i <= gridSize; i++) {
    for (int j = -gridSize; j <= gridSize; j++) {
      float x = i * 120;
      float y = j * 120;
      float w = 100 + sin(offset + i + j) * 30; // Dynamic width
      float h = 100 + cos(offset + i + j) * 30; // Dynamic height
      rect(x, y, w, h);
    }
  }

  // Subtle rotation effect to mimic modern architecture's sharp edges and flowing lines
  rotate(sin(offset) * 0.01);
  
  offset += 0.03; // Slowly change the offset for continuous movement
}
