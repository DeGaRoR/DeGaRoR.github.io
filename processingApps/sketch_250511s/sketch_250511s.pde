int numEntities = 10;
ArrayList<Bloom> blooms;

void setup() {
  size(800, 800);
  frameRate(30);
  blooms = new ArrayList<Bloom>();
  
  // Create initial entities with random positions and colors
  for (int i = 0; i < numEntities; i++) {
    blooms.add(new Bloom(random(width), random(height)));
  }
}

void draw() {
  background(255, 20);  // Create a fading effect for the background

  // Interactions and movement of entities
  for (Bloom a : blooms) {
    a.update();
    a.display();
    for (Bloom b : blooms) {
      if (a != b) {
        a.interact(b);
      }
    }
  }
}

class Bloom {
  PVector pos, vel;
  float alpha = 255;
  color c;
  ArrayList<PVector> points;
  float size = 20;
  boolean isDead = false;
  float[] signature;  // Added signature to represent an entity's "character"
  
  Bloom(float x, float y) {
    pos = new PVector(x, y);
    vel = PVector.random2D().mult(2);
    c = color(random(255), random(255), random(255), 255);
    signature = new float[] {random(1), random(1), random(1)};  // Random signature (a "type" of entity)
    
    points = new ArrayList<PVector>();
    points.add(pos);
  }
  
  void update() {
    // Basic movement
    pos.add(vel);
    
    // Wrap around the screen
    if (pos.x > width) pos.x = 0;
    if (pos.x < 0) pos.x = width;
    if (pos.y > height) pos.y = 0;
    if (pos.y < 0) pos.y = height;

    // Fade out slowly
    if (alpha > 20) {
      alpha -= 0.5;
    } else {
      alpha = 20;
    }
    
    // Slowly shrink when fading
    if (alpha < 30) {
      size *= 0.98;
    }
    
    // Generate points for curve drawing
    points.add(PVector.add(pos, PVector.random2D().mult(5)));
    if (points.size() > 30) {
      points.remove(0);
    }
  }
  
  void display() {
    fill(c, alpha);
    noStroke();
    beginShape();
    for (PVector p : points) {
      curveVertex(p.x, p.y);
    }
    endShape(CLOSE);
  }
  
  void interact(Bloom b) {
    float d = dist(pos.x, pos.y, b.pos.x, b.pos.y);
    
    // Merge if close and share similar colors
    if (d < 50 && !isDead && !b.isDead) {
      float similarity = dist(red(c), green(c), blue(c), red(b.c), green(b.c), blue(b.c));
      
      if (similarity < 150) {
        // Move towards each other
        PVector mid = PVector.lerp(pos, b.pos, 0.5);
        vel.lerp(PVector.sub(mid, pos).normalize().mult(0.5), 0.05);
        
        // Gradually merge colors
        c = lerpColor(c, b.c, 0.02);
        b.c = lerpColor(b.c, c, 0.02);
      }
    } 
    
    // Repel if too far and have different colors
    if (d < 150 && similarityCheck(c, b.c)) {
      PVector force = PVector.sub(pos, b.pos);
      force.normalize();
      force.mult(0.5);
      vel.add(force);
      b.vel.sub(force);
      alpha -= 0.5;
      b.alpha -= 0.5;
    }
  }

  boolean similarityCheck(color c1, color c2) {
    // Simple check for "opposite" color
    return dist(red(c1), green(c1), blue(c1), red(c2), green(c2), blue(c2)) > 150;
  }
}
