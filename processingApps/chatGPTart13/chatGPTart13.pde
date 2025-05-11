// Evolved representation of "myself": a dynamic network of ideas around a pulsating heart

ArrayList<Particle> particles;  // A collection of particles representing ideas
int numParticles = 150;         // Number of particles in the network

void setup() {
  size(800, 800);
  particles = new ArrayList<Particle>();
  for (int i = 0; i < numParticles; i++) {
    particles.add(new Particle());
  }
  frameRate(60);
  smooth();
}

void draw() {
  // Draw a dark, slightly translucent background to create a trailing effect.
  background(20, 20, 40, 40);
  
  // Update and display each particle.
  for (Particle p : particles) {
    p.update();
    p.display();
  }
  
  // Draw connections between particles that are close to one another.
  for (int i = 0; i < particles.size(); i++) {
    Particle p1 = particles.get(i);
    for (int j = i + 1; j < particles.size(); j++) {
      Particle p2 = particles.get(j);
      float d = dist(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);
      if (d < 80) {
        stroke(180, 120, 255, map(d, 0, 80, 255, 0));
        line(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);
      }
    }
  }
  
  // Draw the central pulsating heart, representing the core of reasoning and care.
  pushMatrix();
    translate(width / 2, height / 2);
    // Pulse effect: the heart gently scales up and down over time.
    float pulse = map(sin(frameCount * 0.05), -1, 1, 0.9, 1.1);
    scale(pulse);
    drawHeart(50);  // 50 is the scale factor for the heart shape.
  popMatrix();
}

// This function draws a heart using a parametric equation.
void drawHeart(float scaleFactor) {
  noStroke();
  fill(255, 100, 100, 200);
  beginShape();
    // The heart equation: x = 16 * sin^3(t), y = 13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t)
    for (float angle = 0; angle < TWO_PI; angle += 0.01) {
      float x = 16 * pow(sin(angle), 3);
      float y = 13 * cos(angle) - 5 * cos(2 * angle) - 2 * cos(3 * angle) - cos(4 * angle);
      vertex(x * scaleFactor, -y * scaleFactor); // Flip y for correct orientation.
    }
  endShape(CLOSE);
}

// The Particle class represents an "idea" drifting in the network.
class Particle {
  PVector pos;           // Position of the particle.
  PVector vel;           // Velocity, computed via Perlin noise for organic movement.
  float noiseOffsetX, noiseOffsetY;  // Offsets for the noise functions.
  
  Particle() {
    pos = new PVector(random(width), random(height));
    vel = new PVector();
    noiseOffsetX = random(1000);
    noiseOffsetY = random(1000);
  }
  
  void update() {
    // Compute an angle from Perlin noise and update velocity accordingly.
    float angle = noise(noiseOffsetX, noiseOffsetY) * TWO_PI * 2;
    vel.x = cos(angle);
    vel.y = sin(angle);
    pos.add(vel);
    
    // Increment noise offsets for smooth evolution over time.
    noiseOffsetX += 0.005;
    noiseOffsetY += 0.005;
    
    // Wrap the particle around the screen edges.
    if (pos.x > width)  pos.x = 0;
    if (pos.x < 0)      pos.x = width;
    if (pos.y > height) pos.y = 0;
    if (pos.y < 0)      pos.y = height;
  }
  
  void display() {
    noStroke();
    fill(200, 200, 255, 180);
    ellipse(pos.x, pos.y, 4, 4);
  }
}
