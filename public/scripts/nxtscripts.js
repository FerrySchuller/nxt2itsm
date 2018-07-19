function submitActrequest(deviceId, actId){
	var xhttp1 = new XMLHttpRequest();
    xhttp1.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			alert(xhttp1.responseText);
		}
	};
	xhttp1.open("GET", "/act/" + deviceId + "/" + actId, true);
	xhttp1.send();
}