ArrayList<Bloom> blooms;
int state = 0;
int timer = 0;
int growTime = 300;
int dissolveTime = 200;

void setup() {
  size(800, 800);
  frameRate(30);
  smooth();
  blooms = new ArrayList<Bloom>();
  blooms.add(new Bloom());
}

void draw() {
  noStroke();
  fill(0, 10); // fade slightly
  rect(0, 0, width, height);

  if (state == 0) {
    Bloom current = blooms.get(blooms.size() - 1);
    current.grow();
    current.display();
    timer++;
    if (timer > growTime) {
      current.triggerDissolve();
      state = 1;
      timer = 0;
    }
  } else if (state == 1) {
    Bloom current = blooms.get(blooms.size() - 1);
    current.dissolve();
    current.display();
    timer++;
    if (timer > dissolveTime) {
      blooms.add(new Bloom());
      state = 0;
      timer = 0;
    }
  }

  // Show all previous with transparency
  for (int i = 0; i < blooms.size() - 1; i++) {
    blooms.get(i).displayGhost();
  }
}

// ---- CLASSES ----

class Bloom {
  ArrayList<PVector> points = new ArrayList<PVector>();
  ArrayList<Float> radii = new ArrayList<Float>();
  PVector center;
  float angleOffset;
  color c;
  boolean dissolving = false;
  float alpha = 255;
  float t = random(1000);

  Bloom() {
    center = new PVector(width/2 + random(-100, 100), height/2 + random(-100, 100));
    angleOffset = random(TWO_PI);
    c = color(random(100, 255), random(100, 255), random(100, 255), 100);
  }

  void grow() {
    int numPoints = 100;
    points.clear();
    radii.clear();
    for (int i = 0; i < numPoints; i++) {
      float angle = angleOffset + map(i, 0, numPoints, 0, TWO_PI);
      float noiseFactor = noise(cos(angle)*0.8 + t, sin(angle)*0.8 + t);
      float r = map(noiseFactor, 0, 1, 50, 150);
      PVector p = new PVector(
        center.x + cos(angle) * r,
        center.y + sin(angle) * r
      );
      points.add(p);
      radii.add(r);
    }
    t += 0.01;
  }

  void triggerDissolve() {
    dissolving = true;
  }

  void dissolve() {
    if (alpha > 0) {
      alpha -= 2;
    }
  }

  void display() {
    fill(c, alpha);
    beginShape();
    for (PVector p : points) {
      curveVertex(p.x, p.y);
    }
    endShape(CLOSE);
  }

  void displayGhost() {
    fill(c, 20);
    beginShape();
    for (PVector p : points) {
      curveVertex(p.x, p.y);
    }
    endShape(CLOSE);
  }
}
