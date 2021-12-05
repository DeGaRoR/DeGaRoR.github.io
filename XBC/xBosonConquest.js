// version de Julien
//==============================================
// Events
//==============================================
//
document.onreadystatechange = function () {
	var state = document.readyState
	if (state == 'complete') {
		document.getElementById('loadingScreen').hidden = true;
		document.getElementById('visibleElements').hidden = false;
		document.getElementById('tsparticles').hidden = true;
	}
};
window.onload = function() {
	setBackground();
	checkStorage();
	//setButtonIndicators();
	buildLevelsMenu();
	//checkCustomLevelButton();
	showMasterMenu();
	initializeHack();
	//playMusic('musicMenu');
	document.getElementById('buttonVolumeMainMenu').style.display="none" // hide the volume control on first load, since autoplay is disabled anyways. We will show it later when the user has interacted
	};
window.onresize = function() {sizeBgCanvas(); placeCanvas(drawSpace); placeCanvas(canvasBases);};
window.addEventListener("touchmove", function(event) {
       let target = event.target;
       if (target.id === "body") {
           event.preventDefault();
       }
 });
 function initializeHack() {
	var button = document.getElementById('unlockIcon');
   var count = 0;
   var threshold = 50;

   button.addEventListener('click', function(e) {
       e.preventDefault();
       count++;
  
       if(count == threshold){
           alert("Who told you to click on the lock like a maniac? Enjoy the unlocked levels, you maniac.");
		   unlockAll();
		   count=0;
       }
    }, false); 
 }
 
var persistData = {
	timePace: 10,
	initialScale: 1,
	mutedOverall : false
}
//
//==============================================
// Music and sounds
//==============================================
//
function playMusic(audioElem) {
	// Play only if not intentionally muted
	if (!persistData.mutedOverall) {
		var audioElemList = ['musicMenu','musicGame'];
		var music = document.getElementById(audioElem);
		// stop all the musics but the one
		for (var i=0;i<audioElemList.length;i++) {
			if (audioElem == audioElemList[i]) {var promise = music.play();}
			else {stopMusic(audioElemList[i]);}
		}
		if (promise !== undefined) {
		  promise.then(_ => {
			// Play succeeded
			console.log("Play succeeded");
			music.muted=false;
		  }).catch(error => {
			// Autoplay not allowed!
			// Mute music and try to play again
			console.log("Autoplay not allowed! Mute music and try to play again");
			//music.muted = true;
			//music.play();

			// Show something in the UI that the video is muted
		  });
		}
	}
}

function stopMusic(audioElem) {
	var music = document.getElementById(audioElem);
	music.pause();
}
function muteUnMute(audioElem) {
	var myAudio = document.getElementById(audioElem);
	// check if it is playing, stop if it is
	if (myAudio.duration > 0 && !myAudio.paused) {stopMusic(audioElem); persistData.mutedOverall=true;setVolumeButtonIcon(true)} 
	// and play if it is not
	else {persistData.mutedOverall=false; playMusic(audioElem);setVolumeButtonIcon(false)}
}
function setVolumeButtonIcon(mutedStatus) {
	//choose the correct icons according to status
	if (mutedStatus) {var appropriateIcon='<i class="material-icons">volume_up</i>'}
	else {var appropriateIcon='<i class="material-icons">volume_off</i>'}
	// Loop through all buttons with a certain class
	var volumeButtons = document.getElementsByClassName("buttonVolumeMenu");
	for (var i = 0; i < volumeButtons.length; i++) {
	   volumeButtons.item(i).innerHTML=appropriateIcon;
	}
	// Also update the ingame menu element
	document.getElementById('musicButtonInGame').innerHTML = appropriateIcon;
}

//
//==============================================
// Navigation between different sections
//==============================================
//

function showMasterMenu() {
	updateIndicatorsMasterMenu();
	playMusic('musicMenu');
	showOnly('masterMenu');
	document.getElementById('buttonVolumeMainMenu').style.display="inline";
}
function showLevelEditor() {
	gtag("event", "levelEditor_start", {});
	showOnly('levelEditor');
	playMusic('musicMenu');
	startLevelEditor();
}
function showLevelChooser() {
	playMusic('musicMenu');
	showOnly('LevelChooser');

}
function showCredits() {
	gtag("event", "show_credits", {});
	showOnly('credits');

}
function showOnly(DOMelemID) {
	// List all full screen sections that can be shown stand-alone, within the "visible elements" div
	var sectionList=[
		"masterMenu",
		"LevelChooser",
		"gameUI",
		"levelEditor",
		"credits"
	];
	for (var i=0;i<sectionList.length;i++) {
		if (DOMelemID == sectionList[i]) {document.getElementById(sectionList[i]).hidden=false;}
		else {document.getElementById(sectionList[i]).hidden=true;}
	}
}

//
//==============================================
// Master Menu
//==============================================
//
function donateAction() {
	gtag("event", "donation_intent", {});
	alert("Very nice of you, but we have not yet set a payment system :/ Thanks in any case!");
	
}

