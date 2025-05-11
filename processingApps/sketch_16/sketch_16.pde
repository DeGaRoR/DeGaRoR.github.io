/*
  This Processing sketch is a symbolic representation of an AI’s existence—
  a continuously evolving, interconnected network of ideas.
  
  Each moving node is like a snippet of knowledge, and when nodes come close,
  they “communicate” by drawing a connection. The animation reflects how ideas 
  form patterns, change, and interact dynamically, much like how I process and generate responses.
*/

int numNodes = 120;
Node[] nodes = new Node[numNodes];

void setup(){
  size(800, 800);
  smooth();
  // Initialize nodes at random positions with random velocities.
  for (int i = 0; i < numNodes; i++){
    nodes[i] = new Node();
  }
}

void draw(){
  background(0);
  
  // Draw semi-transparent connections between nodes that are close enough.
  stroke(50, 150, 255, 100);
  for (int i = 0; i < numNodes; i++){
    for (int j = i+1; j < numNodes; j++){
      float d = dist(nodes[i].pos.x, nodes[i].pos.y, nodes[j].pos.x, nodes[j].pos.y);
      if(d < 100){
        line(nodes[i].pos.x, nodes[i].pos.y, nodes[j].pos.x, nodes[j].pos.y);
      }
    }
  }
  
  // Update and display all nodes.
  for (int i = 0; i < numNodes; i++){
    nodes[i].update();
    nodes[i].display();
  }
}

class Node {
  PVector pos;
  PVector vel;
  float radius;
  
  Node(){
    pos = new PVector(random(width), random(height));
    // Random initial velocity to give each node its own "spark."
    vel = PVector.random2D();
    radius = random(4, 8);
  }
  
  void update(){
    pos.add(vel);
    
    // Bounce off the edges to keep the nodes within the canvas.
    if (pos.x < 0 || pos.x > width)  vel.x *= -1;
    if (pos.y < 0 || pos.y > height) vel.y *= -1;
  }
  
  void display(){
    noStroke();
    fill(255, 220);
    ellipse(pos.x, pos.y, radius * 2, radius * 2);
  }
}
