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

function displayScreen(screenID) {
	$('.TGEscreen').hide();
	$('#'+screenID+'').show();
}
function getRandomPeopleAttributes() {
	return {
		firstNamesMale: ['Jean-François','Jean-Pierre','Jean-Philippe','Jean-Paul','Jean-Marcel','Kevin','Killian','Mohammed','Ashton','Brad','Harrison','Bonaventure','Desire','Yunic','Dartagnan'],
		firstNamesFemale: ['Fatima','Barbara','Monica','Priscilia','Stephanie','Kelly','Nicole','Morgan','Jessica','Cindy','Kloe','Kim','Britney','Shakira','Beberly','Merica','Appaloosa','Melanomia','Heaven Lee'],
		lastNames: ['Bjornsonn','Al Belgiki','Dupont','Dugenou','Smith','Gaywad','Trump','Buttz','Ballz','Goodfornothing','Retard','Primitive','Kumar','Singh','Buzzbuzz','Nutgrabber','Ballbuster','Bieber','Van Damme','Van Varenberg','Daerdenne','Bin Batman','Neanderthal','Cromagnon','Uga-uga'],
	}
}
function getInitialState() {
	return {
		people: [
			{name: "denis", gender: "Male",age: "32", photo: "images/denis.jpg"},
			{name: "asal", gender: "Female",age: "28", photo: "images/asal.jpg"},
			//{name: "harry", gender: "Male",age: "15", photo: "images/harry.jpg"},
		]
	}
}
var state = getInitialState();

function makeUL(array) {
    // Create the list element:
    var list = document.createElement('ul');
	list.className = "collection";

    for (var i = 0; i < array.length; i++) {
        // Create the list item:
        var item = document.createElement('li');
		item.className = 'collection-item avatar'
        
		// create the thumbnail
		var thumb = document.createElement('IMG');
		thumb.src = array[i].photo;
		thumb.className = "circle"
		
		//append the thumbnail
		 item.appendChild(thumb);
		// append the text content
        item.appendChild(document.createTextNode(array[i].name));

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

	var newPerson = {name: firstName + ' ' +lastName, gender: gender,age: "15", photo: imgName};
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