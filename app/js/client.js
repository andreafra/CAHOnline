var socket = io('/').connect("http://localhost:5000")
var app = angular.module('CAHOnline',['ngRoute','ngCookies']);
app.config(function($routeProvider, $locationProvider) {
  $routeProvider
  .when("/", {
    templateUrl : "./templates/home.html",
    controller: "mainCtrl"
  })
  .when("/:room", {
    templateUrl: "./templates/game.html",
    controller: "joinGame"
  })

  $locationProvider.html5Mode(true);
})

app.controller("joinGame", function ($scope, $routeParams, $cookies){
  $scope.room=$routeParams.room
  $scope.id=socket.io.engine.id

  socket.on('first_load', function(data){
    //RECONNECTION LOGIC
    var lastId = $cookies.get("lastId")
    console.log(data.players)
    if(data.players[lastId]){
      console.log("FOUND OLD PLAYER")
      var playerObject = data.players[lastId]
      delete data.players[lastId]
      playerObject.id = socket.io.engine.id
      data.players[playerObject.id]=playerObject
      socket.emit('reconnect_player', {newPlayer: playerObject, oldPlayer: lastId})
    }
    $cookies.put("lastId",socket.io.engine.id)
    $scope.players=data.players
    $scope.$apply()
  })

  socket.on('display_players', function(data){
    $scope.players=data.players
    $scope.$apply()
  })

  socket.emit('get_first_load',{room: $routeParams.room})
})

app.controller('mainCtrl', function($scope, $location) {
  //if user clicked to go back to home we should remove him from the players, until he joins another room
  socket.emit("delete_player")

  $scope.createRoom = function() {
    if ($scope.playerName && $scope.playerName.length > 2) {
      socket.emit("create_room", {name: $scope.playerName})
    } else {
      alert("Name is too short or void")
    }
  }

  $scope.joinRoom = function() {
    if ($scope.roomId && ($scope.playerName ? $scope.playerName.length > 2 : false)) {
      socket.emit("join_room", { 
        name: $scope.playerName,
        roomId: $scope.roomId })
    } else {
      alert("Inserisci un id della stanza")
    }
  }

  socket.on('load_game_page', function(data){
    $location.path("/"+data.room)
    $scope.$apply()
  })
})