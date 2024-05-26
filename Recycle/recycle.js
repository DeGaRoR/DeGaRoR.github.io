onmousedown = function(e) { ondown(e.clientX, e.clientY); };
onmousemove = function(e) { onmove(e.clientX, e.clientY); };  
onmouseup = function(e) { onup(e.clientX, e.clientY); };
ontouchstart = function(e) { ondown(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY);};
ontouchend = function(e) { onup(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };
ontouchmove = function(e) { onmove(e.changedTouches["0"].clientX, e.changedTouches["0"].clientY); };

startGame();

// Core functions
function startGame() {
	config = getConfig();
	state = getInitialState();
	buildAssetRelations();
	draw();
}
function buildAssetRelations(){
	var i=0;
	while (i<config.elementsArray.length) {
		var asset = config.elementsArray[i];
		if (asset.toDelete == "false") {
		x_out = asset.coord_x + asset.output[0][0];
		y_out = asset.coord_y + asset.output[0][1];;
		asset.output_cell[0] = getAssetOnCellID(x_out,y_out);
		console.log("Asset of type " + asset.type + " has as output asset ID " + asset.output_cell[0])
		}
		i++;
	}
};

function stepTime() {

	// initialize the hasMoved property for all garbage
	resetHasMoved();
	//loop through the elements and apply their respective actions
	applyElementAction();
	// Update the HTML info section
	updateInfo();
	//draw the canvas
	draw();
	highlight(state.cellSelected[0],state.cellSelected[1]);
}

function applyElementAction(){
	var i=0;
	// loop through all the elements
	while (i<config.elementsArray.length) {
		var asset = config.elementsArray[i];
		if (asset.toDelete == "false") {
			// generate garbage at the start
			if (asset.type == "start") {
				generateGarbage(asset);
			};
			//loop over the garbage and apply appropriate action to its garbage
			j = 0;
			while (j<state.garbageArray.length) {
				garbage = state.garbageArray[j];
				// if garbage is located on asset, apply the asset action to it
				if (garbage.onAssetID == i && garbage.hasMoved == false){asset.action(garbage);	}
				j++;
			}
		}
		i++;
	}
	//build a new garbageVector only with the elements that are not to be deleted
	var garbageArrayTemp = [];
	j = 0;
	while (j<state.garbageArray.length) {
		garbage = state.garbageArray[j];
		if (garbage.toDelete == false) {
			garbageArrayTemp.push(garbage)
		} 
		else {
			// push the garbage into the stock vector of its end element
			config.elementsArray[garbage.onAssetID].stock.push(garbage);
		};
		j++;
	}
	// replace the garbage vector with the newly constructed one
	state.garbageArray = garbageArrayTemp;
}

function resetHasMoved(){
	var j = 0;
	while (j<state.garbageArray.length){
		state.garbageArray[j].hasMoved = false;
		j++
	}
}


function updateInfo() {
	// Get the appropriate DIV and clean it
	var infoSection = document.getElementById("info");
	infoSection.innerHTML = "";
	
	
	
	//loop through assets
	var i=0;
	while (i<config.elementsArray.length) {
		var asset = config.elementsArray[i];
		// generate 1 div per storage type
		if (asset.type == "end") {
			// create an element
			var para = document.createElement("p");
			// compute and print the total garbage count
			var totCount = countGarbage(asset.stock,"toDelete",true);
			var node = document.createTextNode("Container "+asset.ID+" contains "+totCount+" pieces of garbage: ");
			para.appendChild(node);
			// compute and print the detailed garbage count
			// create a list container
			var ul = document.createElement("ul");
			var distinctColor = selectDistinctProperty(asset.stock,"color")
			for (l=0;l<distinctColor.length;l++) {
				var count = countGarbage(asset.stock,"color",distinctColor[l])
				var proportion = count/totCount;
				var li = document.createElement("li");
				var detailNode = document.createTextNode(count+" pieces of "+distinctColor[l]+" garbage ("+100*proportion+"%)");
				li.appendChild(detailNode);
				ul.appendChild(li);
				para.appendChild(ul);
			}
			
			infoSection.appendChild(para);

		};
		i++;
	};
}

function updateInfoElement(elementID) {
	// Get the appropriate DIV and clean it
	var infoSection = document.getElementById("info");
	infoSection.innerHTML = "";
	// create an element in any case
	var para = document.createElement("p");
	// Action in case the cell is empty
	if (elementID<0) {
		var node = document.createTextNode("This area is free for construction");
		para.appendChild(node);
	}
	// In case the cell is occupied by an element
	else {
		var asset = config.elementsArray[elementID];
		// print generic info for all elements
		if (asset.toDelete == "false") {
			var paraGeneric = document.createElement("p");
			var nodeGeneric = document.createTextNode("Asset type "+asset.type+" with ID "+asset.ID);
			paraGeneric.appendChild(nodeGeneric);
			para.appendChild(paraGeneric);
			// For elements of type container
			if (asset.type == "end") {
				// compute and print the total garbage count
				var totCount = asset.stock.length;
				var node = document.createTextNode("Container "+asset.ID+" contains "+totCount+" pieces of garbage: ");
				para.appendChild(node);
				// compute and print the detailed garbage count
				// create a list container
				var ul = document.createElement("ul");
				var distinctColor = selectDistinctProperty(asset.stock,"color")
				for (l=0;l<distinctColor.length;l++) {
					var count = countGarbage(asset.stock,"color",distinctColor[l])
					var proportion = count/totCount;
					var li = document.createElement("li");
					var detailNode = document.createTextNode(count+" pieces of "+distinctColor[l]+" garbage ("+100*proportion+"%)");
					li.appendChild(detailNode);
					ul.appendChild(li);
					para.appendChild(ul);
				}
			}
		}
	}
	infoSection.appendChild(para);

}

function updateActionsElement(elementID) {
	var buildSection = document.getElementById("buildSection");
	var deleteSection = document.getElementById("deleteSection");
	var equipment = config.elementsArray[elementID];
	if (elementID<0 || equipment.toDelete == "true") {buildSection.hidden = false; deleteSection.hidden=true;}
	else {buildSection.hidden = true; deleteSection.hidden=false;}
}

// utilities

function selectDistinctProperty(vector,property){
	var distinct = []
	for (var i = 0; i < vector.length; i++) {
		garbage = vector[i];
		var dupli = 0;
		for (var k=0; k<distinct.length; k++) {
			if (garbage[property] == distinct[k]) {dupli = dupli + 1}
		}
		if (dupli == 0) {distinct.push(garbage[property])}
	}
	return distinct;
};
function countGarbage(vector,property,value){
	i=0;
	count = 0;
	while(i<vector.length){
		garbage = vector[i];
		if(garbage[property] == value) {count = count + 1}
		i++;
	}
	return count;
};
function getAssetOnCellID(x,y){
	var i=0;
	var elementOnCell = -1;
	while (i<config.elementsArray.length) {
		var asset = config.elementsArray[i];
		if (asset.coord_x == x && asset.coord_y == y) {elementOnCell = i} 
		i++;
	}
	return (elementOnCell);
};

//mouse click
function ondown(x,y) {
	
	// figure out the cell clicked on
	// correct the input to account for margin - do better
	var bounds = document.getElementById("myCanvas").getBoundingClientRect();
	var x_rel = x - bounds.left;
    var y_rel = y - bounds.top;
/* 	margin_y=config.y0;
	margin_x=config.x0;
	x_corr=x-margin_x;
	y_corr=y-margin_y; */
	cell_x=Math.floor(x_rel/config.grid_space);
	cell_y=Math.floor(y_rel/config.grid_space);
	// check that the cell exists within the game zone
	if (cell_x<config.grid_x && cell_y<config.grid_y) {
		highlight(cell_x,cell_y);
		state.cellSelected=[cell_x,cell_y];
		assetID=getAssetOnCellID(cell_x,cell_y);
		// if there is an element on the cell
		updateInfoElement(assetID);
		updateActionsElement(assetID);
		
		console.log(x,y,"click detected on cell ",cell_x, cell_y," with assetID ",assetID);
	}
	else {console.log("Click outside playzone")}
}
function onup(x,y) {}
function onmove(x,y) {}


function relativeCoords ( event ) {
  var bounds = document.getElementById("myCanvas").getBoundingClientRect();
  var x = event.clientX - bounds.left;
  var y = event.clientY - bounds.top;
  return {x: x, y: y};
}

// rendering
function draw() {
	var c = document.getElementById("myCanvas");
	var ctx = c.getContext("2d");
	ctx.clearRect(0, 0, c.width, c.height);
	var i = 0;
	var j=0;
	var k=0;
	var l=0;
	//draw lines for grid
	while (i < config.grid_x+1) {
		ctx.moveTo(i*config.grid_space, 0);
		ctx.lineTo(i*config.grid_space, config.grid_y*config.grid_space);
		ctx.stroke();
		i++;
	}
	while (j < config.grid_y+1) {
		ctx.moveTo(0, j*config.grid_space);
		ctx.lineTo(config.grid_x*config.grid_space , j*config.grid_space);
		ctx.stroke();
		j++;
	}
	
	//draw the elements
	while (k < config.elementsArray.length) {
		asset = config.elementsArray[k];
		if (asset.toDelete == "false") {
			ctx.fillStyle = asset.color;
			ctx.fillRect(asset.coord_x*config.grid_space, asset.coord_y*config.grid_space, config.grid_space, config.grid_space);
			img = document.getElementById(asset.type);
			ctx.drawImage(img, asset.coord_x*config.grid_space, asset.coord_y*config.grid_space, config.grid_space, config.grid_space);
			
			ctx.font = "14px Arial";
			ctx.fillStyle = "black";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle"
			ctx.fillText(asset.ID, config.elementsArray[k].coord_x*config.grid_space+config.grid_space/2, config.elementsArray[k].coord_y*config.grid_space+config.grid_space/2);
		}
		k++;
	}
	
	//draw the garbage
	while (l < state.garbageArray.length) {
		garbage = state.garbageArray[l];
		ctx.fillStyle = garbage.color;
		if (garbage.randomSeedX<garbage.size) {positionX=garbage.coord_x + garbage.size} else if((garbage.randomSeedX+garbage.size)>1) {positionX=garbage.coord_x +garbage.randomSeedX-garbage.size} else {positionX=garbage.coord_x +garbage.randomSeedX};
		if (garbage.randomSeedY<garbage.size) {positionY=garbage.coord_y + garbage.size} else if((garbage.randomSeedY+garbage.size)>1) {positionY=garbage.coord_y +garbage.randomSeedY-garbage.size} else {positionY=garbage.coord_y +garbage.randomSeedY};
		//ctx.fillRect(positionX*config.grid_space, positionY*config.grid_space, config.grid_space*garbage.size, config.grid_space*garbage.size);
		ctx.beginPath();
		ctx.arc(positionX*config.grid_space,positionY*config.grid_space,config.grid_space*garbage.size,0,2*Math.PI);
		ctx.fill();
		ctx.stroke();
		//img = document.getElementById(config.elementsArray[k].type);
		//ctx.drawImage(img, config.elementsArray[k].coord_x*config.grid_space, config.elementsArray[k].coord_y*config.grid_space, config.grid_space, config.grid_space);
		l++;
	}

	
}
function highlight(cell_x,cell_y) {
	// redraw the canvas without highlights first
	draw();
	
	if (cell_x<config.grid_x && cell_y<config.grid_y) {
		var c = document.getElementById("myCanvas");
		var ctx = c.getContext("2d");
		ctx.fillStyle = "rgb(255 0 0 / 20%)";
		ctx.fillRect(cell_x*config.grid_space, cell_y*config.grid_space, config.grid_space, config.grid_space);

	}
}

// config functions
function conveyorAction(garbage, asset) {
	// change the coordinates by adding the output coordinates
	garbage.coord_x = garbage.coord_x + asset.output[0][0];
	garbage.coord_y = garbage.coord_y + asset.output[0][1];
	//assign next asset
	garbage.onAssetID = asset.output_cell[0];
	garbage.hasMoved = true;
}
function getConfig() {
	assetType = generateAssetTypes();
	elementsArray = generateElements(assetType);
	return {
		grid_x: 10,
		grid_y: 16,
		grid_space: 50,
		x0:0,
		y0:56,
		elementsArray: elementsArray,
		assetType: assetType
	}
}
function getInitialState() {
	return {
		garbageArray : [],
		processedGarbageArray : [],
		cellSelected: []
	}
}
function generateAssetTypes() {
	var assetType = [];
	var asset0 = {
		assetTypeID : 0,
		name: "start",
		color: "gainsboro",
		// relative X,Y coordinates for output and input
		input: [[0,0]],
		output: [[1,0]],
		action: function(garbage) {
			//console.log("This object is a "+this.name);
			conveyorAction(garbage, this);
			//generateGarbage(this);
		},
	}
	assetType.push(asset0);
	var asset1 = {
		assetTypeID : 1,
		name: "end",
		color: "gainsboro ",
		// relative X,Y coordinates for output and input
		input: [[-1,0]],
		output: [[0,0]],
		action: function(garbage) {
			//console.log("Test action object type "+garbage.type);
			garbage.toDelete = true;
			garbage.hasMoved = true;
		},
	}
	assetType.push(asset1);
	var asset2 = {
		assetTypeID : 2,
		name: "conveyor_lr",
		color: "gainsboro ",
		// relative X,Y coordinates for output and input
		input: [[-1,0]],
		output: [[1,0]],
		action: function(garbage) {
			//console.log("Test action object type "+garbage.type)
			conveyorAction(garbage, this)
		},
	}
	assetType.push(asset2);
	var asset3 = {
		assetTypeID : 2,
		name: "conveyor_rl",
		color: "gainsboro ",
		// relative X,Y coordinates for output and input
		input: [[1,0]],
		output: [[-1,0]],
		action: function(garbage) {
			//console.log("Test action object type "+garbage.type)
			conveyorAction(garbage, this)
		},
	}
	assetType.push(asset3);
	var asset4 = {
		assetTypeID : 2,
		name: "conveyor_tb",
		color: "gainsboro ",
		// relative X,Y coordinates for output and input
		input: [[0,-1]],
		output: [[0,1]],
		action: function(garbage) {
			//console.log("Test action object type "+garbage.type)
			conveyorAction(garbage, this)
		},
	}
	assetType.push(asset4);
	var asset5 = {
		assetTypeID : 2,
		name: "conveyor_bt",
		color: "gainsboro",
		// relative X,Y coordinates for output and input
		input: [[0,1]],
		output: [[0,-1]],
		action: function(garbage) {
			//console.log("Test action object type "+garbage.type)
			conveyorAction(garbage, this)
		},
	}
	assetType.push(asset5);
	return assetType;
}
function generateProceduralElement(typeID, coord_x, coord_y) {
	var asset = {
		coord_x: coord_x,
		coord_y: coord_y,
		typeID: typeID,
	}
	return asset;
}
function generateElements(assetTypeArray) {
	var elementsArray = [];
	elementsArray.push(generateProceduralElement(0,1,0));
	elementsArray.push(generateProceduralElement(2,3,0));
	elementsArray.push(generateProceduralElement(2,2,0));
	elementsArray.push(generateProceduralElement(1,4,0));
	//second
	elementsArray.push(generateProceduralElement(0,0,2));
	elementsArray.push(generateProceduralElement(2,1,2));
	elementsArray.push(generateProceduralElement(4,2,2));
	elementsArray.push(generateProceduralElement(4,2,3));
	elementsArray.push(generateProceduralElement(2,2,4));
	elementsArray.push(generateProceduralElement(2,3,4));
	
	elementsArray.push(generateProceduralElement(0,0,6));
	elementsArray.push(generateProceduralElement(2,1,6));
	elementsArray.push(generateProceduralElement(5,2,6));
	elementsArray.push(generateProceduralElement(5,2,5));
	
	elementsArray.push(generateProceduralElement(1,4,4));
	//third
	elementsArray.push(generateProceduralElement(0,4,2));
	elementsArray.push(generateProceduralElement(2,5,2));
	elementsArray.push(generateProceduralElement(2,6,2));
	elementsArray.push(generateProceduralElement(2,7,2));
	elementsArray.push(generateProceduralElement(2,8,2));
	
	elementsArray.push(generateProceduralElement(4,9,2));
	elementsArray.push(generateProceduralElement(4,9,3));
	elementsArray.push(generateProceduralElement(3,9,4));
	elementsArray.push(generateProceduralElement(3,8,4));
	elementsArray.push(generateProceduralElement(5,7,4));
	elementsArray.push(generateProceduralElement(5,7,3));
	
	
	// map elements to their type to get their full set of properties
	var i=0;
	while (i<elementsArray.length) {
		asset = elementsArray[i];
		asset.ID = i;
		asset.name = assetTypeArray[asset.typeID].name;
		asset.input = assetTypeArray[asset.typeID].input;
		asset.output = assetTypeArray[asset.typeID].output;
		asset.type = assetTypeArray[asset.typeID].name;
		asset.color = assetTypeArray[asset.typeID].color;
		asset.action = assetTypeArray[asset.typeID].action;
		asset.output_cell = [];
		asset.stock = [];
		asset.toDelete="false";
		
		i++;
	}
	
	return elementsArray;
}

function buildOnSelectedCell(elementType) {
	// get the coordinates of the selected cell
	cell_x=state.cellSelected[0];
	cell_y=state.cellSelected[1];
	// Check whether the cell is free or not
	var cellFree=false;
	if (getAssetOnCellID(cell_x,cell_y)<0) {cellFree=true}
	if (getAssetOnCellID(cell_x,cell_y)>=0) {
		if (config.elementsArray[getAssetOnCellID(cell_x,cell_y)].toDelete == "true") {
			cellFree=true;
		}
	}
	if (cellFree=true) {
		// Push the element in the array
		config.elementsArray.push(generateProceduralElement(elementType,cell_x,cell_y));
		// assign the full property set
		asset = config.elementsArray[elementsArray.length-1];
			asset.ID = config.elementsArray.length-1;
			asset.name = config.assetType[asset.typeID].name;
			asset.input = config.assetType[asset.typeID].input;
			asset.output = config.assetType[asset.typeID].output;
			asset.type = config.assetType[asset.typeID].name;
			asset.color = config.assetType[asset.typeID].color;
			asset.action = config.assetType[asset.typeID].action;
			asset.output_cell = [];
			asset.stock = [];
			asset.toDelete="false";
		// recompute the relationships
		buildAssetRelations();
		draw();
	}
	else {console.log("Impossible to build as there is already a piece of equipment here")}
}

function deleteElementOnSelectedCell() {
	// get the coordinates of the selected cell
	x=state.cellSelected[0];
	y=state.cellSelected[1];
	// check that there is an existing element
	assetID = getAssetOnCellID(x,y);
	if (assetID>=0) {
		asset = config.elementsArray[assetID];
		//mark element as to be deleted
		asset.toDelete="true";
	}
/* 	//build a new elementsArray only with the elements that are not to be deleted
	var elementsArrayTemp = [];
	j = 0;
	while (j<config.elementsArray.length) {
		equipment = config.elementsArray[j];
		if (equipment.toDelete == false) {
			elementsArrayTemp.push(equipment)
		} 
		else {
			// push the garbage into the stock vector of its end element
			//config.elementsArray[garbage.onAssetID].stock.push(garbage);
		};
		j++;
	}
	// replace the garbage vector with the newly constructed one
	config.elementsArray = elementsArrayTemp; */
	
	// recompute the relationships
		buildAssetRelations();
		draw();
}

function generateGarbage(asset) {

	var random1X = Math.random();
	var random2 = Math.random();
	var garbage1 = {
		coord_x: asset.coord_x,
		coord_y: asset.coord_y,
		color: "red",
		type: "plastic",
		size: 0.15,
		randomSeedX: Math.random(),
		randomSeedY: Math.random(),
		onAssetID: asset.ID, 
		hasMoved: true,
		toDelete: false,
	}
	state.garbageArray.push(garbage1);
	var garbage2 = {
		coord_x: asset.coord_x,
		coord_y: asset.coord_y,
		color: "yellow",
		type: "metal",
		size: 0.1,
		randomSeedX: Math.random(),
		randomSeedY: Math.random(),
		onAssetID: asset.ID,
		hasMoved: true,
		toDelete: false,
	}
	state.garbageArray.push(garbage2);
}
