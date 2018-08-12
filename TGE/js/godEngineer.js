document.addEventListener('DOMContentLoaded', function() {
M.AutoInit();
});
 
  function createCard(cardType) {
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
			{name: "denis", gender: "Male",age: "32", photo: "images/denis.jpg", diplomas : [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]},
			{name: "asal", gender: "Female",age: "28", photo: "images/asal.jpg", diplomas : [2,5,8,11,14]}
		]
	}
}

/* function getConfig() {
	return {
		diplomaList: [
			{name: 'Level 1', icon: 'fas fa-graduation-cap', color: '#b87333'},
			{name: 'Level 2', icon: 'fas fa-graduation-cap', color: '#C0C0C0'},
			{name: 'Level 3', icon: 'fas fa-graduation-cap', color: '#FFDF00'},
			{name: 'Engineer 1', icon: 'fas fa-wrench', color: '#b87333'},
			{name: 'Engineer 2', icon: 'fas fa-wrench', color: '#C0C0C0'},
			{name: 'Engineer 3', icon: 'fas fa-wrench', color: '#FFDF00'},
			{name: 'Doctor 1', icon: 'fas fa-stethoscope', color: '#b87333'},
			{name: 'Doctor 2', icon: 'fas fa-stethoscope', color: '#C0C0C0'},
			{name: 'Doctor 3', icon: 'fas fa-stethoscope', color: '#FFDF00'},
			{name: 'Hunter 1', icon: 'fab fa-grunt', color: '#b87333'},
			{name: 'Hunter 2', icon: 'fab fa-grunt', color: '#C0C0C0'},
			{name: 'Hunter 3', icon: 'fab fa-grunt', color: '#FFDF00'},

		]
	}
} */

function getConfig() {
	return {
		diplomaList: [
			{name: 'Level 1', icon: 'fas fa-graduation-cap', color: '#b87333'},
			{name: 'Level 2', icon: 'fas fa-graduation-cap', color: '#C0C0C0'},
			{name: 'Level 3', icon: 'fas fa-graduation-cap', color: '#FFDF00'},
			{name: 'Engineer 1', icon: 'fas fa-wrench', color: '#b87333'},
			{name: 'Engineer 2', icon: 'fas fa-wrench', color: '#C0C0C0'},
			{name: 'Engineer 3', icon: 'fas fa-wrench', color: '#FFDF00'},
			{name: 'Doctor 1', icon: 'fas fa-briefcase-medical', color: '#b87333'},
			{name: 'Doctor 2', icon: 'fas fa-briefcase-medical', color: '#C0C0C0'},
			{name: 'Doctor 3', icon: 'fas fa-briefcase-medical', color: '#FFDF00'},
			{name: 'Food 1', icon: 'fas fa-utensils', color: '#b87333'},
			{name: 'Food 2', icon: 'fas fa-utensils', color: '#C0C0C0'},
			{name: 'Food 3', icon: 'fas fa-utensils', color: '#FFDF00'},
			{name: 'Warrior 1', icon: 'fas fa-shield-alt', color: '#b87333'},
			{name: 'Warrior 2', icon: 'fas fa-shield-alt', color: '#C0C0C0'},
			{name: 'Warrior 3', icon: 'fas fa-shield-alt', color: '#FFDF00'},

		]
	}
}


function makeUL(peopleArray) {
    // Create the list element:
    var list = document.createElement('ul');
	list.className = "collection";
	
	// for each person
    for (var i = 0; i < peopleArray.length; i++) {
        // Create the list item:
        var item = document.createElement('li');
		item.className = 'collection-item avatar'
        
		// create and append the thumbnail
		var thumb = document.createElement('IMG');
		thumb.src = peopleArray[i].photo;
		thumb.className = "circle"
		item.appendChild(thumb);

		
		// Create the title
		var title = document.createElement('span');
		title.className = 'title';
		title.appendChild(document.createTextNode(peopleArray[i].name + ' '));
		// gender logo
		var genderLogo = document.createElement('i');
		if (peopleArray[i].gender == 'Male') {genderLogo.className = "fas fa-mars"} else {genderLogo.className = "fas fa-venus"}
		title.appendChild(genderLogo);
		item.appendChild(title);
		
		// create and append the second line content
		var secondLineContent = document.createElement('p');
		// sort the list of detained diplomas alphabetically, so the icons align
		peopleArray[i].diplomas.sort(function(a, b){return a - b});	
			// badges education
			// for all entries in diploma
			for (var j = 0; j < peopleArray[i].diplomas.length; j++) {
				diploma = config.diplomaList[peopleArray[i].diplomas[j]]
				console.log('Iteration '+j+' of loop over diplomas of '+peopleArray[i].name+' found '+diploma.name);
				var diplomaLogo = document.createElement('i');
				diplomaLogo.className = diploma.icon;
				diplomaLogo.style.color = diploma.color;
				secondLineContent.appendChild(diplomaLogo);
				secondLineContent.appendChild(document.createTextNode(" "))
			}
		item.appendChild(secondLineContent);
		
		// append the text content
        //item.appendChild(document.createTextNode(peopleArray[i].name));

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
	document.getElementById(divID).appendChild(makeUL(state.people));
}

function clearPeopleDOM(divID) {
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

	var newPerson = {name: firstName + ' ' +lastName, gender: gender,age: "15", photo: imgName, diplomas : [0]};
	state.people.push(newPerson);
}

function addAndRefresh(divID) {
	addRandomPerson_BE();
	refreshPeopleList_FE();
}

function refreshPeopleList_FE() {
	divID = 'peopleListArea';
	clearPeopleDOM(divID);
	generatePeopleDOM(divID);
}

function test() {
	alert('Yeah you clicked');
}

// initialization
var state = getInitialState();
var config = getConfig();
generatePeopleDOM('peopleListArea');