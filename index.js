var express = require("express")
var app = express();
var server = require("http").Server(app);
var io = require("socket.io")(server);

var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/"))

server.listen(port)

console.log("http server listening on %d", port)

app.get("/", function(res, req) {
  res.sendFile(__dirname + "/index.html")
})


io.on('connection', function(socket){
  var id = setInterval(function() {
    socket.emit("ping", "data")
  }, 1000)

  console.log("socket connection open")
  socket.on("disconnect", function() {
    console.log("socket connection close")
    clearInterval(id)
  })
})
