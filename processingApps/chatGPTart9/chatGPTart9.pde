// Tweakable parameters
int numParticles = 500;         // Number of particles
float baseParticleSize = 4.0;   // Base size of each particle
float speed = 1.2;              // Reduced speed of particle movement for thicker trails
float attractionStrength = 0.01; // Attraction towards the center
float repulsionStrength = 0.1;  // Repulsion force between particles
float forceFactor = 1.5;        // Factor for the effect of forces
float trailLength = 100;        // Maximum length of the particle trail
float backgroundAlpha = 10;     // Background fading alpha
float noiseStrength = 0.02;     // Noise applied to movement
boolean interactive = true;     // Toggle interaction with mouse

ArrayList<Particle> particles;
float maskOffsetX = 0;          // Horizontal offset for color mask animation
float maskOffsetY = 0;          // Vertical offset for color mask animation

void setup() {
  size(800, 800);
  noStroke();
  smooth();
  particles = new ArrayList<Particle>();
  // Create particles at random positions
  for (int i = 0; i < numParticles; i++) {
    particles.add(new Particle(random(width), random(height)));
  }
}

void draw() {
  // Draw the background without the color mask
  background(0, backgroundAlpha);

  // Update the color mask to morph it faster
  updateColorMask();

  // Temporary list to hold new trail particles
  ArrayList<Particle> newParticles = new ArrayList<Particle>();

  // Update and display each particle
  for (Particle p : particles) {
    p.applyForces();
    p.update();
    p.display();

    // Add trail particles to the temporary list
    if (p.isTrailParticle) {
      newParticles.add(p);
    }
  }

  // Add all new trail particles to the main list after the loop is done
  particles.addAll(newParticles);
}

// Function to apply the evolving color mask to the particle
int applyColorMask(float x, float y) {
  float maskX = (x + maskOffsetX) / width;
  float maskY = (y + maskOffsetY) / height;

  // Using a warm, smooth palette with subtle transitions
  float r = (sin(maskX * TWO_PI + maskOffsetX * 0.1) * 60 + 180) + (sin(maskY * TWO_PI + maskOffsetY * 0.1) * 30);
  float g = (cos(maskY * TWO_PI + maskOffsetY * 0.2) * 40 + 140) + (cos(maskX * TWO_PI + maskOffsetX * 0.15) * 40);
  float b = (sin(maskX * TWO_PI + maskOffsetY * 0.3) * 40 + 100) + (cos(maskY * TWO_PI + maskOffsetX * 0.25) * 20);

  // Keeping the values within range, but leaning towards warm tones
  r = constrain(r, 0, 255);
  g = constrain(g, 50, 180); // Slightly toned-down green for balance
  b = constrain(b, 50, 150); // Softer blues

  return color(r, g, b, 150); // Soft colors for particle interaction
}

// Particle class definition
class Particle {
  PVector position;
  PVector velocity;
  PVector acceleration;
  int col; // Use int type for color (initial particle color)
  ArrayList<PVector> trail;
  float sizeFactor = 1.0; // Dynamically adjusted size factor
  float trailAge = 0;     // Age of the trail (used to manage fading)
  boolean isTrailParticle; // Flag to distinguish trail particles from the parent

  Particle(float x, float y) {
    position = new PVector(x, y);
    velocity = PVector.fromAngle(PI / 4); // All particles move in the same general direction
    velocity.mult(speed);
    acceleration = new PVector(0, 0);
    col = applyColorMask(x, y); // Store initial color when the particle is created
    trail = new ArrayList<PVector>();
    isTrailParticle = false; // Default is to be a parent particle
  }

  // Apply forces to the parent particle
  void applyForces() {
    if (!isTrailParticle) { // Only apply forces to the main particle
      // Attraction to the center of the screen
      PVector center = new PVector(width / 2, height / 2);
      PVector towardsCenter = PVector.sub(center, position);
      float distance = towardsCenter.mag();
      towardsCenter.normalize();
      float strength = attractionStrength / (distance + 1); // Distance affects attraction
      towardsCenter.mult(strength);
      acceleration.add(towardsCenter);

      // Repulsion between particles (to avoid clumping)
      for (Particle p : particles) {
        if (p != this && !p.isTrailParticle) {
          PVector force = PVector.sub(p.position, position);
          float dist = force.mag();
          if (dist < 100) {  // Only apply repulsion when particles are close
            force.normalize();
            force.mult(repulsionStrength / (dist * dist)); // Stronger at closer distances
            acceleration.sub(force);
          }
        }
      }

      // Add random noise to create swirling motion
      float angle = noise(position.x * noiseStrength, position.y * noiseStrength) * TWO_PI;
      PVector noiseForce = PVector.fromAngle(angle).mult(noiseStrength);
      acceleration.add(noiseForce);

      // Apply mouse interaction if enabled
      if (interactive) {
        PVector mousePos = new PVector(mouseX, mouseY);
        PVector mouseForce = PVector.sub(mousePos, position);
        float distanceToMouse = mouseForce.mag();
        mouseForce.normalize();
        mouseForce.mult(0.1 / (distanceToMouse + 1)); // Weak attraction/repulsion to mouse
        acceleration.add(mouseForce);
      }

      // Apply the final velocity and limit it to avoid excessive speed
      velocity.add(acceleration);
      velocity.limit(3); // Reduced velocity for thicker trails

      // Adjust size factor based on the velocity of the particle
      sizeFactor = map(velocity.mag(), 0, 3, 1.0, 2.0);  // Increase size as speed increases
    }
  }

  // Update the particle's position
  void update() {
    position.add(velocity);
    acceleration.mult(0);  // Reset acceleration after each frame

    // Keep particle inside the window (wrap around edges)
    if (position.x < 0) position.x = width;
    if (position.x > width) position.x = 0;
    if (position.y < 0) position.y = height;
    if (position.y > height) position.y = 0;

    // Add the current position to the trail and manage trail age
    if (!isTrailParticle) { // Only parent particles create trails
      trail.add(new PVector(position.x, position.y));
      trailAge += 1; // Increase trail age over time
      if (trail.size() > trailLength) {
        trail.remove(0);  // Maintain trail length
      }

      // Create trail particles with a slight offset to create the trailing effect
      Particle trailParticle = new Particle(position.x, position.y);
      trailParticle.isTrailParticle = true;  // Mark this as a trail particle
      trailParticle.col = col;              // Keep the same color
      trailParticle.sizeFactor = 0.5;       // Smaller size for trail
      // No need to add trail particles to the list yet, we'll do this later
    }
  }

  // Display the particle and its trail
  void display() {
    // Draw the trail with fading effect, using the particle's initial color
    for (int i = 0; i < trail.size(); i++) {
      PVector p = trail.get(i);
      float alpha = map(i, 0, trail.size(), 100, 255); // Fade out effect
      fill(col, alpha);
      ellipse(p.x, p.y, baseParticleSize * sizeFactor, baseParticleSize * sizeFactor); // Dynamic size
    }

    // Draw the particle itself with its color and dynamic size
    fill(col);
    ellipse(position.x, position.y, baseParticleSize * sizeFactor, baseParticleSize * sizeFactor);
  }
}

// Update the background color mask (animated gradient)
void updateColorMask() {
  maskOffsetX += 0.02;  // Increased speed of the color mask animation for quicker changes
  maskOffsetY += 0.02;  // Increased speed of the color mask animation for quicker changes
}
