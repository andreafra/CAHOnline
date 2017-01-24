const express = require('express')
const shortid = require('shortid');
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)

var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/"))

server.listen(port)

console.log("http server listening on %d", port)


var players = {}

app.get("*", function(req, res) {
  res.sendFile(__dirname + "/index.html")
})

io.on("connection", function(socket) {
  // create room and join it
  socket.on("create_room", function(data) {
    console.log("Name: " + data.name + " Id: " + socket.id) //DEBUG

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
})


function addPlayer(player) {
  players[player.socket.id] = {
    playerId: player.socket.id,
    playerName: player.data.name,
    playerRoom: player.data.roomId,
    points: 0
  }
  player.socket.emit("load_game_page", player.data.roomId)
  console.log("Players : " + JSON.stringify(players))
}