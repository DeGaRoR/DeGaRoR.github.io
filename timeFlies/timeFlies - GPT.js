<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shooting Game</title>
    <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
    </style>
</head>
<body>
<canvas id="canvas1"></canvas>
<script>
// Setup canvas and context
const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width = 1200;
const CANVAS_HEIGHT = canvas.height = 700;
let gameSpeed = 10;

const backgroundLayer1 = new Image();
backgroundLayer1.src = "background/layer-1.png";
const backgroundLayer2 = new Image();
backgroundLayer2.src = "background/layer-2.png";
const backgroundLayer3 = new Image();
backgroundLayer3.src = "background/layer-3.png";
const backgroundLayer4 = new Image();
backgroundLayer4.src = "background/layer-4.png";
const backgroundLayer5 = new Image();
backgroundLayer5.src = "background/layer-5.png";

// Player movement setup
const planeSpeedMultiplier = 5;
const tolerancePlaneBounds = 10;
let shootKeyDown = false;
let score = 0;
let explosionSound = new Audio("explosion.mp3"); // Load sound effect

window.onload = function() {
    startGame();
};

const layer1 = new Layer(backgroundLayer1, 0.2);
const layer2 = new Layer(backgroundLayer2, 0.4);
const layer3 = new Layer(backgroundLayer3, 0.6);
const layer4 = new Layer(backgroundLayer4, 0.8);
const layer5 = new Layer(backgroundLayer5, 1);
const backgroundObjects = [layer1, layer2, layer3, layer4, layer5];

let x = 400;
let y = 200;
let speedY = 0;
let framesSinceLastBullet = 0;
let fireRate = 20;
var bullets = [];
var bulletSpeed = 10;
var weaponOffsetX = 200;
var weaponOffsetY = 50;
var enemies = [];
var frames = 0;

// Sound effect for shooting
let shootSound = new Audio("shoot.mp3"); 

class Layer {
    constructor(image, speedModifier) {
        this.x = 0;
        this.y = 0;
        this.width = 2400;
        this.height = 700;
        this.image = image;
        this.speedModifier = speedModifier;
        this.speed = gameSpeed * this.speedModifier;
    }
    update() {
        this.speed = gameSpeed * this.speedModifier;
        if (this.x <= - this.width) {this.x = 0;}
        this.x = this.x - this.speed;
    }
    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        ctx.drawImage(this.image, this.x + this.width, this.y, this.width, this.height);
    }
}

function createEnemies() {
    for (let i = 0; i < 20; i++) {
        let newEnemy = { 
            x: 1000 + 700 * i, 
            y: 300 + Math.random() * 200 - Math.random() * 200, 
            speed: -(Math.random() + 1), 
            speedY: 2 * Math.random() - 1
        };
        enemies.push(newEnemy);
    }
}

function drawPlayer(x, y) {
    var planePlayer = document.getElementById("planePlayer");
    ctx.drawImage(planePlayer, x, y, 264, 204);
}

function createBullet() {
    if (framesSinceLastBullet > (1 / (fireRate / 100))) {
        framesSinceLastBullet = 0;
        var newBullet = { x: x + weaponOffsetX, y: y + weaponOffsetY };
        bullets.push(newBullet);
        shootSound.play(); // Play shooting sound effect
    }
}

function drawBullets() {
    var bulletPic = document.getElementById("bullet2");
    for (var i = 0; i < bullets.length; i++) {
        ctx.drawImage(bulletPic, bullets[i].x, bullets[i].y, 32, 16);
    }
}

function updateBullets() {
    for (var i = 0; i < bullets.length; i++) {
        bullets[i].x += bulletSpeed;
    }
}

function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        if (enemy.x > -250 && enemy.x < CANVAS_WIDTH + 10) {
            ctx.drawImage(enemy.img, enemy.x, enemy.y, 264, 204);
        }
    }
}

function updateEnemies() {
    for (var i = 0; i < enemies.length; i++) {
        enemies[i].x += enemies[i].speed;
        if (enemies[i].y < 30 || enemies[i].y > 450) {
            enemies[i].speedY = -enemies[i].speedY;
        }
        enemies[i].y += enemies[i].speedY;
    }
}

function checkCollisions() {
    for (var i = 0; i < bullets.length; i++) {
        for (var j = 0; j < enemies.length; j++) {
            if (bullets[i] && enemies[j]) {
                if (
                    bullets[i].x < enemies[j].x + 264 &&
                    bullets[i].x + 32 > enemies[j].x &&
                    bullets[i].y < enemies[j].y + 204 &&
                    bullets[i].y + 16 > enemies[j].y
                ) {
                    // Bullet hit enemy
                    bullets.splice(i, 1); // Remove bullet
                    enemies.splice(j, 1); // Remove enemy
                    score += 10; // Increase score
                    explosionSound.play(); // Play explosion sound
                    break; // Exit collision loop
                }
            }
        }
    }
}

function updateScore() {
    ctx.font = '30px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('Score: ' + score, 20, 40);
}

function animate() {
    frames++;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    backgroundObjects.forEach(object => {
        object.update();
        object.draw();
    });
    framesSinceLastBullet++;
    y -= speedY;
    drawPlayer(x, y);
    drawBullets();
    updateBullets();
    drawEnemies();
    updateEnemies();
    checkCollisions(); // Check for bullet-enemy collisions
    updateScore(); // Update score display

    if (shootKeyDown) {
        createBullet();
    }

    requestAnimationFrame(animate);
}

function startGame() {
    createEnemies();
    animate();
}

window.addEventListener('keydown', function (e) {
    var key = e.keyCode;
    if (key == 40) { // down
        if (y < CANVAS_HEIGHT - 300) {
            speedY = -planeSpeedMultiplier;
        }
        else {
            speedY = 0;
        }
    }

    if (key == 38) { // up
        if (y > tolerancePlaneBounds) {
            speedY = planeSpeedMultiplier;
        }
        else {
            speedY = 0;
        }
    }
    if (key == 32) { // spacebar
        shootKeyDown = true;
    }
});

window.addEventListener('keyup', function (e) {
    var keyUp = e.keyCode;
    if (keyUp == 38 || keyUp == 40) {
        speedY = 0;
    }
    if (keyUp == 32) {
        shootKeyDown = false;
    }
});
</script>
</body>
</html>
