//============================== 
//Config and initial state
//============================== 
function getInitialState() {
	return {
		people: [
			{name: "denis", gender: "Male",age: "32", photo: "images/denis.jpg", diplomaList : [{diplomaTypeID: 0, diplomaLevel:2},{diplomaTypeID: 1, diplomaLevel:1},{diplomaTypeID: 2, diplomaLevel:0},{diplomaTypeID: 3, diplomaLevel:2},{diplomaTypeID: 4, diplomaLevel:0}]},
			{name: "asal", gender: "Female",age: "28", photo: "images/asal.jpg", diplomaList : [{diplomaTypeID: 0, diplomaLevel:2}]}
		],
		// refinedResources is a vector whose positions correspond to the positions in refinedResourceTypeList
		// Wood, Stone, Metal, Food
		refinedResources: [3,3,8,10],
		rawResources: [125,50,30,500],
		facilities: [
			{facilityTypeID: 0, facilityID: 0, facilityStatus: 1, employees: [], turnsTillConstruction: 0}
		],
		mapTiles: [],
		villages: [],
		explorerTeams: [
		//terrainCapability is the minimum terrain type it can move to - 0 means all terrains, 1 means all terrains but water, 2 means forest and plains, 3 means plains only
			{ID:0, cellID: 70, icon: 'fas fa-binoculars', remainingMoves:1, maxMoves:1, terrainCapability: 2},
			{ID:1, cellID: 70, icon: 'fas fa-binoculars', remainingMoves:1, maxMoves:1, terrainCapability: 0},
			]
	}
}
function getConfig() {
	var medalColorList = ['#b87333','#C0C0C0','#FFDF00'];
	return {
		diplomaTypeList: [
			{name: 'General', icon: 'fas fa-graduation-cap', color: medalColorList},
			{name: 'Engineer', icon: 'fas fa-wrench', color: medalColorList},
			{name: 'Doctor', icon: 'fas fa-briefcase-medical', color: medalColorList},
			{name: 'Food', icon: 'fas fa-utensils', color: medalColorList},
			{name: 'Warrior', icon: 'fas fa-shield-alt', color: medalColorList},
		],
		baseFacilityTypeList: [
			// Cost[Wood,Stone,Metal]
			{name: "Logging Cabin", cost: [2,1,0], buildTime: 1, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 0, outputRefinedResource: 0, thumb: "images/facilities/loggingCabin_s.jpg", img: "images/facilities/loggingCabin_m.jpg", requiredDiplomaToBuild: {diplomaTypeID:1,diplomaLevel:0},requiredDiplomaToWork:{diplomaTypeID:1,diplomaLevel:0}},
			{name: "Quarry", cost: [5,0,2], buildTime: 2, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 1, outputRefinedResource: 1, thumb: "images/facilities/quarry_s.jpg", img: "images/facilities/quarry_m.jpg", requiredDiplomaToBuild: {diplomaTypeID:1,diplomaLevel:0},requiredDiplomaToWork:{diplomaTypeID:1,diplomaLevel:0}},
			{name: "Mine", cost: [10,5,5], buildTime: 3, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 2, outputRefinedResource: 2, thumb: "images/facilities/mine_s.jpg", img: "images/facilities/mine_m.jpg", requiredDiplomaToBuild: {diplomaTypeID:1,diplomaLevel:0},requiredDiplomaToWork:{diplomaTypeID:1,diplomaLevel:0}},
			{name: "Food processing", cost: [1,1,1], buildTime: 1, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 3, outputRefinedResource: 3, thumb: "images/facilities/foodProcessing_s.jpg", img: "images/facilities/foodProcessing_m.jpg", requiredDiplomaToBuild: {diplomaTypeID:1,diplomaLevel:0},requiredDiplomaToWork:{diplomaTypeID:1,diplomaLevel:0}}
		],
		specialFacilityTypeList: [
			{name: "House"},
			{name: "School"}
		],
		rawResourceTypeList: [
			{name: "Trees"},
			{name: "Rock formation"},
			{name: "Metal deposit"},
			{name: "Food source"}
		],
		refinedResourceTypeList: [
			{name: "Wood", icon: 'fas fa-tree'},
			{name: "Stone", icon: 'fas fa-cubes'},
			{name: "Metal", icon: 'fas fa-magnet'},
			{name: "Food", icon: 'fas fa-utensils'}
		],
		facilityStatusList: ["In construction","Operating","Disabled"],
		mapSettings: {
			sizeX: 12,
			sizeY: 12,
			villageTypes: [
				{ID: 0, name: 'None', amount: 0, icon:''},
				{ID: 1, name: 'Home', amount: 1, icon:'fas fa-home teal-text', picture: 'images/tiles/smallVillage_m.jpg'},
				{ID: 2, name: 'Small Village', amount: 15, icon:'fas fa-users teal-text text-lighten-3', picture: 'images/tiles/smallVillage_m.jpg'},
				{ID: 3, name: 'Large Village', amount: 5, icon:'fas fa-gopuram teal-text text-lighten-2', picture: 'images/tiles/largeVillage_m.jpg'}
			],
			terrainBlocks: [
				// define in decreasing "difficulty order" to use in the explorer capability
				{ID: 0, name: 'water', color:'blue lighten-3', icon: 'fas fa-tint', probability: 0.15, picture:'images/tiles/water_m.jpg'},
				{ID: 1, name: 'mountain', color:'grey lighten-1', icon:'fas fa-snowflake', probability: 0.1, picture:'images/tiles/mountain_m.jpg'},
				{ID: 2, name: 'forest', color: 'green lighten-3', icon:'fas fa-tree', probability: 0.2, picture:'images/tiles/forest_m.jpg'},
				{ID: 3, name: 'plains', color: 'green lighten-5', icon:'', probability: 0.4, picture:'images/tiles/plains_m.jpg'}
			]
		}
	}
}
function getRandomPeopleAttributes() {
	return {
		firstNamesMale: ['Jean-Michel','Jean-Pierre','Jean-Philippe','Jean-Paul','Jean-Marcel','Kevin','Killian','Mohammed','Ashton','Brad','Harrison','Bonaventure','Desire','Yunic','Dartagnan'],
		firstNamesFemale: ['Fatima','Barbara','Monica','Priscilia','Stephanie','Kelly','Nicole','Morgan','Jessica','Cindy','Kloe','Kim','Britney','Shakira','Beberly','Merica','Appaloosa','Melanomia','Heaven Lee'],
		lastNames: ['Bjornsonn','Al Belgiki','Dupont','Dugenou','Smith','Gaywad','Trump','Buttz','Ballz','Goodfornothing','Retard','Primitive','Kumar','Singh','Buzzbuzz','Nutgrabber','Ballbuster','Bieber','Van Damme','Van Varenberg','Daerdenne','Bin Batman','Neanderthal','Cromagnon','Uga-uga'],
	}
}
//============================== 
//UI general functions
//============================== 
function displayScreen(screenID) {
	// function to hide all screen divs and show the one passed as a parameter
	$('.TGEscreen').hide();
	$('#'+screenID+'').show();
}
function clearDOM(divID) {
	var myNode = document.getElementById(divID);
	while (myNode.firstChild) {
		myNode.removeChild(myNode.firstChild);
	}
}
function refreshGlobalIndicators() {
	document.getElementById("woodIndicator").innerHTML = state.refinedResources[0];
	document.getElementById("stoneIndicator").innerHTML = state.refinedResources[1];
	document.getElementById("metalIndicator").innerHTML = state.refinedResources[2];
	document.getElementById("foodIndicator").innerHTML = state.refinedResources[3];
	document.getElementById("peopleIndicator").innerHTML = state.people.length;
}
//============================== 
//People
//============================== 
function filterPeopleArrayOnDiploma(peopleArray, requiredDiploma) {
	console.log("Starting filtering people list. We're looking for diploma of type "+requiredDiploma.diplomaTypeID+" and level "+requiredDiploma.diplomaLevel+" or higher");
	var filteredPeopleArray = [];
	// for each person
	for (var i = 0; i < peopleArray.length; i++) {
		var compliant = false;
		var person = peopleArray[i];
		console.log("Looking at "+person.name);
		for (var j = 0; j < person.diplomaList.length; j++) {
			console.log("Looking at diploma of type "+person.diplomaList[j].diplomaTypeID+" and level "+person.diplomaList[j].diplomaLevel)
			if (person.diplomaList[j].diplomaTypeID == requiredDiploma.diplomaTypeID && person.diplomaList[j].diplomaLevel >=  requiredDiploma.diplomaLevel) {
				compliant = true;
				console.log("It is matching!");
			}
		}
		if (compliant) {filteredPeopleArray.push(person); console.log("Adding "+person.name+" to the filtered list")};
	}
	return filteredPeopleArray;
}
function makePeopleList(peopleArray) {
    // Create the list element:
    var list = document.createElement('ul');
	list.className = "collection";
	
	// for each person
    for (var i = 0; i < peopleArray.length; i++) {
        var person = peopleArray[i];
		// Create the list item:
        var item = document.createElement('li');
		item.className = 'collection-item avatar'
        
		// create and append the thumbnail
		var thumb = document.createElement('IMG');
		thumb.src = person.photo;
		thumb.className = "circle"
		item.appendChild(thumb);

		
		// Create the title with person's name
		var title = document.createElement('span');
		title.className = 'title';
		title.appendChild(document.createTextNode(person.name + ' '));
		
		// gender logo
		var genderLogo = document.createElement('i');
		if (person.gender == 'Male') {genderLogo.className = "fas fa-mars"} else {genderLogo.className = "fas fa-venus"}
		title.appendChild(genderLogo);
		item.appendChild(title);
		
		// create and append the second line content
		var secondLineContent = document.createElement('p');
			// sort the list of detained diplomaList alphabetically, so the icons align
			//person.diplomaList.sort(function(a, b){return a - b});	
			// badges education
			// for all entries in diploma
			for (var j = 0; j < person.diplomaList.length; j++) {
				diplomaType = config.diplomaTypeList[person.diplomaList[j].diplomaTypeID]
				//console.log('Iteration '+j+' of loop over diplomaList of '+person.name+' found '+diplomaType.name+' level'+person.diplomaList[j].diplomaLevel+' corresponding to color '+diplomaType.color[person.diplomaList[j].diplomaLevel]);
				var diplomaLogo = document.createElement('i');
				diplomaLogo.className = diplomaType.icon;
				diplomaLogo.style.color = diplomaType.color[person.diplomaList[j].diplomaLevel];
				secondLineContent.appendChild(diplomaLogo);
				// insert a space after each logo
				secondLineContent.appendChild(document.createTextNode(" "))
			}
		item.appendChild(secondLineContent);
		
		// append the text content
        //item.appendChild(document.createTextNode(person.name));

		// append the delete icon
		var linkDelete = document.createElement('a');
		linkDelete.className = 'secondary-content deletePerson';
		linkDelete.href = '#!'
		//linkDelete.onclick = "test"
		linkDelete.addEventListener("click", test, false);
		var deleteIcon = document.createElement('i');
		deleteIcon.className = 'material-icons';
		deleteIcon.appendChild(document.createTextNode('delete'))
		linkDelete.appendChild(deleteIcon);
		item.appendChild(linkDelete);
		
        // Add it to the list:
        list.appendChild(item);
    }

    // Finally, return the constructed list:
    return list;
}
function generatePeopleDOM(divID) {
	document.getElementById(divID).appendChild(makePeopleList(state.people));
}
function addPerson_BE() {
	var newPerson = {name: "harry", gender: "Male",age: "15"};
	state.people.push(newPerson);
}
function addRandomPerson_BE() {
	// get the list of random names
	var randomPeopleAttributes = getRandomPeopleAttributes();
	// pick a random last name
	var randomIndex = Math.round(Math.random()*(randomPeopleAttributes.lastNames.length-1))
	var lastName = randomPeopleAttributes.lastNames[randomIndex]	
	// decide whether the person is male or female
	if (Math.random() > 0.5) {
		var gender = 'Male'
		// pick a random picture in the images
		randomIndex = Math.round(Math.random()*65)+1
		var imgName='images/People/Males/image-'+randomIndex+'.jpg'
		// pick a random first name
		randomIndex = Math.round(Math.random()*(randomPeopleAttributes.firstNamesMale.length-1));
		var firstName = randomPeopleAttributes.firstNamesMale[randomIndex];
	} else {
		var gender = 'Female'
		// pick a random picture in the images
		randomIndex = Math.round(Math.random()*65)+1
		var imgName='images/People/Females/image-'+randomIndex+'.jpg'
		// pick a random first name
		randomIndex = Math.round(Math.random()*(randomPeopleAttributes.firstNamesFemale.length-1));
		var firstName = randomPeopleAttributes.firstNamesFemale[randomIndex];
	}

	var newPerson = {name: firstName + ' ' +lastName, gender: gender,age: "15", photo: imgName, diplomaList : [{diplomaTypeID: 0, diplomaLevel:0}]};
	state.people.push(newPerson);
}
function addAndRefresh(divID) {
	addRandomPerson_BE();
	refreshPeopleList_FE();
}
function refreshPeopleList_FE() {
	divID = 'peopleListArea';
	clearDOM(divID);
	generatePeopleDOM(divID);
	refreshGlobalIndicators();
}
//============================== 
//Facilities
//============================== 
function indexFromFacilityID(facilityID) {
	var index = -1;
	for (var i = 0; i < state.facilities.length; i++) {
		if(facilityID == state.facilities[i].facilityID) {index = i}
	}
	return index;
}
function makeFacilityCard(facilityID) {
	//console.log("Received facilityID "+facilityID);
	var facility = state.facilities[indexFromFacilityID(facilityID)];
	var facilityType = config.baseFacilityTypeList[facility.facilityTypeID];
	var cardArea = document.getElementById("cardArea");
	var newCardContainer = document.createElement("DIV");
	newCardContainer.className = "col s12 m6 l3 xl3 cardToDelete";
		// Create the card div
		var newCard = document.createElement("DIV");
		newCard.className = 'card';
			// Create the header (image, title)
			var cardHeader = document.createElement("DIV");
			cardHeader.className = 'card-image';
				var cardImage = document.createElement("IMG");
				cardImage.src = facilityType.img;
				var cardTitle = document.createElement("SPAN");
				cardTitle.className = 'card-title';
				cardTitle.appendChild(document.createTextNode(facilityType.name))
			cardHeader.appendChild(cardImage);
			cardHeader.appendChild(cardTitle);
			// Create the description
			var cardDescription = document.createElement("DIV");
			cardDescription.appendChild(document.createTextNode(config.facilityStatusList[facility.facilityStatus]))
			switch(facility.facilityStatus) {
				case 0: cardDescription.className = 'card-content orange-text'; cardDescription.appendChild(document.createTextNode(" "+facility.turnsTillConstruction+" turn(s) remaining")); break; // orange text if in construction
				case 1: cardDescription.className = 'card-content green-text'; break; // Green text if operating
				case 2: cardDescription.className = 'card-content red-text';//red text if disabled
			}
			// Create the actions (worker controls)
			var cardActions = document.createElement("DIV");
			cardActions.className = 'card-action';
				var buttonRemove = document.createElement("a");
				buttonRemove.className = 'btn-floating waves-effect waves-light red';
					var removeIcon = document.createElement("i");
					removeIcon.className = 'material-icons';
					removeIcon.innerHTML = "remove";
				buttonRemove.appendChild(removeIcon);
				var buttonAdd = document.createElement("a");
				buttonAdd.className = 'btn-floating waves-effect waves-light blue';
					var addIcon = document.createElement("i");
					addIcon.className = 'material-icons';
					addIcon.innerHTML = "add";
				buttonAdd.appendChild(addIcon);
			cardActions.appendChild(buttonRemove);
			cardActions.appendChild(buttonAdd);
		// append header, description and worker controls to the card div
		newCard.appendChild(cardHeader);
		newCard.appendChild(cardDescription);
		newCard.appendChild(cardActions);
	// Append the nex card content to the new card container
	newCardContainer.appendChild(newCard);	
	//Append the card div to newCardContainer
	cardArea.appendChild(newCardContainer);
 }
