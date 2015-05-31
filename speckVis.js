//Disabling .getJSON()'s asynchronous behavior so that variables can be
//accessed outside the getJSON function
$.ajaxSetup({
   async: false
});

//Global variables
var id;
var latitude;
var longitude;
var userLatitude;
var userLongitude;
var epochTime;
var minTime;
var maxTime;
var name;
var lastValue;
var lastPollutantValue;
var timeValue;
var pollutantValue;
var link;
var feedData;
var sensors;
var marker2;
var map;
var markers = [];
var ESDR_root = "https://esdr.cmucreatelab.org/api/v1/feeds/";
var geocoding_root = "https://maps.googleapis.com/maps/api/geocode/json?address=";
//Uses PM2_5 for initial channel
var currentChannel = "PM 2.5 Value";

//Picks up user location through HTML5 geolocation
//Plots pollution markers on the map
function initialize() {
	//Geolocation using HTML5
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(showPosition);
	} else {
		alert("Your browser doesn't support geolocation.");
	}

	function showPosition(position) {
		//Show progress bar while map loads
		document.getElementById("progressbar").style.visibility = "visible";

		//Sets the map's center to the user's location
		userLatitude = position.coords.latitude;
		userLongitude = position.coords.longitude;
		var userLocation = new google.maps.LatLng(userLatitude, userLongitude);
		map.setCenter(userLocation);

		//epochTime is initialized to current time
		epochTime = Math.floor(Date.now()/1000);

		//Gets array of nearby sensors with air quality data
		sensors = findNearbySensors(userLatitude, userLongitude, epochTime);
		//If no sensors are found, notify user
		if (sensors.length == 0) {
			alert("No recent air quality updates in your area. Try again later.")
		}

		//Plots markers on map from the sensor array
		plotAQMarkers();

		//Places user's current location marker on the map
		marker2 = new google.maps.Marker({
			position: userLocation,
			icon: "static/location_pin.svg",
			map: map
		});

		//Info window that displays userlocation window
		var infowindow2 = new google.maps.InfoWindow({
		      content: "<h4>Current Location</h4>"
		});

		//Opens info window on click
		google.maps.event.addListener(marker2, 'click', function() {
		    infowindow2.open(map,marker2);
		});

		//Hide progress bar once map is done loading
		document.getElementById("progressbar").style.visibility = "hidden";
	}

	var mapOptions = {
	  zoom: 9,
	  mapTypeControl: false,
	  streetViewControl: false,
	  panControl: true,
	  panControlOptions: {
	  	position: google.maps.ControlPosition.RIGHT_TOP
	  },
	  zoomControl: true,
	  zoomControlOptions: {
	  	position: google.maps.ControlPosition.RIGHT_TOP
	  }
	};
	map = new google.maps.Map(document.getElementById('map-canvas'),
			    mapOptions);

}
google.maps.event.addDomListener(window, 'load', initialize);

//Updates the current location and finds new nearby markers when user
//enters a new address (using Google Maps geocoding)
function updateLocation() {
	//Fetching the new address from user input
	var newAddress = document.getElementById("location").value;
	document.getElementById("location").placeholder = newAddress;
	var geocoding_url = geocoding_root + newAddress;

	//Only updates if new address is entered (is not an empty string)
	if (newAddress != "") {

		//Identifies the lat/long of the new address using server-side geocoding
		//Read details here: https://developers.google.com/maps/articles/geocodestrat
		$.getJSON(geocoding_url, function(geocode) {

			//If the location is not recognized, alert user and return
			if (!geocode["results"][0]) {
				alert("Location not recognized. Please try again.");
				return;
			}
			userLatitude = geocode["results"][0]["geometry"]["location"]["lat"];
			userLongitude = geocode["results"][0]["geometry"]["location"]["lng"];
		});
	}

	//Changes the center of map to new location
	var userLocation = new google.maps.LatLng(userLatitude, userLongitude);
	map.setCenter(userLocation);
	marker2.setPosition(userLocation);

	//Deletes all previous map markers
	setAllMap(null);
	markers = [];
	function setAllMap(map) {
	    for (var i = 0; i < markers.length; i++) {
	        markers[i].setMap(map);
	    }
	}

	//Gets array of nearby sensors with updated userLatitude and userLongitude
	sensors = findNearbySensors(userLatitude, userLongitude, epochTime);
	if (sensors.length == 0) {
		alert("No recent air quality updates in this area. Try again later.")
	}

	//Plots markers on map from the sensor array
	plotAQMarkers();

	map.setOptions({
	  zoom: 9
	});
}

