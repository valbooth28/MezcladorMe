"use strict";

function heuristic(song1, song2){
	var tempo1 = parseFloat(song1.enInfo.tempo);
	var tempo2 = parseFloat(song2.enInfo.tempo)
    var tempDiff = Math.abs(tempo1-tempo2);
    var danceDiff = Math.abs((parseFloat(song1.enInfo.danceability* 100))-(parseFloat(song2.enInfo.danceability * 100)))
    var loudDiff = Math.abs(parseFloat(song1.enInfo.loudness)-parseFloat(song2.enInfo.loudness));
    var valDiff = Math.abs((parseFloat(song1.enInfo.valence*100)) -(parseFloat(song2.enInfo.valence*100)) );
    var acoustDiff = Math.abs((parseFloat(song1.enInfo.acousticness*100)) - (parseFloat(song2.enInfo.acousticness*100)));
    var energyDiff = Math.abs((parseFloat(song1.enInfo.energy*100))-(parseFloat(song2.enInfo.energy)*100));
    //Based off of my mix test data. Not sure if this math makes sense
    var result =7.5*loudDiff+danceDiff+(15/17)*energyDiff+(15/21)*acoustDiff+(15/24)*valDiff+(15/31)*tempDiff;
    return result;
}   



function buildGraph(allSongs){
	var graph = (function () {
	    var that = {
	        nodes: [], 
	        add: function(newNode) {
	            var index = 0;
	            var allNodes = this.nodes;
	            var graphLength=allNodes.length;
	            
	           	if(graphLength == 0){
	           		allNodes.push(newNode);
	           	}else{
	           		var newVal = newNode[0];
	           		var index = 0;
	           		while((index < graphLength)){
	           			var entry =allNodes[index];
	           			if(entry[0] < newVal){
	           				index++;
	           			}else{
	           				break;
	           			}
	           		}
	           		if(index == graphLength-1){
	           			allNodes.push(newNode);
	           		}else{
	           			allNodes.splice(index, 0, newNode);
	           		}
	           	}
	        },
	        remove: function() {
	        	//console.log("removing from graph: " + JSON.stringify(this.nodes, null, 4));
	        	return this.nodes.shift();
	        }
    	};
    return that;
	}());
	for(var k=0; k<allSongs.length;k++){
		for(var l=0; l<allSongs.length;l++){
			if(l==k){
				continue;
			}else{
				var song1 = allSongs[k];
				var song2 = allSongs[l];
				var edge = heuristic(song1, song2);
				var newNode = [];
				newNode.push(edge, k,l);
			}
			graph.add(newNode);
		}
	}
	return graph;
}

function MST(graph, songCount, allSongs){
	var treeSize = 0;
	var adjList = {};
	var edgeCount = {};
	var fullNodes = {};
	var nextNode;
	var cycleChecking = [];
	while(treeSize < songCount-1){
		nextNode = graph.remove();
		var vertex1 = nextNode[1];
		var vertex2 = nextNode[2];
		var vert1EdgeCount;
		var vert2EdgeCount;
		if(fullNodes.hasOwnProperty(vertex1) || fullNodes.hasOwnProperty(vertex2)){
			continue;
		}
		var cycleExists = false;
		for(var i=0;i < cycleChecking.length; i++){
			var subTree = cycleChecking[i];
			if((subTree.indexOf(vertex1)!= -1) && (subTree.indexOf(vertex2)!=-1)){
				cycleExists = true;
			}
		}
		if(cycleExists) continue;
		if(!edgeCount.hasOwnProperty(vertex1)){
			vert1EdgeCount= 0;
		}else{
			vert1EdgeCount=edgeCount[vertex1];
		}
		if(!edgeCount.hasOwnProperty(vertex2)){
			vert2EdgeCount= 0;
		}else{
			vert2EdgeCount=edgeCount[vertex2]
		}
		if(!adjList.hasOwnProperty(vertex1)){
			adjList[vertex1] = [vertex2];
		}else{
			adjList[vertex1].push(vertex2);
		}
		if(!adjList.hasOwnProperty(vertex2)){
			adjList[vertex2] = [vertex1];
		}else{
			adjList[vertex2].push(vertex1);
		}
		vert1EdgeCount+=1;
		vert2EdgeCount+=1;
		edgeCount[vertex1] = vert1EdgeCount;
		edgeCount[vertex2] = vert2EdgeCount;
		if(vert1EdgeCount==2){
			fullNodes[vertex1] = 1;
		}
		if(vert2EdgeCount==2){
			fullNodes[vertex2] = 1;
		}
		
		if((vert1EdgeCount ==1) && (vert2EdgeCount==vert1EdgeCount)){
			cycleChecking.push([vertex2,vertex1]);
		}else if((vert1EdgeCount ==1)){
			for(var i =0; i < cycleChecking.length; i++){
				var subTree = cycleChecking[i];
				if (subTree.indexOf(vertex2)!=-1){
					cycleChecking[i].push(vertex1);
				}
			}
		}else if((vert2EdgeCount ==1)){
			for(var i =0; i < cycleChecking.length; i++){
				var subTree = cycleChecking[i];
				if (subTree.indexOf(vertex1)!=-1){
					cycleChecking[i].push(vertex2);
				}
			}
		}else{
			var subTree1;
			var subTree2;
			for(var i =0; i < cycleChecking.length; i++){
				var subTree = cycleChecking[i];
				if(subTree.indexOf(vertex1)!= -1){
					subTree1 = i;
				} if (subTree.indexOf(vertex2)!=-1){
					subTree2 = i;
				}
			}
			//Just copy into subtree 1, no particular reason
			cycleChecking[subTree1] = cycleChecking[subTree1].concat(cycleChecking[subTree2]);
			cycleChecking.splice(subTree2, 1);
		}
		
		console.log("treeSize: " + treeSize);
		console.log("adjList: "+JSON.stringify(adjList, null, 4));
		treeSize++;
	}
	//TODO remove
	//console.log("adjList: "+JSON.stringify(adjList, null, 4));
	//TODO return something
	var results = buildPath(adjList, allSongs);
	return results;
}


function buildPath(adjList, allSongs){
	var path = [];
	var pathIndices = [];
	var startNode;
	for(var prop in adjList){
		if(adjList.hasOwnProperty(prop)){
			if(adjList[prop].length == 1){
				startNode = prop;
				break;
			}
		}
	}
	var parent= adjList[startNode][0];
	pathIndices.push(startNode, parent);
	path.push(toData(startNode,allSongs), toData(parent,allSongs));
	
	var parentLst= adjList[parent];
	var newParent;
	while(path.length< allSongs.length){
		for(var i = 0; i<parentLst.length; i++){
			if(pathIndices.indexOf(parentLst[i])==-1){
				newParent = parentLst[i];
			}
		}
		path.push(toData(newParent,allSongs));
		pathIndices.push(newParent);
		parentLst = adjList[newParent];
		parent = newParent;
	}
	console.log("PATH: " + JSON.stringify(path, null, 4));
	return path;
}

function toData(index, allSongs){
	var trackInfo = allSongs[index];
	var data = {
        name: trackInfo.name,
        artists: [trackInfo.artist],
        id: trackInfo.id,
        which: index,
        enInfo: {
            tempo: trackInfo.tempo,
            energy: trackInfo.energy,
            danceability: trackInfo.danceability,
            loudness: trackInfo.loudness,
            valence: trackInfo.valence,
            duration_s: trackInfo.duration,
            acousticness: trackInfo.acousticness,
    	}
	}
	var track = {
		track: data
	}
	return track;
}
