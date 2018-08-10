document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.sidenav');
    var instances = M.Sidenav.init(elems);
  });
  
    document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.modal');
    var instances = M.Modal.init(elems);
  });
 
//document.addEventListener('DOMContentLoaded', function() {
//   var elems = document.querySelectorAll('.fixed-action-btn');
//   var instances = M.FloatingActionButton.init(elems);
// });
 
 //function createCard() {
//	var newDiv = document.createElement("DIV");
//	newDiv.innerHTML = " <div class=\"row\">	<div class=\"col s12 m5\">      <div class=\"card-panel teal\">        <span class=\"white-text\">I am a very simple card.        </span>      </div>    </div>  </div>	";
 //   document.body.appendChild(newDiv);
 //}
 
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
 
// document.getElementById("addCard").addEventListener("click", function(){
//    createCard();
//});

$('.closeBtn').on('click', function(){
    $(this).closest(".cardToDelete").remove();
});