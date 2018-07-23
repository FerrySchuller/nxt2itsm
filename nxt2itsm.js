var https = require('https');
const request = require('request');
const express = require('express');
const app = express();
const fs = require('fs');
var path = require('path');   
var libxmljs = require('libxmljs');

var scorename;

var query='query?platform=windows&query=select (' ;
var selectstring = 'device_uid ';
var limits = [];
var scores = [];
var actSections = [];
var settings = JSON.parse(fs.readFileSync(__dirname + '/settings.json'), {encoding: 'utf-8'});
var options = settings.engineOptions;
var xmlfilePath = __dirname + '/' + settings.scoreFile;

const httpsoptions = {
  key: fs.readFileSync(__dirname + '/keys/ca.key', 'utf8'),
  cert: fs.readFileSync(__dirname + '/keys/ca.crt', 'utf8')
};

var clientList = JSON.parse(fs.readFileSync(__dirname + '/clientList.json'), {encoding: 'utf-8'});


fs.readFile(xmlfilePath, {encoding: 'utf-8'}, function(err,data){
    if (!err) {
        var xmlDoc = libxmljs.parseXml(data);
		var firstcompositescore = xmlDoc.get('//CompositeScore');
		scorename = xmlDoc.get('//ScoreDef').attr('Name').value();
		var compositescores = firstcompositescore.find('./CompositeScore');
		for (var compositeindex in compositescores){
			var score={};
			Object.assign(score, {"type":"Composite"});
			Object.assign(score, {'name': compositescores[compositeindex].attr('Name').value()});
			Object.assign(score, {'description': compositescores[compositeindex].attr('Description').value()});
			scores.push(score);

			var leafscores = compositescores[compositeindex].find('./LeafScore');
			for (leafindex in leafscores){
				var score = {};
				Object.assign(score, {"type":"Leaf"});
				Object.assign(score, {'description': leafscores[leafindex].attr('Description').value().replace(/(\r\n|\n|\r)/gm,'<br>')});
				Object.assign(score, {'name': leafscores[leafindex].attr('Name').value()});
				scores.push(score);
				// next line on purpose not good
				selectstring += '#"score:' + scorename + "/" + leafscores[leafindex].attr('Name').value() + '" '
			}
		}
		var firstCompositescoreActSections = firstcompositescore.find('./Document/Sections/Section');
		for (section in firstCompositescoreActSections){
			var actsection = {};
			actsection.title=firstCompositescoreActSections[section].get('Title').text();
			actsection.description=firstCompositescoreActSections[section].get('Description').text();
			var actionsList = [] ;
			var actionXML = firstCompositescoreActSections[section].find('RemoteAction');
			 for (remoteAction in actionXML){
				 var remoteActions = {};
				 Object.assign(remoteActions, {"name":actionXML[remoteAction].attr('Name').value()});
				 Object.assign(remoteActions, {"UID":actionXML[remoteAction].attr('UID').value()});
				 actionsList.push(remoteActions);
			 }
			 Object.assign(actsection, {"remoteAction":actionsList});
			 httpList = [];
			 var httpXML = firstCompositescoreActSections[section].find('HTTP');
			 for (httpLinkIndex in httpXML){
				 var httpLinks = {};
				 Object.assign(httpLinks, {"text":httpXML[httpLinkIndex].text()});
				 Object.assign(httpLinks, {"url":httpXML[httpLinkIndex].attr('href').value()});
				 httpList.push(httpLinks);
			 }
			 Object.assign(actsection, {"http":httpList});
			 actSections.push(actsection);
		}
		//console.log(actSections);
		
		query += escape(selectstring) + ')(from device (where device (eq name (string "';
		var thresholds = xmlDoc.get('//Thresholds').find('./Threshold');
		for (var threshold in thresholds){
			var keywords = thresholds[threshold].find('./Keyword');
			for (var keywordindex in keywords ){
				limits.push([keywords[keywordindex].attr('From').value(),keywords[keywordindex].attr('Label').value(),thresholds[threshold].attr('Color').value()]);
			}
		}
	}
});

