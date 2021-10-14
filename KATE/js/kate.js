//============================== 
//Config and initial state
//============================== 
function getInitialState() {
	return {
	}
}
function getConfig() {
	return {
		cardDeck: [
			{cardID: 0, cardIMG: 'kate07.jpg', cardHEAD: 'Hello I am Kate', cardTXT: 'Kate is new in town and is looking for a one-night stand. Interested?', cardQ:['yes','no','maybe'], cardQlink: [1,10,11]},
			{cardID: 1, cardIMG: 'kate06.jpg', cardHEAD: 'There you go!', cardTXT: 'Kate is grateful for your diligent services', cardQ:['Again'], cardQlink: [0]},
			{cardID: 10, cardIMG: 'https://i0.hippopx.com/photos/779/387/800/bed-bedding-bedroom-duvet-preview.jpg', cardHEAD: 'Good night then...', cardTXT: 'A good night sleep is all you need for not having sex tomorrow neither!', cardQ:['Try Again'], cardQlink: [0]},
			{cardID: 11, cardIMG: 'kate04.jpg', cardHEAD: 'Kate insists <3', cardTXT: 'And she can be quite... persuasive', cardQ:['OK, if it can help','No, definitely not interested'], cardQlink: [1,10]}
		]
		}
	} 

//============================== 
//DOM manipulation
//============================== 	

/*
function generateCardListDOM() {
	//create a card for each facility
	for (var i = 0; i < config.cardDeck.length; i++) {
		printCard(config.cardDeck[i].cardID)
	}
}
*/

function goToCard(cardID) {
	// trigger the transition hiding thing
	toggleCardTransitioner();
	// Wait the time of the transition before calling the new card
	setTimeout(function() {printCard(cardID);}, 1000)
}
function printCard(cardID) {
	// get the position in the cardDeck vector
	var cardIndex = indexFromCardID(cardID);
	//=================== manage the background image =========================
	// benchmark the performance
	var t0 = performance.now()
	var img = new Image();
	// remove the cache when finished loading
	img.onload = function() { 
		// benchmark the performance
		var t1 = performance.now(); 
		console.log("Image loaded in " + (t1 - t0) + " milliseconds."); 
		// remove the cache thingy once everything is properly loaded
		toggleCardTransitioner();}
	// apply the newly loaded image as background cover
	img.src = config.cardDeck[cardIndex].cardIMG;
	document.body.style.background = "#f3f3f3 url('"+config.cardDeck[cardIndex].cardIMG+"') no-repeat center center fixed";
	document.body.style.backgroundSize = "cover";
	
	//================= update the content of the modal=======================
	var modalContent = document.getElementById("modalContent")
	// clear the existing content
	clearDOM('modalContent');
	// create header and text
	var title = document.createElement("h4");
	title.appendChild(document.createTextNode(config.cardDeck[cardIndex].cardHEAD));
	var txt = document.createElement("p");
	txt.appendChild(document.createTextNode(config.cardDeck[cardIndex].cardTXT));
	modalContent.appendChild(title);
	modalContent.appendChild(txt);
	// create all buttons corresponding to options
	for (var i = 0; i < config.cardDeck[cardIndex].cardQ.length; i++) {
		var action = document.createElement("a");
		action.appendChild(document.createTextNode(config.cardDeck[cardIndex].cardQ[i]));
		action.href="#!";// probably not needed
		action.classList.add('waves-effect');
		action.classList.add('waves-light');
		action.classList.add('btn');
		action.classList.add('modal-close');
		action.classList.add('choiceBtn'); //custom class to change stuff if needed
		action.originalIndex = i; // needed to keep the context
		action.onclick=function(){goToCard(config.cardDeck[cardIndex].cardQlink[this.originalIndex]); console.log("The button sent the cardID "+config.cardDeck[cardIndex].cardQlink[this.originalIndex]);}
		// append to modal content
		modalContent.appendChild(action);
		modalContent.appendChild(document.createTextNode(" "));
	}

}

function toggleCardTransitioner() {
  var element = document.getElementById("CardTransitioner");
  element.classList.toggle("moveAway");
}


//============================== 
//Utils
//============================== 

function test(stuff) {
	alert(stuff);
}

function indexFromCardID(cardID) {
	var index = -1;
	for (var i = 0; i < config.cardDeck.length; i++) {
		if(cardID == config.cardDeck[i].cardID) {index = i}
	}
	return index;
}
function clearDOM(divID) {
	var myNode = document.getElementById(divID);
	while (myNode.firstChild) {
		myNode.removeChild(myNode.firstChild);
	}
}

//============================== 
//Code core
//============================== 
// initialisation of  materialize components
document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.modal');
    var options = {'opacity': 0}
    var instances = M.Modal.init(elems, options);
});

// get states and config
var state = getInitialState();
var config = getConfig();

//get welcome screen displayed first (card 0)
printCard(0);
toggleCardTransitioner();
