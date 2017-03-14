//
//==============================================
// Events
//==============================================
//
window.onload = function() {setBackground()};
window.onresize = function() {sizeBgCanvas(); placeCanvas(drawSpace); placeCanvas(canvasBases);};
var persistData = {
	timePace: 1
}
//
//==============================================
// Mouse and selection
//==============================================
//
var selectionBox = document.getElementById('selectionBox'), x_init = 0, y_init = 0, x2 = 0, y2 = 0, x_final = 0, y_final = 0;
onmousedown = function(e) { ondown(e.clientX, e.clientY); };
onmousemove = function(e) { onmove(e.clientX, e.clientY); };
onmouseup = function(e) { onup(e.clientX, e.clientY); };
ontouchstart = function(e) { ondown(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY);};
ontouchend = function(e) { onup(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };
ontouchmove = function(e) { onmove(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };
function reCalc() {
    var x3 = Math.min(x_init,x2);
    var x4 = Math.max(x_init,x2);
    var y3 = Math.min(y_init,y2);
    var y4 = Math.max(y_init,y2);
    selectionBox.style.left = x3 + 'px';
    selectionBox.style.top = y3 + 'px';
    selectionBox.style.width = x4 - x3 + 'px';
    selectionBox.style.height = y4 - y3 + 'px';
}
function ondown(x,y) {
    selectionBox.hidden = 0;
    x_init = x;
    y_init = y;
	x2 = x;
	y2 = y;
    reCalc();
};
function onmove(x,y) {
    x2 = x;
    y2 = y;
    reCalc();
};
function onup(x,y) {
    selectionBox.hidden = 1;
    x_final = x;
    y_final = y;
	// correction of coordinates for canvas position
	x_init_canvas = x_init - drawSpace.offsetLeft +8;
	y_init_canvas = y_init - drawSpace.offsetTop+8;
	x_final_canvas = x_final - drawSpace.offsetLeft+8;
	y_final_canvas = y_final - drawSpace.offsetTop+8;
	//alert(x_final + " " + y_final + " " + x_init + " " + y_init);
    if (distance(x_final, y_final, x_init, y_init) < config.clickTol) {
    	//alert("this looks like a click");
		setTargetOnClick(x_final_canvas,y_final_canvas);
		releaseSelection();
    }
    else {
    	//alert("This looks like a selection");
		// note that the release selection could be implemented as part of hthe selection function
		releaseSelection();
		selectObjectsInRectangle(x_final_canvas, y_final_canvas, x_init_canvas, y_init_canvas);
    }
};
function releaseSelection() {
	for (var i = 0; i < state.objects.length; i++) {
        var object = state.objects[i];
		object.isSelected = false;
    }
}
function selectObjectsInRectangle(x_final, y_final, x_init, y_init){
	var x_top_left = Math.min(x_final,x_init);
	var y_top_left = Math.min(y_final,y_init);
	var x_bottom_right = Math.max(x_final,x_init);
	var y_bottom_right = Math.max(y_final,y_init);
	for (var i = 0; i < state.objects.length; i++) {
        var object = state.objects[i];
		if (object.controlType == 0 && object.hasBeenHit == false) {
			if (object.x >= x_top_left && object.x <= x_bottom_right && object.y >= y_top_left && object.y <= y_bottom_right) {
				object.isSelected = true;
			}
		}
    }
}
//
//==============================================
// Background
//==============================================
//
function getBgConfig() {
	return {
		background_canvas: document.getElementById('background_canvas'),
		background_ctx: document.getElementById('background_canvas').getContext('2d'),
		nLargeObjects: 20,
		nSmallObjects : 20,
		bgObjects : [],
		globalSpeed : 0.5,
		small_object_L : document.getElementById("small_object_L"),
		small_object_M : document.getElementById("small_object_M"),
		small_object_S : document.getElementById("small_object_S"),
		big_object_1 : document.getElementById("big_object_1"),
		big_object_2 : document.getElementById("big_object_2"),
		big_object_3 : document.getElementById("big_object_3"),
	}
}
function sizeBgCanvas() {
	bgConfig.background_canvas.width = window.innerWidth-2;
	bgConfig.background_canvas.height = window.innerHeight;
}
function setBackground() {
	// Get the configuration in a proper object, no global or local scope
	bgConfig = getBgConfig();
	// size canvas
	sizeBgCanvas();
	// create large objects
	for (var i=0; i<bgConfig.nLargeObjects;i++) {
		var imgL = selectRandom3(bgConfig.big_object_1, bgConfig.big_object_2, bgConfig.big_object_3);
		var x_init = getRandom(0, bgConfig.background_canvas.width);
		var y_init = getRandom(0, bgConfig.background_canvas.height);
		var theta = getRandom(0, Math.PI*2);
		var speed = getRandom(0.1,0.5);
		var largeObject = {
			x: x_init,
			y: y_init,
			img: imgL,
			theta: theta,
			speed: speed,
		}
		bgConfig.bgObjects.push(largeObject);
	}
	// Create small objects
	for (var i=0; i<bgConfig.nSmallObjects;i++) {
		var imgS = selectRandom3(bgConfig.small_object_L, bgConfig.small_object_M, bgConfig.small_object_S);
		var x_init = getRandom(0, bgConfig.background_canvas.width);
		var y_init = getRandom(0, bgConfig.background_canvas.height);
		var theta = getRandom(0, Math.PI*2);
		var speed = getRandom(0.5,1);
		var smallObject = {
			x: x_init,
			y: y_init,
			img: imgS,
			theta: theta,
			speed: speed,
		}
		bgConfig.bgObjects.push(smallObject);
	}
	animateBackground();
}
function animateBackground() {
	requestAnimationFrame(animateBackground);
	// render objects
	bgConfig.background_ctx.clearRect(0, 0, bgConfig.background_canvas.width, bgConfig.background_canvas.height);
	for (var i=0; i<bgConfig.bgObjects.length; i++) {
		object = bgConfig.bgObjects[i];
		// Get the boundaries where the object image is completely hidden
		var y_min = 0 - object.img.height;
		var x_min = 0 - object.img.width;
		var x_max = bgConfig.background_canvas.width;
		var y_max = bgConfig.background_canvas.height;
		// detect and re-initialize objects outside of canvas
		if 		(object.x < x_min) {object.x = x_max}
		else if (object.y < y_min) {object.y = y_max}
		else if (object.x > x_max) {object.x = x_min}
		else if (object.y > y_max) {object.y = y_min}
		// refresh position of objects
		object.y += bgConfig.globalSpeed*object.speed*Math.sin(object.theta);
		object.x += bgConfig.globalSpeed*object.speed*Math.cos(object.theta);
		// Draw the objects
		var y_center = object.y;
		var x_center = object.x;
		var w = object.img.width;
		var h = w;
		bgConfig.background_ctx.drawImage(object.img, x_center, y_center, w, h);
	}
}
//
//==============================================
// Utils
//==============================================
//
function getRandom(min, max) {return Math.random() * (max - min) + min;}
function selectRandom3(x,y,z) {
	var selected = Math.round(getRandom(1,3));
	if (selected == 1){
		return x
	}
	else if (selected == 2) {
		return y
	}
	else if (selected == 3) {
		return z
	}
}
function distance(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x1-x2, 2)+Math.pow(y1-y2,2)) }
function distanceNY(x1, y1, x2, y2) { return (Math.abs(x1-x2) + Math.abs(y1-y2)) }
//
//==============================================
// Game UI
//==============================================
//
function ShowConfirmReturnHome() {document.getElementById('confirmBoxReturnHome').hidden = false;}
function hideConfirmReturnHome() {document.getElementById('confirmBoxReturnHome').hidden = true;}
function ShowConfirmRestart() {document.getElementById('confirmBoxRestart').hidden = false;}
function hideConfirmRestart() {document.getElementById('confirmBoxRestart').hidden = true;}
function backToChoice() {
	persistData.timePace = state.timePace;
	state.abandon = true;
	document.getElementById('gameUI').hidden = true;
	document.getElementById('LevelChooser').hidden = false;
}
function showMenu() {
	state.previousTimePace = state.timePace;
	document.getElementById('inGameMenu').hidden = false;
	pauseGame();
	setSpeedIndicator(state.previousTimePace);
	
}
function hideMenu() {
	document.getElementById('inGameMenu').hidden = true;
	unPauseGame();
}
function setSpeedIndicator(speed) {
	document.getElementById("speedIndicator").innerHTML = speed + "x";
}
//
//==============================================
// Game menu controls
//==============================================
//
function reStart() {persistData.timePace = state.timePace; state.abandon = true; cancelAnimationFrame(reqID); startGame(config.level);}
function pauseGame() {state.timePace = 0;}
function unPauseGame() {state.timePace = state.previousTimePace;}
function changeSpeed(increment) {
	// do not go lower than 1x and higher than 5x
	if ((state.previousTimePace == 1 && increment < 0) || (state.previousTimePace == 5 && increment >0)) {
		//do nothing
	}
	else {
		// manipulate only the variable previousTimePace - set it to timePace on hide menu
		state.previousTimePace = state.previousTimePace + increment;
		setSpeedIndicator(state.previousTimePace);
	}
}
//
//==============================================
// Game initialization
//==============================================
//
function initializePlayers(sizeFactor) {
	var players = [];
	var cell3D_S = document.getElementById("cell3D_S");
	var cell3D_M = document.getElementById("cell3D_M");
	var cell3D_L = document.getElementById("cell3D_L");
	var fungus3D_S = document.getElementById("fungus3D_S");
	var fungus3D_M = document.getElementById("fungus3D_M");
	var fungus3D_L = document.getElementById("fungus3D_L");
	var virus3D_S = document.getElementById("virus3D_S");
	var virus3D_M = document.getElementById("virus3D_M");
	var virus3D_L = document.getElementById("virus3D_L");
	var playerNone = {
		playerName: "none",
		playerColour: "grey",
		controlType: 2,
	}
	players.push(playerNone);
	var player1 = {
		playerName: "Plasma Cells",
		playerColour: "#00BCC5",
		controlType: 0, // 0 for human, 1 for CPU, 2 for none
		imgBase: [cell3D_S,cell3D_M,cell3D_L],
		baseSize: [150 * sizeFactor,200 * sizeFactor,256 * sizeFactor],
	}
	players.push(player1);
	var player2 = {
		playerName: "Fungus",
		playerColour: "#A0F500",
		controlType: 1,
		imgBase: [fungus3D_S,fungus3D_M,fungus3D_L],
		baseSize: [256 * sizeFactor,300 * sizeFactor,350 * sizeFactor],
	}
	players.push(player2);
	var player3 = {
		playerName: "Virus",
		playerColour: "#FF0700",
		controlType: 1,
		imgBase: [virus3D_S,virus3D_M,virus3D_L],
		baseSize: [150 * sizeFactor,200 * sizeFactor,256 * sizeFactor],
	}
	players.push(player3);

	return players;
}
function getBases(players, canvas, selectedLevel, maxHealth, minConquership) {
	var newBases = [];
	var w = canvas.width;
	var h = canvas.height;
	var levels = getLevels();
	// push the bases from the selected level into the bases vector
	for (i=0; i<levels[selectedLevel-1].bases.length; i++) {
		newBases[i]=levels[selectedLevel-1].bases[i];
		// transform some parameters to make them aware of the context, such as the canavas and the lisqt of players
		var newBase = newBases[i];
		newBase.x = newBase.x * w;
		newBase.y = newBase.y * h;
		newBase.ownership = players[newBase.ownership];
		// initialize some parameters
		newBase.levelCurrent = 1;
		newBase.lastSpawn = -1;
		newBase.upgradePoints = 0;
		newBase.isUnderAttack = false;
		newBase.health = maxHealth;
		newBase.colour = newBase.ownership.playerColour;
		newBase.id = i;
		if (newBase.ownership != players[0]) {
			newBase.initUnits = 100;
			newBase.controlType = newBase.ownership.controlType;
			newBase.conquership = minConquership;
		}
		else {
			newBase.initUnits = 0;
			newBase.controlType = 2;
			newBase.conquership = 0;
			}
	}
	return newBases;
}
function getConfig(selectedLevel) {
	var canvas = document.getElementById("drawSpace");
	var canvasBases = document.getElementById("canvasBases");
	var sizeFactor = 0.75;
	var players = initializePlayers(sizeFactor);
	var defaultBaseSize = 32 * sizeFactor;
	var levelSizeIncrease = 12 * sizeFactor;
	var defaultUnitSize = 3 * sizeFactor;
	var baseMinDist = (defaultBaseSize + levelSizeIncrease * 2 + defaultUnitSize + 2); // minimum distance from the base after spawning
	var baseMaxDist = (baseMinDist + 20); // max distance from the base after spawning
	var maxHealth = 100;
	var minConquership = 100;
	var bases = getBases(players, canvas, selectedLevel, maxHealth, minConquership);
	
	return {
		level: selectedLevel,
		// canvas manipulation
		canvas: canvas,
		canvasBases: canvasBases,
		ctx: canvas.getContext("2d"),
		ctxBases: canvasBases.getContext("2d"),
		// players and bases
		bases: bases,
		players: players,
		// timings
		turnLength: 25,
		// sizes
		defaultBaseSize: defaultBaseSize,
		levelSizeIncrease: levelSizeIncrease,
		defaultUnitSize: defaultUnitSize,
		baseMinDist: baseMinDist,
		baseMaxDist: baseMaxDist,
		pulseSizeIncrease: 1,
		radiusRandom: 15,
		neighbourDistance: Math.round(canvas.width/3),
		imgBaseSize: 256,
		// tolerances
		collisionTol: 6, // tolerance for declaring collision
		maxUnits: 100000,
		clickTol: 20, // for declaring a click rather than a rectangle selection
		baseClickTol: 3 * defaultBaseSize,
		// base values
		minConquership: minConquership,
		maxHealth: maxHealth,
		maxUpgradePoints: 100,

	}
}
function getInitialState() {
	//var timePace = 2;
	//var spawnRate = 2000/timePace;
	
	return {
		objects: [],
		timePace: 1,
		spawnRate: function() { return 2000 / this.timePace; },
		speedUnit: function() { return 0.03 * this.timePace; },
		targetTol: function() { return 6 + Math.round(this.timePace/10)*6; }, // tolerance for declaring a unit on base - increase this if state.timePace increase, to allow the software to catch positions on time
		lastTurn: 0,
		// Game states
		gameWon: false,
		playerAlive: null,
		prevTime: Date.now(),
		themeID: 0,
		abandon: false,
		previousTimePace:1,
		// timer
		levelStartTime: null,
		levelFinishTime: null,
		refreshBasesCanvas: true,
	};
}
function placeCanvas(canvas) {
	// Center the canvas using margins - so the click events are not confused...
	canvas.style.marginLeft = (window.innerWidth - drawSpace.width) /2;
}
function sizeMainCanvas(canvas) {
	if (window.innerWidth > window.innerHeight) {
		canvas.height = window.innerHeight;
		canvas.width = canvas.height;
		//drawSpace.style.paddingLeft = 100;
	}
	else {
		canvas.width = window.innerWidth-8;
		canvas.height = canvas.width;
	}
}

