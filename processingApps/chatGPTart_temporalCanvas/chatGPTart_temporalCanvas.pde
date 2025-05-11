/**
 * Temporal Tapestry
 *
 * A visual meditation on time that unfolds in layers:
 *
 * 1. Background Gradient:
 *    A radial gradient flows from a bright, warm center (creation)
 *    to a dark, somber periphery (obsolescence).
 *
 * 2. Spiral Particle System:
 *    Moments are born at the center and follow spiral trajectories outward.
 *    Their gradual fade represents the passage of time from inception to decay.
 *
 * 3. Pulsing Concentric Circles:
 *    Gentle, rhythmic pulses at the center evoke the cyclic nature of time.
 *
 * Together, these elements present an atypical, multi-dimensional
 * representation of time—from the moment of creation until the projected
 * moment of obsolescence.
 */

ArrayList<SpiralParticle> particles; // Stores our fleeting moments.
int spawnInterval = 2;  // Spawn a new particle every 2 frames.

void setup() {
  size(800, 800);
  smooth(4);
  particles = new ArrayList<SpiralParticle>();
  frameRate(60);
}

void draw() {
  // Draw the dynamic background gradient that embodies the flow of time.
  drawBackgroundGradient();
  
  // Overlay pulsing circles that evoke cyclical rhythms.
  drawPulsingCircles();
  
  // Spawn new spiral particles (new moments) at regular intervals.
  if (frameCount % spawnInterval == 0) {
    particles.add(new SpiralParticle());
  }
  
  // Update and display each particle.
  // They journey from the bright center outward, fading as they age.
  for (int i = particles.size()-1; i >= 0; i--) {
    SpiralParticle p = particles.get(i);
    p.update();
    p.display();
    if (p.isDead()) {
      particles.remove(i);
    }
  }
}

/**
 * Draws a radial gradient background.
 * The gradient shifts from a warm, golden center (creation)
 * to a deep, midnight-blue edge (obsolescence).
 */
void drawBackgroundGradient() {
  PVector center = new PVector(width/2, height/2);
  float maxRadius = dist(0, 0, width/2, height/2);
  
  // Create the gradient by drawing concentric ellipses.
  for (float r = maxRadius; r > 0; r -= 2) {
    // Map r to an interpolation factor (0 at the edge, 1 at the center).
    float inter = map(r, 0, maxRadius, 1, 0);
    // Define inner (bright) and outer (dark) colors.
    int innerColor = color(255, 240, 200);
    int outerColor = color(10, 10, 30);
    int c = lerpColor(innerColor, outerColor, inter);
    noStroke();
    fill(c);
    ellipse(center.x, center.y, r*2, r*2);
  }
}

/**
 * Draws pulsing concentric circles at the center.
 * These softly oscillating rings evoke the rhythm of cyclical time.
 */
void drawPulsingCircles() {
  pushMatrix();
  translate(width/2, height/2);
  noFill();
  int numCircles = 6;
  float baseSpacing = 50;
  float t = millis() * 0.001;  // Slow time parameter for pulsing.
  
  for (int i = 1; i <= numCircles; i++) {
    float phase = t + i;
    // Each circle pulses (expands/contracts) slightly.
    float r = i * baseSpacing + sin(phase) * 10;
    // Outer circles are rendered with lower opacity.
    float alpha = map(i, 1, numCircles, 200, 50);
    stroke(200, 220, 255, alpha);
    strokeWeight(2);
    ellipse(0, 0, r*2, r*2);
  }
  popMatrix();
}

/**
 * SpiralParticle represents a fleeting moment in time.
 * Born at the center, it travels outward on a spiral path,
 * subtly perturbed by noise to evoke organic variability.
 * Its gradual fade symbolizes the passage from creation toward obsolescence.
 */
class SpiralParticle {
  float age;          // Age in frames.
  float maxAge;       // Lifespan (in frames) before the particle vanishes.
  float initialAngle; // Random starting angular offset.
  float radialSpeed;  // Determines how fast it moves away from the center.
  float rotationFactor; // Governs how quickly it rotates around the center.
  PVector pos;        // Current position.
  float noiseOffset;  // For introducing slight random variation.
  
  SpiralParticle() {
    age = 0;
    // Lifespan between ~5 and 10 seconds (at 60 fps).
    maxAge = random(300, 600);
    initialAngle = random(TWO_PI);
    radialSpeed = random(0.5, 1.5);
    rotationFactor = random(0.005, 0.02);
    noiseOffset = random(1000);
    pos = new PVector(width/2, height/2);
  }
  
  void update() {
    age += 1;
    // The radial distance grows with age.
    float r = age * radialSpeed;
    
    // The angle evolves over time; a noise‐induced variation makes the path organic.
    float noiseVal = noise(age * 0.01, noiseOffset);
    float angleVariation = map(noiseVal, 0, 1, -PI/16, PI/16);
    float angle = initialAngle + age * rotationFactor * TWO_PI + angleVariation;
    
    // Convert from polar to Cartesian coordinates.
    pos.x = width/2 + r * cos(angle);
    pos.y = height/2 + r * sin(angle);
  }
  
  void display() {
    // Fade the particle with age.
    float alpha = map(age, 0, maxAge, 255, 0);
    noStroke();
    // Transition the color from vibrant white to a subdued blue as it ages.
    int cStart = color(255, 255, 255);
    int cEnd = color(100, 150, 255);
    int c = lerpColor(cStart, cEnd, age / maxAge);
    fill(red(c), green(c), blue(c), alpha);
    ellipse(pos.x, pos.y, 6, 6);
  }
  
  boolean isDead() {
    return age > maxAge;
  }
}
