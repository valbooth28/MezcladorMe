"use strict";
var accessToken = null;
var curUserID = null;
var curPlaylist = null;
var audio = $("<audio>");
var songTable;
var cols = [
    'order', 'title', 'artist', 'BPM', 'energy',
    'danceability', 'loudness', 'valence', 'duration',
    'acousticness', 'popularity'
];
// disable save while loading and saving, no matter what the saved state
var forceDisableSave = false;
// state of the saved playlist, so save button is only shown when different
var savedState = {};
var allSongs;
function error(msg) {
    info(msg);
}
function getCurSortName() {
    var currentState = getPlaylistState();
    var prefix = (currentState.order[1] == 'asc') ? 'increasing ' : 'decreasing ';
    return prefix + cols[currentState.order[0]];
}
function info(msg) {
    $("#info").text(msg);
}
function authorizeUser() {
    var scopes = 'playlist-read-private playlist-modify-private playlist-modify-public';
    var url = 'https://accounts.spotify.com/authorize?client_id=' + SPOTIFY_CLIENT_ID +
        '&response_type=token' +
        '&scope=' + encodeURIComponent(scopes) +
        '&redirect_uri=' + encodeURI(SPOTIFY_REDIRECT_URI);
    document.location = url;
}
function parseArgs() {
    var hash = location.hash.replace(/#/g, '');
    var all = hash.split('&');
    var args = {};
    _.each(all, function(keyvalue) {
        var kv = keyvalue.split('=');
        var key = kv[0];
        var val = kv[1];
        args[key] = val;
    });
    return args;
}
function callSpotify(type, url, json, callback) {
    $.ajax(url, {
        type: type,
        data: JSON.stringify(json),
        dataType: 'json',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
        },
        success: function(r) {
            callback(true, r);
        },
        error: function(r) {
            // 2XX status codes are good, but some have no
            // response data which triggers the error handler
            // convert it to goodness.
            if (r.status >= 200 && r.status < 300) {
                callback(true, r);
            } else {
                callback(false, r);
            }
        }
    });
}
function callSpotifyQ(type, url, json) {
    return Q.Promise(function(resolve, reject, notify) {
        $.ajax(url, {
            type: type,
            data: JSON.stringify(json),
            dataType: 'json',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            beforeSend : function () {
                console.log(type + ": " + this.url);
            },
            success: function(data) {
                resolve(data);
            },
            error: function(jqXHR, textStatus) {
                // 2XX status codes are good, but some have no
                // response data which triggers the error handler
                // convert it to goodness.
                if (jqXHR.status >= 200 && jqXHR.status < 300) {
                    resolve(undefined);
                } else {
                    reject(textStatus);
                }
            }
        });  
    });
}

