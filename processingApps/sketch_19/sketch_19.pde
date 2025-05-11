int circleCount = 12;
float[] radii = new float[circleCount];
color[] colors = new color[circleCount];
float angleStep = TWO_PI / circleCount;
float offsetAngle = 0;

void setup() {
  size(800, 800);
  noFill();
  noStroke();
  
  // Initialize radii and colors with gradual, more controlled oscillations
  for (int i = 0; i < circleCount; i++) {
    radii[i] = map(i, 0, circleCount, 40, 100);  // Moderate radii for variation
    colors[i] = color(lerp(20, 150, random(1)), lerp(60, 170, random(1)), lerp(100, 200, random(1)));  // Soft, earthy palette
  }
}

void draw() {
  background(0);
  
  float offsetX = width / 2;
  float offsetY = height / 2;
  
  // Slightly faster movement offset (but still slow)
  offsetAngle += 0.005;  // Smooth, moderate pace
  
  for (int i = 0; i < circleCount; i++) {
    // Controlled oscillations for radii and movement
    float radiusOscillation = sin(0.005 * frameCount * (i + 1));  // Gentle oscillations
    float radius = radii[i] + radiusOscillation * 8;  // Moderate size fluctuation
    
    // Smooth, rhythmic movement along a circular path
    float angle = offsetAngle + angleStep * i;
    float movementOffset = cos(0.01 * frameCount * (i + 1)) * 8;  // Slow, organic oscillation
    
    // Position with slight variation for subtle texture
    float x = offsetX + cos(angle) * (radius + movementOffset) * 2;
    float y = offsetY + sin(angle) * (radius + movementOffset) * 2;
    
    fill(colors[i], 150);  // Soft, semi-transparent colors
    ellipse(x, y, radius * 2, radius * 2);  // Draw circle with subtle movement
  }
}
