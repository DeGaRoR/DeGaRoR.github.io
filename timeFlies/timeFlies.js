const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width = 1600;
const CANVAS_HEIGHT = canvas.height = 900;
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

window.onload = function() {
    startGame();
}

const planeSpeedMultiplier = 5;
const tolerancePlaneBounds = 10;
let shootKeyDown = false;
let moveLeft = false;
let moveRight = false;
window.addEventListener('keydown', function (e) {
    var key = e.keyCode;
    if (key == 40) { // down
        if (y < CANVAS_HEIGHT - 300) {
            speedY = -planeSpeedMultiplier;
        } else {
            speedY = 0;
        }
    }

    if (key == 38) { // up
        if (y > tolerancePlaneBounds) {
            speedY = planeSpeedMultiplier;
        } else {
            speedY = 0;
        }
    }

    if (key == 37) { // left
        moveLeft = true;
    }

    if (key == 39) { // right
        moveRight = true;
    }

    if (key == 32) { // spacebar
        shootKeyDown = true;
    }
})

window.addEventListener('keyup', function (e) {
    var keyUp = e.keyCode;
    if (keyUp == 38 || keyUp == 40) { speedY = 0; }
    if (keyUp == 37) { moveLeft = false; }
    if (keyUp == 39) { moveRight = false; }
    if (keyUp == 32) { shootKeyDown = false; }
})

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
        if (this.x <= -this.width) { this.x = 0; }
        this.x = this.x - this.speed;
    }
    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        ctx.drawImage(this.image, this.x + this.width, this.y, this.width, this.height);
    }
}

const layer1 = new Layer(backgroundLayer1, 0.2);
const layer2 = new Layer(backgroundLayer2, 0.4);
const layer3 = new Layer(backgroundLayer3, 0.6);
const layer4 = new Layer(backgroundLayer4, 0.8);
const layer5 = new Layer(backgroundLayer5, 1);
const backgroundObjects = [layer1, layer2, layer3, layer4, layer5];

let x = 400;
let y = 200;
let speedY = 0;
let speedX = 0;
let framesSinceLastBullet = 0;
let fireRate = 20;
var bullets = [];
var bulletSpeed = 10;
var weaponOffsetX = 200;
var weaponOffsetY = 50;
var ennemies = [];
var powerUps = [];
var frames = 0;
let score = 0;
let scoreMultiplier = 1;
let missionComplete = false;

function createEnnemies() {
    var ennemiesSpeed = -3;
    var img = 0;

    for (var i = 0; i < 30; i++) {  // Increased enemy count
        var newEnnemy = {
            x: 1000 + 700 * i,
            y: 300 + Math.random() * 200 - Math.random() * 200,
            speed: -(Math.random() + 1),
            img: img,
            speedY: 2 * Math.random() - 1,
            type: Math.random() < 0.5 ? "normal" : "fast" // New types of enemies
        };
        ennemies.push(newEnnemy);
    }

    var ennemyPic = document.getElementById("ennemy");
    var ennemyPicFlip = document.getElementById("ennemyFlip");
    for (var i = 0; i < ennemies.length; i++) {
        if (ennemies[i].speed > 0) { img = ennemyPicFlip } else { img = ennemyPic }
        ennemies[i].img = img;
    }
}

function createPowerUp() {
    if (Math.random() < 0.01) { // chance to create a power-up
        let powerUp = {
            x: Math.random() * (CANVAS_WIDTH - 30),
            y: Math.random() * (CANVAS_HEIGHT - 30),
            size: 20,
            type: Math.random() < 0.5 ? "score" : "speed" // Different power-up types
        };
        powerUps.push(powerUp);
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
        bullets[i].x = bullets[i].x + bulletSpeed;
    }
}

function drawEnnemies() {
    for (var i = 0; i < ennemies.length; i++) {
        var ennemy = ennemies[i];
        if (ennemy.x > -250 && ennemy.x < CANVAS_WIDTH + 10) {
            ctx.drawImage(ennemies[i].img, ennemies[i].x, ennemies[i].y, 264, 204);
        }
    }
}

function updateEnnemies() {
    for (var i = 0; i < ennemies.length; i++) {
        ennemies[i].x = ennemies[i].x + ennemies[i].speed;
        if (ennemies[i].y < 30 || ennemies[i].y > 450) { ennemies[i].speedY = -ennemies[i].speedY; }
        ennemies[i].y = ennemies[i].y + ennemies[i].speedY;

        if (ennemies[i].type === "fast") {
            ennemies[i].speed *= 1.2; // Increase speed for fast enemies
        }
    }
}

function drawPowerUps() {
    for (var i = 0; i < powerUps.length; i++) {
        ctx.beginPath();
        ctx.arc(powerUps[i].x, powerUps[i].y, powerUps[i].size, 0, Math.PI * 2);
        ctx.fillStyle = "yellow"; // Power-up color
        ctx.fill();
        ctx.closePath();
    }
}

function updatePowerUps() {
    for (var i = 0; i < powerUps.length; i++) {
        powerUps[i].x -= gameSpeed * 0.5; // Power-ups move with the background speed
    }
}

function checkCollisions() {
    for (let i = 0; i < bullets.length; i++) { // Use 'let' here for loop variable
        for (let j = 0; j < ennemies.length; j++) { // Use 'let' here for loop variable
            if (bullets[i].x < ennemies[j].x + 264 &&
                bullets[i].x + 32 > ennemies[j].x &&
                bullets[i].y < ennemies[j].y + 204 &&
                bullets[i].y + 16 > ennemies[j].y) {
                // Bullet hits enemy
                ennemies.splice(j, 1); // Remove enemy
                bullets.splice(i, 1);  // Remove bullet
                score += 10;  // Increase score
                break;
            }
        }
    }
    for (let i = 0; i < powerUps.length; i++) { // Use 'let' here for loop variable
        if (x < powerUps[i].x + powerUps[i].size &&
            x + 264 > powerUps[i].x &&
            y < powerUps[i].y + powerUps[i].size &&
            y + 204 > powerUps[i].y) {
            // Player collects power-up
            powerUps.splice(i, 1); // Remove power-up
            score += 50;  // Increase score by 50 when power-up is collected
        }
    }
}

function drawScore() {
    ctx.font = '30px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('Score: ' + score, 10, 30);
}

function drawMissionComplete() {
    ctx.font = '40px Arial';
    ctx.fillStyle = 'green';
    ctx.fillText('Mission Complete!', CANVAS_WIDTH / 2 - 150, CANVAS_HEIGHT / 2);
}

function animate() {
    frames++;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    backgroundObjects.forEach(object => {
        object.update();
        object.draw();
    })
    framesSinceLastBullet++;
    y = y - speedY;
    x += speedX;
    if (moveLeft && x > 0) {
        speedX = -planeSpeedMultiplier;
    } else if (moveRight && x < CANVAS_WIDTH - 264) {
        speedX = planeSpeedMultiplier;
    } else {
        speedX = 0;
    }

    drawPlayer(x, y);
    drawBullets();
    updateBullets();
    drawEnnemies();
    updateEnnemies();
    drawPowerUps();
    updatePowerUps();
    checkCollisions();
    drawScore();

    if (score >= 1000) {  // End condition
        missionComplete = true;
        drawMissionComplete();
        return;  // Stop the game when mission is complete
    }

    if (shootKeyDown) { createBullet(); }

    createPowerUp();  // Attempt to create power-ups at intervals

    requestAnimationFrame(animate);
}

function startGame() {
    createEnnemies();
    animate();
}
