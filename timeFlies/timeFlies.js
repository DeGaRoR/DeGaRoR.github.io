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

window.onload = function() {
	startGame();
}

const planeSpeedMultiplier = 5;
const tolerancePlaneBounds = 10;
let shootKeyDown = false;
window.addEventListener('keydown', function (e) {
	//console.log(y);
      var key = e.keyCode;
	  if (key == 40) {// down
		  if(y<CANVAS_HEIGHT-300) {
			  speedY=-planeSpeedMultiplier;
			}
		else {speedY=0;}
	  }
	  
	  if (key == 38) {// up
		  if(y>tolerancePlaneBounds) {
			  speedY=planeSpeedMultiplier;
			}
		else {speedY=0;}
	  }
	  if (key == 32) {// spacebar
		  shootKeyDown = true;
	  }
	  
    })
window.addEventListener('keyup', function (e) {
	var keyUp = e.keyCode;
      if (keyUp == 38 || keyUp == 40 ) {speedY=0;}
	  if (keyUp == 32) {shootKeyDown = false;}
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
		if (this.x <= - this.width) {this.x = 0;}
		this.x = this.x - this.speed;
	}
	draw() {
		ctx.drawImage(this.image,this.x, this.y, this.width, this.height);
		ctx.drawImage(this.image,this.x + this.width, this.y, this.width, this.height);
	}
}


const layer1 = new Layer(backgroundLayer1, 0.2);
const layer2 = new Layer(backgroundLayer2, 0.4);
const layer3 = new Layer(backgroundLayer3, 0.6);
const layer4 = new Layer(backgroundLayer4, 0.8);
const layer5 = new Layer(backgroundLayer5, 1);
const backgroundObjects=[layer1,layer3,layer4,layer5];

let x=400;
let y=200;
let speedY = 0;
let framesSinceLastBullet = 0;
let fireRate = 20;
var bullets=[];
var bulletSpeed = 10;
var weaponOffsetX = 200;
var weaponOffsetY = 50;
var ennemies = [];
var frames = 0;

function createEnnemies() {
	
	var ennemiesSpeed = -3;
	var img = 0;
	
	for (var i=0; i<20;i++) {
		var newEnnemy={x: 1000+700*i, y:300+Math.random()*200-Math.random()*200, speed : -(Math.random()+1),img: img, speedY:2*Math.random()-1};
		ennemies.push(newEnnemy);
	}
	
	// update the images according to speed
	var ennemyPic = document.getElementById("ennemy");
	var ennemyPicFlip = document.getElementById("ennemyFlip");
	for (var i=0; i<ennemies.length; i++) {
		if (ennemies[i].speed>0) {img=ennemyPicFlip} else {img=ennemyPic}
		ennemies[i].img = img;
	}
	
}
function drawPlayer(x,y) {
	var planePlayer = document.getElementById("planePlayer");
	// Make it shake
	//y = y+(frames*0.5) % 5;
	
	ctx.drawImage(planePlayer,x,y,264,204);
}
function createBullet() {
	if (framesSinceLastBullet>(1/(fireRate/100))) {
		console.log("shooting");
		framesSinceLastBullet=0;
		var newBullet={x:x+weaponOffsetX, y:y+weaponOffsetY};
		bullets.push(newBullet);
	}
};
function drawBullets() {
	var bulletPic = document.getElementById("bullet2");
	for (var i=0; i<bullets.length; i++) {
		ctx.drawImage(bulletPic,bullets[i].x,bullets[i].y,32,16);
	}
}
function updateBullets() {
	for (var i=0; i<bullets.length; i++) {
		bullets[i].x=bullets[i].x+bulletSpeed;
	}
}
function drawEnnemies() {
	
	for (var i=0; i<ennemies.length; i++) {
		var ennemy=ennemies[i];
		if (ennemy.x > -250 && ennemy.x<CANVAS_WIDTH+10) {
			ctx.drawImage(ennemies[i].img,ennemies[i].x,ennemies[i].y,264,204);
		}
	}
};
function updateEnnemies() {
	for (var i=0; i<ennemies.length; i++) {
		ennemies[i].x=ennemies[i].x+ennemies[i].speed;
		if (ennemies[i].y<30 || ennemies[i].y>450) {ennemies[i].speedY=-ennemies[i].speedY}
		ennemies[i].y = ennemies[i].y+ennemies[i].speedY;
	}
};

function animate() {
	frames++;
	ctx.clearRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
	backgroundObjects.forEach(object => {
		object.update();
		object.draw();
	})
	framesSinceLastBullet++;
	y=y-speedY;
	drawPlayer(x,y);
	drawBullets();
	updateBullets();
	drawEnnemies();
	updateEnnemies();
	
	if (shootKeyDown) {createBullet();}
	
	requestAnimationFrame(animate);
}
function startGame() {
	
	createEnnemies();
	animate();
	}
