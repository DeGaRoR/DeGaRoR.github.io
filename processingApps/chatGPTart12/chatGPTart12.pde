int numShapes = 10;  // Number of evolving shapes
float angle = 0;     // Starting angle for rotation
float radius = 150;  // Radius of the heart shape
float heartSize = 30; // Heart size
float offset = 0.1;  // Offset for the pulse effect

void setup() {
  size(600, 600);
  noStroke();
  frameRate(30);
}

void draw() {
  background(0);  // Black background to make the colors pop

  // Heart shape in the center
  pushMatrix();
  translate(width / 2, height / 2);
  
  // Pulsing effect for the heart
  float pulse = sin(angle) * 50 + 100;
  fill(255, 100, 100, 150);
  beginShape();
  for (float i = 0; i < TWO_PI; i += 0.1) {
    float x = pulse * cos(i) - 20 * sin(i);
    float y = pulse * sin(i) - 20 * cos(i);
    vertex(x, y);
  }
  endShape(CLOSE);
  
  popMatrix();

  // Pulsating and rotating shapes
  for (int i = 0; i < numShapes; i++) {
    float x = cos(angle + TWO_PI * i / numShapes) * radius + width / 2;
    float y = sin(angle + TWO_PI * i / numShapes) * radius + height / 2;
    
    // Changing size and color based on effort/heart
    float sizeMod = sin(angle + i * offset) * 15 + 20;
    fill(255 - sizeMod, 255 - sizeMod, 255, 150);
    ellipse(x, y, sizeMod, sizeMod);
  }

  angle += 0.02;  // Increment angle for rotation and pulsation effect
}
