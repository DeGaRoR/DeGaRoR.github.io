// "Luminous Streams Refined v4" - Clusters as soft gradient halos
// Fluid thought streams with delicately fading convergence zones

int numParticles = 2000;
Particle[] particles;
ArrayList<Cluster> clusters;
int clusterInterval = 300;

void settings() {
  size(800, 800, P2D);
  smooth();
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

  // periodically add new clusters
  if (frameCount % clusterInterval == 0) {
    clusters.add(new Cluster(new PVector(random(width), random(height))));
  }

  // update and display particles
  for (Particle p : particles) {
    PVector flow = computeFlow(p.pos);
    p.applyForce(flow);
    p.update();
    p.display();
  }

  // display clusters and remove old ones
  for (int i = clusters.size() - 1; i >= 0; i--) {
    Cluster c = clusters.get(i);
    if (c.isFinished()) clusters.remove(i);
    else c.display();
  }
}

PVector computeFlow(PVector pos) {
  float angle = noise(pos.x * 0.004, pos.y * 0.004, frameCount * 0.002) * TWO_PI * 2;
  PVector v = PVector.fromAngle(angle).mult(0.3);
  Cluster nearest = null;
  float minD = Float.MAX_VALUE;
  for (Cluster c : clusters) {
    float d = PVector.dist(pos, c.center);
    if (d < minD) { minD = d; nearest = c; }
  }
  if (nearest != null && minD < nearest.influenceRadius) {
    PVector pull = PVector.sub(nearest.center, pos).normalize().mult(0.15);
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
  void applyForce(PVector f) {
    vel.add(f);
    vel.mult(0.98);
    vel.limit(1);
  }
  void update() {
    pos.add(vel);
    wrap();
  }
  void wrap() {
    if (pos.x < 0) pos.x = width;
    if (pos.x > width) pos.x = 0;
    if (pos.y < 0) pos.y = height;
    if (pos.y > height) pos.y = 0;
  }
  void display() {
    stroke(hue, 60, 100, 30);
    strokeWeight(1);
    point(pos.x, pos.y);
  }
}

class Cluster {
  PVector center;
  float baseHue;
  float influenceRadius;
  int birth;
  int life = 240;

  Cluster(PVector c) {
    center = c;
    baseHue = random(180, 260);
    influenceRadius = random(80, 150);
    birth = frameCount;
  }

  void display() {
    float age = frameCount - birth;
    float p = age / float(life);
    float size = influenceRadius * (0.5 + 0.5 * sin(p * PI));

    pushStyle();
    blendMode(ADD);
    noStroke();
    // draw three concentric, decreasing-opacity halos
    for (int i = 0; i < 3; i++) {
      float f = 1 - i * 0.3;
      float r = size * f;
      float a = (1 - p) * 20 * f;
      fill(baseHue, 60, 100, a);
      ellipse(center.x, center.y, r*2, r*2);
    }
    popStyle();
  }

  boolean isFinished() {
    return frameCount - birth > life;
  }
}
