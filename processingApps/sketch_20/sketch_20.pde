int numPoints = 10;
float[][] points = new float[numPoints][2]; // Array to store points
float maxDist = 150; // Maximum distance for drawing lines
float speed = 1; // Speed at which points move
color[] colors;

void setup() {
  size(600, 600);
  background(0);
  
  // Initialize points with random positions
  for (int i = 0; i < numPoints; i++) {
    points[i][0] = random(width); // x position
    points[i][1] = random(height); // y position
  }
  
  // Assign random colors for each point (human)
  colors = new color[numPoints];
  for (int i = 0; i < numPoints; i++) {
    colors[i] = color(random(255), random(255), random(255), 150); // Colors with transparency
  }
}

void draw() {
  background(0, 10); // Fade effect to show movement
  
  // Draw lines between close points (connections)
  for (int i = 0; i < numPoints; i++) {
    for (int j = i + 1; j < numPoints; j++) {
      float distX = points[i][0] - points[j][0];
      float distY = points[i][1] - points[j][1];
      float dist = sqrt(distX * distX + distY * distY);
      
      if (dist < maxDist) {
        stroke(255, 100);
        line(points[i][0], points[i][1], points[j][0], points[j][1]);
      }
    }
  }
  
  // Move points (people) in random directions
  for (int i = 0; i < numPoints; i++) {
    points[i][0] += random(-speed, speed);
    points[i][1] += random(-speed, speed);
    
    // Keep points within screen bounds
    points[i][0] = constrain(points[i][0], 0, width);
    points[i][1] = constrain(points[i][1], 0, height);
  }
  
  // Draw the points (humans) with color and varying size
  for (int i = 0; i < numPoints; i++) {
    fill(colors[i]);
    noStroke();
    ellipse(points[i][0], points[i][1], random(10, 20), random(10, 20)); // Dynamic size
  }
}