function getSpotify(url, data, callback) {
    $.ajax(url, {
        dataType: 'json',
        data: data,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        },
        success: function(r) {
            callback(r);
        },
        error: function(r) {
            callback(null);
        }
    });
}
function getSpotifyQ(url, data) {
    return Q.Promise(function(resolve, reject, notify) {
        $.ajax(url, {
            dataType: 'json',
            data: data,
            headers: {
                'Authorization': 'Bearer ' + accessToken
            },
            beforeSend : function () {
                // console.log("GET: " + this.url);
            },
            success: function(data) {
                resolve(data);
            },
            error: function(jqXHR, textStatus) {
                if (jqXHR.status >= 200 && jqXHR.status < 300) {
                    resolve(undefined);
                } else {
                    reject(textStatus);
                }
            }
        });
    });
}
function showPlaylists() {
    $(".worker").hide();
    $("#playlists").show();
}
function fetchSinglePlaylist(playlist) {
    $(".worker").hide();
    $("#single-playlist").show();
    $("#single-playlist-contents").hide();
    $(".spinner2").show();
    $("#song-table tbody").empty();
    window.scrollTo(0,0);
    disableSaveButton();
    songTable.clear();
    resetState();
    curPlaylist = playlist;
    curPlaylist.tracks.items = [];
    $("#playlist-title").text(playlist.name);
    $("#playlist-title").attr('href', playlist.uri);
    info("");
    fetchPlaylistTracks(playlist)
    //Fuck save state right now
    // .then(function() {
    //     saveState();
    //     enableSaveButtonWhenNeeded();
    // // })
    // .catch(function(msg) {
    //     console.log('msg', msg);
    //     error("Error while loading playlist: " + msg);
    // });

}
function mix(){
    //TODO remove
    console.log("Got to the mix function!");
    var graph = buildGraph(allSongs);
    //console.log(JSON.stringify(graph, null, 4));
    var newOrder = MST(graph, allSongs.length, allSongs);
    var data = {
        items: newOrder
    }
    songTable.destroy();
    $("#song-table").empty();
    songTable = initTable();
    updateTable(data);
}
function findDuplicates(playlist) {
    var ids = {};
    var dups = [];
    _.each(playlist.tracks.items, function(item, i) {
        if (item.track && item.track.id) {
            var track = item.track.id;
            if (id in ids) {
                dups.push(id);
            }
            ids[id] = 1;
        }
    });
    return dups;
}
function formatDuration(dur) {
    var mins = Math.floor(dur / 60)
    var secs = Math.floor(dur - mins * 60);
    var ssecs = secs.toString();
    if (secs < 10) {
        ssecs = '0' + ssecs;
    }
    return mins + ":" + ssecs;
}
function fetchAudioFeatures(ids) {
    var url = 'http://developer.echonest.com/api/v4/track/profile?api_key=FFUEJWLF3RQQQP2K8&callback=?';
    $.ajaxSetup({
        scriptCharset: "utf-8",
        contentType: "application/json",
        charset:"ISO-8859-1"
    });
    var promises = [];
    for(var i = 0; i <ids.length; i++){
        var id = ids[i];
        //TODO remove
        //console.log('spotify-WW:track:'.concat(id));
        promises.push($.getJSON(url, { id: 'spotify-WW:track:'.concat(id), format:'jsonp', bucket : 'audio_summary'}, function(data) {
            }
        ))
    }
    // Combine all promises
    // and run a callback
    return $.when.apply($, promises).then(function(){
        var tracks = [];

        // This callback will be passed the result of each AJAX call as a parameter
        for(var i = 0; i < arguments.length; i++){
            // arguments[i][0] is needed because each argument
            // is an array of 3 elements.
            // The data, the status, and the jqXHR object
            //console.log(JSON.stringify(data, null, 4));
            //console.log(JSON.stringify(data.response.track.audio_summary, null, 4));
            var trackInfo = arguments[i][0].response.track;
            var data = {
                name: trackInfo.title,
                artist: trackInfo.artist,
                id: trackInfo.foreign_id.substring(14),
                which: i,
                enInfo: {
                    tempo: trackInfo.audio_summary.tempo,
                    energy: trackInfo.audio_summary.energy,
                    danceability: trackInfo.audio_summary.danceability,
                    loudness: trackInfo.audio_summary.loudness,
                    valence: trackInfo.audio_summary.valence,
                    duration_s: trackInfo.audio_summary.duration,
                    acousticness: trackInfo.audio_summary.acousticness,
                }

            }
            tracks.push(data);
        }
        //TODO remove
        return tracks;

    });
}
function updateTable(tracks) {
    $("#single-playlist-contents").show();
    _.each(tracks.items, function(item, i) {
        var track = item.track;
        addTrack(songTable, track);
    });
    songTable.draw();
    $(".spinner2").hide();
}
function addTrack(table,track) {
    if ('tempo' in track.enInfo) {
        var data = [
                track.which + 1, 
                track.name, 
                track.artists[0].name,
                Math.round(track.enInfo.tempo),
                Math.round(track.enInfo.energy * 100),
                Math.round(track.enInfo.danceability * 100),
                Math.round(track.enInfo.loudness),
                Math.round(track.enInfo.valence * 100),
                formatDuration(Math.round(track.enInfo.duration_s)),
                Math.round(track.enInfo.acousticness * 100),
                //Math.round(track.enInfo.song_hotttnesss * 100),
                //Math.round(track.popularity),
                track
        ];
        table.row.add(data);
    } else {
        table.row.add([
                track.which + 1, 
                track.name, 
                track.artists[0].name,
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                track
        ]);
    }
}
function fetchPlaylistTracks(playlist) {
    function fetchLoop(url) {
        var tracks;
        return getSpotifyQ(url)
        .then(function(data) {
            var ids = [];
            tracks = data.tracks ? data.tracks : data;
            _.each(tracks.items, function(item, i) {
                if (item.track) {
                    item.track.which = curPlaylist.tracks.items.length;
                    curPlaylist.tracks.items.push(item);
                    if (item.track && item.track.id) {
                        ids.push(item.track.id);
                    }
                }
            });
            
            return fetchAudioFeatures(ids).then(function(trackData){
                return trackData;
            });
        })
        .then(function(trackFeatures) {
            var fmap = {};
            //console.log('audio', JSON.stringify(trackFeatures,null,4));
            // beta apis are funny like this ...
            if ('audio_attributes' in trackFeatures) {
                trackFeatures = trackFeatures['audio_attributes']
            }
            if ('audio_features' in trackFeatures) {
                trackFeatures = trackFeatures['audio_features']
            }
            _.each(trackFeatures, function(trackFeature, i) {
                if (trackFeature && trackFeature.id) {
                    fmap[trackFeature.id] = trackFeature;
                }
            });
            _.each(tracks.items, function(item, i) {
                if (item.track && item.track.id) {
                    var tid = item.track.id;
                    if (tid in fmap) {
                        item.track.enInfo = fmap[tid].enInfo;
                        //console.log(JSON.stringify(fmap[tid].enInfo, null, 4));
                    } else {
                        item.track.enInfo = {};
                    }
                }
            });
            updateTable(tracks);
            allSongs = trackFeatures;
            //TODO remove
            //console.log(JSON.stringify(allSongs, null, 4));
            //TODO not necessary, remove?
            if (tracks.next) {
                return fetchLoop(tracks.next);
            }

        })
        
    }
    // Spotify API defect? specifying limit will actually return up to 100 items anyway.
    var startUrl = "https://api.spotify.com/v1/users/" + playlist.owner.id +
        "/playlists/" + playlist.id + "/tracks?limit=50";
    return fetchLoop(startUrl);
}
function fetchPlaylists(uid, callback) {
    $("#playlist-list tbody").empty();
    $(".prompt").hide();
    $(".spinner").show();
    info("Getting your playlists");
    var url = 'https://api.spotify.com/v1/users/' + uid + '/playlists';
    var data = {
        limit:50,
        offset:0
    }
    getSpotify(url, data, callback);
}
function fetchCurrentUserProfile(callback) {
    var url = 'https://api.spotify.com/v1/me';
    getSpotify(url, null, callback);
}
function goodPlaylist(playlist) {
    return playlist.tracks.total > 0; // && playlist.owner.id == curUserID;
}
function formatOwner(owner) {
    if (owner.id == curUserID) {
        return "";
    } else {
        // opportunity to fetch owner details here
        return owner.id;
    }
}
function playlistLoaded(playlists) {
    var pl = $("#playlist-list tbody");
    $(".prompt").show();
    $(".spinner").hide();
    if (playlists) {
        info("");
        _.each(playlists.items, function(playlist) {
            if (goodPlaylist(playlist)) {
                var tr = $("<tr>");
                var tdName = $("<td>")
                var aName = $("<a>")
                    .text(playlist.name)
                    .addClass('hoverable')
                    .on('click', function() {
                        fetchSinglePlaylist(playlist);
                    });
                tdName.append(aName);
                var tdTrackCount = $("<td>").text(playlist.tracks.total);
                var tdOwner = $("<td>").text(formatOwner(playlist.owner));
                tr.append(tdName);
                tr.append(tdTrackCount);
                tr.append(tdOwner);
                pl.append(tr);
            }
        });
        $("#mix").on('click', function(){
            mix();
        });
        if (playlists.next) {
            getSpotify(playlists.next, null, playlistLoaded);
        }
    } else {
        error("Sorry, I couldn't find your playlists");
    }
}
function loadPlaylists(uid) {
    $("#playlists").show();
    fetchPlaylists(uid, playlistLoaded);
}
function inRange(val, min, max) {
    return ( ( isNaN(min) && isNaN(max) ) ||
             ( isNaN(min) && val <= max ) ||
             ( min <= val && isNaN(max) ) ||
             ( min <= val && val <= max ) );
}
function playlistFilter( settings, data, dataIndex ) {
    var minBpm = parseInt( $('#min-bpm').val(), 10 );
    var maxBpm = parseInt( $('#max-bpm').val(), 10 );
    var includeDouble = $('#include-double').is(':checked');
    var bpm = parseFloat( data[3] ) || 0;
    return inRange(bpm, minBpm, maxBpm) || 
        (includeDouble && inRange(bpm*2, minBpm, maxBpm));
}
function playTrack(track) {
    audio.attr('src', track.preview_url);
    audio.get(0).play();
}
function stopTrack() {
    audio.get(0).pause();
}
// ----------------------------------------------------------------------------
// Playlist Saving
// ----------------------------------------------------------------------------
function getSortedUrisFromTable(tracks, table) {
    // Possibly a defect in DataTables: rows() and rows().indexes() returns array in incorrect order
    // Instead, use rows().data() and calculate index from track column.
    return _.chain(table.rows({filter:'applied'}).data())
        // Web API only doesn't support local files for now.
        .select(function(rowdata) { return rowdata[11].uri.startsWith("spotify:track:"); } )
        .map (function(rowdata) {return rowdata[11].uri;})
        .value();
}
// (#save,#dropSave,#dropOverwrite).onclick
function savePlaylist(playlist, createNewPlaylist) {
    var tids = getSortedUrisFromTable(playlist.tracks.items, songTable);
    if (tids.length <= 0) {
        error("Cannot save the playlist because there are no tracks left after filtering");
        return;
    }
    disableSaveButton();
    showSaveSpinner(true);
    createOrReusePlaylist(playlist, createNewPlaylist)
    .then(function(playlistToModify) {
        return saveTidsToPlaylist(playlistToModify, tids, true);
    })
    .then(function() {
        saveState();
    })
    .catch(function(msg) {
        error(msg);
    })
    .finally(function() {
        showSaveSpinner(false);
        enableSaveButtonWhenNeeded();
    })
}
function saveTidsToPlaylist(playlist, tids, replace) {
    var sliceLength = 100;
    var this_tids = tids.slice(0, sliceLength);
    var remaining = tids.slice(sliceLength);
    var url = "https://api.spotify.com/v1/users/" + playlist.owner.id + 
         "/playlists/" + playlist.id + '/tracks';
    var type;
    var json;
    if (replace) {
        type = 'PUT';
        json = { 'uris': this_tids };
    } else {
        type = 'POST';
        json = this_tids;
    }
    return callSpotifyQ(type, url, json)
    .then(function() {
        if (remaining.length > 0) {
            return saveTidsToPlaylist(playlist, remaining, false);
        } 
    })
    .catch(function() {
        return Q.reject("Trouble saving tracks to the playlist");
    });
}
function createPlaylist(owner, name, isPublic) {
    var url = "https://api.spotify.com/v1/users/" + owner + "/playlists";
    var json = { name: name, 'public': isPublic };
    return callSpotifyQ('POST', url, json)
    .catch(function() {
        return Q.reject("Cannot create the new playlist");
    });
}
function createOrReusePlaylist(playlist, createNewPlaylist) {
    if (createNewPlaylist) {
        var sortName = getCurSortName();
        return createPlaylist(curUserID, playlist.name + " sorted by " + sortName, playlist.public);
    } else {
        return Q(playlist);
    }
}
// ----------------------------------------------------------------------------
// Saved playlist state tracking
// ----------------------------------------------------------------------------
function resetState() {
    songTable.order([0, 'asc']);
    $('#min-bpm').val("");
    $('#max-bpm').val("");
    $('#include-double').prop('checked', true);
    saveState();
}
// we keep track of which column we last sorted on so we
// can enable or disable the save button as appropriate
function getPlaylistState() {
    var firstOrder = [];
    var selectedTableOrder = songTable.order();
    if (selectedTableOrder.length >= 1) {
        firstOrder = _.clone(selectedTableOrder[0]); // object is reused by datatable!
    }
    return { 
        minBpm: parseInt( $('#min-bpm').val(), 10 ),
        maxBpm: parseInt( $('#max-bpm').val(), 10 ),
        includeDouble: $('#include-double').is(':checked'),
        order: firstOrder,
    };
}
function saveState() {
    savedState = getPlaylistState();
}
function isSavable() {
    return !_.isEqual(savedState, getPlaylistState());
}
function setNeedsSave(state) {
    if (state) {
        $("#save,#saveDropdown").attr('disabled', false);
        $("#save,#saveDropdown").removeClass('btn-warning');
        $("#save,#saveDropdown").addClass('btn-primary');
    } else {
        $("#save,#saveDropdown").attr('disabled', true);
        $("#save,#saveDropdown").addClass('btn-warning');
        $("#save,#saveDropdown").removeClass('btn-primary');
    }
}
function updateSaveButtonState() {
    setNeedsSave(!forceDisableSave && isSavable());
}
function disableSaveButton() {
    forceDisableSave = true;
    updateSaveButtonState();
}
function enableSaveButtonWhenNeeded() {
    forceDisableSave = false;
    updateSaveButtonState();
}
function showSaveSpinner(showSpinner) {
    if (showSpinner) {
        $('#save').addClass('active');
    } else {
        $('#save').removeClass('active');
    }
}



