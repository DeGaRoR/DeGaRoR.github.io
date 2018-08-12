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

function getInitialState() {
	return {
		people: [
			{name: "denis", gender: "Male",age: "32"},
			{name: "asal", gender: "Female",age: "28"},
			//{name: "harry", gender: "Male",age: "15"},
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
		thumb.src = 'images/'+array[i].name+'.jpg'
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

function addAndRefresh(divID) {
	addPerson_BE();
	refreshPeopleList_FE();
}

function refreshPeopleList_FE() {
	divID = 'peopleListArea';
	clearPeopleDOM(divID);
	generatePeopleDOM(divID);
}