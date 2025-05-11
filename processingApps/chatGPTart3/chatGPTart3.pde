int gridSize = 10; // Grid size
float maxOffset = 10; // Small offset for subtle movement
float minSize = 50; // Min circle size
float maxSize = 120; // Max circle size
color baseColor, randomColor;

void setup() {
  size(800, 800);
  frameRate(30);
  baseColor = color(20, 100, 255); // Blueish base color
  randomColor = color(255, 204, 0); // Bright yellow accent color
  smooth();
}

void draw() {
  background(20);
  int step = width / gridSize; // Step size for grid
  
  // Draw the grid of circles with subtle movement
  for (int x = 0; x < gridSize; x++) {
    for (int y = 0; y < gridSize; y++) {
      float posX = x * step + sin(frameCount * 0.005 + (x + y) * 0.1) * maxOffset;
      float posY = y * step + cos(frameCount * 0.005 + (x + y) * 0.1) * maxOffset;
      float size = map(sin(frameCount * 0.003 + (x + y) * 0.1), -1, 1, minSize, maxSize);
      
      // Smooth gradient transition based on position
      float col = map(x + y, 0, gridSize * 2, 100, 255);
      fill(lerpColor(baseColor, randomColor, col / 255.0));
      
      ellipse(posX, posY, size, size);
    }
  }
}
