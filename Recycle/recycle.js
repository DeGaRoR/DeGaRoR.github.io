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
		x_out = asset.coord_x + asset.output[0][0];
		y_out = asset.coord_y + asset.output[0][1];;
		asset.output_cell[0] = getAssetOnCellID(x_out,y_out);
		console.log("Asset of type " + asset.type + " has as output asset ID " + asset.output_cell[0])
		i++;
	}
};

function stepTime() {

	// initialize the hasMoved property for all garbage
	var j = 0;
	while (j<state.garbageArray.length){
		state.garbageArray[j].hasMoved = false;
		j++
	}
	//loop through the elements
	var i=0;
	while (i<config.elementsArray.length) {
		var asset = config.elementsArray[i];
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
			//state.processedGarbageArray.push(garbage);
			// push the garbage into the stock vector of its end element
			config.elementsArray[garbage.onAssetID].stock.push(garbage);
		};
		j++;
	}
	// replace the garbage vector with the newly constructed one
	state.garbageArray = garbageArrayTemp;
	//console.log(state.processedGarbageArray);
	//countYellow = countGarbage(state.processedGarbageArray,"color","yellow");
	//console.log(countYellow);
	updateInfo();
	draw();
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
	while (i<config.elementsArray.length) {
		var asset = config.elementsArray[i];
		if (asset.coord_x == x && asset.coord_y == y) {return i} 
		i++;
	}
};

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
		ctx.fillStyle = asset.color;
		ctx.fillRect(asset.coord_x*config.grid_space, asset.coord_y*config.grid_space, config.grid_space, config.grid_space);
		img = document.getElementById(asset.type);
		ctx.drawImage(img, asset.coord_x*config.grid_space, asset.coord_y*config.grid_space, config.grid_space, config.grid_space);
		
		ctx.font = "14px Arial";
		ctx.fillStyle = "black";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle"
		ctx.fillText(asset.ID, config.elementsArray[k].coord_x*config.grid_space+config.grid_space/2, config.elementsArray[k].coord_y*config.grid_space+config.grid_space/2);
		
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
	//test

	
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
		grid_x: 12,
		grid_y: 7,
		grid_space: 50,
		elementsArray: elementsArray,
		assetType: assetType
	}
}
function getInitialState() {
	return {
		garbageArray : [],
		processedGarbageArray : [],
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
		
		i++;
	}
	
	return elementsArray;
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