function buildFacility(facilityTypeID) {
	addFacility_BE(facilityTypeID);
	refreshFacilityList_FE()
	//makeFacilityCard(facilityTypeID);
}
function addFacility_BE(facilityTypeID) {
	
	var goAhead = true;
	var maxID = 0;
	// figure out the highest facilityID within the list of facilities to increment by looping over the existing facilities
	for (var i = 0; i < state.facilities.length; i++) {
		if (state.facilities[i].facilityID>maxID) {maxID = state.facilities[i].facilityID}
	}
	// check whether there is enough resources to build
	for (var i = 0; i < 3; i++) {
		console.log("There are "+state.refinedResources[i]+" of "+config.refinedResourceTypeList[i].name+". The building costs "+config.baseFacilityTypeList[facilityTypeID].cost[i] )
		if (state.refinedResources[i]>=config.baseFacilityTypeList[facilityTypeID].cost[i]) {
			console.log("After substraction, I have "+state.refinedResources[i]+" of "+config.refinedResourceTypeList[i].name);
			
		} else {
			console.log("Not enough resources of type "+config.refinedResourceTypeList[i].name)
			goAhead = false;
			M.toast({html: 'Not enough '+config.refinedResourceTypeList[i].name+' for '+config.baseFacilityTypeList[facilityTypeID].name+"!"});
		}
	}
	// if enough resources available
	if (goAhead) {
		// substract the cost of the building from the refined resources
		for (var i = 0; i < 3; i++) {
			state.refinedResources[i] = state.refinedResources[i] - config.baseFacilityTypeList[facilityTypeID].cost[i];
		}
		// create the new facility object and push it to the facility vector 
		var newFacility = {facilityTypeID: facilityTypeID, facilityID: maxID+1, facilityStatus: 0, employees: [], turnsTillConstruction: config.baseFacilityTypeList[facilityTypeID].buildTime}
		state.facilities.push(newFacility);
	}

}
function refreshFacilityList_FE() {
	divID = 'cardArea';
	clearDOM(divID);
	generateFacilityDOM(divID);
	refreshGlobalIndicators();
}
function generateFacilityDOM(divID) {
	//create a card for each facility
	for (var i = 0; i < state.facilities.length; i++) {
		makeFacilityCard(state.facilities[i].facilityID)
	}
}
function generateFacilityModal(divID) {
	document.getElementById(divID).appendChild(makeBaseFacilityTypeUL(config.baseFacilityTypeList));
}
function makeBaseFacilityTypeUL(baseFacilityTypeList) {
	// Create the list element:
    var list = document.createElement('ul');
	list.className = "collection";
	
	// for each facility type
    for (var i = 0; i < baseFacilityTypeList.length; i++) {
        var facilityType = baseFacilityTypeList[i];
		// Create the list item:
        var item = document.createElement('a');
		item.className = 'collection-item avatar modal-close';
		console.log("Creating list item for facility type ID "+i);
		item.originalIndex = i;
		item.onclick=function(){buildFacility(this.originalIndex);};
        
		// create and append the thumbnail
		var thumb = document.createElement('IMG');
		thumb.src = facilityType.thumb;
		thumb.className = "circle"
		item.appendChild(thumb);
		
		// Create the title with facility's name
		var title = document.createElement('span');
		title.className = 'title';
		title.appendChild(document.createTextNode(facilityType.name));
		item.appendChild(title);
		
		// create and append the second line content (cost)
		var secondLineContent = document.createElement('p');
		//var secondLineText = "Wood: "+facilityType.cost[0]+" Stone: "+facilityType.cost[1]+" Metal: "+facilityType.cost[2]
		secondLineContent.appendChild(document.createTextNode("Cost: "))
		//Loop through all the costs and find the associated icons
		for (var j = 0; j < facilityType.cost.length; j++) {
			var resourceLogo = document.createElement('i');
			resourceLogo.className = config.refinedResourceTypeList[j].icon;
			secondLineContent.appendChild(resourceLogo);
			// insert a space after each logo
			secondLineContent.appendChild(document.createTextNode(" "+facilityType.cost[j]+" "))
		}
		item.appendChild(secondLineContent);
		
		// create and append the third line content (prod)
		var thirdLineContent = document.createElement('p');
		//var secondLineText = "Wood: "+facilityType.cost[0]+" Stone: "+facilityType.cost[1]+" Metal: "+facilityType.cost[2]
		thirdLineContent.appendChild(document.createTextNode("Prod: "+facilityType.prodPerPeoplePerTurn+" "))
		var outputLogo = document.createElement('i');
		outputLogo.className = config.refinedResourceTypeList[facilityType.outputRefinedResource].icon;
		thirdLineContent.appendChild(outputLogo);
		item.appendChild(thirdLineContent);
		
		// create and append the fourth line content  (build time)
		var fourthLineContent = document.createElement('p');
		//var secondLineText = "Wood: "+facilityType.cost[0]+" Stone: "+facilityType.cost[1]+" Metal: "+facilityType.cost[2]
		fourthLineContent.appendChild(document.createTextNode("Build time: "+facilityType.buildTime+" "))
		var outputLogo = document.createElement('i');
		outputLogo.className = 'far fa-clock';
		fourthLineContent.appendChild(outputLogo);
		item.appendChild(fourthLineContent);
        
		// Add it to the list:
        list.appendChild(item);
    }

    // Finally, return the constructed list:
    return list;
}
//============================== 
//Map
//============================== 
function generateMap() {
	generateMapTiles();
	setExplorerPosition(0,homePosition())
	generateMapDOM();
}
function generateMapTiles() {
	var sizeX = config.mapSettings.sizeX;
	var sizeY = config.mapSettings.sizeY;
	var nHomes = 0;
	var nSmallVillages = 0;
	var nLargeVillages = 0;
	var smallVillage = [];
	var largeVillage = [];
	// give coordinates to small villages
	for (var i=0; i<config.mapSettings.villageTypes[2].amount; i++) {
		smallVillage[i] = Math.round(Math.random()*((sizeX*sizeY)-1)*0.9);
		if (i>0 && smallVillage[i]==smallVillage[i-1]) {
			smallVillage[i] = smallVillage[i] + 1;
		}
	}
	// give coordinates to large villages
	for (var i=0; i<config.mapSettings.villageTypes[3].amount; i++) {
		largeVillage[i] = Math.round(Math.random()*((sizeX*sizeY)-1)*0.9);
		if (i>0 && largeVillage[i]==largeVillage[i-1]) {
			largeVillage[i] = largeVillage[i] + 1;
		}
	}
	for (var i=0; i<sizeX; i++) {
		for (var j=0; j<sizeY; j++) {
			var newTile = {};
			newTile.ID = (i*sizeX)+j;
			newTile.x = i;
			newTile.y = j;
			newTile.villageType = 0;
			// assign a terrain type based on probability
			var random = Math.random();
			if (random <= config.mapSettings.terrainBlocks[0].probability) {newTile.terrainType = config.mapSettings.terrainBlocks[0].ID}
			else if (random > config.mapSettings.terrainBlocks[0].probability && random <= config.mapSettings.terrainBlocks[0].probability+config.mapSettings.terrainBlocks[1].probability) {newTile.terrainType = config.mapSettings.terrainBlocks[1].ID}
			else if (random > config.mapSettings.terrainBlocks[0].probability+config.mapSettings.terrainBlocks[1].probability && random <= config.mapSettings.terrainBlocks[0].probability+config.mapSettings.terrainBlocks[1].probability+config.mapSettings.terrainBlocks[2].probability) {newTile.terrainType = config.mapSettings.terrainBlocks[2].ID}
			else {newTile.terrainType = config.mapSettings.terrainBlocks[3].ID}
			
			// drop home in the middle of the map, on a plain tile
			if (i>sizeX/3 && j>sizeY/3 && nHomes <1 && newTile.terrainType == config.mapSettings.terrainBlocks[3].ID) {
				newTile.villageType = 1;
				nHomes = nHomes + 1;
				// add an entry to villages
				var newVillage = {};
				newVillage.type = 1;
				newVillage.cellID = newTile.ID;
				state.villages.push(newVillage);
			}
			// distribute the small villages
			// check if there is a smallVillage planned there
			for (var k = 0; k<smallVillage.length; k++) {
				if (smallVillage[k]==newTile.ID) {
					// if plains + the tile is not home
					if (newTile.terrainType == config.mapSettings.terrainBlocks[3].ID && newTile.villageType != 1) {
						// put a village there
						newTile.villageType = 2;
						nSmallVillages = nSmallVillages + 1;
						// add an entry to villages
						var newVillage = {};
						newVillage.type = 2;
						newVillage.cellID = newTile.ID;
						state.villages.push(newVillage);
					} else {
						// otherwise shift the coordinates to the next cell
						smallVillage[k] = smallVillage[k] + 1;
					}
				}
			}
			// distribute the large villages
			// check if there is a large villages planned there
			for (var k = 0; k<largeVillage.length; k++) {
				if (largeVillage[k]==newTile.ID) {
					// if plains + the tile is not home
					if (newTile.terrainType == config.mapSettings.terrainBlocks[3].ID && newTile.villageType != 1 && newTile.villageType != 2) {
						// put a village there
						//newTile.isLargeVillage = true;
						newTile.villageType = 3;
						nLargeVillages = nLargeVillages + 1;
						// add an entry to villages
						var newVillage = {};
						newVillage.type = 3;
						newVillage.cellID = newTile.ID;
						state.villages.push(newVillage);
					} else {
						// otherwise shift the coordinates to the next cell
						largeVillage[k] = largeVillage[k] + 1;
					}
				}
			}
			state.mapTiles.push(newTile);
		}
	}
}
function homePosition() {
	var villagePos = 0;
	for (i=0; i<state.villages.length;i++) {
		if (state.villages[i].type == 1) {villagePos=state.villages[i].cellID}
	}
	return villagePos;
}
function generateMapDOM() {
	// clear everything first
	clearDOM('mapArea');
	console.log("Generation of map started");
	var mapArea=document.getElementById("mapArea");
	var newRow = document.createElement("DIV");
	newRow.className = "row";
	for (var i=0; i<state.mapTiles.length; i++) {
			var newCell = document.createElement("a");
			var tile = state.mapTiles[i]

			newCell.className = "TGEmapCellTest col s1  btn black-text "+config.mapSettings.terrainBlocks[tile.terrainType].color;
			if (tile.reachable > -1) {
				newCell.className = 'glowing '+newCell.className;
			};
			newCell.originalIndex = tile.ID;
			// new test with explorers
			newCell.onclick = function(){cellSelect(this.originalIndex);};
			
			// add icon container
			var iconContainer = document.createElement("DIV");
			iconContainer.className = 'TGEmapIconContainer';
			// add icon
			if (tile.villageType > 0) {
				var icon = document.createElement("i");
				icon.className = config.mapSettings.villageTypes[tile.villageType].icon+' TGEmapIconBackground';
				iconContainer.appendChild(icon);
			}
			if (tile.hasExplorers > -1) {
				var icon = document.createElement("i");
				icon.className = 'fas fa-user TGEmapIconForeground';
				if (state.explorerTeams[tile.hasExplorers].remainingMoves>0) {icon.className = icon.className+' deep-orange-text'} else {icon.className = icon.className+' deep-orange-text text-lighten-3'}
				iconContainer.appendChild(icon);
			}
			
			newCell.appendChild(iconContainer);
			newRow.appendChild(newCell);
	}
	mapArea.appendChild(newRow);
}
function resetReachable() {
	// set all the reachable properties to false
	for (i=0;i<state.mapTiles.length;i++) {
		state.mapTiles[i].reachable = -1;
	}
}
function cellSelect(cellID) {
	console.log('clicked cell '+cellID);
	cell = state.mapTiles[cellID];
	var reRender = false;
	// if the cell is reachable
	if (state.mapTiles[cellID].reachable > -1) {
		//open the modal with associated actions
		refreshModalMap(cellID);
		var modal = document.getElementById('modalMap');
		var instance = M.Modal.getInstance(modal);
		instance.open();
	} else {
		// set all the reachable properties to false
		for (i=0;i<state.mapTiles.length;i++) {
			if(state.mapTiles[i].reachable > -1) {reRender = true};
			state.mapTiles[i].reachable = -1;
		}
	}
	// if explorer team on the cell, put the ID of the explorer team in the reachable property of the reachable neighbouring cells
	if (cell.hasExplorers > -1 && state.explorerTeams[cell.hasExplorers].remainingMoves > 0) {
		if (cellID > 11) 	{if(state.mapTiles[cellID-12].terrainType >= state.explorerTeams[cell.hasExplorers].terrainCapability) 	{state.mapTiles[cellID-12].reachable = cell.hasExplorers}} //cell up
		if (cellID < 132) 	{if(state.mapTiles[cellID+12].terrainType >= state.explorerTeams[cell.hasExplorers].terrainCapability) 	{state.mapTiles[cellID+12].reachable = cell.hasExplorers}} //cell down
		if (cell.x > 0) 	{if(state.mapTiles[cellID-1].terrainType >= state.explorerTeams[cell.hasExplorers].terrainCapability) 	{state.mapTiles[cellID-1].reachable = cell.hasExplorers}} //cell left
		if (cell.y < 11) 	{if(state.mapTiles[cellID+1].terrainType >= state.explorerTeams[cell.hasExplorers].terrainCapability) 	{state.mapTiles[cellID+1].reachable = cell.hasExplorers}} //cell right
		reRender = true;
	}
	// re-render the map
	if (reRender) {generateMapDOM();};
}
function setExplorerPosition(explorerID,cellID) {
	state.explorerTeams[explorerID].cellID = cellID;
	placeExplorersOnTile();
}
function placeExplorersOnTile() {
	console.log('Looking for explorers');
	for (var i=0; i<state.mapTiles.length; i++) {
		state.mapTiles[i].hasExplorers = -1;
		for (var j=0; j<state.explorerTeams.length; j++) {
			if (state.mapTiles[i].ID == state.explorerTeams[j].cellID) {
				console.log('found explorers on tile '+state.mapTiles[i].ID)
				state.mapTiles[i].hasExplorers = j;
			}
		}
		
	}
}

