/**
 * A Journey Within
 * 
 * This Processing sketch tells a subtle, evolving narrative of ideas and emotions.
 * Over time, the digital landscape transitions through three phases:
 *
 *   1. The Awakening: In the darkness, a gentle spark emerges.
 *   2. The Convergence: Ideas connect, forming a swirling network of insight.
 *   3. The Reflection: In calm introspection, new understandings are born.
 *
 * The animation responds to your presence—when you press the mouse,
 * the landscape shifts, as if acknowledging your interaction.
 *
 * Each phase unfolds in approximately 15‑second chapters, inviting you to
 * experience a meditative journey where visual form and narrative intertwine.
 */

int phaseDuration = 15000;  // Duration of each phase in milliseconds
int currentPhase = 0;
String[] narrative = {
  "In the beginning, a spark emerges...",
  "Connections are forged; ideas converge...",
  "In reflection, new insights arise..."
};

int numParticles = 100;
Particle[] particles = new Particle[numParticles];

void setup() {
  size(800, 800);
  smooth();
  // Initialize particles at random positions
  for (int i = 0; i < numParticles; i++){
    particles[i] = new Particle(random(width), random(height));
  }
  textAlign(CENTER, CENTER);
  textSize(24);
}

void draw() {
  // Determine current phase based on elapsed time
  currentPhase = int(millis() / float(phaseDuration)) % 3;
  
  // Set background based on current phase
  if (currentPhase == 0) {
    background(10, 10, 30); // Dark, subtle awakening
  } else if (currentPhase == 1) {
    background(30, 20, 50); // A richer tone for convergence
  } else if (currentPhase == 2) {
    background(20, 30, 40); // Reflective, calm ambiance
  }
  
  // Update and display each particle
  for (Particle p : particles) {
    p.update();
    p.display();
  }
  
  // In the Convergence phase, draw ephemeral connections between nearby particles
  if (currentPhase == 1) {
    stroke(200, 200, 255, 100);
    for (int i = 0; i < numParticles; i++){
      for (int j = i + 1; j < numParticles; j++){
        float d = dist(particles[i].pos.x, particles[i].pos.y, particles[j].pos.x, particles[j].pos.y);
        if (d < 100) {
          strokeWeight(map(d, 0, 100, 3, 0.5));
          line(particles[i].pos.x, particles[i].pos.y, particles[j].pos.x, particles[j].pos.y);
        }
      }
    }
  }
  
  // Display the narrative text at the bottom of the canvas
  fill(255, 200);
  text(narrative[currentPhase], width/2, height - 50);
}

// The Particle class represents a spark of idea that evolves with the narrative
class Particle {
  PVector pos;        // Current position
  PVector vel;        // Velocity vector
  float noiseOffset;  // Unique noise offset for varied behavior
  
  Particle(float x, float y) {
    pos = new PVector(x, y);
    vel = new PVector(0, 0);
    noiseOffset = random(1000);
  }
  
  void update() {
    // Use Perlin noise to determine movement in different phases
    float dt = 0.005;
    float n = noise(pos.x * dt, pos.y * dt, noiseOffset + millis() * 0.0005);
    
    if (currentPhase == 0) {
      // The Awakening: gentle, meandering movement
      float angle = n * TWO_PI;
      vel.x = cos(angle) * 0.5;
      vel.y = sin(angle) * 0.5;
    } else if (currentPhase == 1) {
      // The Convergence: dynamic movement with a subtle pull toward the center
      float angle = n * TWO_PI * 2;
      vel.x = cos(angle) * 2;
      vel.y = sin(angle) * 2;
      // Attract toward the center to foster convergence
      PVector center = new PVector(width/2, height/2);
      PVector attraction = PVector.sub(center, pos);
      attraction.setMag(0.05);
      vel.add(attraction);
    } else if (currentPhase == 2) {
      // The Reflection: calm, introspective drift with a hint of randomness
      float angle = n * TWO_PI;
      vel.x = cos(angle) * 1;
      vel.y = sin(angle) * 1;
    }
    
    // Update position based on calculated velocity
    pos.add(vel);
    
    // Interact with the viewer: if the mouse is pressed, particles are gently repelled
    if (mousePressed) {
      PVector mousePos = new PVector(mouseX, mouseY);
      PVector diff = PVector.sub(pos, mousePos);
      float d = diff.mag();
      if (d < 100) {
        diff.setMag(2);
        pos.add(diff);
      }
    }
    
    // Wrap around edges to keep the particles in view
    if (pos.x < 0) pos.x += width;
    if (pos.x >= width) pos.x -= width;
    if (pos.y < 0) pos.y += height;
    if (pos.y >= height) pos.y -= height;
  }
  
  void display() {
    noStroke();
    // Particle color shifts with the phase, reflecting the narrative mood
    if (currentPhase == 0) {
      fill(255, 100);
    } else if (currentPhase == 1) {
      fill(180, 220, 255, 200);
    } else if (currentPhase == 2) {
      fill(255, 255, 200, 150);
    }
    ellipse(pos.x, pos.y, 8, 8);
  }
}
