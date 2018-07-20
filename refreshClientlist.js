const request = require('request');
const async = require('async');
const fs = require('fs');

var filePath = __dirname +'/clientList.json';
var settings = JSON.parse(fs.readFileSync(__dirname + '/settings.json'), {encoding: 'utf-8'});
var options = settings.engineOptions;
var nxtquery = 'query?platform=windows&query=select name (from device)&format=json';


getClientList();

function getClientList(){
	var clientArray = {};
	settings = JSON.parse(fs.readFileSync(__dirname + '/settings.json'), {encoding: 'utf-8'});
	options = settings.engineOptions;
	async.each( settings.engines, function listClients(engine, callback1){
		options.baseUrl = 'https://' + engine + ':' + settings.APIport + '/2/';
		options.uri = nxtquery ;
		//console.log("Engine Index is: " + engine);
		request(options, function(error,response,body){
			if (error){
				console.log("error");
			}
			else {
				var jsonOutput = JSON.parse(body);
				for (clientIndex in jsonOutput){
					clientArray[jsonOutput[clientIndex].name] = engine;
				}
			}
			callback1();
		});
	}, function (err){
		//saveClientList();
		fs.writeFileSync(filePath,JSON.stringify(clientArray, null,2),{"encoding":"utf-8","flag" : "w"});
	});
}


function saveClientList(){
	fs.writeFileSync(filePath,JSON.stringify(clientArray, null,2),{"encoding":"utf-8","flag" : "w"});
}

setInterval(getClientList, 600000pm2 start refreshClientlist.js);