function goToPugface() {
	gtag("event", "visit_pugface", {
		source:'more games button'
	});
}
function shareXBC() {
	gtag("event", "intent_to_share", {
		source: 'Master menu'
	});
	alert("We have not yet implemented the sharing system (either...), but you would help us by using your browser integrated share button");
}
function updateIndicatorsMasterMenu() {
	// calculate the sums first
	var levels = getLevels();
	var nLevels = levels.length;
	var sumStars = 0;
	var statusLevelLock = getStatusLevelLock();
	var sumLocks = 0;
	for (i=1; i< nLevels+1; i++) {
		var level = "level" + i;
		// initialize localStorage for all levels
		if(localStorage[level]) {sumStars = sumStars + parseInt(localStorage[level])};
		sumLocks = sumLocks + statusLevelLock[i];
	}
	var sumUnlocked = nLevels-sumLocks
	var stringStars = sumStars+"/"+nLevels*3;
	var stringLocks = sumUnlocked+"/"+nLevels;
	
	console.log("Stars: "+sumStars+"/"+nLevels*3+", locks: "+sumLocks+"/"+nLevels);
	// put the correct sums into the html elements
	var divScoreStars = document.getElementById("sumStars");
	var divScoreLocks = document.getElementById("sumUnlocked");
	divScoreStars.innerHTML=stringStars;
	divScoreLocks.innerHTML=stringLocks;
}

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
	if (typeof(config) !== 'undefined') {
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
		big_object_1 : 	[	
							document.getElementById("big_object_1"),
							document.getElementById("big_object_1_y"),
							document.getElementById("big_object_1_r"),
							document.getElementById("big_object_1_b"),
							document.getElementById("big_object_1"),
							document.getElementById("big_object_1_r"),
							document.getElementById("big_object_1_r"),
							document.getElementById("big_object_1_b"),
							document.getElementById("big_object_1_r"),
							document.getElementById("big_object_1_y"),
							document.getElementById("big_object_1_b"),
							document.getElementById("big_object_1_r"),
						],
		big_object_2 : 	[	
							document.getElementById("big_object_2"),
							document.getElementById("big_object_2_y"),
							document.getElementById("big_object_2_r"),
							document.getElementById("big_object_2_b"),
							document.getElementById("big_object_2"),
							document.getElementById("big_object_2_r"),
							document.getElementById("big_object_2_r"),
							document.getElementById("big_object_2"),
							document.getElementById("big_object_2_r"),
							document.getElementById("big_object_2_y"),
							document.getElementById("big_object_2_b"),
							document.getElementById("big_object_2_r"),
						],
		big_object_3 : 	[	
							document.getElementById("big_object_3"),
							document.getElementById("big_object_3_y"),
							document.getElementById("big_object_3_r"),
							document.getElementById("big_object_3_b"),
							document.getElementById("big_object_3"),
							document.getElementById("big_object_3_r"),
							document.getElementById("big_object_3_r"),
							document.getElementById("big_object_3_b"),
							document.getElementById("big_object_3_r"),
							document.getElementById("big_object_3_y"),
							document.getElementById("big_object_3_b"),
							document.getElementById("big_object_3_r"),
						],
		bgColor : 		[	
							"#59f1ff",//pale blue
							"#A9D800",//green
							"#cf8f89",//red
							"#0052b9",//dark blue
							"#4C0E44",//dark red
							"#FFA357",//orange
							"#91004A",//pink
							"#4B0075",//dark purple
							"#B87B00",//drak orange
							"#225E29",//dark green
							"#0D0D10",//almost black blue
							"#4C0E44",//dark red
						],
	}
}
function sizeBgCanvas() {
	bgConfig.background_canvas.width = window.innerWidth-2;
	bgConfig.background_canvas.height = window.innerHeight;
}
function setBackground(section) {
	
	section = section || 1;
	// Get the configuration in a proper object, no global or local scope
	bgConfig = getBgConfig();
	// size canvas
	sizeBgCanvas();
	// create large objects
	for (var i=0; i<bgConfig.nLargeObjects;i++) {
		var imgL = selectRandom3(bgConfig.big_object_1[section-1], bgConfig.big_object_2[section-1], bgConfig.big_object_3[section-1]);
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
	// Change the satic background color
	document.body.style.backgroundColor = bgConfig.bgColor[section-1];
}
function animateBackground() {
	bgReqID = requestAnimationFrame(animateBackground);
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
function getLevelNames() {
	var levels=getLevels();
	var nLevels = levels.length;
	var levelNames = [];
	for (var i=0;i<nLevels;i++) {
		levelNames[i]=levels[i].name;
	}
	return levelNames;
}
//
//==============================================
// Game UI
//==============================================
//

function checkStorage() {
	// Version 2 on 10/11/2021 with 99 levels ordered from easy to hard
	var storageVersionNumber = 2;
	// test local storage support
	if (typeof(Storage) !== "undefined") {
		console.log("localStorage supported");
	} else {
		console.log("localStorage NOT supported");
	}
	
	//localStorage.clear();
	// if no local storage yet (first time)
	if (typeof localStorage.firstTime == 'undefined') {
		console.log("no local storage defined yet - Initializing");
		initializeLocalStorage(storageVersionNumber);
		}
	
	else {
		console.log("local storage exists");
		// if this is an old version
		if (typeof localStorage.storageVersionNumber == 'undefined' || localStorage.storageVersionNumber<storageVersionNumber) {
			M.toast({html : '<div style="font-size : 40px; padding:10px; "><i class="fas fa-grin-beam-sweat"></i></div><div>An older version has been detected. Your previous scores are not valid anymore and have been deleted, sorry :/</div>',displayLength : 10000});
			localStorage.clear();
			initializeLocalStorage(storageVersionNumber);
		}
		else {console.log("Versions of the scoring system match, enjoy your previous ratings!");}
	}
}
function initializeLocalStorage(storageVersionNumber) {
		var levels = getLevels();
		var nLevels = levels.length;
		localStorage.firstTime = 'false';
		// record the storage version number, so we can version control later and remove invalid scores
		localStorage.storageVersionNumber=storageVersionNumber;
		for (i=1; i< nLevels+1; i++) {
			var level = "level" + i;
			// initialize localStorage for all levels
			localStorage[level] = 0;
		}
}
function unlockAll() {
		var levels = getLevels();
		var nLevels = levels.length;
		for (i=1; i< nLevels+1; i++) {
			var level = "level" + i;
			// initialize localStorage for all levels
			localStorage[level] = 3;
		}
}
function ShowConfirmReturnHome() {document.getElementById('confirmBoxReturnHome').hidden = false;}
function hideConfirmReturnHome() {document.getElementById('confirmBoxReturnHome').hidden = true;}
function ShowConfirmRestart() {document.getElementById('confirmBoxRestart').hidden = false;}
function hideConfirmRestart() {document.getElementById('confirmBoxRestart').hidden = true;}
function backToChoice() {
	persistData.timePace = state.timePace;
	level=config.level;
	state.abandon = true;
	//setButtonIndicators();
	buildLevelsMenu(Math.ceil(level/9));
	document.getElementById('tsparticles').hidden = true;
	showLevelChooser();
	
}
function showMenu() {
	var pauseBackground = document.getElementById("pauseBackground");
	if (state.gamePaused) {
		unPauseGame(); 
		state.gamePaused = false;
		pauseBackground.hidden=true;
	}
	else {
		state.previousTimePace = state.timePace;
		//document.getElementById('inGameMenu').hidden = false;
		pauseGame();
		state.gamePaused = true;
		setSpeedIndicator(state.previousTimePace);
		pauseBackground.hidden=false;
	}
	
}
function hideMenu() {
	//document.getElementById('inGameMenu').hidden = true;
	unPauseGame();
}
function setSpeedIndicator(speed) {
	//document.getElementById("speedIndicator").innerHTML = speed + "x";
}
function showNextLevels(currentLevel) {
	var nextLevel = currentLevel + 1;
	var currentDivName = "levelsButtons0" + currentLevel.toString();
	var nextDivName = "levelsButtons0" + nextLevel.toString();
	console.log(currentDivName);
	document.getElementById(currentDivName).hidden = true;
	document.getElementById(nextDivName).hidden = false;
	
	cancelAnimationFrame(bgReqID);
	setBackground(nextLevel);
}
function showPreviousLevels(currentLevel) {
	var prevLevel = currentLevel - 1;
	var currentDivName = "levelsButtons0" + currentLevel.toString();
	var prevDivName = "levelsButtons0" + prevLevel.toString();
	console.log(currentDivName);
	document.getElementById(currentDivName).hidden = true;
	document.getElementById(prevDivName).hidden = false;
	
	cancelAnimationFrame(bgReqID);
	setBackground(prevLevel);
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
// Levels menu
//==============================================
//
/* function checkCustomLevelButton() {
	if (typeof(localStorage.customLevel) !== "undefined")  {document.getElementById('playCustomLevel').style.display='fixed';}
	else {document.getElementById('playCustomLevel').style.display='none';}
} */
function getConfigMenu() {
	configMenu={
		arrowUpClass1:"fas",
		arrowUpClass2:"fa-arrow-up",
		arrowDownClass1:"fas",
		arrowDownClass2:"fa-arrow-down",
		lockClass1:"fas",
		lockClass2:"fa-lock",
		starEmptyClass1:"far",
		starEmptyClass2:"fa-star",
		starFullClass1:"fas",
		starFullClass2:"fa-star",
		starFullClass3:"yellow-text",
		titleSections: ["TIER 1 / HELLO WORLD","TIER 2 / ","TIER 3","TIER 4","TIER 5","TIER 6","TIER 7","TIER 8","TIER 9","TIER 10","TIER 11"],
		hackyClicksRequired:20
	};
	return configMenu;
}
function buildLevelsMenu(sectionToShow) { //This function builds the levels menu automatically from the levels file
	// We are in the normal game, so let's hide the hacky restart button for custom levels
	document.getElementById("restartLE").style.display = 'none';
	document.getElementById("restartNormal").style.display = 'inline';
	document.getElementById("homeLE").style.display = 'none';
	document.getElementById("homeNormal").style.display = 'inline';
	//
	var configMenu=getConfigMenu();
	// If invoked with no arguments, show the section 1 by default
	if (!sectionToShow) {sectionToShow=1; console.log("Build menu invoked without arguments, initializing on level 1")} else {console.log("Build menu and displaying section "+sectionToShow)}
	
	console.log("Starting building the levels menu");
	var nLevelsPerSection = 9;
	var nLevelsPerRow = 3;
	var lastLevelBuilt = 0;
	// Get the vector with the levels
	var levels = getLevels();
	var nLevels = levels.length
	// Determine how many sections of nine levels are required based on the vector length
	var nSections = Math.ceil(nLevels/nLevelsPerSection);
	console.log("Found "+nLevels+" levels. Attempting to create "+nSections+" sections of "+nLevelsPerSection+" levels");
	
	
	//Get the div holding the section
	var sectionDiv=document.getElementById("levelContent");
	// Clear it first
	sectionDiv.innerHTML='';
	// Loop through all sections
	for (var i=1;i<nSections+1;i++) {
		//=====================
		// Add the first section
		//=====================
		var newSection = document.createElement("DIV");
		newSection.id = "levelsButtons0"+i;
		newSection.classList.add("menuCenter");
		newSection.classList.add("buttonsMenu");
		if (i!=sectionToShow) {newSection.hidden=true;}
		sectionDiv.appendChild(newSection);
		//-----------------
		// Previous button
		//-----------------
		// Add a row
		var newRow = document.createElement("DIV");
		newRow.classList.add("row");
		newSection.appendChild(newRow);
		// Add an s12 column
		var newCol = document.createElement("DIV");
		newCol.classList.add("col");
		newCol.classList.add("s12");
		newRow.appendChild(newCol);
		// Add the previous button
		var newButton = document.createElement("BUTTON");
		newButton.classList.add("buttonNextPrev");
		newButton.ariaLabel = "Towards easier levels";
		//Do not put an action on the first one
		if(i>1) {newButton.setAttribute('onclick','showPreviousLevels('+i+')');}
		else {newButton.classList.add("invisible");}
		newCol.appendChild(newButton);
		// Add the button icon
		var newI = document.createElement("I");
		newI.classList.add(configMenu.arrowUpClass1);
		newI.classList.add(configMenu.arrowUpClass2);
		newI.ariaHidden=true;
		newButton.appendChild(newI);
		//-----------------
		// Group Title
		//-----------------
 		// Add a row
		var newRow = document.createElement("DIV");
		newRow.classList.add("row");
		newSection.appendChild(newRow);
		// Add an s12 column
		var newCol = document.createElement("DIV");
		newCol.classList.add("col");
		newCol.classList.add("s12");
		newCol.classList.add("levelGroupTitle");
		newCol.innerHTML=configMenu.titleSections[i-1];
		newRow.appendChild(newCol); 
		//-----------------
		// Level buttons
		//-----------------
		// Build 3 rows
		for (var j=0;j<3;j++) {
			// do not do anything if we reached the last level
			
			// Add a row
			var newRow = document.createElement("DIV");
			newRow.classList.add("row");
			newSection.appendChild(newRow);
			// Build 3 columns inside each row
			for (var k=0;k<3;k++) {
				if (lastLevelBuilt == nLevels) {break}
				var currentLevel = lastLevelBuilt+1;
				// Add the column to host the button
				var newCol = document.createElement("DIV");
				newCol.classList.add("col");
				newCol.classList.add("s4");
				newCol.classList.add("m2");
				if (k==0) {newCol.classList.add("offset-m3");}
				newCol.classList.add("demoDiv");
				newRow.appendChild(newCol);
				// Add the button
				var newButton = document.createElement("BUTTON");
				newButton.id="btnLevel"+currentLevel;
				newButton.classList.add("buttonMain");
				newButton.setAttribute('onclick','startGame('+currentLevel+')')
				newCol.appendChild(newButton);
				// Add the lock if needed
				var statusLevelLock=getStatusLevelLock();
				if (statusLevelLock[currentLevel] == 1) {
					var newDiv=document.createElement("DIV");
					newDiv.classList.add("lockIcon");
					newDiv.id="lock";
					newButton.appendChild(newDiv);
					var newI=document.createElement("I");
					newI.classList.add(configMenu.lockClass1);
					newI.classList.add(configMenu.lockClass2);
					newDiv.appendChild(newI)
				}
				// Add the button text
				var newDiv=document.createElement("DIV");
				newDiv.classList.add("row");
				newDiv.innerHTML = currentLevel;
				newButton.appendChild(newDiv);
				// Add the stars
				var newDiv=document.createElement("DIV");
				newDiv.classList.add("row");
				newDiv.classList.add("starIcon");
				newButton.appendChild(newDiv);


				// Create the elements empty star, full star and the receiving columns, 3 times
				var starFull=[];
				var starEmpty=[];
				var divStar=[];
				for (l=1;l<4;l++) {
					starFull[l] = document.createElement("I");
					starFull[l].classList.add(configMenu.starFullClass1);
					starFull[l].classList.add(configMenu.starFullClass2);
					starFull[l].classList.add(configMenu.starFullClass3);
					
					starEmpty[l] = document.createElement("I");
					starEmpty[l].classList.add(configMenu.starEmptyClass1);
					starEmpty[l].classList.add(configMenu.starEmptyClass2);
					
					divStar[l] = document.createElement("DIV")
					divStar[l].classList.add("col");
					divStar[l].classList.add("s4");
					
					newDiv.appendChild(divStar[l]);
				}
				// Fill in the stars according to recorded game state
				var level = "level" + currentLevel;
				if (localStorage[level] == "1") 		{divStar[1].appendChild(starFull[1]);	divStar[2].appendChild(starEmpty[2]);	divStar[3].appendChild(starEmpty[3]);	}
				else if (localStorage[level] == "2") 	{divStar[1].appendChild(starFull[1]);	divStar[2].appendChild(starFull[2]);	divStar[3].appendChild(starEmpty[3]);	}
				else if (localStorage[level] == "3") 	{divStar[1].appendChild(starFull[1]);	divStar[2].appendChild(starFull[2]);	divStar[3].appendChild(starFull[3]);	}
				else 									{divStar[1].appendChild(starEmpty[1]);	divStar[2].appendChild(starEmpty[2]);	divStar[3].appendChild(starEmpty[3]);	}
				
				
				// Record the last level built
				lastLevelBuilt=currentLevel;
			}
		}
		//-----------------
		// Next button
		//-----------------
		// Only add the button if this is not the last section
		if (i<nSections) {
		// Add a row
			var newRow = document.createElement("DIV");
			newRow.classList.add("row");
			newSection.appendChild(newRow);
			// Add an s12 column
			var newCol = document.createElement("DIV");
			newCol.classList.add("col");
			newCol.classList.add("s12");
			newRow.appendChild(newCol);
			// Add the previous button
			var newButton = document.createElement("BUTTON");
			newButton.classList.add("buttonNextPrev");
			newButton.ariaLabel = "Towards harder levels";
			newButton.setAttribute('onclick','showNextLevels('+i+')')
			newCol.appendChild(newButton);
			// Add the button icon
			var newI = document.createElement("I");
			newI.classList.add(configMenu.arrowDownClass1);
			newI.classList.add(configMenu.arrowDownClass2);
			newI.ariaHidden=true;
			newButton.appendChild(newI);
		}
/* 		// Add the button for level editor beta
		// Add a row
			var newRow = document.createElement("DIV");
			newRow.classList.add("row");
			newSection.appendChild(newRow);
			// Add an s12 column
			var newCol = document.createElement("DIV");
			newCol.classList.add("col");
			newCol.classList.add("s12");
			newRow.appendChild(newCol);
			
		var newA=document.createElement("A");
		newA.classList.add(waves-effect);
		newA.classList.add(waves-light);
		newA.classList.add(btn);
		//newA.href="levelEditor.html";
		newA.innerHTML="Level editor (alpha)";
		newCol.appendChild(newA); */
		
	}
	
	
}

function doNothing() {}
function getStatusLevel(levelNumber) {
	//Parse the content of the local storage into a proper vector
	var levels=getLevels();
	var nLevels=levels.length;
	var statusLevel=[]
	for (var i=1;i<=nLevels;i++) {
		var storageKey="level"+i;
		statusLevel[i]=localStorage[storageKey];
	}
	if(levelNumber) {return statusLevel[levelNumber];}
	else return statusLevel;
	
}
function getStatusLevelLock() {
	var levels=getLevels();
	var nLevels=levels.length;
	var statusLevelLock=[]
	var statusLevel=getStatusLevel();
	for (var i=1;i<=nLevels;i++) {
			// if the previous level is won, unlock the next one
			if (statusLevel[i-1] > 0) {statusLevelLock[i]=0;}
			// in any other case, lock the level
			else {statusLevelLock[i]=1;}
		}
	// Ensure that level 1 is unlocked in any case
	statusLevelLock[1]=0;
	return statusLevelLock;
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
	var phage3D_L = document.getElementById("phage3D_L");
	var phage3D_S = document.getElementById("phage3D_S");
	var phage3D_M = document.getElementById("phage3D_M");
	
	
	
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
	var player4 = {
		playerName: "Phage",
		playerColour: "#FF7F00",//"#FF0700",
		controlType: 1,
		AIType: 1, // 0 for random AI, 1 for released AI
		imgBase: [phage3D_S,phage3D_M,phage3D_L],
		baseSize: [300 * sizeFactor,350 * sizeFactor,400 * sizeFactor],
	}
	players.push(player4);

	return players;
}
function loadCustomLevel() {
	if (localStorage.customLevel) {
		var text = localStorage.getItem("customLevel");
		var obj = JSON.parse(text);
		return obj;
	}
	else {alert("No custom levels saved")}
}

function getBases(players, canvas, selectedLevel, maxHealth, minConquership) {
	var newBases = [];
	var w = canvas.width;
	var h = canvas.height;
	var levels = getLevels();
	// ability to start from the level editor directly with a little trick
	if (selectedLevel == 0) {
		// Bases = output from the editor
		customLevel=loadCustomLevel();
		bases = customLevel.bases;
	}
	else { var bases = levels[selectedLevel-1].bases;}
	
	
	
	// push the bases from the selected level into the bases vector
	for (i=0; i<bases.length; i++) {
		newBases[i]=bases[i];
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
		gamePaused:false,
		currentLevel: 0,
		tutoMessagesSeen: [0,0,0,0,0,0,0,0,0,0]
	};
}
function placeCanvas(canvas) {
	// Center the canvas using margins - so the click events are not confused...
	canvas.style.marginLeft = persistData.marginCanvasWidth/2;
}
function sizeMainCanvas(canvas) {
	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;
}

function getHeight() {
	windowHeight = window.innerHeight;
	screenHeight = (screen.height/persistData.initialScale);
	if (screenHeight<windowHeight) {height=screenHeight;} else {height=windowHeight};
	return(height);
}
function getWidth() {
	windowWidth = window.innerWidth;
	screenWidth = (screen.width/persistData.initialScale);
	if (screenWidth<windowWidth) {width=screenWidth;} else {width=windowWidth};
	return(width);
}

function startGameLE(level) {
		// Set the correct buttons with right behaviours for the in game menu
		document.getElementById("restartLE").style.display = 'inline';
		document.getElementById("restartNormal").style.display = 'none';
		document.getElementById("homeLE").style.display = 'inline';
		document.getElementById("homeNormal").style.display = 'none';
		// Set the correct background
		cancelAnimationFrame(bgReqID);
		setBackground(1);
		// Start the game music
		playMusic('musicGame');
		
		// hide the level choice UI and show the game div
		document.getElementById('LevelChooser').hidden = true;
		//document.getElementById('levelEditor').hidden = true;
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
		// Put the level in state to access later
		state.currentLevel = level;
		// Off we go
		animate();
	}
function startGame(level) {
	// Check if the level is unlocked first
	var statusLevelLock=getStatusLevelLock();
	if (statusLevelLock[level] == 0) {
		// Send a Google analytics event
		gtag("event", "level_start", {level_name: String("level")});
		// Start the game music
		playMusic('musicGame');
		
		// Set the correct background
		var section = Math.ceil(level/9);
		cancelAnimationFrame(bgReqID);
		setBackground(section);
		
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
		// Put the level in state to access later
		state.currentLevel = level;
		// Off we go
		animate();
	}
	else {
		//Dismiss existing toasts before, otherwise deranged clickers will fill the screen
		M.Toast.dismissAll();
		M.toast({html : '<div style="font-size : 40px; padding:10px; color:orange;"><i class="fas fa-lock"></i></div><div>Win the previous level with at least 1 star to unlock this one</div>',displayLength : 3000});
		 
		//buildLevelsMenu();
	}
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
		config.ctx.strokeStyle = "#F57C00";
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
		var defendersNum = getDefendersNum(base);
		
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
function releasedAI(player) {
	// for each base owned by player
	for (var i=0; i<config.bases.length; i++) {
		base = config.bases[i];
		// get the numbers of defenders
		var defendersNum = getDefendersNum(base);
		// get the neighbours in a vector
		var neighbours = getNeighbours(base);
		var ennemyNeighbours = getEnnemyNeighbours(neighbours, base);
		var emptyNeighbours = getEmptyNeighbours(neighbours, base);
		var friendlyNeighbours = getFriendlyNeighbours(neighbours, base);
		// if base is owned by the player
		if (base.colour == player.playerColour) {
			//console.log("treating base "+i+" for AI________________________________________");
			// if adjacent to an ennemy
			if (ennemyNeighbours.length > 0) {
				//console.log("Adjacent to ennemy");
				var weakestEnnemy = findWeakest(ennemyNeighbours);
				// If large number of units compared to weakest
				if (defendersNum > getDefendersNum(weakestEnnemy) + weakestEnnemy.health + weakestEnnemy.conquership) {
					//console.log("%cCan crush its weakest ennemy - do it!",'color:red');
					// attack weakest ennemy with all available soldiers
					attack(base, weakestEnnemy,0);
				}
				// if enough units to conquer an empty sun and there are empty suns
				else if (defendersNum > config.minConquership && emptyNeighbours.length > 0) {
					//console.log("Not superior enough to attack, but empty suns can be conquered");
					// if base is not fully upgraded
					
						var chance = Math.random();
						// 40% chance: conquer empty sun
						if (chance < 0.4) {
							//console.log("%cLet's conquer it!",'color:blue');
							// conquer empty neighbour farthest from ennemy
							var target = findFarthestFromEnnemy(player, emptyNeighbours);
							attack(base, target, target.levelMax * config.minConquership);
						}
						// or upgrade
						else if (base.levelCurrent < base.levelMax) {
							//console.log("%cLet's rather upgrade",'color:green');
							upgrade(base);
						}
						else {
							//console.log("%cLet's conquer it!",'color:blue');
							// conquer empty neighbour farthest from ennemy
							var target = findFarthestFromEnnemy(player, emptyNeighbours);
							attack(base, target, target.levelMax * config.minConquership);
						}
					
				}
				else if (defendersNum > config.minConquership) {
					// attack random ennemy with few units
					//console.log("%cLet's harass a neighbour gently",'color:orange');
					attack(base, ennemyNeighbours[0], Math.round(defendersNum/3));
					//attack(base, ennemyNeighbours[0], 5);
				}
				else {
				//console.log('%cWait - not much to do now','color:grey');
				}
			}
			// not adjacent to ennemy sun
			else {
				//console.log("Not adjacent to ennemy");
				// if empty suns around
				if (emptyNeighbours.length > 0 && defendersNum > config.minConquership) {
					//console.log("Empty suns around");
					var chance = Math.random();
					if (chance < 0.25) {
						//console.log("%cLet's upgrade first",'color:green');
						upgrade(base);
					}
					else {
						// S colonize an empty sun farthest from ennemy
						var target = findFarthestFromEnnemy(player, emptyNeighbours);
						attack(base, target, target.levelMax * config.minConquership);
						//console.log("%cConquer the sun farthest from the ennemy",'color:blue');
					}
				}
				// if enough units to upgrade
				else if (defendersNum >= config.maxUpgradePoints && base.levelCurrent < base.levelMax) {
					//console.log("%cNo adjacent empty suns - But I can upgrade",'color:green');
					upgrade(base);
				}
				else {
					// if it can upgrade further
					if (base.levelCurrent < base.levelMax) {
						var chance = Math.random();
						if (chance < 0.25) {
						// move all soldiers to friendly base closer to ennemy
						//console.log("%cLet's reinforce another base",'color:purple');
						var target = findClosestToEnnemy(player, friendlyNeighbours, base);
						attack(base, target, 0);
						}
						else {
							//console.log("%cWait a little more",'color:grey');
						}
					}
					else {
						// move all soldiers to friendly base closer to ennemy
						console.log("%cLet's reinforce another base",'color:purple');
						var target = findClosestToEnnemy(player, friendlyNeighbours, base);
						attack(base, target, 0);
					}
				}
			}
		}
	}
}
function getEnnemyNeighbours(neighbours, base) {
	var ennemyNeighbours = [];
	for (var j=0; j<neighbours.length; j++) {
		var otherBase = neighbours[j]
		if (otherBase.ownership != base.ownership && otherBase.ownership != config.players[0]) {
			ennemyNeighbours.push(otherBase);
		}
	}
	return ennemyNeighbours;
}
function getEmptyNeighbours(neighbours, base) {
	var emptyNeighbours = [];
	for (var j=0; j<neighbours.length; j++) {
		var otherBase = neighbours[j]
		if (otherBase.ownership == config.players[0] || (otherBase.ownership == base.ownership && otherBase.conquership < config.minConquership)) {
			emptyNeighbours.push(otherBase);
		}
	}
	return emptyNeighbours;
}
function getFriendlyNeighbours(neighbours, base) {
	var friendlyNeighbours = [];
	for (var j=0; j<neighbours.length; j++) {
		var otherBase = neighbours[j];
		if (otherBase.ownership == base.ownership) {
			friendlyNeighbours.push(otherBase);
		}
	}
	return friendlyNeighbours;
}
function attack(sourceBase, targetBase, nUnits) {
	// Loop thoruhg all objects
	var nUnitsSent = 0;
	for (j = 0; j < state.objects.length; j++) {
		var object = state.objects[j];
		// take all the objects having sourceBase as motherbase
		if (object.motherBase == sourceBase && object.defensiveMode == true) {
			// send the units to the targets if "attack with all units command (nUnits = 0)" or not reached nUnits yet
			if (nUnits == 0 || nUnitsSent < nUnits) {
				setTarget(object, targetBase);
				object.defensiveMode = false;
				nUnitsSent = nUnitsSent+1;
			}
		}
	}
}
function findWeakest(ennemyNeighbours) {
	// for every ennemy sun
	var weakest = ennemyNeighbours[0];
	for (var j=0; j<ennemyNeighbours.length; j++) {
		ennemyNeighbour = ennemyNeighbours[j];
		if (getDefendersNum(ennemyNeighbour) + ennemyNeighbour.conquership + ennemyNeighbour.health < getDefendersNum(weakest) + weakest.conquership + weakest.health) {
			weakest = ennemyNeighbour;
		}
	}
	return weakest;
}
function findFarthestFromEnnemy(player, basesArray) {
	var farthest = basesArray[0];
	for (var i=0; i<basesArray.length; i++) {
		var otherBase = basesArray[i];
		var distToEnnemy = minDistToEnnemy(player, otherBase);
		if (distToEnnemy > minDistToEnnemy(player, farthest)) {
			farthest = otherBase;
		}
	}
	return farthest;
}
function findClosestToEnnemy(player, basesArray, base) {
	if (basesArray.length != 0 && typeof(basesArray) != 'undefined') {
		var closest = basesArray[0];
		for (var i=0; i<basesArray.length; i++) {
			var otherBase = basesArray[i];
			var distToEnnemy = minDistToEnnemy(player, otherBase);
			if (distToEnnemy < minDistToEnnemy(player, closest)) {
				closest = otherBase;
			}
		}
		if (minDistToEnnemy(player, closest) >= minDistToEnnemy(player, base)) {
			closest = base;
		}
	}
	else {closest = base;}
	return closest;
}
function getDefendersNum(base) {
	var nObjects = state.objects.length;
	var defendersNum = 0;
	if (base.ownership != config.players[0]) {
		for (var i = 0; i < nObjects; i++) {
			object = state.objects[i];
			if (object.defensiveMode == true && object.motherBase == base && base.ownership != config.players[0]) {
				defendersNum += 1;
			}
		}
		//console.log("Base of player "+base.ownership.playerName+" has "+defendersNum+" defenders");
	}
	return defendersNum;
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
	else {console.log("Not enough units to upgrade base");
	}
	
}
function findNeighboursCloserToEnnemy(base) { // returns an array of neighbours which are closer to the ennemy than "base"
	var neighboursCloserToEnnemy = [];
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
					neighboursCloserToEnnemy.push(otherBase);
				}
			}
		}
	}
	return neighboursCloserToEnnemy;
}
function getNeighbours(base) { // returns an array of neighbours which are closer to the ennemy than "base"
	var neighbours = [];
	for (var i = 0; i < config.bases.length; i++) {
		var otherBase = config.bases[i];
		// if it is another base
		if (otherBase != base) {
			// if other base close enough for being a neighbour
			if (distance(base.x, base.y, otherBase.x, otherBase.y) <= config.neighbourDistance) {
					neighbours.push(otherBase);
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
function countUnits(player) {
	var count = 0;
	for (var i = 0; i < state.objects.length; i++) {
		if (state.objects[i].ownership == player) {
			count=count+1;
		}
	}
	return count;
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
// Level Editor
//==============================================
//
//==============================================
// Events
//==============================================
//
/* window.onload = function() {
		startLevelEditor();
	}; */
// initialisation of  materialize components
document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.modal');
    var options = {opacity:0,onCloseStart: function() { clearSelectionLE(); }}
    var instances = M.Modal.init(elems, options);
});	


//
//==============================================
// LE - Mouse and selection
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
			var clickOnBase=isClickOnBaseLE(x_final,y_final);
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
function isClickOnBaseLE(x,y) {
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
// LE - UI + string composer
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
	for (var i=0;i<config.players.length;i++) {
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
// LE - Output functions
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
// LE - Config & state
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
/* function loadCustomLevel() {
	if (localStorage.customLevel) {
		var text = localStorage.getItem("customLevel");
		var obj = JSON.parse(text);
		return obj;
	}
	else {alert("No custom levels saved")}
} */

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
// LE - Draw functions
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



//
//==============================================
// Tutorial
//==============================================
//
function showTutorial(level, elapsedTime) {
	//console.log("tuto function invoked");
	if(level == 1) {
		//sendTuto(level,1,elapsedTime,1000,3000,'Hello and Welcome to X Boson Conquest');
		sendTuto(level,2,elapsedTime,1000,5000,'You are the blue cells',0,"Resources/Bases/cell3D_S.webp");
		sendTuto(level,3,elapsedTime,7000,5000,'The fungus is your enemy',0,"Resources/Bases/fungus3D_S.webp");
		//sendTuto(level,4,elapsedTime,9000,5000,'Cells produce units<br>With enough units, you can crush your enemy');
		sendTuto(level,5,elapsedTime,15000,30000,'Drag your finger or mouse to select<br>Click on the fungus to attack<br>Swipe this message away',1,"Resources/tuto/XBCTuto01.mp4");
	}
	if(level == 2) {
		//sendTuto(level,1,elapsedTime,1000,2000,'OK, you got the hang of it!');
		sendTuto(level,2,elapsedTime,1000,3000,'Well done!<br>Now, you should conquer other cells');
		sendTuto(level,3,elapsedTime,4000,25000,'Conquer the empty cells.<br>Swipe this away.',1,"Resources/tuto/XBCTuto02.mp4");
		sendTuto(level,4,elapsedTime,20000,10000,'An orange circle appears around damaged cells.<br>Send units to heal them');
		//sendTuto(level,5,elapsedTime,35000,5000,'Ennemy units cancel each other out');
		//sendTuto(level,6,elapsedTime,28000,25000,'You can now crush your enemy!');
		sendTuto(level,7,elapsedTime,30000,25000,'When you have more cells than your enemy,<br>time is in your favour.<br>Accumulate units, then destroy your enemy!');
		sendTuto(level,8,elapsedTime,60000,50000,'You do not have to conquer all cells to win,<br> you should just be the only one remaining');
	}
	if(level == 3) {
		//sendTuto(level,1,elapsedTime,1000,2000,'OK, you got the hang of it!');
		sendTuto(level,2,elapsedTime,1000,3000,"You're killing it!<br>Let's upgrade some cells now");
		sendTuto(level,3,elapsedTime,4000,8000,'Upgradeable bases are marked with circles<br>indicating the maximum level',0,"Resources/tuto/basesUpgrade.webp");
		sendTuto(level,4,elapsedTime,12000,6000,'Send your units towards your base to upgrade it');
		sendTuto(level,5,elapsedTime,19000,6000,'The circles around the base show the completion of the upgrade');
		sendTuto(level,6,elapsedTime,26000,10000,'Upgraded cells produce faster,<br>but they are not more resistant than basic cells');
		//sendTuto(level,6,elapsedTime,28000,25000,'You can now crush your enemy!');
		sendTuto(level,7,elapsedTime,40000,25000,'When you have higher level cells than your enemy,<br>time is in your favour.<br>Accumulate units, then destroy your enemy!');
		//sendTuto(level,8,elapsedTime,60000,50000,'You do not have to conquer all cells to win,<br> you should just be the only one remaining');
	}
		if(level == 4) {
		//sendTuto(level,1,elapsedTime,1000,2000,'OK, you got the hang of it!');
		sendTuto(level,2,elapsedTime,1000,3000,"You're almost ready!<br> Let's see what you can do against 2 opponents");
		sendTuto(level,3,elapsedTime,4000,8000,"Use the learnings of the previous lessons to defeat them both!");
		sendTuto(level,4,elapsedTime,13000,6000,'The levels will become increasingly difficult after this<br>Have fun!');
	}
}
function sendTuto(level,msgNum,elapsedTime,timeToTrigger,duration,tutoContent, videoEnabled, imgSrc){
	if(elapsedTime>timeToTrigger && state.tutoMessagesSeen[msgNum-1]!=1) {
			//console.log("first tuto message, cool");
			if (imgSrc && videoEnabled!=1) {tutoContent = tutoContent+'<img src='+imgSrc+' width="100" height="100" style="padding:5px"> '};
			if (imgSrc && videoEnabled==1) {tutoContent = tutoContent+'<video width="auto" height="200" style="padding:5px" autoplay loop><source src='+imgSrc+' type="video/mp4"></video>'};
			toastOptions = {
				html : tutoContent,
				displayLength : duration,
				};
			M.toast(toastOptions);
			state.tutoMessagesSeen[msgNum-1]=1;
		}
}
//
//==============================================
// Main
//==============================================
//
function animate(time) {
	// Behaviour at the end of the game
	if (state.gameWon == true) {
		//Dismiss all tuto toasts
		M.Toast.dismissAll();
		// compute game time
		state.levelFinishTime = Date.now();
		var gameTime = state.levelFinishTime-state.levelStartTime;
		console.log("Get out of the animate function since game won declared");
		var minutesWon = Math.floor(gameTime/60000);
		var secondsWon = Math.round((gameTime/1000) - (60 * minutesWon));
		// clear canvas
		config.ctx.clearRect(0, 0, config.canvas.width, config.canvas.height);
		// Update timePace
		persistData.timePace = state.timePace;
		
		// Get the list of levels
		var levels=getLevels();
		var nLevels=levels.length;
		//HTML part______
		// Update the behaviour of the next level button
		var nextLevelButton = document.getElementById('nextLevelButton');
		nextLevelButton.onclick = function() {
			document.getElementById('nextLevelMenu').hidden = true;
			document.getElementById('tsparticles').hidden = true;
			if (config.level < nLevels) {
				startGame(config.level+1);
			}
			else {
				alert("This was the last level");
				backToChoice();
			}
		};
		// Update the HTML message
		var winnerMessage = document.getElementById('winnerMessage');
		winnerMessage.innerHTML = "Victory for " + state.playerAlive.playerName + " <br> " + minutesWon + " min, " + secondsWon + " sec"
		document.getElementById('imageWinner').src=state.playerAlive.imgBase[2].src;
		// Display HTML element with "home" and "next level" buttons
		document.getElementById('nextLevelMenu').hidden = false;
		document.getElementById('tsparticles').hidden = false;
		// If the human player is the winner, show the next level button and ratings. Otherwise, only show the home button
		if (state.playerAlive==config.players[1]) {
			document.getElementById('starsWinMenu').hidden = false;
			document.getElementById('optionsWinner').hidden = false;
			document.getElementById('optionsLooser').hidden = true;
			gtag("event", "level_success", {
				level_name: String(config.level),
			});
		}
		else {
			document.getElementById('starsWinMenu').hidden = true;
			document.getElementById('optionsWinner').hidden = true;
			document.getElementById('optionsLooser').hidden = false;
			gtag("event", "level_loss", {
				level_name: String(config.level),
			});
		}
		
		
		// Local storage part ________
		// Update localStorage to indicate that the level is won
		var lsLevel = "level" + config.level;
		var score = "0";
		var starsWinMenu=document.getElementById("starsWinMenu");
		if (state.playerAlive.controlType == 0) {
			if (gameTime < 120000) {
				score = "3"; 
				starsWinMenu.innerHTML="<div class='col s4'><i class='fas fa-star yellow-text'></i></div><div class='col s4'><i class='fas fa-star yellow-text'></i></div><div class='col s4'><i class='fas fa-star yellow-text'></i></div>"
			}
			else if (gameTime < 300000) {
				score = "2"; 
				starsWinMenu.innerHTML="<div class='col s4'><i class='fas fa-star yellow-text'></i></div><div class='col s4'><i class='fas fa-star yellow-text'></i></div><div class='col s4'><i class='far fa-star'></i></div>"
			}
			else {
				score = "1"; 
				starsWinMenu.innerHTML="<div class='col s4'><i class='fas fa-star yellow-text'></i></div><div class='col s4'><i class='far fa-star'></i></div><div class='col s4'><i class='far fa-star'></i></div>"
			}
			if (parseInt(localStorage[lsLevel], 10)<score) {localStorage[lsLevel] = score;}
		}
		// Re-build the menu to correctly show the achievements
		buildLevelsMenu(Math.ceil(config.level/9));
		
		// exit animate function
		return;
	}
	if (state.abandon == true) {
		gtag("event", "level_abandon", {
			level_name: String(config.level),
		});
		//Dismiss all tuto toasts
		M.Toast.dismissAll();

		return;
	}
    // request another animation frame (always first call)
	// requestAnimationFrame pauses when the windows loses focus. If undesired, use setInterval instead
    reqID = requestAnimationFrame(animate);
	
	//var time = date.now();
	var timeDiff = time - state.prevTime;
	
	currentTime = Date.now();
	var elapsedTime = currentTime - state.levelStartTime;
	//call the tutorial
	showTutorial(state.currentLevel, elapsedTime);
	
	
	// Initialize new objects vector
	var newObjects = [];

	// Call the AI when it is time
	if (time > state.lastTurn + config.turnLength * state.spawnRate()) {
		//console.log("New AI round ////////////////////////////////////////////");
		for (var p = 1; p < config.players.length; p++) {
			player = config.players[p];
			if (player.controlType == 1) {
				//console.log("call AI move for player " + player.playerName + "===============================");
				if (player.AIType == 0) {randomAI(player); console.log("random AI");}
				else if (player.AIType == 1) {releasedAI(player); 
				//console.log("released AI");
				}
				else {releasedAI(player);}
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
		//console.log("canvasBases refresh");
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
	// update the indicator bars
	document.getElementById('indicatorBarCell').style.width		=(countUnits(config.players[1])*config.indicatorBarSizeFactor)+'px';
	document.getElementById('indicatorBarFungus').style.width	=(countUnits(config.players[2])*config.indicatorBarSizeFactor)+'px';
	document.getElementById('indicatorBarVirus').style.width	=(countUnits(config.players[3])*config.indicatorBarSizeFactor)+'px';
	
	
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
