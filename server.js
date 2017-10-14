const express = require('express')
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)
const fs = require('fs')

let port = process.env.PORT || 5000

app.use(express.static(__dirname + "/app"))


server.listen(port)

console.log("http server listening on %d", port)

let players = {}
let timers = {}
let cards = { 
  "ita": JSON.parse(fs.readFileSync(__dirname + '/app/json/italian-cards.json', 'utf8')),
  "eng": JSON.parse(fs.readFileSync(__dirname + '/app/json/cards.json', 'utf8'))
}

app.get("*", function(req, res) {
  res.sendFile(__dirname + "/app/index.html")
})

io.on("connection", function(socket) {
  console.log("User " + socket.id + " connected")
  
  // create room and join it
  socket.on("create_room", function(data) {
    let roomId = newRoomId()
    data.roomId = roomId
    socket.join(roomId)
    io.nsps['/'].adapter.rooms[roomId].gameState=0
    io.nsps['/'].adapter.rooms[roomId].name=data.roomName || roomId
    io.nsps['/'].adapter.rooms[roomId].lang=data.lang
    io.sockets.emit('show_rooms', {rooms: shrinkRooms(io.nsps['/'].adapter.rooms)})
    addPlayer({data, socket}, true)
    console.log("NEW ROOM WITH ID " + roomId)
  })

  socket.on("join_room", function(data) {
    socket.join(data.roomId)
    io.sockets.emit('show_rooms', {rooms: shrinkRooms(io.nsps['/'].adapter.rooms)})
    addPlayer({data, socket}, false)
    console.log("JOINED ROOM WITH ID " + data.roomId)
  })

  socket.on('get_rooms', function(){
    socket.emit('show_rooms', {rooms: shrinkRooms(io.nsps['/'].adapter.rooms)})
  });

  socket.on('disconnect', function() {
  	setTimeout(function(){deletePlayer(socket.id)}, 3000)
  	console.log("Player " + socket.id + " disconnected")
  })

  socket.on('delete_player', function() {
  	deletePlayer(socket.id)
  })

  socket.on('fetch_players', function(data){
	  let playersInSameRoom = getPlayersInRoom(data.room)
	  io.to(data.room).emit("display_players", {players: playersInSameRoom})
  })

  socket.on('reconnect_player', function(data){
    socket.join(data.newPlayer.room)
    delete players[data.oldPlayer]
    players[data.newPlayer.id]=data.newPlayer
    if(io.nsps['/'].adapter.rooms[data.newPlayer.room].gameState!=1){
      socket.emit('sync_gamestate', {gameState: io.nsps['/'].adapter.rooms[data.newPlayer.room].gameState})
    }
    else  socket.emit('waiting_room')
    socket.emit('display_blackcard', {blackCard: io.nsps['/'].adapter.rooms[data.newPlayer.room].blackCard})
  })

  socket.on('get_first_load', function(data){
    let playersInSameRoom = getPlayersInRoom(data.room)
    if(!io.nsps['/'].adapter.rooms[data.room]){
      clearTimeout(timers[data.room])
      delete timers[data.room]
      socket.join(data.room)
      io.nsps['/'].adapter.rooms[data.room].gameState = 0
    }
    socket.emit('first_load',{players: playersInSameRoom, gameState: io.nsps['/'].adapter.rooms[data.room].gameState})

    if(io.nsps['/'].adapter.rooms[data.room].gameState!=1){
      socket.emit('sync_gamestate', {gameState: io.nsps['/'].adapter.rooms[data.room].gameState})
    }
    else  socket.emit('waiting_room')
    socket.emit('display_blackcard', {blackCard: io.nsps['/'].adapter.rooms[data.room].blackCard})

    // The user might have accessed a room gamepage without going through the menu, not being recognised as a player
    if(players[socket.id])
      io.to(data.room).emit("display_players", {players: playersInSameRoom})
  })

  socket.on('give_whitecards', function(data){
    if(!io.nsps['/'].adapter.rooms[data.room]) return;
    let deck = io.nsps['/'].adapter.rooms[data.room].whiteCards || getNewDeck("whiteCards",data.room)
    let playerCards = []
    for(let i = 0; i < data.amount; i++){
      playerCards.push(deck.pop())
    }
    socket.emit('display_whitecards', {whiteCards:playerCards})
  })

  socket.on('play_card', function(data){
    if(!io.nsps['/'].adapter.rooms[data.room]) return;
    if(!io.nsps['/'].adapter.rooms[data.room].playedCards)  io.nsps['/'].adapter.rooms[data.room].playedCards = {}
    if(!io.nsps['/'].adapter.rooms[data.room].playedCards[data.player]) io.nsps['/'].adapter.rooms[data.room].playedCards[data.player]={player: data.player, cards: []}
    io.nsps['/'].adapter.rooms[data.room].playedCards[data.player].cards.push(data.text)
    io.to(data.room).emit('display_played_cards', {cards: io.nsps['/'].adapter.rooms[data.room].playedCards})
    let playedCardsCount = 0;
    let playedCards = Object.keys(io.nsps['/'].adapter.rooms[data.room].playedCards).map(function(key) {
      return io.nsps['/'].adapter.rooms[data.room].playedCards[key];
    });
    for(let i=0; i<playedCards.length; i++){
      playedCardsCount += playedCards[i].cards.length;
    }
    if(playedCardsCount == (Object.keys(getPlayersInRoom(data.room)).length-1) * io.nsps['/'].adapter.rooms[data.room].blackCard.pick)
    {
      clearTimeout(timers[data.room])
      delete timers[data.room]
      syncGamestate(data.room, 2)
    }
  })

  socket.on('start_game', function(data){
    startRound(data.room)
  })

  socket.on('pick_winner', function(data){
    if(!players[data.winner]) return;
    if(io.nsps['/'].adapter.rooms[data.room].gameState!=2) return;
    players[data.winner].points++
    io.to(data.room).emit('display_players', {players: getPlayersInRoom(data.room)})
    endRound(data.room, data.winner, data.winnerCards)
  })

  function startRound(room){
    if(!io.nsps['/'].adapter.rooms[room]) return;
    syncGamestate(room,1)
    let deck = io.nsps['/'].adapter.rooms[room].blackCards || getNewDeck("blackCards",room)
    let newCard = deck.pop()
    io.nsps['/'].adapter.rooms[room].blackCard=newCard;
    io.to(room).emit('display_blackcard', {blackCard:newCard})
    timers[room]=setTimeout(function(){
      if(!io.nsps['/'].adapter.rooms[room]) return;
      if(io.nsps['/'].adapter.rooms[room].playedCards)
        syncGamestate(room,2)
      else{
        startRound(room);
      }
    }, 30*1000)
  }

  function endRound(room, lastWinner, lastWinnerCards){
    syncGamestate(room, 3, {winner: lastWinner, winnerCards: lastWinnerCards})
    setTimeout(function(){
      let roomPlayers = getPlayersInRoom(room)
      let newGameMaster = pickNewGameMaster(roomPlayers)
      for(id in roomPlayers){
        if(players[id].isGameMaster) players[id].isGameMaster=false
        if(id==newGameMaster.id) players[id].isGameMaster=true
      }
      io.to(room).emit('display_players', {players: getPlayersInRoom(room)})
      if(io.nsps['/'].adapter.rooms[room]){
        io.nsps['/'].adapter.rooms[room].playedCards = null; 
        startRound(room)
      }
    },5*1000)
  }

  function syncGamestate(room, gamestate, data){
    if(!io.nsps['/'].adapter.rooms[room]) return;
    io.nsps['/'].adapter.rooms[room].gameState=gamestate
    io.to(room).emit('sync_gamestate',{gameState:gamestate, args: data})
  }

  function pickNewGameMaster (roomPlayers){
    let keys = Object.keys(roomPlayers)
    let currentIndex = -1
    let newIndex = -1
    for(let i=0; i<keys.length; i++){
      if(roomPlayers[keys[i]].isGameMaster)
        currentIndex = i
    }
    
    if(currentIndex==keys.length-1)
      newIndex = 0
    else
      newIndex = currentIndex + 1

    return roomPlayers[keys[newIndex]]
  }
})

