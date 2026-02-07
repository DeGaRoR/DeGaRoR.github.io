ArrayList<Agent> agents;
int numAgents = 500;
float connectionDistance = 100;

void setup() {
  size(1000, 1000);
  smooth();
  agents = new ArrayList<Agent>();
  for (int i = 0; i < numAgents; i++) {
    agents.add(new Agent());
  }
  background(10);
}

void draw() {
  // Fade previous frame slightly — acts like memory decay
  fill(10, 10, 10, 15); // Very transparent black
  noStroke();
  rect(0, 0, width, height);

  drawChaosLayer();
  drawConnectionLayer();

  for (Agent a : agents) {
    a.update();
    a.displayTrail();
  }
}

void drawChaosLayer() {
  stroke(255, 10);
  strokeWeight(0.2);

  for (Agent a : agents) {
    for (int i = 0; i < 3; i++) {
      float angle = noise(a.pos.x * 0.01, a.pos.y * 0.01, frameCount * 0.01 + i) * TWO_PI * 2;
      float r = random(3, 15);
      float x1 = a.pos.x + cos(angle) * r;
      float y1 = a.pos.y + sin(angle) * r;
      float x2 = x1 + cos(angle + PI/4) * 5;
      float y2 = y1 + sin(angle + PI/4) * 5;
      line(x1, y1, x2, y2);
    }
  }
}


void drawConnectionLayer() {
  stroke(255, 40);
  for (int i = 0; i < agents.size(); i++) {
    for (int j = i + 1; j < agents.size(); j++) {
      Agent a = agents.get(i);
      Agent b = agents.get(j);
      float d = dist(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
      if (d < connectionDistance) {
        strokeWeight(map(d, 0, connectionDistance, 1.5, 0.05));
        line(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
      }
    }
  }
}

class Agent {
  PVector pos, vel, acc;
  ArrayList<PVector> trail;

  Agent() {
    pos = new PVector(random(width), random(height));
    vel = PVector.random2D().mult(random(0.5, 1.5));
    acc = new PVector();
    trail = new ArrayList<PVector>();
  }

  void update() {
    // Slight unpredictable acceleration
    acc.add(PVector.random2D().mult(0.03));
    vel.add(acc);
    vel.limit(2.5);
    pos.add(vel);
    acc.mult(0);

    // Keep a trail of last positions
    trail.add(pos.copy());
    if (trail.size() > 80) {
      trail.remove(0);
    }

    // Wrap around screen
    if (pos.x < 0) pos.x += width;
    if (pos.y < 0) pos.y += height;
    if (pos.x > width) pos.x -= width;
    if (pos.y > height) pos.y -= height;
  }

  void displayTrail() {
    noFill();
    stroke(255, 70);
    strokeWeight(1);
    beginShape();
    for (int i = 0; i < trail.size(); i++) {
      PVector p = trail.get(i);
      curveVertex(p.x, p.y);
    }
    endShape();
  }
}
