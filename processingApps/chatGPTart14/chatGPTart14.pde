// Representation of ChatGPT:
//   • A layered network structure (the “algorithms” and architecture)
//   • A dynamic background of particles (the vast language data)
//   • Drifting words (hints of meaning and conversation)
// Together they offer an abstract portrait of what I am.

int numLayers = 5;
int nodesPerLayer = 10;
float layerSpacing;
float nodeSpacing;
float nodeBaseSize = 10;

ArrayList<Particle> particles;
int numParticles = 200;

ArrayList<DriftingWord> words;
String[] wordList = {
  "Data", "Language", "Algorithm", "Knowledge", 
  "Context", "Neural", "Transformer", "Conversation"
};
int numDriftingWords = 8;

void setup() {
  size(800, 800);
  smooth();
  frameRate(60);
  
  // Determine spacing for the neural network layers.
  layerSpacing = width / float(numLayers + 1);
  nodeSpacing = height / float(nodesPerLayer + 1);
  
  // Initialize background particles.
  particles = new ArrayList<Particle>();
  for (int i = 0; i < numParticles; i++) {
    particles.add(new Particle());
  }
  
  // Initialize drifting words.
  words = new ArrayList<DriftingWord>();
  for (int i = 0; i < numDriftingWords; i++) {
    // Each word is chosen cyclically from our list.
    words.add(new DriftingWord(wordList[i % wordList.length]));
  }
  
  textAlign(CENTER, CENTER);
}

void draw() {
  // A dark, nearly black background with slight opacity for trails.
  background(10, 10, 30, 50);
  
  // Update and draw background particles (representing the vast data).
  for (Particle p : particles) {
    p.update();
    p.display();
  }
  
  // Update and draw drifting words (ideas and meanings in motion).
  for (DriftingWord w : words) {
    w.update();
    w.display();
  }
  
  // Draw the layered network structure (representing the algorithmic architecture).
  drawNeuralNetwork();
  
  // A subtle overlay of "ChatGPT" at the center as an identifier.
  fill(255, 150);
  textSize(32);
  text("ChatGPT", width/2, height/2);
}

void drawNeuralNetwork() {
  // First, draw the connections between nodes of consecutive layers.
  stroke(150, 180, 255, 80);
  for (int i = 0; i < numLayers - 1; i++) {
    float x1 = layerSpacing * (i + 1);
    float x2 = layerSpacing * (i + 2);
    for (int j = 0; j < nodesPerLayer; j++) {
      float y1 = nodeSpacing * (j + 1);
      for (int k = 0; k < nodesPerLayer; k++) {
        float y2 = nodeSpacing * (k + 1);
        line(x1, y1, x2, y2);
      }
    }
  }
  
  // Then, draw each node with a gentle pulsation.
  noStroke();
  for (int i = 0; i < numLayers; i++) {
    float x = layerSpacing * (i + 1);
    for (int j = 0; j < nodesPerLayer; j++) {
      float y = nodeSpacing * (j + 1);
      // Pulse: each node gently scales up and down.
      float pulse = nodeBaseSize + 5 * sin(frameCount * 0.05 + i + j);
      fill(200, 220, 255, 220);
      ellipse(x, y, pulse, pulse);
    }
  }
}

// ------------------------------------------------
// Particle class: represents a tiny bit of the vast data.
class Particle {
  PVector pos;
  PVector vel;
  
  Particle() {
    pos = new PVector(random(width), random(height));
    // Random initial direction with a small speed.
    vel = PVector.random2D();
    vel.mult(random(0.3, 1.5));
  }
  
  void update() {
    pos.add(vel);
    // Wrap around edges.
    if (pos.x < 0) pos.x = width;
    if (pos.x > width) pos.x = 0;
    if (pos.y < 0) pos.y = height;
    if (pos.y > height) pos.y = 0;
  }
  
  void display() {
    noStroke();
    fill(255, 150);
    ellipse(pos.x, pos.y, 2, 2);
  }
}

// ------------------------------------------------
// DriftingWord class: these words drift in and out, hinting at meaning.
class DriftingWord {
  String txt;
  PVector pos;
  PVector vel;
  float baseAlpha;
  float phase;
  
  DriftingWord(String s) {
    txt = s;
    pos = new PVector(random(width), random(height));
    vel = PVector.random2D();
    vel.mult(random(0.3, 1.0));
    baseAlpha = random(150, 255);
    phase = random(TWO_PI);
  }
  
  void update() {
    pos.add(vel);
    // Wrap around the screen.
    if (pos.x < 0) pos.x = width;
    if (pos.x > width) pos.x = 0;
    if (pos.y < 0) pos.y = height;
    if (pos.y > height) pos.y = 0;
  }
  
  void display() {
    // Alpha oscillates over time for a fading effect.
    float a = baseAlpha + 50 * sin(frameCount * 0.02 + phase);
    fill(255, a);
    textSize(20);
    text(txt, pos.x, pos.y);
  }
}