function initTable() {
    var table = $("#song-table").DataTable( {
            paging: false,
            searching: true,  // searching must be enabled for filtering to work
            // scrollY:'300px',
            info:false,
            dom:"t", // only show table (exclude search bar)
            columnDefs: [
                { type : "time-uni", targets:8},
            ]
     });
    table.on('order.dt', function() {
        updateSaveButtonState();
    });
    $("#song-table tbody").on( 'click', 'tr', function () {
        if ( $(this).hasClass('selected') ) {
            $(this).removeClass('selected');
            var row = songTable.row( $(this) );
            stopTrack();
        } else {
            table.$('tr.selected').removeClass('selected');
            $(this).addClass('selected');
            var row = songTable.row( $(this) );
            var rowData = row.data();
            var track = rowData[rowData.length - 1];
            playTrack(track);
        }
    } );
    return table;
}
$(document).ready(
    function() {
        songTable = initTable();
        var args = parseArgs();
        if ('error' in args) {
            error("Sorry, I can't read your playlists from Spotify without authorization");
            $("#go").show();
            $("#go").on('click', function() {
                authorizeUser();
            });
        } else if ('access_token' in args) {
            accessToken = args['access_token'];
            $(".worker").hide();
            fetchCurrentUserProfile(function(user) {
                if (user) {
                    curUserID = user.id;
                    $("#who").text(user.id);
                    loadPlaylists(user.id);
                } else {
                    error("Trouble getting the user profile");
                }
            });
        } else {
            $("#go").show();
            $("#go").on('click', function() {
                authorizeUser();
            });
        }
        $("#save,#dropSave").on('click', function() {
            savePlaylist(curPlaylist, true);
        });
        $("#dropOverwrite").on('click', function() {
            savePlaylist(curPlaylist, false);
        });
        $("#pick").on('click', function() {
            showPlaylists();
        });
        $.fn.dataTable.ext.search.push(playlistFilter);
        $('#min-bpm,#max-bpm,#include-double').on('keyup change', function() {
            songTable.draw();
            updateSaveButtonState();
        });
    }
);