const express = require('express')
const shortid = require('shortid');
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)
const fs = require('fs')

var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/app"))


server.listen(port)

console.log("http server listening on %d", port)

var players = {}
var cards = JSON.parse(fs.readFileSync(__dirname + '/app/json/cards.json', 'utf8'));

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
    io.nsps['/'].adapter.rooms[roomId].gameState=0;
    addPlayer({data, socket}, true)
    console.log("NEW ROOM WITH ID " + roomId)
  })

  socket.on("join_room", function(data) {
    socket.join(data.roomId)
    addPlayer({data, socket}, false)
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
    socket.emit('first_load',{players: playersInSameRoom, gameState: io.nsps['/'].adapter.rooms[data.room].gameState})
  })

  socket.on('sync_room_gamestate', function(data){
    io.nsps['/'].adapter.rooms[data.room].gameState=data.gameState
    io.to(data.room).emit("sync_gamestate", {gameState: io.nsps['/'].adapter.rooms[data.room].gameState})
  })

  socket.on('give_whitecards', function(data){
    var deck = io.nsps['/'].adapter.rooms[data.room].whiteCards ? io.nsps['/'].adapter.rooms[data.room].whiteCards : getNewDeck("whiteCards",data.room)
    //for(var playerId in getPlayersInRoom(data.room)){  
      var playerCards = new Array()
      for(var i = 0; i < data.amount; i++){
        playerCards.push(deck.pop())
      }
      //io.to(playerId).emit('display_whitecards', {whiteCards:playerCards})
      socket.emit('display_whitecards', {whiteCards:playerCards})
    //}
  })

  socket.on('give_blackcard', function(data){
    var deck = io.nsps['/'].adapter.rooms[data.room].blackCards ? io.nsps['/'].adapter.rooms[data.room].blackCards : getNewDeck("blackCards",data.room)
    io.to(data.room).emit('display_blackcard', {blackCard:deck.pop()})
  })

  socket.on('start_game', function(data){
    io.nsps['/'].adapter.rooms[data.room].gameState = 1
    io.to(data.room).emit('sync_gamestate',{gameState: 1})
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

function addPlayer(player, isGameMaster) {
  players[player.socket.id] = {
    id: player.socket.id,
    name: player.data.name,
    room: player.data.roomId,
    isGameMaster: isGameMaster,
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
    if(io.sockets.connected[id]) io.sockets.connected[id].leave(playerRoom)
		delete players[id]
		var playersInSameRoom = getPlayersInRoom(playerRoom)
		io.to(playerRoom).emit("display_players", {players: playersInSameRoom})
	}
}

function getNewDeck(set,room){
  console.log("Creating new deck of " + set + " for room " + room)
  switch(set){
    case "whiteCards":
      var newDeck = cards.whiteCards;
      shuffle(newDeck)
      io.nsps['/'].adapter.rooms[room].whiteCards=newDeck
      return newDeck
      break
    case "blackCards":
      var newDeck = cards.blackCards;
      shuffle(newDeck)
      io.nsps['/'].adapter.rooms[room].blackCards=newDeck
      return newDeck
      break
  }
}

function shuffle(a) {
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
}