//Queries for new data with time given by user
//and updates the map
function updateTime() {
	//Parse date and time values from user input
	var date = document.getElementById("datepicker").value;
	var hour = parseInt(document.getElementById("hourInput").value);
	var minute = parseInt(document.getElementById("minuteInput").value);
	var AMPMStatus = document.getElementById("AMPM").value;

	//Converts back to 24-hour time using AM/PM status
	if (AMPMStatus == "PM") {
		hour = ((hour + 12) % 24) || 12;
	}
	if (AMPMStatus == "AM" && hour == 12) {
		hour = 0;
	}

	//epochTime is updated to the time provided by user
	var newDate = new Date(date + " " + hour + ":" + minute);
	epochTime = newDate.getTime() / 1000;

	//Error checking for invalid times
	if (!epochTime) {
		alert("Please enter a valid date and time.");
		return;
	}

	//Deletes all previous map markers
	setAllMap(null);
	markers = [];
	function setAllMap(map) {
	    for (var i = 0; i < markers.length; i++) {
	        markers[i].setMap(map);
	    }
	}

	//Gets array of nearby sensors with new epochTime
	sensors = findNearbySensors(userLatitude, userLongitude, epochTime);
	if (sensors.length == 0) {
		alert("No air quality updates for the given time. Try a different time.")
	}

	//Plots markers on map from the sensor array
	plotAQMarkers();

	map.setOptions({
	  zoom: 9
	});
}

//Returns an array of nearby sensors within 100 square km of userlocation
function findNearbySensors(userLatitude, userLongitude, epochTime) {
	//Distance in kilometers (preset to 100km)
	var distance = 100;
	var sensors = [];

	//Creates a rectangular grid to constrain the feeds using 
	//Haversine formula

	//-------------------------* (maxLatitude, maxLongitude)
	//|                        |
	//|                        |
	//|          user          |							
	//|                        |
	//|                        |
	//|________________________|
	//*
	// (minLatitude, minLongitude)

	//Bottom-left corner of the rectangle grid
	var minLatitude = haversineNewCoords(userLatitude, userLongitude, distance, 225)[0];
	var minLongitude = haversineNewCoords(userLatitude, userLongitude, distance, 225)[1];

	//Top-right corner of the rectangle grid
	var maxLatitude = haversineNewCoords(userLatitude, userLongitude, distance, 45)[0];
	var maxLongitude = haversineNewCoords(userLatitude, userLongitude, distance, 45)[1];

	//Only reports feeds that come in within past two hours (7200 secs) of epochTime
	timeTwoHoursAgo = epochTime - 7200;
	var constrainedFeedLink = ESDR_root + "?where=latitude>" + minLatitude + ",latitude<" + maxLatitude 
								+ ",longitude>" + minLongitude + ",longitude<" + maxLongitude
								+ ",maxTimeSecs>" + timeTwoHoursAgo
								+ ",minTimeSecs<" + timeTwoHoursAgo
								+ "&fields=id,latitude,longitude,maxTimeSecs,name,channelBounds";

	//Goes through each feed in the constrained link
	//Gets the latitude, longitude, pollutant value of the sensors
	//Returns a final sensor array containing air quality data from nearby sensors
	$.getJSON(constrainedFeedLink, function(json) {
		var length = json["data"]["rows"].length;

		for (k = 0; k < length; k++) {
			id = json["data"]["rows"][k]["id"];
			name = json["data"]["rows"][k]["name"];
			latitude = json["data"]["rows"][k]["latitude"];
			longitude = json["data"]["rows"][k]["longitude"];
			minTime = json["data"]["rows"][k]["minTimeSecs"]
			maxTime = epochTime;

			link = ESDR_root + id;

			//Fetches PM 2.5 data if current channel is PM 2.5
			if (currentChannel == "PM 2.5 Value") {

				//Only fetches data if pollutant feed is available
				if ((json["data"]["rows"][k]["channelBounds"]) &&
					(json["data"]["rows"][k]["channelBounds"]["channels"]["PM2_5"])) {

					lastPollutantValue = getPollutantValue(link, minTime, maxTime, "PM2_5");
					timeValue = Number(lastPollutantValue[0]);
					pollutantValue = Number(lastPollutantValue[1]);

					//Only reports feeds that come in within past 
					//two hours (7200 secs) of epochTime
					if (timeValue > timeTwoHoursAgo) {
						feedData = {
							"name": name,
							"latitude": latitude,
							"longitude": longitude,
							"time": timeValue,
							"PM 2.5 Value": pollutantValue
						};
						sensors.push(feedData);
					}
				}
			////Fetches Ozone data if current channel is Ozone
			} else if (currentChannel == "Ozone Value") {

				if ((json["data"]["rows"][k]["channelBounds"]) &&
					(json["data"]["rows"][k]["channelBounds"]["channels"]["OZONE"])) {

					lastPollutantValue = getPollutantValue(link, minTime, maxTime, "OZONE");
					timeValue = Number(lastPollutantValue[0]);
					pollutantValue = Number(lastPollutantValue[1]);

					//Only reports feeds that come in within past 
					//two hours (7200 secs) of epochTime
					if (timeValue > timeTwoHoursAgo) {
						feedData = {
							"name": name,
							"latitude": latitude,
							"longitude": longitude,
							"time": timeValue,
							"Ozone Value": pollutantValue
						};
						sensors.push(feedData);
					}
				}
			}
		}
	});

	return sensors;
}