function startGame(level) {
	
	// hide the level choice UI and show the game div
	document.getElementById('LevelChooser').hidden = true;
	document.getElementById('gameUI').hidden = false;
	// determine canvas size and position
	sizeMainCanvas(drawSpace);
	placeCanvas(drawSpace);
	sizeMainCanvas(canvasBases);
	placeCanvas(canvasBases);
	// Initialize the config and state
	config = getConfig(level);
	state = getInitialState();
	state.timePace = persistData.timePace;
	// Write the current speed
	setSpeedIndicator();
	// Complete the base definition and initializes them
	spawnInitialUnits();
	// Record the starting time
	state.levelStartTime = Date.now();
	// Off we go
	animate();
}
function spawnInitialUnits() {
	for (var i = 0; i < config.bases.length; i++) {
		var base = config.bases[i];
		// if base is owned
		if (base.ownership != config.players[0]) {
			// spawn initial units
			for (j=0; j < base.initUnits/base.levelCurrent; j++) {
				spawnUnit(base);
			}
		}
	}
}
//
//==============================================
// Draw
//==============================================
//
function drawUnit(object) {
	if (object.hasBeenHit == false) {
		if (object.isSelected == false) {
			if (object.isHidden == true) {
					// draw the unit in green if has been hit for debugging purposes
			config.ctx.beginPath();
			config.ctx.arc(object.x, object.y, 3, 0, Math.PI * 2);
			config.ctx.closePath();
			//config.ctx.stroke();
			config.ctx.fillStyle = "green";
			//config.ctx.fill();
			}
			else {
			// draw the unit in the player color
			config.ctx.beginPath();
			config.ctx.arc(object.x, object.y, config.defaultUnitSize, 0, Math.PI * 2);
			config.ctx.closePath();
			config.ctx.strokeStyle = "black";
			config.ctx.lineWidth = 1;
			//config.ctx.shadowColor = 'black';
			//config.ctx.shadowBlur = 4;
			config.ctx.shadowOffsetX = 2;
			config.ctx.shadowOffsetY = 2;
			//config.ctx.stroke();
			config.ctx.fillStyle = object.colour;
			//config.ctx.fill();
			}
		}
		else {
			// draw the unit in yellow if selected
			config.ctx.beginPath();
			config.ctx.arc(object.x, object.y, config.defaultUnitSize, 0, Math.PI * 2);
			config.ctx.closePath();
			config.ctx.strokeStyle = "black";
			config.ctx.lineWidth = 1;
			//config.ctx.stroke();
			config.ctx.fillStyle = "yellow";
			//config.ctx.fill();
		}
	}
	else
	{
		// draw the unit in green if has been hit for debugging purposes
        config.ctx.beginPath();
        config.ctx.arc(object.x, object.y, 3, 0, Math.PI * 2);
        config.ctx.closePath();
        //config.ctx.stroke();
        config.ctx.fillStyle = "green";
        //config.ctx.fill();
	}
}
function drawTarget(object) {
			// draw the target when still moving
			config.ctx.beginPath();
			config.ctx.arc(object.targetX, object.targetY, 3, 0, Math.PI * 2);
			config.ctx.closePath();
			//config.ctx.stroke();
			config.ctx.fillStyle = "LightGrey";
			//config.ctx.fill();	
}
function drawExplosion(object) {
	x = object.x;
	y = object.y;
	xRand = Math.random()*100
	yRand = Math.random()*100
	config.ctx.beginPath();
	config.ctx.moveTo(x+xRand,y+yRand);
	config.ctx.lineTo(x-xRand,y-yRand);
	config.ctx.moveTo(x-xRand, y+yRand);
	config.ctx.lineTo(x+xRand,y-yRand);
	config.ctx.lineWidth = 1;
	config.ctx.strokeStyle = object.colour;
	config.ctx.stroke();
}
function drawBase(base) {
	var baseSize = 0;
	var level = null;
	// draw the new image
	if (base.ownership != config.players[0] && base.conquership == 100) {
		var imgBase = null;
		var imgSize = null;
		// cap the level to 3, afterwards draw base type 3 always
		if (base.levelCurrent >= 3) {level = 2}
		else {level = base.levelCurrent-1;}
		imgBase = base.ownership.imgBase[level];
		imgSize = base.ownership.baseSize[level];
		config.ctxBases.drawImage(imgBase, base.x-imgSize/2, base.y-imgSize/2, imgSize, imgSize);
	}
	// draw the base a bit larger if it has just spawned - this gives a pulse
	if (base.hasJustSpawned == true) { baseSize = config.defaultBaseSize + config.pulseSizeIncrease; }
	else { baseSize = config.defaultBaseSize; }
	// size the bases according to their current level
	baseSize = baseSize + (base.levelCurrent - 1) * config.levelSizeIncrease;

	// MAX LEVEL: draw circles around the bases showing their maximum level
	for (var i = base.levelCurrent; i < base.levelMax; i++) {
		config.ctxBases.beginPath();
		config.ctxBases.arc(base.x, base.y, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
		config.ctxBases.strokeStyle = 'rgba(255,255,255,0.4)';
		config.ctxBases.lineWidth = 3;
		config.ctxBases.stroke();
		//config.ctx.closePath();
	}
	
	// actually draw the base
	// Draw a vector base only for bases with no ownership
	if (base.ownership == config.players[0] || base.conquership != 100) {
		config.ctxBases.beginPath();
		config.ctxBases.arc(base.x, base.y, baseSize, 0, Math.PI * 2);
		config.ctxBases.closePath();
		config.ctxBases.strokeStyle = "black";
		config.ctxBases.lineWidth = 1;
		config.ctxBases.fillStyle = 'rgba(150,150,150,0.4)';
		config.ctxBases.fill();
	}//config.ctx.stroke();

	// NEIGHBOUR DISTANCE: draw a circle showing the max distance for declaring a neighbour
	/*
	config.ctxBases.beginPath();
	config.ctxBases.arc(base.x, base.y, config.neighbourDistance, 0, Math.PI * 2);
	//config.ctx.closePath();
	config.ctxBases.strokeStyle = "LightGrey";
	config.ctxBases.setLineDash([3,3]);
	config.ctxBases.lineWidth = 1;
	config.ctxBases.stroke();
	config.ctxBases.setLineDash([]);
	*/

}
function drawBaseIndicator(base) {
	var baseSize = 0;
	var level = null;

	// draw the base a bit larger if it has just spawned - this gives a pulse
	baseSize = config.defaultBaseSize;
	// size the bases according to their current level
	baseSize = baseSize + (base.levelCurrent - 1) * config.levelSizeIncrease;

	// UPGRADE status: show current upgrade status
	config.ctx.beginPath();
	config.ctx.arc(base.x, base.y, config.defaultBaseSize + base.levelCurrent * config.levelSizeIncrease, 0, Math.PI * 2 * base.upgradePoints/config.maxUpgradePoints);
	//config.ctx.closePath();
	config.ctx.strokeStyle = base.ownership.playerColour;
	config.ctx.lineWidth = 3;
	config.ctx.stroke();

	// CONQUERSHIP: draw a circle around the base representing the conquership
	if (base.conquership < config.minConquership) {
		config.ctx.beginPath();
		config.ctx.arc(base.x, base.y, baseSize + 1, 0, Math.PI * 2 * base.conquership/config.minConquership);
		//config.ctx.closePath();
		config.ctx.strokeStyle = base.ownership.playerColour;
		config.ctx.lineWidth = 3;
		config.ctx.stroke();
	}
	// HEALTH: draw a circle around the base is the health is not 100%
	if (base.health < config.maxHealth) {
		config.ctx.beginPath();
		config.ctx.arc(base.x, base.y, baseSize + 1, 0, Math.PI * 2 * (base.health/config.maxHealth));
		//config.ctx.closePath();
		config.ctx.strokeStyle = "red";
		config.ctx.lineWidth = 3;
		config.ctx.stroke();
	}
}
//
//==============================================
// AI
//==============================================
//
function randomAI(player) {
	//console.log(player.playerColour + " uses randomAI");
	for (var i=0; i<config.bases.length; i++) {
		base = config.bases[i];
		// for all bases owned by player
		if (base.colour == player.playerColour) {
			if (base.levelCurrent < base.levelMax) {
				if (Math.random() >= 0.5) {
					//console.log(player.playerColour + " decides to upgrade base " + i);
					upgrade(base);
				}
				else if (Math.random() >= 0.5) {
					//console.log(player.playerColour + " decides to stay idle");
				}
				else {
					//console.log(player.playerColour + " decides to move its unit from base " + i + " to other base");
					// move all soldiers to a base closer to the enemy
					moveToRandomNeighbour(base);
				}
			}
			else {
				if (Math.random() >= 0.5) {
					//console.log(player.playerColour + " decides to move its unit from base " + i + " to other base");
					// move all soldiers to a base closer to the enemy
					moveToRandomNeighbour(base);
				}
				else {//console.log(player.playerColour + "decides to stay idle");
				}
			}
		}
	}
}
function moveToRandomNeighbour(base) {
	// get the array of candidate neighbours
	var neighbours = findNeighboursCloserToEnnemy(base);
	var choosedNeighbourID = Math.round(Math.random() * (neighbours.length-1))
	var choosedNeighbour = neighbours[choosedNeighbourID];
	//console.log(choosedNeighbour.id);
	for (j = 0; j < state.objects.length; j++) {
		object = state.objects[j];
		// take all the objects having this base as motherbase
		if (object.motherBase == base) {
			//console.log("line 676, choosed neighbour is base " + choosedNeighbour.id + ". Position in neighbours vecotr is " + choosedNeighbourID);
			setTarget(object, choosedNeighbour);
			object.defensiveMode = false;
		}
	}
}
function upgrade(base) {
	// first, count the units currently defending the base
	var nDefenders = 0;
	for (var i=0; i<state.objects.length; i++) {
		var object = state.objects[i];
		if (object.motherBase == base && object.defensiveMode == true) {
			nDefenders = nDefenders + 1;
		}
	}
	// if enough units to upgrade the base, then select the exact amount required and upgrade
	if (nDefenders >= (config.maxUpgradePoints - base.upgradePoints)) {
		var nUpgraders = 0;
		for (var i=0; i<state.objects.length; i++) {
			var object = state.objects[i];
			if (object.motherBase == base && object.defensiveMode == true && nUpgraders < (config.maxUpgradePoints - base.upgradePoints)) {
				//console.log("line 697");
				setTarget(object, base);
				nUpgraders = nUpgraders + 1;
			}
		}
	}
	else {//console.log("Not enough units to upgrade base");
	}
	
}
function findNeighboursCloserToEnnemy(base) { // returns an array of neighbours which are closer to the ennemy than "base"
	var neighbours = [];
	for (var i = 0; i < config.bases.length; i++) {
		var otherBase = config.bases[i];
		var minDistToEnnemyFromOther = minDistToEnnemy(base.ownership, otherBase);
		var minDistToEnnemyFromThis = minDistToEnnemy(base.ownership, base);
		// if it is another base
		if (otherBase != base) {
			// if other base close enough for being a neighbour
			if (distance(base.x, base.y, otherBase.x, otherBase.y) <= config.neighbourDistance) {
				// and the other base is closer to the ennemy
				if (minDistToEnnemyFromOther <= minDistToEnnemyFromThis) {
					// add the base the the vector of neighbours
					neighbours.push(otherBase);
				}
			}
		}
	}
	return neighbours;
}
function minDistToEnnemy(player, base) { // returns the minimum distance from "base" to an ennemy of "player"
	// make sure to consider when there is no enemy anymore
	var distToOther = null;
	var minDist = null;
	// Loop through bases
	for (var i=0 ; i < config.bases.length ; i++) {
		var otherBase = config.bases[i];
		// if base not owned by the player
		// AND the base is not unconquered
		// then it is an enemy base
		if (otherBase.ownership != player && otherBase.ownership != config.players[0]) {
			// compute the distance between the base and the ennemy base
			distToOther = distance(base.x, base.y, otherBase.x, otherBase.y);
			// if this distance is shorter than the previous one, replace it
			if (distToOther < minDist || minDist == null) {
				minDist = distToOther;
			}
		}
	}
	if (minDist == null) {minDist = 0; console.log("looks like there is no more enemies, so no minimum distance to enemy to calculate");}
	return minDist;
}
//
//==============================================
// Core game
//==============================================
//
function setTargetOnClick(x,y) {
	// correction 8 px of margin from the browser - try to clean that later
	x = x-8;
	y = y-8;
	var clickedBaseID = isClickOnBase(x,y);
	var base = config.bases[clickedBaseID];
	// loop through objects for giving them new target coordinates
	for (var i = 0; i < state.objects.length; i++) {
		var object = state.objects[i];
		
		// only do that for objects controlled by human and currently selected
		if (object.controlType == 0 && object.hasBeenHit == false && object.isSelected == true) 
		{
			object.defensiveMode = false;
			// if clicked on a base, set coordinates to base center
			if (clickedBaseID != -1) {
				//alert("clicked on base with ID " + clickedBaseID);
				object.targetY = base.y;
				object.targetX = base.x;
			}
			// otherwise set to mouse coordinates
			else {
				// introduce some randomness for not having all units on a single spot
				object.targetY = y + Math.random()*config.radiusRandom - Math.random()*config.radiusRandom;
				object.targetX = x + Math.random()*config.radiusRandom - Math.random()*config.radiusRandom;
			}
		}
	}
}
function setTargetAroundBase(object, base) {
	randomDist =  config.baseMinDist + (config.baseMaxDist-config.baseMinDist)*Math.random();
	randomAngle = Math.random() * 2* Math.PI;
	object.targetY = base.y + randomDist * Math.sin(randomAngle);
	object.targetX = base.x + randomDist * Math.cos(randomAngle);
	object.defensiveMode = true;
	object.motherBase = base;
}
function setTarget(object, target) {
	object.targetX = target.x;
	object.targetY = target.y;
}
function isOnBase (object) { // this function returns the ID of the clicked base, or -1 if not clicked
	var baseID = -1;
	for (var b = 0; b < config.bases.length; b++) {
		var base = config.bases[b];
		if (distance(object.x, object.y, base.x, base.y) < config.defaultBaseSize && object.targetX == base.x && object.targetY == base.y) {
			baseID = b;
		}
	//alert("click X: " + objectX + " ,Y: " + objectY + "base X: " + base.x + ", Y: " + base.y + "selected base: " + base.colour + " statement: " + statement);
	}
return baseID;
}
function isClickOnBase (x,y) {
	var baseID = -1;
	for (var b = 0; b < config.bases.length; b++) {
		var base = config.bases[b];
		if (distance(x, y, base.x, base.y) < config.baseClickTol) {
			baseID = b;
		}
	//alert("click X: " + objectX + " ,Y: " + objectY + "base X: " + base.x + ", Y: " + base.y + "selected base: " + base.colour + " statement: " + statement);
	}
return baseID;
}
function spawnUnit(base) {
// go through the spawning loop as many times as there are levelCurrent
for (var i = 0; i < base.levelCurrent; i++) {
	
    // create the new object
    var object = {
		// start by inheriting a few properties from the mother base
		ownership: base.ownership,
        colour: base.colour,
        x: base.x,
        y: base.y,
		targetX: base.x,
		targetY: base.y,
		controlType: base.controlType,
        // choose a direction for spawning
        // theta: Math.random() * 2* Math.PI,
		// initialize the hasBeenHit property
		hasBeenHit: false,
		isSelected: false,
		defensiveMode: true,
		motherBase: base,
		isDefending: false,
		isHidden: false,
    }
	//console.log("spawning new " + object.colour + " object with coordinates " + object.x + ", " + object.y);
	setTargetAroundBase(object, base)
    // add the new object to the objects[] array
    state.objects.push(object);
    }
}
function goToCoordinates(object, timeDiff) {
// compute r and theta
		//var distFromCoord = distance(object.x, object.y, object.targetX, object.targetY);
		var angleFromCoord = Math.atan2(object.y-object.targetY, object.x-object.targetX); // In radians
		// move only if the next move gets you closer to your target
		// the issue was that the timeDiff kept increasing when the window lost focus (as code was paused), 
		// resulting in huge timeDiff when resuming, and the objects being sent super far
		var newObjectY = object.y -state.speedUnit() * timeDiff * Math.sin(angleFromCoord);
		var newObjectX = object.x -state.speedUnit() * timeDiff * Math.cos(angleFromCoord);
		var currentDist = distance(object.x, object.y, object.targetX, object.targetY);
		var nextDist = distance(newObjectX, newObjectY, object.targetX, object.targetY);
		if (nextDist < currentDist)
		{
			object.y = newObjectY;
			object.x = newObjectX;
			//console.log("increment for " + object.colour + " object" + (-speedUnit * timeDiff))
			// draw the target when still moving
			//drawTarget(object);
		}
}
function checkCollision (object) {
	var nObjects = state.objects.length;
	for (var j = 0; j < nObjects; j++) {
		var collider = state.objects[j];
		if (collider.colour !== object.colour && collider.hasBeenHit == false && object.hasBeenHit == false) {
			var dist = distanceNY(object.x, object.y, collider.x, collider.y);
			if (dist < config.collisionTol) {
				killUnit(object);
				killUnit(collider);
			}
		}
	}
}
function killUnit(object) {
	object.hasBeenHit = true;
	drawExplosion(object);
}
function updateBaseProperties(base) {
	if (base.ownership != config.players[0]) {
		base.colour = base.ownership.playerColour;
		base.controlType = base.ownership.controlType;
		//base.health = 100;
		//base.conquership = 100;
	}
	// if base is not owned, set colour to grey
	else {
		base.colour = "grey";
		base.controlType = 2;
		base.ownership = config.players[0];
		//base.health = 0;
		//base.conquership = 0;
	}
	state.refreshBasesCanvas = true;
}
function findClosestAttacker(object) {
	var prevDist = null;
	for (j=0; j < state.objects.length; j++) {
		var other = state.objects[j];
		// if ennemy targeted to mother base
		if (other.colour != object.colour) {// && other.targetX == object.motherBase.x && other.targetY == object.motherBase.y) {
			var dist = distance(object.motherBase.x, object.motherBase.y, other.x, other.y); + 0.1 * distance(object.x, object.y, other.x, other.y);
			if (dist < prevDist || prevDist == null) {
				var attacker = other;
				prevDist = dist;
			}	
		}
	}
	return attacker;
}
//
//==============================================
// Main
//==============================================
//
function animate(time) {
	// Behaviour at the end of the game
	if (state.gameWon == true) {
		state.levelFinishTime = Date.now();
		var gameTime = state.levelFinishTime-state.levelStartTime;
		console.log("Get out of the animate function since game won declared");
		var minutesWon = Math.floor(gameTime/60000);
		var secondsWon = Math.round((gameTime/1000) - (60 * minutesWon));
		config.ctx.clearRect(0, 0, config.canvas.width, config.canvas.height);
		config.ctx.fillStyle = state.playerAlive.playerColour;
		config.ctx.font = "30px Arial";
		config.ctx.textAlign = "center";
		config.ctx.textBaseline = "middle";
		//config.ctx.fillText(base.levelCurrent, base.x, base.y);
		config.ctx.fillText("Victory for " + state.playerAlive.playerName + " in " + minutesWon + " min, " + secondsWon + " sec", config.canvas.width/2, config.canvas.height/2);
		return;
	}
	if (state.abandon == true) {
		return;
	}
    // request another animation frame (always first call)
	// requestAnimationFrame pauses when the windows loses focus. If undesired, use setInterval instead
    reqID = requestAnimationFrame(animate);
	
	//var time = date.now();
	var timeDiff = time - state.prevTime;

	var newObjects = [];

	// Call the AI when it is time
	if (time > state.lastTurn + config.turnLength * state.spawnRate()) {
		for (var p = 1; p < config.players.length; p++) {
			player = config.players[p];
			if (player.controlType == 1) {
				//console.log("call AI move for player " + player.playerColour);
				randomAI(player);
			}
		}
		state.lastTurn = time;
	}

    // clear the canvas so all objects can be 
    // redrawn in new positions
    config.ctx.clearRect(0, 0, config.canvas.width, config.canvas.height);
	
	// logic loop through bases
	for (var i = 0; i < config.bases.length; i++) {
        var attackersNum = 0;
		var base = config.bases[i];
		base.hasJustSpawned = false;
		// check if the base is under attack
		for (var j = 0; j < state.objects.length; j++) {
			object = state.objects[j];
			// if ennemy with coordinates set to this base
			if (object.colour != base.colour && object.targetX == base.x && object.targetY == base.y) {
				attackersNum += 1;
			}
		}
		if (attackersNum > 0) { base.isUnderAttack = true; }
		else { base.isUnderAttack = false; }
		// update/upgrade
		if (base.upgradePoints == config.maxUpgradePoints) {
			base.levelCurrent = base.levelCurrent + 1;
			base.upgradePoints = 0;
			state.refreshBasesCanvas = true;
			//console.log("Base " + i + ", owned by " + base.colour + " has upgraded to " + base.levelCurrent);
		}
		// Base death
		// if base health or conquership reaches 0, set it to not owned
		// !!! issue here - this condition will trigger for all unowned bases, not only the ones that become 0 !!! Not the intent
		if (base.health == 0 || (base.conquership == 0 && base.ownership != config.players[0])) {
			base.ownership = config.players[0];
			base.conquership = 0;
			base.health = config.maxHealth;
			base.levelCurrent = 1;
			base.upgradePoints = 0;
			updateBaseProperties(base);
			state.refreshBasesCanvas = true;
		}
		// spawn the units
		// if the base is owned and conquered by someone
		if (base.ownership != config.players[0] && base.conquership >= config.minConquership) {
			// limit max number of objects
			if (state.objects.length < config.maxUnits) {
				// see if it is time to spawn a new object
				if (time > (base.lastSpawn + state.spawnRate())) 
				{
					base.lastSpawn = time;
					base.hasJustSpawned = true; // Comment for de-activating pulse
					spawnUnit(base);
				}
			}
		}
		drawBaseIndicator(base);
    }
	// bases drawing loop
	// if need to re-render, clear the canvas first
	if (state.refreshBasesCanvas == true) {
		config.ctxBases.clearRect(0, 0, config.canvasBases.width, config.canvasBases.height);
		// loop through bases and render them all
		for (var i = 0; i < config.bases.length; i++) {
			var base = config.bases[i];
			drawBase(base);
		}
		// Job done, reset the need to re-render to false and let the logics loop evaluate if necessary next time
		state.refreshBasesCanvas = false;
		console.log("canvasBases refresh");
	}

    // loop through units
	// main loop containing logics
    for (var i = 0; i < state.objects.length; i++) {
        var object = state.objects[i];
		checkCollision(object);
		// do not compute anything for objects which are already "dead"
		if (object.hasBeenHit == false) {
			var distFromCoord = distance(object.x, object.y, object.targetX, object.targetY);
			var onBaseID = isOnBase(object);
			// first, let the defenders find an enemy if the base is attacked
			if (object.defensiveMode == true) {
				//console.log("detected a " + object.colour + " defender with mother base " + object.motherBase.isUnderAttack);
				if (object.motherBase.isUnderAttack == true) 
				{
					//console.log("a defenser sees base under attack");
					var attacker = findClosestAttacker(object);
					//console.log("line 818");
					setTarget(object, attacker);
					object.isDefending = true;
				}
				else {
					if (object.isDefending == true) {
						setTargetAroundBase(object, object.motherBase);
						object.isDefending = false;
					}
					// if the base has been wounded, and not all healers have yet been assigned
					/*
					if (object.motherBase.health < config.maxHealth) {// && healers < (config.maxHealth - object.motherBase.health)) {
						setTarget(object, object.motherBase);
					
					}
					*/
				}
			}
			// if not yet on position, move to target position
			if (distFromCoord > state.targetTol()) { goToCoordinates(object, timeDiff); }
			// if on position and on a base
			else if (onBaseID != -1) {
				var base = config.bases[onBaseID];
				// if friendly base
				if (base.ownership == object.ownership) {
					// if base is fully conquered
					if (base.conquership >= config.minConquership) {
						// if base health is not full, increase base health and kill unit
						if (base.health < config.maxHealth) {
							base.health = base.health + 1;
							killUnit(object);
						}
						// if the base is already at max level, just dispatch units around the base
						else if (base.levelCurrent == base.levelMax) {
							setTargetAroundBase(object, base);
							goToCoordinates(object, timeDiff);
						}
						// if the base can still evolve, add upgrade points
						else if (base.levelCurrent < base.levelMax && base.upgradePoints < config.maxUpgradePoints) {
							base.upgradePoints = base.upgradePoints + 1;
							killUnit(object);
						}
					}
					// if on a base that the player has started to conquer
					else {
						base.conquership = base.conquership + 1;
						killUnit(object);
						if (base.conquership == config.minConquership) {
							updateBaseProperties(base);
							//console.log("base "+ base.id +" has been conquered by " + base.colour);
						}
					}
				}
				// if on a base with no ownership, set ownership
				if (base.ownership == config.players[0]) 
				{
					base.ownership = object.ownership;
					killUnit(object);
					base.conquership = 1;
				}

				// if on an enemy base
				if (base.ownership != object.ownership) {
					// if the ennemy has only started to conquer, decrease his conquership
					if (base.conquership > 0 && base.conquership < config.minConquership) {
						base.conquership = base.conquership - 1;
						killUnit(object);
					}
					// if health, decrease health
					else if (base.health > 0) {
						base.health = base.health - 1;
						killUnit(object);
					}
					

				}
			}

		}			
    }
	// second loop for removing all dead objects from the objects vector
	for (var i = 0; i < state.objects.length; i++) {
        var object = state.objects[i];
		if (object.hasBeenHit == true) {
			//objects.splice(i, 1);
		}
		else {
			newObjects.push(object);
		}	
    }
	
	state.objects = newObjects;
	
	// third loop for drawing the remaining objects in the right position
	for (var i = 0; i < state.objects.length; i++) {
        var object = state.objects[i];
		drawUnit(object);
		//config.ctx.stroke();
		config.ctx.fill();
    }
	// victory condition
	var nAlive = 0;
	var nBases = 0;

	//document.getElementById("infoField").innerHTML = ""
	for (p=1;p<config.players.length;p++) {
		player = config.players[p];
		//console.log(player.playerName);
		for (b=0;b<config.bases.length;b++) {
			var base = config.bases[b];
			if (base.ownership == player && base.conquership == config.minConquership) {
				nBases = nBases + 1;
			}
		}
		//document.getElementById("infoField").innerHTML += player.playerName + " has " + nBases + " bases <br>";
		if (nBases > 0) {
			nAlive = nAlive + 1;
			state.playerAlive = player;
		}
		
		nBases = 0;
	}
	//document.getElementById("infoField").innerHTML += nAlive + " players are alive <br>";
	if (nAlive == 1) {
		//alert(state.playerAlive.playerName + " has won in " + (time/1000)/60 + " minutes");
		//document.getElementById("infoField").innerHTML += state.playerAlive.playerName + " has won!!!! <br>";
		state.gameWon = true;
	}
	
	// Update the previous timestamp
	state.prevTime = time;
}