const express = require('express')
const shortid = require('shortid');
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)

var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/app"))


server.listen(port)

console.log("http server listening on %d", port)


var players = {}

app.get("*", function(req, res) {
  res.sendFile(__dirname + "/app/index.html")
})

io.on("connection", function(socket) {
  console.log("Player " + socket.id + " connected");
  
  // create room and join it
  socket.on("create_room", function(data) {
    var roomId = shortid.generate()
    data.roomId = roomId;
    socket.join(roomId)
    addPlayer({data, socket})
    console.log("NEW ROOM WITH ID " + roomId)
  })

  socket.on("join_room", function(data) {
    socket.join(data.roomId)
    addPlayer({data, socket})
    console.log("JOINED ROOM WITH ID " + data.roomId)
  })

  socket.on('disconnect', function() {
  	setTimeout(function(){deletePlayer(socket.id)}, 3000);
  	console.log("Player " + socket.id + " disconnected");
  })

  socket.on('delete_player', function() {
  	deletePlayer(socket.id)
  })

  socket.on('fetch_players', function(data){
	  var playersInSameRoom = getPlayersInRoom(data.room)
	  io.to(data.room).emit("display_players", {players: playersInSameRoom})
  })

  socket.on('reconnect_player', function(data){
    socket.join(data.newPlayer.room)
    delete players[data.oldPlayer]
    players[data.newPlayer.id]=data.newPlayer
  })

  socket.on('get_first_load', function(data){
    var playersInSameRoom = getPlayersInRoom(data.room)
    socket.emit('first_load',{players: playersInSameRoom})
  })
})

function getPlayersInRoom(room){
	//var socketsInSameRoom = io.nsps['/'].adapter.rooms[room] ? io.nsps['/'].adapter.rooms[room].sockets : null
	var playersInSameRoom = {}
  for(var otherId in players){
    if(players[otherId].room==room){
      playersInSameRoom[otherId]=players[otherId]
    }
  }
	/*
  for(var otherId in socketsInSameRoom){
	  playersInSameRoom[otherId]=players[otherId]
	}
  */
	return playersInSameRoom
}

function addPlayer(player) {
  players[player.socket.id] = {
    id: player.socket.id,
    name: player.data.name,
    room: player.data.roomId,
    points: 0
  }

  player.socket.emit("load_game_page", {room: player.data.roomId})
  var playersInSameRoom = getPlayersInRoom(player.data.roomId)
  io.to(player.data.roomId).emit("display_players", {players: playersInSameRoom})
  //console.log("Players : " + JSON.stringify(players))
}

function deletePlayer(id) {
	if(players[id]){
		var playerRoom = players[id].room
		delete players[id]
		var playersInSameRoom = getPlayersInRoom(playerRoom)
		io.to(playerRoom).emit("display_players", {players: playersInSameRoom})
	}
}