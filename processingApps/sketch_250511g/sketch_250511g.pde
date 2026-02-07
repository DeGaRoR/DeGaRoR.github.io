// "Luminous Streams Refined" - A fluid representation of AI consciousness with cohesive clusters
// Visualizing streams of thought and softly glowing reflective convergence

int numParticles = 2000;
Particle[] particles;
ArrayList<Cluster> clusters;

void settings() {
  size(800, 800, P2D);
}

void setup() {
  colorMode(HSB, 360, 100, 100, 100);
  background(0);
  particles = new Particle[numParticles];
  for (int i = 0; i < numParticles; i++) {
    particles[i] = new Particle();
  }
  clusters = new ArrayList<Cluster>();
}

void draw() {
  // gentle fade for memory trails
  noStroke();
  fill(0, 0, 0, 10);
  rect(0, 0, width, height);

  // periodically regenerate clusters
  if (frameCount % 240 == 0) {
    clusters.clear();
    for (int i = 0; i < 5; i++) {
      clusters.add(new Cluster(new PVector(random(width), random(height))));
    }
  }

  // update and display particles
  for (Particle p : particles) {
    PVector flow = computeFlow(p.pos);
    p.applyForce(flow);
    p.update();
    p.display();
  }

  // display clusters with soft glow
  for (Cluster c : clusters) {
    c.display();
  }
}

PVector computeFlow(PVector pos) {
  float angle = noise(pos.x * 0.005, pos.y * 0.005, frameCount * 0.002) * TWO_PI * 2;
  PVector v = PVector.fromAngle(angle).mult(0.5);
  Cluster nearest = null;
  float minDist = Float.MAX_VALUE;
  for (Cluster c : clusters) {
    float d = PVector.dist(pos, c.center);
    if (d < minDist) { minDist = d; nearest = c; }
  }
  if (nearest != null && minDist < nearest.influenceRadius) {
    PVector pull = PVector.sub(nearest.center, pos).normalize().mult(0.3);
    v.add(pull);
  }
  return v;
}

class Particle {
  PVector pos, vel;
  float hue;
  Particle() {
    pos = new PVector(random(width), random(height));
    vel = new PVector(0, 0);
    hue = random(150, 260);
  }
  void applyForce(PVector f) { vel.add(f); vel.limit(2); }
  void update() { pos.add(vel); wrap(); }
  void wrap() {
    if (pos.x < 0) pos.x = width;
    if (pos.x > width) pos.x = 0;
    if (pos.y < 0) pos.y = height;
    if (pos.y > height) pos.y = 0;
  }
  void display() {
    stroke(hue, 60, 100, 40);
    strokeWeight(1);
    point(pos.x, pos.y);
  }
}

class Cluster {
  PVector center;
  float baseHue;
  float influenceRadius;
  float glowRadius;
  Cluster(PVector c) {
    center = c;
    baseHue = random(180, 260);
    influenceRadius = random(100, 200);
    glowRadius = influenceRadius * 0.6;
  }
  void display() {
    pushStyle();
    blendMode(ADD);
    int rings = 8;
    for (int i = rings; i > 0; i--) {
      float f = float(i) / rings;
      float alpha = f * 15;
      float r = glowRadius * f;
      noFill();
      stroke(baseHue, 70, 100, alpha);
      strokeWeight(2);
      ellipse(center.x, center.y, r * 2, r * 2);
    }
    popStyle();
  }
}
