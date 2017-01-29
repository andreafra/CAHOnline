//var socket = io('/').connect("http://localhost:5000")
var app = angular.module('CAHOnline',['ngRoute','ngCookies','ngOrderObjectBy']);
app.factory('socket', function ($rootScope) {
  var socket = io('/').connect("http://localhost:5000")
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    },
    id: function(){
      return socket.io.engine.id
    },
    removeAllListeners: function() {
      socket.removeAllListeners();
    } 
  };
});

app.config(function($routeProvider, $locationProvider) {
  $routeProvider
  .when("/", {
    templateUrl: "./templates/home.html",
    controller: "mainCtrl"
  })
  .when("/:room", {
    templateUrl: "./templates/game.html",
    controller: "joinGame"
  })

  $locationProvider.html5Mode(true);
})

app.controller("joinGame", function ($scope, $routeParams, $cookies, socket){
  $scope.room=$routeParams.room
  $scope.id=socket.id()
  
  socket.on('first_load', function(data){
    if(data.gameState != 0){
      //TODO: buttalo fuori
    }
    //RECONNECTION LOGIC
    var lastId = $cookies.get("lastId")
    if(data.players[lastId]){
      var playerObject = data.players[lastId]
      delete data.players[lastId]
      playerObject.id = $scope.id
      data.players[playerObject.id]=playerObject
      socket.emit('reconnect_player', {newPlayer: playerObject, oldPlayer: lastId})
    }
    $cookies.put("lastId",$scope.id)
    $scope.players=data.players
    $scope.iAmGameMaster=data.players[$scope.id].isGameMaster
    $scope.gameState=data.gameState
    $scope.time=10

    socket.emit('give_whitecards',{room: $scope.room, amount: 10})
  })

  socket.emit('get_first_load',{room: $scope.room})

  socket.on('display_players', function(data){
    $scope.players=data.players
    $scope.iAmGameMaster=data.players[$scope.id].isGameMaster
  })

  socket.on('display_whitecards', function(data){
    $scope.whiteCards=data.whiteCards
  })

  socket.on('display_blackcard', function(data){
    $scope.blackCard = data.blackCard
  })

  socket.on('sync_gamestate', function(data){
    $scope.time=10
    $scope.gameState=data.gameState

    switch(data.gameState){
      case 1:
        //TODO: startare il timer, rendere clickabili le carte in mano ai non-gamemaster, ecc.
        $scope.time--
        var timer = setInterval(function(){
          if($scope.time>0) {
            $scope.time--
            $scope.$apply()
          }
          else  {
            //TIME IS OVER
            clearInterval(timer)
            $scope.gameState=2
            if($scope.iAmGameMaster) socket.emit("sync_room_gamestate",{room: $scope.room, gameState: 2})
          }
        },1000)
        break;
      case 2:
        //TODO: l'opposto di quanto sopra; + rendere clickabili al gamemaster le carte sul tavolo
        break;
    }
  })

  $scope.startGame = function(){
    socket.emit('start_game',{room: $scope.room})
    socket.emit('give_blackcard',{room: $scope.room})
  }

  $scope.$on('$destroy', function (event) {
      socket.removeAllListeners();
  });
})

app.controller('mainCtrl', function($scope, $location, $cookies, socket) {
  //if user clicked to go back to home we should remove him from the players, until he joins another room
  socket.emit("delete_player")
  $cookies.remove("lastId")

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
    //$scope.$apply()
  })

  $scope.$on('$destroy', function (event) {
      socket.removeAllListeners();
      // or something like
      // socket.removeListener(this);
  });
})