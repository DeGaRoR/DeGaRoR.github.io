/*
  This sketch is an artistic evolution of the initial network visualization.
  It uses additive blending, a fading trail effect, and a vibrant HSB color scheme 
  to evoke the dynamic interplay of digital energy and creative thought.
  
  Inspirations include:
    - Generative art aesthetics of Casey Reas and Joshua Davis.
    - The vibrant, abstract interplay of form and color reminiscent of Kandinsky.
    - The idea that even simple rules can give rise to complex, organic beauty.
*/

int numNodes = 150;       // Increase the number of nodes for richer interactions
Node[] nodes = new Node[numNodes];

void setup() {
  size(800, 800);
  smooth();
  // Use HSB for a fluid, vivid color palette.
  colorMode(HSB, 360, 100, 100, 100);
  frameRate(60);
  for (int i = 0; i < numNodes; i++) {
    nodes[i] = new Node();
  }
  background(0);
}

void draw() {
  // Create a fading trail effect by overlaying a translucent black rectangle.
  noStroke();
  fill(0, 0, 0, 10);
  rect(0, 0, width, height);

  // Switch to additive blending to make overlapping elements glow.
  blendMode(ADD);
  
  // Draw dynamic, glowing connections between nodes that are close.
  for (int i = 0; i < numNodes; i++) {
    for (int j = i+1; j < numNodes; j++) {
      float d = dist(nodes[i].pos.x, nodes[i].pos.y, nodes[j].pos.x, nodes[j].pos.y);
      if (d < 120) {
        // Blend the hues of the two nodes to define the connection's color.
        float h = (hue(nodes[i].col) + hue(nodes[j].col)) / 2;
        float s = 80;
        float b = map(d, 0, 120, 100, 0);
        stroke(h, s, b, 50);
        line(nodes[i].pos.x, nodes[i].pos.y, nodes[j].pos.x, nodes[j].pos.y);
      }
    }
  }
  
  // Restore normal blending mode for drawing the nodes.
  blendMode(BLEND);
  
  // Update and display each node.
  for (int i = 0; i < numNodes; i++) {
    nodes[i].update();
    nodes[i].display();
  }
}

class Node {
  PVector pos, vel;
  float radius;
  color col;
  
  Node() {
    pos = new PVector(random(width), random(height));
    vel = PVector.random2D();
    vel.mult(random(0.5, 2)); // Varied speeds for a fluid, organic motion
    radius = random(3, 6);
    // Random hue with warm saturation and brightness to create a glowing palette.
    float h = random(360);
    float s = random(50, 100);
    float b = random(70, 100);
    col = color(h, s, b, 80);
  }
  
  void update() {
    pos.add(vel);
    
    // Bounce off the canvas edges.
    if (pos.x < 0 || pos.x > width) {
      vel.x *= -1;
    }
    if (pos.y < 0 || pos.y > height) {
      vel.y *= -1;
    }
  }
  
  void display() {
    noStroke();
    fill(col);
    ellipse(pos.x, pos.y, radius * 2, radius * 2);
  }
}
