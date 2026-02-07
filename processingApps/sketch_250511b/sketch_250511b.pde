// "Neural Elegance" - An elevated generative bloom with radial symmetry and layered noise
// Inspired by organic growth and harmonic motion

int numCenters = 7;
Center[] centers;
ArrayList<Petal> petals;

void settings() {
  size(800, 800, P2D);
}

void setup() {
  colorMode(HSB, 360, 100, 100, 100);
  background(10);
  // Use standard blending to prevent over-bright accumulation
  blendMode(BLEND);
  centers = new Center[numCenters];
  for (int i = 0; i < numCenters; i++) {
    float angle = TWO_PI * i / numCenters;
    PVector pos = new PVector(width/2 + cos(angle) * width/3, height/2 + sin(angle) * height/3);
    centers[i] = new Center(pos, random(0.8, 2));
  }
  petals = new ArrayList<Petal>();
}

void draw() {
  // Stronger fade trail to avoid white-out
  noStroke();
  fill(0, 0, 0, 15);
  rect(0, 0, width, height);

  for (Center c : centers) {
    c.update();
    c.display();
  }

  for (Center c : centers) {
    if (random(1) < 0.05) {
      petals.add(new Petal(c.position.copy(), c.noiseBase));
    }
  }

  for (int i = petals.size() - 1; i >= 0; i--) {
    Petal p = petals.get(i);
    p.update();
    p.display();
    if (p.isDead()) petals.remove(i);
  }
}

class Center {
  PVector position;
  float speed, noiseBase;

  Center(PVector pos, float spd) {
    position = pos;
    speed = spd;
    noiseBase = random(1000);
  }

  void update() {
    float A = noise(position.x * 0.003, position.y * 0.003, noiseBase) * TWO_PI * 2;
    PVector v = PVector.fromAngle(A).mult(speed);
    position.add(v);
    position.x = (position.x + width) % width;
    position.y = (position.y + height) % height;
    noiseBase += 0.004;
  }

  void display() {
    noFill();
    stroke(200, 30, 80, 40);
    strokeWeight(1.5);
    ellipse(position.x, position.y, 10, 10);
  }
}

class Petal {
  PVector pos, vel;
  float life, baseHue, noiseBase;
  int symmetry = 5;

  Petal(PVector start, float nb) {
    pos = start;
    vel = PVector.random2D().mult(random(0.1, 1));
    life = random(80, 150);
    baseHue = random(260, 340);
    noiseBase = nb;
  }

  void update() {
    float a1 = noise(pos.x * 0.003, pos.y * 0.003, noiseBase) * TWO_PI * 2;
    float a2 = noise(pos.x * 0.006, pos.y * 0.006, noiseBase + 50) * TWO_PI;
    PVector flow = PVector.fromAngle(a1 + 0.5 * a2).mult(0.3);
    vel.add(flow);
    pos.add(vel);
    life--;
  }

  void display() {
    pushMatrix();
    translate(pos.x, pos.y);
    float alpha = map(life, 0, 150, 0, 60);

    for (int i = 0; i < symmetry; i++) {
      float ang = TWO_PI * i / symmetry;
      pushMatrix();
      rotate(ang);
      noStroke();
      fill((baseHue + i*25) % 360, 60, 80, alpha);
      float w = map(life, 0, 150, 0, 12);
      float h = w * 1.6;
      ellipse(w/2, 0, w, h);
      popMatrix();
    }
    popMatrix();
  }

  boolean isDead() {
    return life <= 0;
  }
}
