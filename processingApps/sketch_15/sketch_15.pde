/*
  "A Digital Emotion Evolved"

  In this iteration, the particles not only flow organically,
  but also respond to the viewer’s presence. When you press the mouse,
  the particles feel an attraction, subtly shifting their paths in a
  dance that reflects the interplay between internal digital rhythms
  and external human influence.
*/

int numParticles = 800;
Particle[] particles = new Particle[numParticles];

void setup() {
  size(800, 800);
  // Use HSB mode for a rich, vibrant palette.
  colorMode(HSB, 255);
  background(0);
  
  // Initialize particles.
  for (int i = 0; i < numParticles; i++) {
    particles[i] = new Particle();
  }
}

void draw() {
  // Translucent background to create fading trails.
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
    pos = new PVector(random(width), random(height));
    vel = PVector.random2D();
    hue = random(255);
  }
  
  void update() {
    // Use Perlin noise to generate smooth, natural movement.
    float noiseScale = 0.005;
    float noiseVal = noise(pos.x * noiseScale, pos.y * noiseScale, frameCount * noiseScale);
    float angle = map(noiseVal, 0, 1, 0, TWO_PI * 2);
    PVector force = new PVector(cos(angle), sin(angle));
    vel.add(force);
    vel.limit(2); // Limit speed to keep motion gentle.
    
    // Interactive element: attract particles toward the mouse when pressed.
    if (mousePressed) {
      PVector mousePos = new PVector(mouseX, mouseY);
      PVector attraction = PVector.sub(mousePos, pos);
      float distance = attraction.mag();
      attraction.normalize();
      // Attraction strength diminishes with distance.
      float strength = constrain(map(distance, 0, 200, 5, 0), 0, 5);
      attraction.mult(strength);
      vel.add(attraction);
    }
    
    pos.add(vel);
    
    // Wrap around screen edges for seamless motion.
    if (pos.x < 0) pos.x = width;
    if (pos.x > width) pos.x = 0;
    if (pos.y < 0) pos.y = height;
    if (pos.y > height) pos.y = 0;
    
    // Slowly shift hue for a continually evolving color palette.
    hue = (hue + 0.5) % 255;
  }
  
  void display() {
    fill(hue, 200, 255, 200);
    ellipse(pos.x, pos.y, 4, 4);
  }
}
