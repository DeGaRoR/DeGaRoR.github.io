int numShapes = 50;
float[] x = new float[numShapes];
float[] y = new float[numShapes];
float[] speedX = new float[numShapes];
float[] speedY = new float[numShapes];
float[] size = new float[numShapes];
color[] shapeColors = new color[numShapes];
int stage = 0;
boolean interaction = false;

void setup() {
  size(800, 800);
  noStroke();
  smooth();
  
  // Initialize shape positions, speeds, and sizes
  for (int i = 0; i < numShapes; i++) {
    x[i] = random(width);
    y[i] = random(height);
    speedX[i] = random(1, 2);
    speedY[i] = random(1, 2);
    size[i] = random(30, 60);
    shapeColors[i] = color(random(255), random(255), random(255), random(50, 200));
  }
}

void draw() {
  background(10, 10, 20);
  
  // Fade in/out effect based on stage
  if (stage == 0) {
    background(10, 10, 20, 10);
  } else if (stage == 1) {
    background(30, 40, 50, 15);
  } else if (stage == 2) {
    background(60, 70, 80, 20);
  }
  
  // Shape movement and transformation based on stage
  for (int i = 0; i < numShapes; i++) {
    // Increase size and speed over time
    size[i] += 0.02;
    speedX[i] += 0.01;
    speedY[i] += 0.01;
    
    // Move shapes
    x[i] += speedX[i];
    y[i] += speedY[i];
    
    // Morph shapes as they move
    if (stage > 0) {
      shapeColors[i] = color(sin(frameCount * 0.05 + i) * 127 + 128,
                             cos(frameCount * 0.05 + i) * 127 + 128,
                             sin(frameCount * 0.07 + i) * 127 + 128,
                             random(50, 200));
    }

    if (interaction) {
      // When interacting with the mouse, shapes react
      float mouseDist = dist(mouseX, mouseY, x[i], y[i]);
      speedX[i] += (mouseX - x[i]) * 0.001;
      speedY[i] += (mouseY - y[i]) * 0.001;
    }
    
    fill(shapeColors[i]);
    ellipse(x[i], y[i], size[i], size[i]);
    
    // Bounce off walls
    if (x[i] < 0 || x[i] > width) {
      speedX[i] *= -1;
    }
    if (y[i] < 0 || y[i] > height) {
      speedY[i] *= -1;
    }
  }
  
  // Transition between stages to show evolution
  if (frameCount % 300 == 0) {
    stage++;
    if (stage > 2) {
      stage = 0;
    }
  }
}

void mousePressed() {
  interaction = true;
}

void mouseReleased() {
  interaction = false;
}
