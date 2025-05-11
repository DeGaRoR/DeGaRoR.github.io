/*
 * Organic Reflections: An Evolving Digital Garden
 *
 * This sketch visualizes the idea of fluid, organic forms that shift and interact—
 * echoing the subtle interplay of thoughts and the transformative power of language.
 * 
 * Rather than showing overt networks or explicit code structures, the animation uses
 * softly drawn, morphing blobs to represent the emergent beauty of creative thought.
 * Each blob drifts, deforms, and overlaps with its neighbors, reflecting the ephemeral
 * and interconnected nature of ideas.
 *
 * Enjoy this meditative glimpse into an ever-changing digital landscape!
 */

int numBlobs = 5;             // Number of organic forms
Blob[] blobs = new Blob[numBlobs];

void setup() {
  size(800, 800);
  smooth();
  // Initialize each blob with random position, size, and noise offsets.
  for (int i = 0; i < numBlobs; i++){
    float x = random(width);
    float y = random(height);
    float r = random(60, 120);
    blobs[i] = new Blob(x, y, r);
  }
  // Use a dark background for contrast.
  background(10);
}

void draw() {
  // Overlay a translucent rectangle to create gentle trails and fading
  noStroke();
  fill(10, 10, 10, 20);
  rect(0, 0, width, height);
  
  // Update and draw each blob.
  for (Blob b : blobs){
    b.update();
    b.display();
  }
}

// The Blob class defines an organic, morphing shape.
class Blob {
  PVector pos;          // Position of the blob
  float baseRadius;     // Average radius for the blob's shape
  float noiseOffset;    // Unique noise offset for shape modulation
  float angleOffset;    // A constant phase shift for variation
  color col;            // Color of the blob
  
  Blob(float x, float y, float r) {
    pos = new PVector(x, y);
    baseRadius = r;
    noiseOffset = random(1000);
    angleOffset = random(TWO_PI);
    // Choose a soft, pastel color with some transparency.
    col = color(random(80, 255), random(80, 255), random(80, 255), 150);
  }
  
  // Update the blob's position with gentle, noise-based drifting.
  void update() {
    float driftSpeed = 1.0;
    pos.x += map(noise(noiseOffset, millis() * 0.0002), 0, 1, -driftSpeed, driftSpeed);
    pos.y += map(noise(noiseOffset + 100, millis() * 0.0002), 0, 1, -driftSpeed, driftSpeed);
    
    // Wrap around the canvas so blobs never disappear.
    if (pos.x < -baseRadius) pos.x = width + baseRadius;
    if (pos.x > width + baseRadius) pos.x = -baseRadius;
    if (pos.y < -baseRadius) pos.y = height + baseRadius;
    if (pos.y > height + baseRadius) pos.y = -baseRadius;
  }
  
  // Display the blob as a softly curving, noise-modulated shape.
  void display() {
    noFill();
    stroke(col);
    strokeWeight(2);
    beginShape();
    int numPoints = 100; // More points yield a smoother shape.
    for (int i = 0; i < numPoints; i++){
      float angle = map(i, 0, numPoints, 0, TWO_PI);
      // Use Perlin noise to modulate the radius at each vertex.
      float noiseFactor = noise(cos(angle) + 1, sin(angle) + 1, millis() * 0.0005 + noiseOffset);
      float r = baseRadius + map(noiseFactor, 0, 1, -baseRadius * 0.3, baseRadius * 0.3);
      float x = pos.x + r * cos(angle + angleOffset);
      float y = pos.y + r * sin(angle + angleOffset);
      curveVertex(x, y);
    }
    endShape(CLOSE);
  }
}