//Uses haversine formula to calculate new lat-long coordinates
//given original lat-long coords., distance, and bearing
function haversineNewCoords(lat1, long1, distance, bearing) {
	//Converting the inputs to radians for use in the Haversine formula
	var lat1 = lat1 * (Math.PI / 180);
	var long1 = long1 * (Math.PI / 180);
	var bearing = bearing * (Math.PI / 180);
	//Converting distances from km to meters
	var distance = distance * 1000
	var earthRadius = 6371000

	//Haversine formula calculations
	//Taken from: http://www.movable-type.co.uk/scripts/latlong.html
	var newlat = (Math.asin(Math.sin(lat1)*Math.cos(distance/earthRadius) 
					+ Math.cos(lat1)*Math.sin(distance/earthRadius)*Math.cos(bearing))) * (180 / Math.PI);
	
	var newlong = (long1 + Math.atan2(Math.sin(bearing)*Math.sin(distance/earthRadius)*Math.cos(lat1),
                     Math.cos(distance/earthRadius)-Math.sin(lat1)*Math.sin(newlat))) * (180 / Math.PI);

	var coords = [newlat, newlong];
	return coords;
}

//Returns the last recorded pollutant value from a sensor
//given a time range (minTime to maxTime)
function getPollutantValue(link, minTime, maxTime, pollutant) {
	var channelLink = link + "/channels/" + pollutant + "/export?from=" + minTime + "&to=" + maxTime;

	//Gets csv text from ESDR
    $.ajax({
        type: "GET",
        url: channelLink,
        dataType: "text",
        success: function(data) {processData(data);}
     });

    //Parses the csv and extracts the last pollutant value from the file 
	function processData(allText) {
	    var allTextLines = allText.split(/\r\n|\n/);
	    var lastLine = allTextLines[allTextLines.length-2];
	    lastValue = lastLine.split(',');
	}

	return lastValue;
}

