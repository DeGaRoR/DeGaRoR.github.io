ArrayList<Tower> oldTowers = new ArrayList<Tower>();
Tower currentTower;
PVector builderPos;
int state = 0; // 0: building, 1: collapse, 2: wait
int buildTimer = 0;
int collapseDelay = 120;
int waitTime = 60;

color[] palette = {
  color(200, 100, 100),
  color(100, 160, 200),
  color(120, 200, 140),
  color(180, 130, 220)
};

void setup() {
  size(800, 600);
  frameRate(30);
  builderPos = new PVector(width / 2, height - 100);
  startNewTower();
}

void draw() {
  background(250, 250, 255, 20); // fading background for ghost effect
  
  // Draw previous towers
  for (Tower t : oldTowers) {
    t.display(true);
  }

  // Draw current tower
  if (state == 0) {
    currentTower.build();
    if (currentTower.isComplete()) {
      state = 1;
      buildTimer = frameCount;
    }
  } else if (state == 1) {
    if (frameCount - buildTimer > collapseDelay) {
      currentTower.triggerCollapse();
      state = 2;
    }
  } else if (state == 2) {
    currentTower.collapseStep();
    if (currentTower.isCollapsed()) {
      oldTowers.add(currentTower);
      waitTime--;
      if (waitTime <= 0) {
        startNewTower();
        waitTime = 60;
        state = 0;
      }
    }
  }

  currentTower.display(false);
  drawBuilder();
}

// --- CLASSES & FUNCTIONS ---

void startNewTower() {
  currentTower = new Tower(width/2, height - 60, int(random(5, 12)));
}

class Block {
  PVector pos, vel;
  float w, h;
  color c;
  boolean falling = false;

  Block(float x, float y, float w_, float h_, color col) {
    pos = new PVector(x, y);
    vel = new PVector(random(-0.5, 0.5), 0);
    w = w_;
    h = h_;
    c = col;
  }

  void fall() {
    falling = true;
  }

  void update() {
    if (falling) {
      vel.y += 0.5;
      pos.add(vel);
      if (pos.y > height - h/2) {
        pos.y = height - h/2;
        vel.y *= -0.3;
      }
    }
  }

  void display(boolean ghost) {
    noStroke();
    if (ghost) {
      fill(c, 50);
    } else {
      fill(c);
    }
    rectMode(CENTER);
    rect(pos.x, pos.y, w, h);
  }
}

class Tower {
  ArrayList<Block> blocks = new ArrayList<Block>();
  float baseX, baseY;
  int totalBlocks;
  int built = 0;
  boolean collapsing = false;
  boolean complete = false;
  float blockW, blockH;
  color blockColor;

  Tower(float x, float y, int count) {
    baseX = x;
    baseY = y;
    totalBlocks = count;
    blockW = random(30, 60);
    blockH = random(20, 40);
    blockColor = palette[int(random(palette.length))];
  }

  void build() {
    if (built < totalBlocks && frameCount % 20 == 0) {
      float offset = random(-20, 20);
      blocks.add(new Block(baseX + offset, baseY - built * blockH, blockW, blockH, blockColor));
      built++;
      if (built >= totalBlocks) complete = true;
    }
  }

  boolean isComplete() {
    return complete;
  }

  void triggerCollapse() {
    collapsing = true;
    for (Block b : blocks) {
      b.fall();
    }
  }

  void collapseStep() {
    for (Block b : blocks) {
      b.update();
    }
  }

  boolean isCollapsed() {
    for (Block b : blocks) {
      if (b.pos.y < height - b.h / 2 - 1) return false;
    }
    return true;
  }

  void display(boolean ghost) {
    for (Block b : blocks) {
      b.display(ghost);
    }
  }
}

void drawBuilder() {
  pushMatrix();
  translate(builderPos.x, builderPos.y);
  stroke(50);
  fill(0);
  ellipse(0, -25, 20, 20); // head
  line(0, -15, 0, 15); // body
  line(0, 0, -10, 20); // leg
  line(0, 0, 10, 20);  // leg
  line(0, -10, -15, 0); // arm
  line(0, -10, 15, 0);  // arm
  popMatrix();
}
