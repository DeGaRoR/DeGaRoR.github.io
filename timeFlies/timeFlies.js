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

const planeSpeedMultiplier = 5;
const tolerancePlaneBounds = 10;

window.addEventListener('keydown', function (e) {
	//console.log(y);
      var key = e.keyCode;
	  if (key == 40) {
		  if(y<CANVAS_HEIGHT-300) {
			  speedY=-planeSpeedMultiplier;
			}
		else {speedY=0;}
	  }
	  
	  if (key == 38) {
		  if(y>tolerancePlaneBounds) {
			  speedY=planeSpeedMultiplier;
			}
		else {speedY=0;}
	  }
	  
    })
window.addEventListener('keyup', function (e) {
      speedY=0;
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
const backgroundObjects=[layer1,layer2,layer3,layer4,layer5];

let x=400;
let y=50;
let speedY = 0;

function drawPlayer(x,y) {
	var planePlayer = document.getElementById("planePlayer");
	ctx.drawImage(planePlayer,x,y,264,204);
}


function animate() {
	ctx.clearRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
	backgroundObjects.forEach(object => {
		object.update();
		object.draw();
	})
	y=y-speedY;
	drawPlayer(x,y);
	requestAnimationFrame(animate);
}
animate();