function getPlayersInRoom(room){
	//let socketsInSameRoom = io.nsps['/'].adapter.rooms[room] ? io.nsps['/'].adapter.rooms[room].sockets : null
	let playersInSameRoom = {}
  for(let otherId in players){
    if(players[otherId].room==room){
      playersInSameRoom[otherId]=players[otherId]
    }
  }
	return playersInSameRoom
}

function addPlayer(player, isGameMaster) {
  players[player.socket.id] = {
    id: player.socket.id,
    name: player.data.playerName,
    room: player.data.roomId,
    isGameMaster: isGameMaster,
    points: 0
  }
  
  player.socket.emit("load_game_page", {room: player.data.roomId})
  //console.log("Players : " + JSON.stringify(players))
}

function deletePlayer(id) {
	if(players[id]){
		let playerRoom = players[id].room
    if(io.sockets.connected[id]) io.sockets.connected[id].leave(playerRoom)
		delete players[id]
		let playersInSameRoom = getPlayersInRoom(playerRoom)
    io.to(playerRoom).emit("display_players", {players: playersInSameRoom})
    io.sockets.emit('show_rooms', {rooms: shrinkRooms(io.nsps['/'].adapter.rooms)})
	}
}

function shrinkRooms(){
  let rooms = io.nsps['/'].adapter.rooms
  let out = {}
  for(let [id, room] of entries(rooms)){
    out[id] = {name: room.name, length: room.length, lang: room.lang}
  }
  return out
}

function* entries(obj) {
  for (let key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
}

function getNewDeck(set,room){
  let lang = io.nsps['/'].adapter.rooms[room].lang || 'ita';
  let newDeck = {}
  console.log("Creating new deck of " + set + " for room " + room + " with language " + lang)
  switch(set){
    case "whiteCards":
      newDeck = cards[lang].whiteCards
      shuffle(newDeck)
      io.nsps['/'].adapter.rooms[room].whiteCards=newDeck
      return newDeck
    case "blackCards":
      newDeck = cards[lang].blackCards
      shuffle(newDeck)
      io.nsps['/'].adapter.rooms[room].blackCards=newDeck
      return newDeck
  }
}

function shuffle(a) {
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
}

function newRoomId(){
  let random = Math.floor(1000 + Math.random() * 9000)
  while(io.nsps['/'].adapter.rooms[random])
    random = Math.floor(1000 + Math.random() * 9000)
  return random;
}

function randomProperty (obj) {
    let keys = Object.keys(obj)
    return obj[keys[ keys.length * Math.random() << 0]]
};