//==============================================
// Events
//==============================================
//
window.onload = function() {
		console.log("started");
		startLevelEditor();
	};
	
//
//==============================================
// Mouse and selection
//==============================================
//
var selectionBox = document.getElementById('selectionBox'), x_init = 0, y_init = 0, x2 = 0, y2 = 0, x_final = 0, y_final = 0;
drawSpace.onmousedown = function(e) { ondown(e.clientX, e.clientY); };
drawSpace.onmousemove = function(e) { onmove(e.clientX, e.clientY); };
drawSpace.onmouseup = function(e) { onup(e.clientX, e.clientY); };
drawSpace.ontouchstart = function(e) { ondown(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY);};
drawSpace.ontouchend = function(e) { onup(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };
drawSpace.ontouchmove = function(e) { onmove(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };
function reCalc() {
    var x3 = Math.min(x_init,x2);
    var x4 = Math.max(x_init,x2);
    var y3 = Math.min(y_init,y2);
    var y4 = Math.max(y_init,y2);
    //selectionBox.style.left = x3 + 'px';
    //selectionBox.style.top = y3 + 'px';
    //selectionBox.style.width = x4 - x3 + 'px';
    //selectionBox.style.height = y4 - y3 + 'px';
}
function ondown(x,y) {
    //selectionBox.hidden = 0;
	console.log("On down detected");
    x_init = x;
    y_init = y;
	x2 = x;
	y2 = y;
    //reCalc();
};
function onmove(x,y) {
    x2 = x;
    y2 = y;
    //reCalc();
};
function onup(x,y) {
	console.log("On up detected");
    //selectionBox.hidden = 1;
    x_final = x;
    y_final = y;
	// correction of coordinates for canvas position
	x_init_canvas = x_init - drawSpace.offsetLeft +8;
	y_init_canvas = y_init - drawSpace.offsetTop+8;
	x_final_canvas = x_final - drawSpace.offsetLeft+8;
	y_final_canvas = y_final - drawSpace.offsetTop+8;
	
	//alert(x_final + " " + y_final + " " + x_init + " " + y_init);
	// If distance between down and up is not great, it will be considered a click
		if (distance(x_final, y_final, x_init, y_init) < config.clickTol) {
			// Normalize coordinates
			var x_norm=x_final/window.innerWidth;
			var y_norm = y_final/window.innerHeight;
			console.log("this looks like a click at normalized coordinates x="+x_norm.toFixed(2)+", y="+y_norm.toFixed(2));
			// test if the click is on an existing base
			var clickOnBase=isClickOnBase(x_final,y_final);
			if (clickOnBase) {console.log("Clicked on base "+clickOnBase)}
			else {
				drawBase(x_final,y_final);
				newBase={x_final:x_final, x_norm:x_norm,y_final:y_final,y_norm,y_norm};
				config.bases.push(newBase);
			}
			
			//setTargetOnClick(x_final_canvas,y_final_canvas);
		}
		else {
			console.log("This looks like a selection");
			// note that the release selection could be implemented as part of hthe selection function
			//selectObjectsInRectangle(x_final_canvas, y_final_canvas, x_init_canvas, y_init_canvas);
		}
	
};
function testFunction() {
	console.log("that does seem to work");
};
function isClickOnBase(x,y) {
	console.log("test if click is on base")
	var response =0;
	var tolerance = 160*config.sizeFactor;
	for (var i=0; i<config.bases.length;i++) {
		if (distance(config.bases[i].x_final,config.bases[i].y_final,x,y)<tolerance) {response=i+1;}
	}
	return response;
}
//
//==============================================
// Config & state
//==============================================
//
function showHideStringBases(bool) {
	string = getStringContent();
	document.getElementById("exportText").innerHTML=string;
	if (bool) {
		document.getElementById("bases").hidden=true;
		document.getElementById("mainCanvas").hidden=true;
		document.getElementById("buttonShowString").hidden=true;
		document.getElementById("exportString").hidden=false;
	}
	else{
		document.getElementById("bases").hidden=false;
		document.getElementById("mainCanvas").hidden=false;
		document.getElementById("buttonShowString").hidden=false;
		document.getElementById("exportString").hidden=true;
	}
}
function getStringContent() { // get the string content
	var string='{name:"Custom Level",<br>&nbsp;&nbsp;bases:[<br>';
	for (var i=0; i<config.bases.length;i++) {
		string = string + "&nbsp;&nbsp;&nbsp;&nbsp;{ownership:0,x:"+config.bases[i].x_norm.toFixed(2)+",y:"+config.bases[i].y_norm.toFixed(2)+",levelMax:1},<br>"
	}
	string = string +"&nbsp;&nbsp;]<br>},"
	return string;
}
function getCustomLevel() { //function to get the bases as an object, like those in the normal bases vector
	var bases= [];
	for (var i=0; i<config.bases.length;i++) {
		newBase = {
			ownership: 1,
			x: config.bases[i].x_norm.toFixed(2),
			y: config.bases[i].y_norm.toFixed(2),
			levelMax: 1
		}
		bases.push[newBase];
	}
	var customLevel = {name: "Custom Level",bases:bases};
	return customLevel;
}






function startLevelEditor() {
	config=getConfigLE();
	// size both canvases
	config.canvas.width = window.innerWidth-2;
	config.canvas.height = window.innerHeight;
	config.canvasBases.width = window.innerWidth-2;
	config.canvasBases.height = window.innerHeight;
	drawCanvas();
}
function getConfigLE() {
	var canvas = document.getElementById("drawSpace");
	var canvasBases = document.getElementById("canvasBases");
	//adapt the size factor as a function of screen size
	var sizeFactor = 1;
	var sizeFactorSmallScreens = 0.5;
	var sizeFactorBigScreens = 1;
	var smallScreenSize = 600;
	var innerWidth = window.innerWidth;
	if (innerWidth < smallScreenSize) {sizeFactor=sizeFactorSmallScreens;}
	else {sizeFactor=sizeFactorBigScreens;};
	
	var players = initializePlayers(sizeFactor);
	var defaultBaseSize = 32 * sizeFactor;
	var levelSizeIncrease = 12 * sizeFactor;
	var defaultUnitSize = 3 * sizeFactor;
	var baseMinDist = (defaultBaseSize + levelSizeIncrease * 2 + defaultUnitSize + 2); // minimum distance from the base after spawning
	var baseMaxDist = (baseMinDist + 20); // max distance from the base after spawning
	var maxHealth = 100;
	var minConquership = 100;
	var bases = [];
	
	return {
		//level: selectedLevel,
		// canvas manipulation
		canvas: canvas,
		canvasBases: canvasBases,
		ctx: canvas.getContext("2d"),
		ctxBases: canvasBases.getContext("2d"),
		// players and bases
		bases: bases,
		players: players,
		// timings
		turnLength: 5, // pace for calling the AI - corresponds to time for producing N units from a level 1 base
		// sizes
		defaultBaseSize: defaultBaseSize,
		levelSizeIncrease: levelSizeIncrease,
		defaultUnitSize: defaultUnitSize,
		baseMinDist: baseMinDist,
		baseMaxDist: baseMaxDist,
		pulseSizeIncrease: 1,
		radiusRandom: 15,
		neighbourDistance: Math.round(Math.max(canvas.height, canvas.width)/2),
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
		indicatorBarSizeFactor: 0.2,
		sizeFactor: sizeFactor
	}
}
function getInitialStateLE() {
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
		gamePaused:false,
		currentLevel: 0,
		tutoMessagesSeen: [0,0,0,0,0,0,0,0,0,0]
	};
}
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
		playerColour: "#7b1fa2", //"#00BCC5" original colour
		controlType: 0, // 0 for human, 1 for CPU, 2 for none
		AIType: 1, // 0 for random AI, 1 for released AI
		imgBase: [cell3D_S,cell3D_M,cell3D_L],
		baseSize: [150 * sizeFactor,200 * sizeFactor,256 * sizeFactor],
	}
	players.push(player1);
	var player2 = {
		playerName: "Fungus",
		playerColour: "#A0F500",
		controlType: 1,
		AIType: 1, // 0 for random AI, 1 for released AI
		imgBase: [fungus3D_S,fungus3D_M,fungus3D_L],
		baseSize: [256 * sizeFactor,300 * sizeFactor,350 * sizeFactor],
	}
	players.push(player2);
	var player3 = {
		playerName: "Virus",
		playerColour: "#FF0700",//"#FF0700",
		controlType: 1,
		AIType: 1, // 0 for random AI, 1 for released AI
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
function sizeBgCanvas() {
	bgConfig.background_canvas.width = window.innerWidth-2;
	bgConfig.background_canvas.height = window.innerHeight;
}

function drawCanvas() {
	var width=window.innerWidth;
	var height = window.innerHeight;
	var nGrad = 10;
	// Get the vertical lines
	for (var i=0; i<nGrad;i++) {
		config.ctx.beginPath();
		config.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
		config.ctx.moveTo(i*width/nGrad, 0);
		config.ctx.lineTo(i*width/nGrad, height);
		config.ctx.stroke();
		config.ctx.closePath();
	};
	// Get the horizontal lines
	for (var j=0; j<nGrad;j++) {
		config.ctx.beginPath();
		config.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
		config.ctx.moveTo(0, j*height/nGrad);
		config.ctx.lineTo(width, j*height/nGrad);
		config.ctx.stroke();
		config.ctx.closePath();
	};
	// draw stay out rectangles
	config.ctx.fillStyle = 'rgba(255,0,0,0.5)';
	//top
	config.ctx.beginPath();
	config.ctx.rect(0, 0, width, height/nGrad);
	config.ctx.fill();
	config.ctx.closePath();
	//left
	config.ctx.beginPath();
	config.ctx.rect(0, height/nGrad, width/nGrad, (nGrad-2)*height/nGrad);
	config.ctx.fill();
	config.ctx.closePath();
	//bottom
	config.ctx.beginPath();
	config.ctx.rect(0, (nGrad-1)*height/nGrad, width, height/nGrad);
	config.ctx.fill();
	config.ctx.closePath();
	//right
	config.ctx.beginPath();
	config.ctx.rect((nGrad-1)*width/nGrad, height/nGrad, width/nGrad, (nGrad-2)*height/nGrad);
	config.ctx.fill();
	config.ctx.closePath();
}
function drawBase(x,y) {
	//var baseSize = 0;
	//var level = null;
	//// draw the new image
	//if (base.ownership != config.players[0] && base.conquership == 100) {
	//	var imgBase = null;
	//	var imgSize = null;
	//	// cap the level to 3, afterwards draw base type 3 always
	//	if (base.levelCurrent >= 3) {level = 2}
	//	else {level = base.levelCurrent-1;}
	//	imgBase = base.ownership.imgBase[level];
	//	imgSize = base.ownership.baseSize[level];
	//	config.ctxBases.drawImage(imgBase, base.x-imgSize/2, base.y-imgSize/2, imgSize, imgSize);
	//}
	//// draw the base a bit larger if it has just spawned - this gives a pulse
	//if (base.hasJustSpawned == true) { baseSize = config.defaultBaseSize + config.pulseSizeIncrease; }
	//else { baseSize = config.defaultBaseSize; }
	//// size the bases according to their current level
	//baseSize = baseSize + (base.levelCurrent - 1) * config.levelSizeIncrease;

	// MAX LEVEL: draw circles around the bases showing their maximum level
	for (var i = 4; i < 5; i++) {
		config.ctxBases.beginPath();
		config.ctxBases.setLineDash([5, 3]);
		config.ctxBases.arc(x, y, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
		config.ctxBases.strokeStyle = 'rgba(255,255,255,0.4)';
		config.ctxBases.lineWidth = 3;
		config.ctxBases.stroke();
		config.ctxBases.closePath();
	}
	
	for (var i = 1; i < 4; i++) {
		config.ctxBases.beginPath();
		config.ctxBases.setLineDash([0]);
		config.ctxBases.arc(x, y, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
		config.ctxBases.strokeStyle = 'rgba(255,255,255,0.4)';
		config.ctxBases.lineWidth = 3;
		config.ctxBases.stroke();
		config.ctxBases.closePath();
	}
	

	// Draw a vector base only for bases with no ownership
	//if (base.ownership == config.players[0] || base.conquership != 100) {
		config.ctxBases.beginPath();
		config.ctxBases.arc(x, y, config.defaultBaseSize, 0, Math.PI * 2);
		config.ctxBases.closePath();
		config.ctxBases.strokeStyle = "black";
		config.ctxBases.lineWidth = 1;
		config.ctxBases.fillStyle = 'rgba(250,250,250,0.4)';
		config.ctxBases.fill();
	//}
	//config.ctx.stroke();

	// NEIGHBOUR DISTANCE: draw a circle showing the max distance for declaring a neighbour
	
	/* config.ctxBases.beginPath();
	config.ctxBases.arc(base.x, base.y, config.neighbourDistance, 0, Math.PI * 2);
	//config.ctx.closePath();
	config.ctxBases.strokeStyle = "LightGrey";
	config.ctxBases.setLineDash([3,3]);
	config.ctxBases.lineWidth = 1;
	config.ctxBases.stroke();
	config.ctxBases.setLineDash([]); */
	

}
function distance(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x1-x2, 2)+Math.pow(y1-y2,2)) }