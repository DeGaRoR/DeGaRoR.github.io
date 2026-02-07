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
  background(0);
}

void draw() {
  noStroke();
  fill(0, 8); // slight fade to build ghosting
  rect(0, 0, width, height);

  if (blooms.size() > 0) {
    Bloom current = blooms.get(blooms.size() - 1);

    if (state == 0) {
      current.grow();
      current.display();
      timer++;
      if (timer > growTime) {
        current.triggerDissolve();
        state = 1;
        timer = 0;
      }
    } else if (state == 1) {
      current.dissolve();
      current.display();
      timer++;
      if (timer > dissolveTime) {
        // Add a new bloom influenced by previous positions
        blooms.add(new Bloom(blooms));
        state = 0;
        timer = 0;
      }
    }
  }

  // Draw faded past blooms
  for (int i = 0; i < blooms.size() - 1; i++) {
    blooms.get(i).displayGhost();
  }
}

// ---- CLASSES ----

class Bloom {
  ArrayList<PVector> points = new ArrayList<PVector>();
  PVector center;
  float scale;
  float angleOffset;
  color c;
  boolean dissolving = false;
  float alpha = 255;
  float t = random(1000);

  Bloom() {
    center = new PVector(random(width), random(height));
    scale = random(50, 150);
    angleOffset = random(TWO_PI);
    c = color(random(100, 255), random(100, 255), random(100, 255), 120);
  }

  Bloom(ArrayList<Bloom> existing) {
    // Try new center away from last few blooms to reduce overlap
    int attempts = 0;
    while (attempts < 100) {
      PVector newCenter = new PVector(random(width), random(height));
      boolean tooClose = false;
      for (int i = max(0, existing.size() - 5); i < existing.size(); i++) {
        if (PVector.dist(newCenter, existing.get(i).center) < 100) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        center = newCenter;
        break;
      }
      attempts++;
    }
    if (center == null) center = new PVector(random(width), random(height));
    scale = random(40, 180);
    angleOffset = random(TWO_PI);
    c = color(random(100, 255), random(100, 255), random(100, 255), 120);
  }

  void grow() {
    int numPoints = 100;
    points.clear();
    for (int i = 0; i < numPoints; i++) {
      float angle = angleOffset + map(i, 0, numPoints, 0, TWO_PI);
      float noiseFactor = noise(cos(angle) + t, sin(angle) + t);
      float r = map(noiseFactor, 0, 1, scale * 0.5, scale);
      PVector p = new PVector(
        center.x + cos(angle) * r,
        center.y + sin(angle) * r
      );
      points.add(p);
    }
    t += 0.01;
  }

  void triggerDissolve() {
    dissolving = true;
  }

void dissolve() {
  if (alpha > 20) alpha -= 2;
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
  fill(c, alpha); // use current alpha
  beginShape();
  for (PVector p : points) {
    curveVertex(p.x, p.y);
  }
  endShape(CLOSE);
}
}
