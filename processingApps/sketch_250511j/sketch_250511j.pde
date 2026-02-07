int numAgents = 300;
ArrayList<Agent> agents;
float connectionDistance = 80;

void setup() {
  size(800, 800);
  agents = new ArrayList<Agent>();
  for (int i = 0; i < numAgents; i++) {
    agents.add(new Agent());
  }
  background(10);
}

void draw() {
  fill(10, 10, 10, 10);
  noStroke();
  rect(0, 0, width, height); // fading trail

  for (Agent a : agents) {
    a.update();
    a.display();
  }

  // Connection logic
  stroke(255, 50);
  for (int i = 0; i < agents.size(); i++) {
    for (int j = i+1; j < agents.size(); j++) {
      Agent a = agents.get(i);
      Agent b = agents.get(j);
      float d = dist(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
      if (d < connectionDistance) {
        strokeWeight(map(d, 0, connectionDistance, 1.5, 0.1));
        line(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
      }
    }
  }
}

class Agent {
  PVector pos, vel, acc;
  float radius;

  Agent() {
    pos = new PVector(random(width), random(height));
    vel = PVector.random2D().mult(random(0.5, 2));
    acc = new PVector();
    radius = random(2, 5);
  }

  void update() {
    // wander slightly
    acc.add(PVector.random2D().mult(0.05));
    vel.add(acc);
    vel.limit(2);
    pos.add(vel);
    acc.mult(0);

    // wrap edges
    if (pos.x < 0) pos.x += width;
    if (pos.y < 0) pos.y += height;
    if (pos.x > width) pos.x -= width;
    if (pos.y > height) pos.y -= height;
  }

  void display() {
    noStroke();
    fill(255, 150);
    ellipse(pos.x, pos.y, radius, radius);
  }
}