function refreshModalMap(cellID) {
	// clear Everything first
	clearDOM('modalMapContent');
	
	// check whether this is a village or an empty tile
	var tileType = '';
	if (state.mapTiles[cellID].villageType >0) {tileType = config.mapSettings.villageTypes[state.mapTiles[cellID].villageType]} 
	else {tileType = config.mapSettings.terrainBlocks[state.mapTiles[cellID].terrainType]}
	
	//create the image section
	var pictureSection = document.createElement("div");
	pictureSection.className = 'card-image';
		// add the picture
		var picture = document.createElement("IMG");
		picture.src = tileType.picture;
		pictureSection.appendChild(picture);
		// Create a title
		var title = document.createElement("span");
		title.className = 'card-title'
		title.innerHTML = tileType.name;		
	pictureSection.appendChild(title);
	
	//create the content
	var newContent = document.createElement("div");
	newContent.className = 'card-content';
		// add icon
		var icon = document.createElement("i");
		icon.className = tileType.icon;
		newContent.appendChild(icon);
		// add description
	newContent.appendChild(document.createTextNode('Grid ID: '+cellID));
	
	// action section
	var action = document.createElement("div");
	action.className = 'card-action';
		// add move button
		var buttonGo = document.createElement("a");
		buttonGo.className = 'waves-effect waves-light btn';
		buttonGo.innerHTML = 'Go there!'
		buttonGo.targetCell = cellID;
		buttonGo.onclick=function(){moveExplorer(this.targetCell)};
	action.appendChild(buttonGo);
	
	// append all to a card section
	var card = document.createElement("div");
	card.className = 'card';
	card.appendChild(pictureSection);
	card.appendChild(newContent);
	card.appendChild(action);
	
	// add card to modal
	var modalMapContent = document.getElementById('modalMapContent');
	modalMapContent.appendChild(card);
}
function moveExplorer(targetCellID) {
	setExplorerPosition(state.mapTiles[targetCellID].reachable,targetCellID);
	// decrease remaining moves
	state.explorerTeams[state.mapTiles[targetCellID].reachable].remainingMoves = state.explorerTeams[state.mapTiles[targetCellID].reachable].remainingMoves - 1
	// reset the reachable properties and therefore the glowing effect
	resetReachable();
	// close the modal
	var modal = document.getElementById('modalMap');
	var instance = M.Modal.getInstance(modal);
	instance.close();
	// Regenerate the map DOM
	generateMapDOM();
}
//============================== 
//Misc
//============================== 

// delete a card
$('.closeBtn').on('click', function(){
    $(this).closest(".cardToDelete").remove();
});
function test() {
	alert('Yeah you clicked');
}

//============================== 
//initialization
//============================== 
// initialisation of all materialize components
document.addEventListener('DOMContentLoaded', function() {
M.AutoInit();
});
var state = getInitialState();
var config = getConfig();
generatePeopleDOM('peopleListArea');
generateFacilityModal('modalFacilitiesContent');
generateFacilityDOM('cardArea')
refreshGlobalIndicators();
generateMap();