//Goes through each feed in sensors array and plots markers on map
//Also creates an info window for each marker
function plotAQMarkers() {
	for (i = 0; i <= Object.keys(sensors).length - 1; i++) {
		//Only place marker if none of the values are null
		if (sensors[i]["latitude"] && sensors[i]["longitude"] && sensors[i][currentChannel]) {
			var latLng = new google.maps.LatLng(sensors[i]["latitude"], sensors[i]["longitude"]);
			var marker = new google.maps.Marker({
				position: latLng,
				icon: {
			      path: google.maps.SymbolPath.CIRCLE,
			      fillOpacity: 0.9,
			      fillColor: getMarkerColor(sensors[i][currentChannel]),
			      strokeWeight: 1.5,
			      strokeColor: "#000000",
			      scale: 12,
			    },
				map: map
			});
			markers.push(marker);

			//Creates a new info window for each marker
			var infowindow = new google.maps.InfoWindow();
			attachInfoWindow(marker, i);
			function attachInfoWindow(marker, i) {
				google.maps.event.addListener(marker, 'click', function() {
					var contentString = "<div style=\"font-size:16px; line-height: 30px\">"
										+ "<b>Station: </b>" + sensors[i]["name"] 
										+ "<br><b>" + currentChannel + ": </b>" + sensors[i][currentChannel] + " " + getUnits(currentChannel)
										+ "<br><b>Quality: </b>"+ getMarkerStatus(sensors[i][currentChannel])
										+"<br><b>Timestamp: </b>" + getLocalTime(sensors[i]["time"])
										+ "</div>";
					infowindow.setOptions({
						content: contentString,
					});
					infowindow.open(marker.get('map'), marker);
				});
			}
		}
	}
}

//Colors of the air quality levels
var markerColors = {
	good: "#00E400",
	moderate: "#E1E100",
	unhealthy_for_sensitive_groups: "#FF7E00",
	unhealthy: "#FF0000",
	very_unhealthy: "#99004C",
	hazardous: "#7E0023",
	none: "#dddddd"
};

//Directs the request to get the marker status to the 
//appropriate function (PM 2.5 or Ozone)
function getMarkerStatus(value) {
	if (currentChannel == "PM 2.5 Value") {
		return getMarkerStatusPM2_5(value);
	} else if (currentChannel == "Ozone Value") {
		return getMarkerStatusOZONE(value);
	}
}

//Directs the request to get the marker color to the 
//appropriate function (PM 2.5 or Ozone)
function getMarkerColor(value) {
	if (currentChannel == "PM 2.5 Value") {
		return getMarkerColorPM2_5(value);
	} else if (currentChannel == "Ozone Value") {
		return getMarkerColorOZONE(value);
	}
}

//Returns PM 2.5 classifications taken from
//http://airnow.gov/index.cfm?action=aqibasics.aqi
function getMarkerStatusPM2_5(value) {
	if (value <= 12) {
		return "Good";
	} else if (value <= 35.4) {
		return "Moderate";
	} else if (value <= 55.4) {
		return "Unhealthy for Sensitive Groups";
	} else if (value <= 150.4) {
		return "Unhealthy";
	} else if (value <= 250.4) {
		return "Very Unhealthy";
	} else if (value <= 500.4) {
		return "Hazardous";
	} else {
		return "None";
	}
} 

//Returns PM 2.5 color codes taken from
//http://airnow.gov/index.cfm?action=aqibasics.aqi
function getMarkerColorPM2_5(value) {
	if (value <= 12) {
		return markerColors.good;
	} else if (value <= 35.4) {
		return markerColors.moderate;
	} else if (value <= 55.4) {
		return markerColors.unhealthy_for_sensitive_groups;
	} else if (value <= 150.4) {
		return markerColors.unhealthy;
	} else if (value <= 250.4) {
		return markerColors.very_unhealthy;
	} else if (value <= 500.4) {
		return markerColors.hazardous;
	} else {
		return markerColors.none;
	}
}

//Returns Ozone classifications taken from
//http://airnow.gov/index.cfm?action=aqibasics.aqi
function getMarkerStatusOZONE(value) {
	if (value <= 59) {
		return "Good";
	} else if (value <= 75) {
		return "Moderate";
	} else if (value <= 95) {
		return "Unhealthy for Sensitive Groups";
	} else if (value <= 115) {
		return "Unhealthy";
	} else if (value <= 374) {
		return "Very Unhealthy";
	} else {
		return "None";
	}
}

//Returns Ozone color codes taken from
//http://airnow.gov/index.cfm?action=aqibasics.aqi
function getMarkerColorOZONE(value) {
	if (value <= 59) {
		return markerColors.good;
	} else if (value <= 75) {
		return markerColors.moderate;
	} else if (value <= 95) {
		return markerColors.unhealthy_for_sensitive_groups;
	} else if (value <= 115) {
		return markerColors.unhealthy;
	} else if (value <= 374) {
		return markerColors.very_unhealthy;
	} else {
		return markerColors.none;
	}
}

