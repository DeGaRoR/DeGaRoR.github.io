int numCircles = 100;
float[] x = new float[numCircles];
float[] y = new float[numCircles];
float[] speedX = new float[numCircles];
float[] speedY = new float[numCircles];
color[] circleColors = new color[numCircles];

void setup() {
  size(800, 800);
  noStroke();
  
  // Initialize circle positions and speeds
  for (int i = 0; i < numCircles; i++) {
    x[i] = random(width);
    y[i] = random(height);
    speedX[i] = random(1, 3);
    speedY[i] = random(1, 3);
    circleColors[i] = color(random(255), random(255), random(255), random(50, 200));
  }
}

void draw() {
  background(10, 10, 20);
  
  // Gradient background effect
  for (int i = 0; i < height; i++) {
    float lerpedColor = map(i, 0, height, 0, 255);
    stroke(lerpedColor, lerpedColor / 2, lerpedColor * 1.5);
    line(0, i, width, i);
  }
  
  // Draw circles with dynamic movement and gradients
  for (int i = 0; i < numCircles; i++) {
    fill(circleColors[i]);
    ellipse(x[i], y[i], 50, 50);
    
    // Move circles
    x[i] += speedX[i];
    y[i] += speedY[i];
    
    // Bounce off walls
    if (x[i] < 0 || x[i] > width) {
      speedX[i] *= -1;
    }
    if (y[i] < 0 || y[i] > height) {
      speedY[i] *= -1;
    }
    
    // Change color dynamically
    circleColors[i] = color(sin(frameCount * 0.05 + i) * 127 + 128,
                            cos(frameCount * 0.05 + i) * 127 + 128,
                            sin(frameCount * 0.07 + i) * 127 + 128,
                            random(50, 200));
  }
  
  // Random lines intersecting circles
  for (int i = 0; i < 5; i++) {
    strokeWeight(2);
    stroke(random(255), random(255), random(255), 150);
    float x1 = random(width);
    float y1 = random(height);
    float x2 = random(width);
    float y2 = random(height);
    line(x1, y1, x2, y2);
  }
}
