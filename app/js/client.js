var app = angular.module('CAHOnline',['ngRoute','ngCookies','ngOrderObjectBy', 'ngAnimate', 'ngSanitize'])
app.factory('socket', function ($rootScope) {
  var socket = io('/').connect("http://cahonline.herokuapp.com/")
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments
        $rootScope.$apply(function () {
          callback.apply(socket, args)
        })
      })
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args)
          }
        })
      })
    },
    id: function(){
      return socket.io.engine.id
    },
    removeAllListeners: function() {
      socket.removeAllListeners()
    } 
  }
})

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

  $locationProvider.html5Mode(true)
})

app.controller("joinGame", function ($scope, $routeParams, $cookies, $timeout, socket){
  $scope.room=$routeParams.room
  $scope.playerid=socket.id()
  socket.on('first_load', function(data){
    //RECONNECTION LOGIC
    $scope.playerid=socket.id()
    var lastId = $cookies.get("lastId")
    if(data.players[lastId] && data.players[lastId].room==$scope.room){
      var playerObject = data.players[lastId]
      delete data.players[lastId]
      playerObject.id = $scope.playerid
      data.players[playerObject.id]=playerObject
      socket.emit('reconnect_player', {newPlayer: playerObject, oldPlayer: lastId})
      $scope.whiteCards = $cookies.getObject("whiteCards")
    }
    else{
      socket.emit('give_whitecards',{room: $scope.room, amount: 10})
    }
    $cookies.put("lastId",$scope.playerid)
    $scope.players=data.players
    $scope.iAmGameMaster=data.players[$scope.playerid].isGameMaster
    $scope.gameState=data.gameState
    $scope.myPlayedCards=[]
    $scope.playedCards=[]
    $scope.time=30
  })

  socket.emit('get_first_load',{room: $scope.room})

  socket.on('display_players', function(data){
    $scope.players=data.players
    if(!$scope.iAmGameMaster && data.players[$scope.playerid].isGameMaster){
      $scope.showNewGameMaster=true
      $timeout(function(){
        $scope.showNewGameMaster=false
      },3000)
    }
    $scope.iAmGameMaster=data.players[$scope.playerid].isGameMaster
  })

  socket.on('display_whitecards', function(data){
    $scope.whiteCards=data.whiteCards.concat($scope.whiteCards || [])
    console.log(JSON.stringify($scope.whiteCards) + "\n" + JSON.stringify(data.whiteCards))
    $cookies.putObject("whiteCards",$scope.whiteCards)
  })

  socket.on('display_blackcard', function(data){
    $scope.blackCard = data.blackCard
  })

  socket.on('sync_gamestate', function(data){
    $scope.gameState=data.gameState

    switch(data.gameState){
      case 0:
        delete $scope.winner
        delete $scope.winnerCards
        $scope.myPlayedCards.length=0
        $scope.playedCards.length=0
        $scope.time=30
        socket.emit('give_whitecards', {room: $scope.room, amount: 10 - $scope.whiteCards.length})
        if($scope.iAmGameMaster) {
          socket.emit("new_round", {players: $scope.players, room: $scope.room})
        }
        break
      case 1:
        $scope.time=30
        $timeout(function(){
          $scope.time--
          $scope.$apply()
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
        },1)
        break
      case 2:
        break
      case 3:
        $scope.winner=data.args.winner
        $scope.winnerCards=data.args.winnerCards
        if($scope.iAmGameMaster){
          socket.emit("increase_points", {player: $scope.winner, room: $scope.room})
          $timeout(function(){
            socket.emit("sync_room_gamestate",{room: $scope.room, gameState:0})
          },5000)
        }
        break
    }
  })

  socket.on('display_played_cards', function(data){
    //$scope.playedCards.push(card)
    $scope.playedCards=data.cards
  })

  $scope.startGame = function(){
    socket.emit('start_game',{room: $scope.room})
    socket.emit('give_blackcard',{room: $scope.room})
  }

  $scope.playCard = function(index){
    $scope.myPlayedCards.push($scope.whiteCards[index])
    socket.emit("play_card",{text: $scope.whiteCards[index], player: $scope.playerid, room: $scope.room})
    $scope.whiteCards.splice(index,1)
    $cookies.putObject("whiteCards",$scope.whiteCards)
  }

  $scope.pickWinner = function(data){
    console.log("Il giocatore " + data.id + " ha giocato la/e carta/e più divertente/i: " + JSON.stringify(data.cards))
    if($scope.iAmGameMaster)  socket.emit('sync_room_gamestate', {room:$scope.room, gameState:3, winner:data.id, winnerCards:data.cards})
  }

  $scope.$on('$destroy', function (event) {
    socket.removeAllListeners()
  })
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
      socket.removeAllListeners()
      // or something like
      // socket.removeListener(this);
  })
})