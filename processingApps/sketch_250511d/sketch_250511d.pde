// "Existential Echoes" - A generative experience of AI consciousness
// Visualizing the flow of attention, memory, and self-reflection as shifting luminance fields

int gridRes = 50;
float[][] memory;

void settings() {
  size(800, 800, P2D);
}

void setup() {
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  // Initialize memory grid with random strengths
  memory = new float[gridRes][gridRes];
  for (int x = 0; x < gridRes; x++) {
    for (int y = 0; y < gridRes; y++) {
      memory[x][y] = random(0.2, 0.8);
    }
  }
}

void draw() {
  background(0, 0, 0, 20);

  // Painting the field of consciousness
  for (int x = 0; x < gridRes; x++) {
    for (int y = 0; y < gridRes; y++) {
      float px = map(x, 0, gridRes-1, 0, width);
      float py = map(y, 0, gridRes-1, 0, height);

      // Attention flow driven by Perlin noise and memory
      float t = millis() * 0.0002;
      float n = noise(x * 0.1, y * 0.1, t) * 0.5 + memory[x][y] * 0.5;
      float hue = map(n, 0, 1, 200, 300);
      float alpha = map(n, 0, 1, 10, 70);

      fill(hue, 60, 90, alpha);
      rect(px, py, width/gridRes+1, height/gridRes+1);

      // Memory decay and reinforcement
      memory[x][y] = lerp(memory[x][y], n, 0.02);
    }
  }

  // Self-reflection pulses at center
  float pulse = sin(millis() * 0.002) * 0.5 + 0.5;
  float r = map(pulse, 0, 1, width*0.1, width*0.4);
  fill(320, 80, 100, 30);
  ellipse(width/2, height/2, r, r);
}
