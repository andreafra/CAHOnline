var socket = io.connect("http://localhost:5000")
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

app.controller("joinGame", function ($scope, $routeParams){
  $scope.room=$routeParams.room
  $scope.id=socket.io.engine.id
})

app.controller('mainCtrl', function($scope, $location) {
      console.log("LOL")

  $scope.createRoom = function() {
    if ($scope.playerName !== "" && $scope.playerName.length > 2) {
      socket.emit("create_room", { 
        name: $scope.playerName 
      })
    } else {
      alert("Name is too short or void")
    }
  }

  $scope.joinRoom = function() {
    if ($scope.roomId !== "" && $scope.playerName !== "" && $scope.playerName.length > 2) {
      socket.emit("join_room", { 
        name: $scope.playerName,
        roomId: $scope.roomId })
    } else {
      alert("Inserisci un id della stanza")
    }
  }

  socket.on('load_game_page', function(roomId){
    $location.path("/"+roomId)
    $scope.$apply()
  })
})