var formattedName = HTMLheaderName.replace("%data%", "Shouvik Mani");
var formattedRole = HTMLheaderRole.replace("%data%", "Web Developer");

//$("#header").prepend(formattedRole);
//$("#header").prepend(formattedName);


var skills = ["awesomeness", "programming", "teaching"];

var bio = {
	"name" : "Shouvik",
	"age" : 18,
	"skills" : skills
}

//$("#main").append(bio.name);

var work = {
	"employer" : "Carnegie Mellon CREATE Lab",
	"city" : "Pittsburgh"
}
work["position"] = "Research Programmer";

//$("#main").append(ed.name);
//$("#main").append(work["position"]);

var education = {
	"Lynbrook" : {
		"city" : "San Jose",
		"majors" : "Economics, CS",
		"grad" : 2014
	},
	"Carnegie Mellon" : {
		"city" : "Pittsburgh",
		"majors" : "N/A",
		"grad" : 2018
	}
}