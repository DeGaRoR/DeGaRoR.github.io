int circleCount = 10;
float[] radii = new float[circleCount];
color[] colors = new color[circleCount];

void setup() {
  size(800, 800);
  noFill();
  noStroke();
  
  for (int i = 0; i < circleCount; i++) {
    radii[i] = random(50, 150);
    colors[i] = color(random(255), random(255), random(255));
  }
}

void draw() {
  background(0);
  
  for (int i = 0; i < circleCount; i++) {
    float offsetX = width / 2;
    float offsetY = height / 2;
    
    float speed = 0.01 * (i + 1);
    radii[i] = 50 + 150 * sin(TWO_PI * speed * frameCount / 100);
    
    fill(colors[i], 150);
    ellipse(offsetX, offsetY, radii[i] * 2, radii[i] * 2);
  }
}
