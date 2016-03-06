"use strict";

function heuristic(song1, song2){
    var tempDiff = Math.abs(parseFloat(song1.enInfo.tempo) - parseFloat(song2.enInfo.tempo));
    var danceDiff = Math.abs((parseFloat(song1.enInfo.danceability) * 100)-(parseFloat(song2.enInfo.danceability) * 100))
    var loudDiff = Math.abs(parseFloat(song1.enInfo.loudness)-parseFloat(song2.enInfo.loudness));
    var valDiff = Math.abs((parseFloat(song1.enInfo.valence)*100) -(parseFloat(song2.enInfo.valence)*100) );
    var acoustDiff = Math.abs((parseFloat(song1.enInfo.acousticness)*100) - (parseFloat(song2.enInfo.acoustDiff)*100));
    var energyDiff = Math.abs((parseFloat(song1.enInfo.energy)*100)-(parseFloat(song2.enInfo.energy)*100));
    //Based off of my mix test data. Not sure if this math makes sense
    var result =7.5*loudDiff+danceDiff+(15/17)*energyDiff+(15/21)*acoustDiff+(15/24)*valDiff+(15/31)*tempDiff;
    return result;
}   


function buildGraph(allSongs){
	for(var i = 0; i< allSongs.length; i++){

	}

}