var httpsServer = https.createServer(httpsoptions, app);
httpsServer.listen(443);
app.use(express.static('public'));
app.get('/', function(req,res) {
	res.write("<!DOCTYPE 'html'>");
	res.write("<html>");
	res.write("<head><meta charset='utf-8'>");
	res.write("<link rel='stylesheet' type='text/css' href='/style/mystyle.css'>");
	res.write("<title>Nexthink integration</title>");
	res.write("</head>");
	res.write("<body>");
	res.write("Usage: /device/name of device");
	res.write("</body></html>");
	res.end();
});
app.get('/device/:deviceId', function(req,res) {
	if (typeof clientList[req.params.deviceId.toUpperCase()] !== 'undefined'){
		options.baseUrl = 'https://' + clientList[req.params.deviceId.toUpperCase()] + ':' + settings.APIport + '/2/';
		options.uri = query + req.params.deviceId.toUpperCase() + '"))))&format=json';
		request(options, function(error,response,body){
			if ( error == null){
				res.write("<!DOCTYPE 'html'>");
				res.write("<html>");
				res.write("<head><meta charset='utf-8'>");
				res.write("<link rel='stylesheet' type='text/css' href='/style/mystyle.css'>");
				res.write("<title>Nexthink integration</title>");
				res.write("<script type='text/javascript' src='/scripts/nxtscripts.js'></script>");
				res.write("</head>");
				res.write("<body>");
				res.write("<div class='scorepane'>");
				try {
					var output = JSON.parse(body);
					//console.log(JSON.stringify(output, null,2));
					for (scoreindex in scores){
						var outtext;
						if (scores[scoreindex].type === "Composite"){
							res.write("<div class='composite cell'>" + scores[scoreindex].name + '</div><div class="clear"></div>');
						}
						else {
							scorestring = "score:" + scorename+ "/" + scores[scoreindex].name; 
							var scoreresult = calcColor(output[0][scorestring]);
							res.write("<div class= 'line' ><div class='leaf cell'> " + scores[scoreindex].name + '</div><div class = "tooltip cell ' + scoreresult.Color + '">' + scoreresult.Label + ': ' + output[0][scorestring] + '<span class="tooltiptext">' + scores[scoreindex].description + '</span></div></div><div class="clear"></div>');
						}
					}
					res.write("</div>");
					if (settings.ActEnabled){
						res.write("<div class='actpane'>");
						for (section in actSections){
							res.write("<div class='cell actSectionHeader'>" + actSections[section].title + "<span class='acttooltip'>" + actSections[section].description + "</span></div><div class='clear'></div>");
							for (actionIndex in actSections[section].remoteAction){
								//res.write("<div class='line'><div class='cell'><img src='/images/settings.png' height='20px' width='20px'style='float:left'><div class='acttext'>" + actSections[section].remoteAction[action].name + "<span class='acttooltip'>Sommige problemen verdwijnen als je hier op klikt</span></div></div></div><div class='clear'></div>");
								res.write("<div class='line'><div class='cell'><img src='/images/settings.png' height='20px' width='20px'style='float:left' onclick=submitActrequest('" + output[0]['device_uid'] + "','" + actSections[section].remoteAction[actionIndex].UID + "')><div class='acttext'>" + actSections[section].remoteAction[actionIndex].name + "</div></div></div><div class='clear'></div>");
							}
							for (httpIndex in actSections[section].http){
								res.write("<div class='line'><div class='cell'><img src='/images/settings.png' height='20px' width='20px'style='float:left'><div class='acttext'><a href='" + actSections[section].http[httpIndex].url + "' target='_blank'>" + actSections[section].http[httpIndex].text + "</a></div></div></div><div class='clear'></div>");
							}
						}
						res.write("</div>");
					}
				} catch(e) {
					//res.write(e.toString());
					res.write("engine startup is not completed yet</div>");
				}
				
				res.write("</body></html>");
				res.end();
			}
			else {
				//console.log('Error: ' + error);
				res.write("Error: unable to contact Nexthink Engine");
				res.end();
			}
		});	
	}		
	else {
		res.write("No valid device found");
		res.end();
	}
});

app.get('/reload', function(req,res) {
	reloadStuff();
	res.write("done");
	res.end();
});

app.get('/act/:deviceId/:actId',function(req,res){
	var portalOptions = {}; 
	portalOptions.baseUrl = 'https://' + settings.portal; 
	portalOptions.uri =  '/api/remoteaction/v1/run';
	portalOptions.method = 'POST';
	portalOptions.agentOptions = {'rejectUnauthorized' : false, 'Content-type' : 'application/json', json:true};
	portalOptions.headers = {'Content-type' : 'application/json'};
	portalOptions.auth = settings.portalOptions.auth;
	portalOptions.body = JSON.stringify({"RemoteActionUid": req.params.actId ,"DeviceUids" :[ req.params.deviceId]});
	//console.log(portalOptions);
	request(portalOptions, function(error,response,body){
		res.write(body);
		res.end();
	});
});
function reloadStuff() {
	settings = JSON.parse(fs.readFileSync(__dirname + '/settings.json'), {encoding: 'utf-8'});
	options = settings.engineOptions;
	clientList = JSON.parse(fs.readFileSync(__dirname + '/clientList.json'), {encoding: 'utf-8'});
	console.log(`reloaded`);
}

setInterval(reloadStuff, 300000);


function calcColor(score){
	var result = {"Label": "onbekend", "Color": "green"};
	for(var cnt in limits){
		if (score <= limits[cnt][0]){
			var result = {"Label": limits[cnt][1], "Color":limits[cnt][2]};
			break;
		}
	}
	return result;
}