//Converts an UNIX time value to a local time string 
function getLocalTime(epochTimeLocal) {
	var myDate = new Date(epochTimeLocal * 1000);
	var myTime = myDate.toLocaleString();

	return myTime;
}

//Updates the location when "Go" button pressed
function updateLocationOnEnter(event) {
	if (event.keyCode == 13 || event.which == 13) {
		updateLocation();
	}
}

//Returns the units for PM 2.5 and Ozone
function getUnits(channel) {
	if (channel == "PM 2.5 Value") {
		return "ug/m3";
	} else if (channel == "Ozone Value") {
		return "ppb";
	}
}

//JQuery Datepicker function
//Source: https://jqueryui.com/datepicker/
$(function() {
	$( "#datepicker" ).datepicker();
});

//JQuery Progress bar function
//Source: https://jqueryui.com/progressbar/#indeterminate
$(function() {
    $( "#progressbar" ).progressbar({
      value: false
    });
    $( "button" ).on( "click", function( event ) {
      var target = $( event.target ),
        progressbar = $( "#progressbar" ),
        progressbarValue = progressbar.find( ".ui-progressbar-value" );
 
      if ( target.is( "#numButton" ) ) {
        progressbar.progressbar( "option", {
          value: Math.floor( Math.random() * 100 )
        });
      } else if ( target.is( "#colorButton" ) ) {
        progressbarValue.css({
          "background": '#' + Math.floor( Math.random() * 16777215 ).toString( 16 )
        });
      } else if ( target.is( "#falseButton" ) ) {
        progressbar.progressbar( "option", "value", false );
      }
    });
});

//Sidebar button onclick functions//

//Changes current channel to PM 2.5 and updates map
function changeChannelPM2_5() {
	document.getElementById("OZONE").style.color = "#000";
	document.getElementById("OZONE").style.background = "#fff";
	document.getElementById("OZONE").style.borderColor = "#4cae4c";
	document.getElementById("PM 2.5").style.color = "#fff";
	document.getElementById("PM 2.5").style.background = "#4cae4c";
	document.getElementById("PM 2.5").style.borderColor = "#4cae4c";
	currentChannel = "PM 2.5 Value";
	updateLocation();
}

//Changes current channel to Ozone and updates map
function changeChannelOzone() {
	document.getElementById("PM 2.5").style.color = "#000";
	document.getElementById("PM 2.5").style.background = "#fff";
	document.getElementById("OZONE").style.color = "#fff";
	document.getElementById("OZONE").style.background = "#4cae4c";
	document.getElementById("OZONE").style.borderColor = "#4cae4c";
	currentChannel = "Ozone Value";
	updateLocation();
}

//Displays color key, hides timeline
function key() {
	document.getElementById("colorKey").style.display = "";
	document.getElementById("timelineForm").style.display = "none";
	document.getElementById("timeline").style.color = "#000";
	document.getElementById("timeline").style.background = "#fff";
	document.getElementById("timeline").style.borderColor = "#4cae4c";
	document.getElementById("key").style.color = "#fff";
	document.getElementById("key").style.background = "#4cae4c";
	document.getElementById("key").style.borderColor = "#4cae4c";
	document.getElementById("sidebar").style.height = "550px";
}

//Displays timeline feature, hides colorKey
function timeline() {
	document.getElementById("colorKey").style.display = "none";
	document.getElementById("timelineForm").style.display = "";
	document.getElementById("key").style.color = "#000";
	document.getElementById("key").style.background = "#fff";
	document.getElementById("timeline").style.color = "#fff";
	document.getElementById("timeline").style.background = "#4cae4c";
	document.getElementById("timeline").style.borderColor = "#4cae4c";
	document.getElementById("sidebar").style.height = "450px";
}

//Updates epochTime to the current time
function currentTime() {
	epochTime = Math.floor(Date.now()/1000);

	//Restoring the date and time values to current time
	initializeDate();
	initializeHour();
	initializeMinute();
	initializeAMPM();

	updateTime();
}