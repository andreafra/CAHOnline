const express = require('express')
const shortid = require('shortid');
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)

var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/"))

server.listen(port)

console.log("http server listening on %d", port)


var players = []

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html")
})

app.get("/:room", function(req, res) {
  res.sendFile(__dirname + "/game.html")

  io.on("connection", function (socket) {
    var roomId = req.params.room

    socket.join(roomId)

    socket.to(roomId).emit("update", {
     room: roomId
    })
  })
})

io.on("connection", function(socket) {
  // create room and join it
  socket.on("create_room", function(player) {
    addPlayer(player)
    console.log("Name: " + player.name + " Id: " + socket.id) //DEBUG

    var newRoom = shortid.generate()
    socket.join(newRoom)
    console.log("NEW ROOM WITH ID " + newRoom)
  })

  socket.on("join_room", function(player) {
    addPlayer(player)
    socket.join(player.roomId)
    console.log("JOINED ROOM WITH ID " + player.roomId)
  })
})


function addPlayer(player) {
  players[player.id] = {
    playerName: player.name,
    playerId: player.id,
    points: 0
  }
}