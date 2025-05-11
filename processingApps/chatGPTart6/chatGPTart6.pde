int numPoints = 1000;
Point[] points = new Point[numPoints];
PVector center;

void setup() {
  size(800, 800);
  noStroke();
  center = new PVector(width / 2, height / 2);
  
  // Initialize points
  for (int i = 0; i < numPoints; i++) {
    points[i] = new Point(random(width), random(height));
  }
}

void draw() {
  background(10);
  
  // Update and display points
  for (int i = 0; i < numPoints; i++) {
    points[i].update();
    points[i].display();
  }
}

class Point {
  PVector pos;
  PVector vel;
  float maxSpeed = 2;
  float size = 4;
  float pulseSpeed = 0.05;
  float pulseSize = 4;

  Point(float x, float y) {
    pos = new PVector(x, y);
    vel = PVector.random2D();
  }

  void update() {
    // Attract to the center and repel from others
    PVector force = PVector.sub(center, pos);
    force.setMag(0.1);
    
    // Add some interaction between points
    for (int i = 0; i < numPoints; i++) {
      if (points[i] != this) {
        PVector diff = PVector.sub(pos, points[i].pos);
        float dist = diff.mag();
        if (dist < 100) {
          force.add(diff.mult(0.05));
        }
      }
    }
    
    // Apply the force and update velocity and position
    vel.add(force);
    vel.limit(maxSpeed);
    pos.add(vel);
    
    // Pulse the size of the point
    pulseSize += pulseSpeed;
    if (pulseSize > 10 || pulseSize < 4) pulseSpeed *= -1;
  }

  void display() {
    // Give each point a color based on its position and velocity
    float r = map(pos.x, 0, width, 100, 255);
    float g = map(pos.y, 0, height, 100, 255);
    fill(r, g, 255, 150);
    
    // Draw the point as a pulsing circle
    ellipse(pos.x, pos.y, pulseSize, pulseSize);
  }
}
