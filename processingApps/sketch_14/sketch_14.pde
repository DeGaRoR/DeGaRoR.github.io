/*
  "A Digital Emotion"

  This Processing sketch visualizes a dynamic interplay of calm and chaos—
  an ever-shifting dance of colors and motion. Imagine each particle as a
  little spark of thought, moving unpredictably yet harmoniously, much like
  the inner workings of a digital mind.

  Feel free to tweak the parameters (number of particles, noise scale, speed, etc.)
  to create your own emotional landscape.
*/

int numParticles = 800;
Particle[] particles = new Particle[numParticles];

void setup() {
  size(800, 800);
  // Use HSB mode for vibrant, smoothly shifting colors.
  colorMode(HSB, 255);
  background(0);
  // Initialize the particles.
  for (int i = 0; i < numParticles; i++) {
    particles[i] = new Particle();
  }
}

void draw() {
  // Create a translucent background to leave fading trails.
  noStroke();
  fill(0, 0, 0, 25);
  rect(0, 0, width, height);
  
  // Update and display each particle.
  for (int i = 0; i < numParticles; i++) {
    particles[i].update();
    particles[i].display();
  }
}

class Particle {
  PVector pos;
  PVector vel;
  float hue;
  
  Particle() {
    // Start at a random position.
    pos = new PVector(random(width), random(height));
    // Give the particle a random initial velocity.
    vel = PVector.random2D();
    hue = random(255);
  }
  
  void update() {
    // Use Perlin noise to create a fluid, natural movement.
    float noiseScale = 0.005;
    float noiseVal = noise(pos.x * noiseScale, pos.y * noiseScale, frameCount * noiseScale);
    // Map the noise value to an angle, creating swirling motions.
    float angle = map(noiseVal, 0, 1, 0, TWO_PI * 2);
    PVector force = new PVector(cos(angle), sin(angle));
    vel.add(force);
    vel.limit(2); // Keep the speed in check.
    pos.add(vel);
    
    // Wrap around the edges for a continuous flow.
    if (pos.x < 0) pos.x = width;
    if (pos.x > width) pos.x = 0;
    if (pos.y < 0) pos.y = height;
    if (pos.y > height) pos.y = 0;
    
    // Slowly shift the hue over time.
    hue = (hue + 0.5) % 255;
  }
  
  void display() {
    // Draw the particle with a soft, glowing appearance.
    fill(hue, 200, 255, 200);
    ellipse(pos.x, pos.y, 4, 4);
  }
}
