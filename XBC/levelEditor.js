//==============================================
// Events
//==============================================
//
window.onload = function() {
		console.log("started");
		startLevelEditor();
	};
// initialisation of  materialize components
document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.modal');
    var options = {opacity:0,onCloseStart: function() { clearSelectionLE(); }}
    var instances = M.Modal.init(elems, options);
});	


//
//==============================================
// Mouse and selection
//==============================================
//

drawSpaceLE.onmousedown = function(e) { ondownLE(e.clientX, e.clientY); };
drawSpaceLE.onmousemove = function(e) { onmoveLE(e.clientX, e.clientY); };
drawSpaceLE.onmouseup = function(e) { onupLE(e.clientX, e.clientY); };
//drawSpaceLE.ontouchstart = function(e) { ondownLE(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY);};
//drawSpaceLE.ontouchend = function(e) { onupLE(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };
//drawSpaceLE.ontouchmove = function(e) { onmoveLE(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };

function ondownLE(x,y) {
    //selectionBox.hidden = 0;
	//console.log("On down detected");
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
	//console.log("On up detected");
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
			if (clickOnBase) {//behaviour if clicking on an existing base
				console.log("Clicked on base "+clickOnBase);
				showModalBaseProperties(clickOnBase);
				// clear selected status of all bases first
				clearSelectionLE();
				// Update the selection flag
				config.bases[clickOnBase-1].baseIsSelected = true;
				reDrawBases(config.bases);
			}
			else {//behaviour if clicking anywhere else on the canvas
				newBase={x_final:x_final, x_norm:x_norm,y_final:y_final,y_norm:y_norm,baseIsSelected:false,ownership:0,levelMax:1};
				config.bases.push(newBase);
				clearSelectionLE();
				
				
			}
		}
		else {
			//console.log("This looks like a selection");
		}
	
};
function clearSelectionLE() {
	//console.log("clear selection invoked");
	for (var i=0; i<config.bases.length;i++) {
		config.bases[i].baseIsSelected = false;
	}
	reDrawBases(config.bases);
}
function isClickOnBase(x,y) {
	//console.log("test if click is on base")
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
function setOwnership(baseID,ownership) {
	config.bases[baseID].ownership = ownership;
	updateBaseModalContent(baseID+1);
	reDrawBases(config.bases);
}
function setLevelMax(baseID,levelMax) {
	config.bases[baseID].levelMax = levelMax;
	updateBaseModalContent(baseID+1);
	reDrawBases(config.bases);
}
function updateBaseModalContent(baseID) {
	var titleTXT="Properties of base "+baseID;
	var ownershipTXT="Owner of the base: ";
	var maxLevelTXT="Maximum reachable level: ";
	var modalContent = document.getElementById("modalContentLE")
	// clear the existing content
	clearDOM('modalContentLE');
	// create title
	var title = document.createElement("h4");
	title.appendChild(document.createTextNode(titleTXT));
	// Create div for ownership
	var divOwnership = document.createElement("DIV");
	divOwnership.appendChild(document.createTextNode(ownershipTXT));
	// Create 4 buttons corresponding to players
	for (var i=0;i<4;i++) {
		var btnPlayer = document.createElement("BUTTON");
		btnPlayer.style.backgroundColor = config.players[i].playerColour;
		btnPlayer.innerHTML = config.players[i].playerName;
		//btnPlayer.setAttribute('onclick','setOwnership(baseID-1,i)');
		btnPlayer.targetBase = baseID-1;
		btnPlayer.ownership=i;
		btnPlayer.onclick=function(){setOwnership(this.targetBase,this.ownership)}
		btnPlayer.style.width = '20 px';
		btnPlayer.style.height = '20 px';
		btnPlayer.style.margin='0px 10px 0px 10px';
		// Thick border to show currently selected owner
		if (i == config.bases[baseID-1].ownership) {btnPlayer.style.border = "thick solid #00FF00"}
		// Append the button
		divOwnership.appendChild(btnPlayer)
	}
	// create the section for the lmax level
	var maxLevel = document.createElement("DIV");
	maxLevel.appendChild(document.createTextNode(maxLevelTXT));
	// Create 3 buttons for the levels
	for (var i=0;i<3;i++) {
		var btnLevel = document.createElement("BUTTON");
		btnLevel.style.backgroundColor = "#FFFFFF";
		btnLevel.innerHTML = i+1;
		//btnLevel.setAttribute('onclick','setOwnership(baseID-1,i)');
		btnLevel.targetBase = baseID-1;
		btnLevel.levelMax=i+1;
		btnLevel.onclick=function(){setLevelMax(this.targetBase,this.levelMax)}
		btnLevel.style.width = '20 px';
		btnLevel.style.height = '20 px';
		btnLevel.style.margin='0px 10px 0px 10px';
		// Thick border to show currently selected owner
		if (i == config.bases[baseID-1].levelMax-1) {btnLevel.style.border = "thick solid #00FF00"}
		// Append the button
		maxLevel.appendChild(btnLevel);
	}
	
	
	
	
	
	
	
	
	
	
	// Append to modal content
	modalContent.appendChild(title);
	modalContent.appendChild(divOwnership);
	modalContent.appendChild(maxLevel);
}
function showModalBaseProperties(baseID) {
	// Get the modal into an instance
	var elem = document.getElementById("modalBaseProperties");
	var instance = M.Modal.getInstance(elem);
	// Update the modal content
	updateBaseModalContent(baseID);
	// open the modal
	instance.open();
}
function showHideStringBases(bool) {
	string = getStringContent();
	document.getElementById("exportText").innerHTML=string;
	if (document.getElementById("basesLE").hidden==false) {
		document.getElementById("basesLE").hidden=true;
		document.getElementById("mainCanvasLE").hidden=true;
		document.getElementById("exportString").hidden=false;
	}
	else{
		document.getElementById("basesLE").hidden=false;
		document.getElementById("mainCanvasLE").hidden=false;
		document.getElementById("exportString").hidden=true;
	}
}

function clearDOM(divID) {
	var myNode = document.getElementById(divID);
	while (myNode.firstChild) {
		myNode.removeChild(myNode.firstChild);
	}
}


//
//==============================================
// Output functions
//==============================================
//

function getStringContent() { // get the string content
	var string='{name:"Custom Level",<br>&nbsp;&nbsp;bases:[<br>';
	for (var i=0; i<config.bases.length;i++) {
		string = string + "&nbsp;&nbsp;&nbsp;&nbsp;{ownership:"+config.bases[i].ownership+",x:"+config.bases[i].x_norm.toFixed(2)+",y:"+config.bases[i].y_norm.toFixed(2)+",levelMax:"+config.bases[i].levelMax+"},<br>"
	}
	string = string +"&nbsp;&nbsp;]<br>},"
	return string;
}
function getStringContentNoFormat() { // get the string content
	var string='{name:"Custom Level",bases:[';
	for (var i=0; i<config.bases.length;i++) {
		string = string + "{ownership:"+config.bases[i].ownership+",x:"+config.bases[i].x_norm.toFixed(2)+",y:"+config.bases[i].y_norm.toFixed(2)+",levelMax:"+config.bases[i].levelMax+"},"
	}
	string = string +"]},"
	return string;
}

function getCustomLevel() { //function to get the bases as an object, like those in the normal bases vector
	var bases = [];
	for (var i=0; i<config.bases.length;i++) {
		xTrunc = Math.round(config.bases[i].x_norm*100)/100;
		yTrunc = Math.round(config.bases[i].y_norm*100)/100;
		var newBase = {
			ownership: config.bases[i].ownership,
			x: xTrunc,
			y: yTrunc,
			levelMax: config.bases[i].levelMax
		}
		bases.push(newBase);
	}
	var customLevel = {name: "Custom Level",bases:bases};
	return customLevel;
}
function saveCustomLevel() {
	var customLevel = getCustomLevel();
	const myJSON = JSON.stringify(customLevel);
	localStorage.customLevel = myJSON;
}


//
//==============================================
// Config & state
//==============================================
//
function clearBases() {
	config.bases=[];
	reDrawBases(config.bases);
}

function startLevelEditor() {
	config=getConfigLE();
	// size both canvases
	config.canvas.width = window.innerWidth-2;
	config.canvas.height = window.innerHeight;
	config.canvasBases.width = window.innerWidth-2;
	config.canvasBases.height = window.innerHeight;
	drawCanvasLE();
	// Check if there is an existing custom level
	if (typeof(localStorage.customLevel) !== "undefined")  {// if it exists
		// replace the content of the level editor base vector with this one
		// Get the custom level as an object
		customLevel=loadCustomLevel();
		// Map the properties
		for (var i=0;i<customLevel.bases.length;i++) {
			var newBase= {
				x_final:customLevel.bases[i].x*window.innerWidth,
				x_norm :customLevel.bases[i].x,
				y_final:customLevel.bases[i].y*window.innerHeight,
				y_norm :customLevel.bases[i].y,
				baseIsSelected:false,
				ownership:customLevel.bases[i].ownership,
				levelMax:customLevel.bases[i].levelMax
			}
			// push the new object into the base vector
			config.bases.push(newBase);
		}
	} 
	else {} // if it does not
	reDrawBases(config.bases);
}
function loadCustomLevel() {
	if (localStorage.customLevel) {
		var text = localStorage.getItem("customLevel");
		var obj = JSON.parse(text);
		return obj;
	}
	else {alert("No custom levels saved")}
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
	
	//------------------------
	// draw grid
	//------------------------
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
	//------------------------
	// draw stay out rectangles
	//------------------------
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
	//------------------------
	// draw circles
	//------------------------
	config.ctx.beginPath();
	config.ctx.setLineDash([0]);
	//config.ctx.arc(width/2, height/2, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
	config.ctx.ellipse(width/2, height/2, 0.8*width/2, 0.8*height/2, 0, 0, Math.PI * 2);
	config.ctx.ellipse(width/2, height/2, 0.4*width/2, 0.4*height/2, 0, 0, Math.PI * 2);
	//config.ctx.lineWidth = 3;
	config.ctx.stroke();
	config.ctx.closePath();
	//------------------------
	// diagonals
	//------------------------
	config.ctx.beginPath();
	config.ctx.moveTo(0, 0);
	config.ctx.lineTo(width, height);
	config.ctx.stroke();
	config.ctx.closePath();
	
	config.ctx.beginPath();
	config.ctx.moveTo(width, 0);
	config.ctx.lineTo(0, height);
	config.ctx.stroke();
	config.ctx.closePath();
}
function reDrawBases(bases) {
	// clear the canvas so all objects can be 
    // redrawn in new positions
	var width=window.innerWidth;
	var height = window.innerHeight;
    config.ctxBases.clearRect(0, 0, width, height);
	// Draw everybase within the base vector
		for (var i=0; i<bases.length;i++) {
			drawBaseLE(bases[i]);
		}
}
function drawBaseLE(base) {
	var colorSelected = 'rgba(255,255,0,1)';
	var colorDefault = 'rgba(255,255,255,1)';
	var colorPlayer = config.players[base.ownership].playerColour;


		config.ctxBases.strokeStyle = colorPlayer;
		config.ctxBases.fillStyle = colorPlayer;

	

	// Draw circles around bases according to max level
	for (var i = 1; i < base.levelMax; i++) {
		config.ctxBases.beginPath();
		config.ctxBases.setLineDash([0]);
		config.ctxBases.arc(base.x_final, base.y_final, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
		config.ctxBases.lineWidth = 3;
		config.ctxBases.stroke();
		config.ctxBases.closePath();
	}
	
	// Draw the plain base center

		config.ctxBases.beginPath();
		config.ctxBases.arc(base.x_final, base.y_final, config.defaultBaseSize, 0, Math.PI * 2);
		config.ctxBases.closePath();
		config.ctxBases.lineWidth = 1;
		config.ctxBases.fill();
	
	if (base.baseIsSelected) {
		config.ctxBases.strokeStyle = colorSelected;
		config.ctxBases.fillStyle = colorSelected;
	}
		// Draw a dashed line showing the maximum area
	for (var i = 4; i < 5; i++) {
		config.ctxBases.beginPath();
		config.ctxBases.setLineDash([5, 3]);
		config.ctxBases.arc(base.x_final, base.y_final, config.defaultBaseSize + i * config.levelSizeIncrease, 0, Math.PI * 2);
		
		config.ctxBases.lineWidth = 3;
		config.ctxBases.stroke();
		config.ctxBases.closePath();
	}
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
	

	// Draw a vector base only for bases with no ownership
	if (base.ownership == config.players[0] || base.conquership != 100) {
		config.ctxBases.beginPath();
		config.ctxBases.arc(base.x, base.y, baseSize, 0, Math.PI * 2);
		config.ctxBases.closePath();
		config.ctxBases.strokeStyle = "black";
		config.ctxBases.lineWidth = 1;
		config.ctxBases.fillStyle = 'rgba(250,250,250,0.4)';
		config.ctxBases.fill();
	}//config.ctx.stroke();

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
		playerColour: 'rgba(255,255,255,0.4)',
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