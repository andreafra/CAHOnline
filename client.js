var socket = io.connect("http://localhost:5000", {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax : 5000,
    reconnectionAttempts: 99999
})

var app = angular.module('CAHOnline',['ngRoute']);
app.config(function($routeProvider, $locationProvider) {
  $routeProvider
  .when("/", {
    templateUrl : "home.html",
    controller: "mainCtrl"
  })
  .when("/:room", {
    templateUrl: "game.html",
    controller: "joinGame"
  })

  $locationProvider.html5Mode(true);
})

app.controller("joinGame", function ($scope,$routeParams){
  $scope.room=$routeParams.room
  $scope.id=socket.io.engine.id
})

app.controller('mainCtrl', function($scope) {

  var createRoomBtn = document.getElementById("create_room")
  var joinRoomBtn = document.getElementById("join_room")
  var playerName = document.getElementById("playerName")
  var roomId = document.getElementById("roomId")

  createRoomBtn.addEventListener("click", function() {
    if (playerName.value !== "" && playerName.value.length > 2) {
      socket.emit("create_room", { 
        name: playerName.value 
      })
    } else {
      alert("Name is too short or void")
    }
  })
  joinRoomBtn.addEventListener("click", function() {
    if (roomId.value !== "" && playerName.value !== "" && playerName.value.length > 2) {
      socket.emit("join_room", { 
        name: playerName.value,
        roomId: roomId.value })
    } else {
      alert("Inserisci un id della stanza")
    }
  })

  socket.on('load_game_page', function(roomId){
    window.location.replace("/"+roomId);
  })
})