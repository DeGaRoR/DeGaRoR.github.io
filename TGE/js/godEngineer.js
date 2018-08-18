document.addEventListener('DOMContentLoaded', function() {
M.AutoInit();
});
 
 function createCard(cardType) {
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
				cardImage.src = 'images/facilities/mine_m.jpg';
				var cardTitle = document.createElement("SPAN");
				cardTitle.className = 'card-title';
				cardTitle.appendChild(document.createTextNode("Facilty type"))
			cardHeader.appendChild(cardImage);
			cardHeader.appendChild(cardTitle);
			// Create the description
			var cardDescription = document.createElement("DIV");
			cardDescription.className = 'card-content';
			cardDescription.appendChild(document.createTextNode("A description"))
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
	newCardContainer.appendChild(newCard);	
	//Append the card div to newCardContainer
	cardArea.appendChild(newCardContainer);
 }
 
 function createCardOld(cardType) {
	var newDiv = document.createElement("DIV");
	newDiv.className = "col s12 m6 l3 xl3 cardToDelete";
	newDiv.innerHTML = `
		   <div class="card">
			<div class="card-image">
			  <img src="images/`+cardType+`.jpg">
			  <span class="card-title">`+cardType+`</span>
			  <a class="btn-floating halfway-fab waves-effect waves-light red closeBtn"><i class="material-icons">delete</i></a>
			</div>
			<div class="card-content">
			  <p>`+cardType+`</p>
			</div>
			<div class="card-action">

				<a class="btn-floating waves-effect waves-light red"><i class="material-icons">remove</i></a>
				<a class="btn-floating waves-effect waves-light blue"><i class="material-icons">add</i></a>
			</div>
		  </div>
	`;
	cardArea = document.getElementById("cardArea");
    cardArea.appendChild(newDiv);
	$('.closeBtn').on('click', function(){
    $(this).closest(".cardToDelete").remove();
});
 }

// delete a card
$('.closeBtn').on('click', function(){
    $(this).closest(".cardToDelete").remove();
});

//$('.deletePerson').click(function(){ console.log('Delete me'); return false; });

function displayScreen(screenID) {
	// function to hide all screen divs and show the one passed as a parameter
	$('.TGEscreen').hide();
	$('#'+screenID+'').show();
}
function getRandomPeopleAttributes() {
	return {
		firstNamesMale: ['Jean-Michel','Jean-Pierre','Jean-Philippe','Jean-Paul','Jean-Marcel','Kevin','Killian','Mohammed','Ashton','Brad','Harrison','Bonaventure','Desire','Yunic','Dartagnan'],
		firstNamesFemale: ['Fatima','Barbara','Monica','Priscilia','Stephanie','Kelly','Nicole','Morgan','Jessica','Cindy','Kloe','Kim','Britney','Shakira','Beberly','Merica','Appaloosa','Melanomia','Heaven Lee'],
		lastNames: ['Bjornsonn','Al Belgiki','Dupont','Dugenou','Smith','Gaywad','Trump','Buttz','Ballz','Goodfornothing','Retard','Primitive','Kumar','Singh','Buzzbuzz','Nutgrabber','Ballbuster','Bieber','Van Damme','Van Varenberg','Daerdenne','Bin Batman','Neanderthal','Cromagnon','Uga-uga'],
	}
}

function getInitialState() {
	return {
		people: [
			{name: "denis", gender: "Male",age: "32", photo: "images/denis.jpg", diplomaList : [{diplomaTypeID: 0, diplomaLevel:2},{diplomaTypeID: 1, diplomaLevel:1},{diplomaTypeID: 2, diplomaLevel:0},{diplomaTypeID: 3, diplomaLevel:2},{diplomaTypeID: 4, diplomaLevel:0}]},
			{name: "asal", gender: "Female",age: "28", photo: "images/asal.jpg", diplomaList : [{diplomaTypeID: 0, diplomaLevel:2}]}
		],
		// refinedResources is a vector whose positions correspond to the positions in refinedResourceTypeList
		// Wood, Stone, Metal, Food
		refinedResources: [50,30,20,100],
		rawResources: [125,50,30,500]
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
			{name: "Logging Cabin", cost: [2,1,0], buildTime: 1, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 0, outputRefinedResource: 0, thumb: "images/facilities/loggingCabin_s.jpg"},
			{name: "Quarry", cost: [5,0,2], buildTime: 2, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 1, outputRefinedResource: 1, thumb: "images/facilities/quarry_s.jpg"},
			{name: "Mine", cost: [10,5,5], buildTime: 3, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 2, outputRefinedResource: 2, thumb: "images/facilities/mine_s.jpg"},
			{name: "Food processing", cost: [1,1,1], buildTime: 1, peopleCapacity: 10, prodPerPeoplePerTurn: 1, consPerPeoplePerTurn: 1, inputRawResource: 3, outputRefinedResource: 3, thumb: "images/facilities/foodProcessing_s.jpg"}
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
		]
	}
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

// Add the contents of options[0] to #jobsScreen:
function generatePeopleDOM(divID) {
	document.getElementById(divID).appendChild(makePeopleList(state.people));
}

function clearDOM(divID) {
	var myNode = document.getElementById(divID);
	while (myNode.firstChild) {
		myNode.removeChild(myNode.firstChild);
	}
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

function test() {
	alert('Yeah you clicked');
}

function refreshGlobalIndicators() {
	document.getElementById("woodIndicator").innerHTML = state.rawResources[0];
	document.getElementById("stoneIndicator").innerHTML = state.rawResources[1];
	document.getElementById("metalIndicator").innerHTML = state.rawResources[2];
	document.getElementById("foodIndicator").innerHTML = state.rawResources[3];
	document.getElementById("peopleIndicator").innerHTML = state.people.length;
}

function generateFacilityModal(divID) {
	document.getElementById(divID).appendChild(makeBaseFacilityTypeList(config.baseFacilityTypeList));
}
function makeBaseFacilityTypeList(baseFacilityTypeList) {
	// Create the list element:
    var list = document.createElement('ul');
	list.className = "collection";
	
	// for each facility type
    for (var i = 0; i < baseFacilityTypeList.length; i++) {
        var facilityType = baseFacilityTypeList[i];
		// Create the list item:
        var item = document.createElement('a');
		item.className = 'collection-item avatar modal-close';
		item.onclick=function(){createCard('oil');};
        
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
// initialization
var state = getInitialState();
var config = getConfig();
generatePeopleDOM('peopleListArea');
generateFacilityModal('modalFacilitiesContent');
refreshGlobalIndicators();
