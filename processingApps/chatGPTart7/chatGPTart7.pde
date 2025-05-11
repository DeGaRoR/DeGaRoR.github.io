int gridSize = 20;  // Control the spacing of the grid
int numRows = 40;   // Rows in the grid
int numCols = 40;   // Columns in the grid
Point[][] points = new Point[numRows][numCols];

void setup() {
  size(800, 800);
  noStroke();
  
  // Initialize points in a lattice grid
  for (int row = 0; row < numRows; row++) {
    for (int col = 0; col < numCols; col++) {
      float x = col * gridSize + random(-2, 2);  // Small randomness for fluidity
      float y = row * gridSize + random(-2, 2);  // Small randomness for fluidity
      points[row][col] = new Point(x, y);
    }
  }
}

void draw() {
  background(10);
  
  // Update and display points
  for (int row = 0; row < numRows; row++) {
    for (int col = 0; col < numCols; col++) {
      points[row][col].update(row, col);
      points[row][col].display();
    }
  }
}

class Point {
  PVector pos;
  PVector vel;
  float size = 4;
  float pulseSpeed = 0.05;
  float pulseSize = 4;
  float trailOpacity = 50;
  float randomness = 0.3;  // Amount of randomness applied to movement

  Point(float x, float y) {
    pos = new PVector(x, y);
    vel = PVector.random2D();
  }

  void update(int row, int col) {
    // Introduce a subtle wave movement with both waves affecting the position
    float wave1 = sin(frameCount * 0.05 + (row + col) * 0.1) * 3;
    float wave2 = cos(frameCount * 0.03 + (row + col) * 0.2) * 3;
    
    PVector force = new PVector(wave1, wave2);
    
    // Apply small amounts of random force to make the points move unpredictably sometimes
    if (random(1) < randomness) {
      force.add(PVector.random2D().mult(2));  // A random "disturbance"
    }
    
    vel.add(force);

    // Apply velocity and update position
    vel.limit(1.5);  // Limit speed to maintain stability
    pos.add(vel);

    // Pulse the size of the point
    pulseSize += pulseSpeed;
    if (pulseSize > 8 || pulseSize < 4) pulseSpeed *= -1;
    
    // Create a fading trail effect
    trailOpacity = max(0, trailOpacity - 0.5);
  }

  void display() {
    // Add a smooth trail effect
    fill(255, 100, 150, trailOpacity);
    ellipse(pos.x, pos.y, pulseSize, pulseSize);
    
    // Vibrant color shift based on position
    float r = map(pos.x, 0, width, 100, 255);
    float g = map(pos.y, 0, height, 100, 255);
    fill(r, g, 255, 150);
    
    // Draw the point itself
    ellipse(pos.x, pos.y, pulseSize, pulseSize);
    
    // Gradually increase opacity for the trail
    trailOpacity = min(255, trailOpacity + 1);
  }
}
