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

drawSpaceLE.onmousedown = function(e) { ondownLE(e.clientX, e.clientY); };
drawSpaceLE.onmousemove = function(e) { onmoveLE(e.clientX, e.clientY); };
drawSpaceLE.onmouseup = function(e) { onupLE(e.clientX, e.clientY); };
drawSpaceLE.ontouchstart = function(e) { ondownLE(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY);};
drawSpaceLE.ontouchend = function(e) { onupLE(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };
drawSpaceLE.ontouchmove = function(e) { onmoveLE(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };

function ondownLE(x,y) {
    //selectionBox.hidden = 0;
	console.log("On down detected");
    x_init = x;
    y_init = y;
	x2 = x;
	y2 = y;
};
function onmoveLE(x,y) {
    x2 = x;
    y2 = y;
};
function onupLE(x,y) {
	console.log("On up detected");
    //selectionBox.hidden = 1;
    x_final = x;
    y_final = y;
	// correction of coordinates for canvas position
	x_init_canvas = x_init - drawSpaceLE.offsetLeft +8;
	y_init_canvas = y_init - drawSpaceLE.offsetTop+8;
	x_final_canvas = x_final - drawSpaceLE.offsetLeft+8;
	y_final_canvas = y_final - drawSpaceLE.offsetTop+8;
	
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
				drawBaseLE(x_final,y_final);
				newBase={x_final:x_final, x_norm:x_norm,y_final:y_final,y_norm,y_norm};
				config.bases.push(newBase);
			}
		}
		else {
			console.log("This looks like a selection");
		}
	
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
// Level Editor UI + string composer
//==============================================
//
function showHideStringBases(bool) {
	string = getStringContent();
	document.getElementById("exportText").innerHTML=string;
	if (bool) {
		document.getElementById("basesLE").hidden=true;
		document.getElementById("mainCanvasLE").hidden=true;
		document.getElementById("buttonShowString").hidden=true;
		document.getElementById("exportString").hidden=false;
	}
	else{
		document.getElementById("basesLE").hidden=false;
		document.getElementById("mainCanvasLE").hidden=false;
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
//
//==============================================
// Config & state
//==============================================
//


function startLevelEditor() {
	config=getConfigLE();
	// size both canvases
	config.canvas.width = window.innerWidth-2;
	config.canvas.height = window.innerHeight;
	config.canvasBases.width = window.innerWidth-2;
	config.canvasBases.height = window.innerHeight;
	drawCanvasLE();
}
function getConfigLE() {
	// Get the canvas elements
	var canvas = document.getElementById("drawSpaceLE");
	var canvasBases = document.getElementById("canvasBasesLE");
	//adapt the size factor as a function of screen size
	var sizeFactor = 1;
	var sizeFactorSmallScreens = 0.5;
	var sizeFactorBigScreens = 1;
	var smallScreenSize = 600;
	var innerWidth = window.innerWidth;
	if (innerWidth < smallScreenSize) {sizeFactor=sizeFactorSmallScreens;}
	else {sizeFactor=sizeFactorBigScreens;};
	// Initialize the rest
	var players = initializePlayers(sizeFactor);
	var defaultBaseSize = 32 * sizeFactor;
	var levelSizeIncrease = 12 * sizeFactor;
	var bases = [];
	
	return {
		// canvas manipulation
		canvas: canvas,
		canvasBases: canvasBases,
		ctx: canvas.getContext("2d"),
		ctxBases: canvasBases.getContext("2d"),
		// players and bases
		bases: bases,
		players: players,
		// sizes
		defaultBaseSize: defaultBaseSize,
		levelSizeIncrease: levelSizeIncrease,

		imgBaseSize: 256,
		// tolerances
		clickTol: 20, // for declaring a click rather than a rectangle selection
		baseClickTol: 3 * defaultBaseSize,
		// base values
		sizeFactor: sizeFactor
	}
}
function getInitialStateLE() {

	return {

	};
}

//
//==============================================
// Draw functions
//==============================================
//
function drawCanvasLE() {
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
function drawBaseLE(x,y) {
	// Draw a dashed line showing the maximum area
	for (var i = 4; i < 5; i++) {
		config.ctxBases.beginPath();
		config.ctxBases.setLineDash([5, 3]);
		config.ctxBases.arc(x, y, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
		config.ctxBases.strokeStyle = 'rgba(255,255,255,0.4)';
		config.ctxBases.lineWidth = 3;
		config.ctxBases.stroke();
		config.ctxBases.closePath();
	}
	// Draw 3 circles around the base for now, like they're all level 3
	for (var i = 1; i < 4; i++) {
		config.ctxBases.beginPath();
		config.ctxBases.setLineDash([0]);
		config.ctxBases.arc(x, y, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
		config.ctxBases.strokeStyle = 'rgba(255,255,255,0.4)';
		config.ctxBases.lineWidth = 3;
		config.ctxBases.stroke();
		config.ctxBases.closePath();
	}
	
	// Draw the plain base center

		config.ctxBases.beginPath();
		config.ctxBases.arc(x, y, config.defaultBaseSize, 0, Math.PI * 2);
		config.ctxBases.closePath();
		config.ctxBases.strokeStyle = "black";
		config.ctxBases.lineWidth = 1;
		config.ctxBases.fillStyle = 'rgba(250,250,250,0.4)';
		config.ctxBases.fill();

}
//
//==============================================
// Common funtions with core game
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

function distance(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x1-x2, 2)+Math.pow(y1-y2,2)) }