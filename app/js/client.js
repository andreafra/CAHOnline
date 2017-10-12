var app = angular.module('CAHOnline',['ngRoute','ngCookies','ngOrderObjectBy', 'ngAnimate', 'ngSanitize'])
app.factory('socket', function ($rootScope) {
  var socket = io('/')
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

app.controller("joinGame", function ($scope, $routeParams, $cookies, $timeout, $interval, $location, socket){
  $scope.room=$routeParams.room
  $scope.playerid=socket.id()
  
  socket.emit('get_first_load',{room: $scope.room})

  socket.on('first_load', function(data){
    var lastId = $cookies.get("lastId")

    // if the user manually loaded a room page without going through the main menu, 
    // we should kick him cause we cannot have his user infos
    if(!data.players[$scope.playerid] && !data.players[lastId]){
      $scope.isToKick = true;
      $timeout(function(){
        $location.path("/")
      }, 4000)
      return
    }

    // See if user refreshed the page (or lost connection and got reconnected)
    if(data.players[lastId] && data.players[lastId].room==$scope.room){
      //RECONNECT
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
    $scope.playedCards=[]
    $scope.myPlayedCards=[]
    $scope.time=30
  })

  // Wierd things can happen if only 2 people are playing (which shouldnt happen, but yea.)
  // TODO: See into this
  socket.on('waiting_room', function() {
    $scope.isWaitingRoom = true;
  });

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
    $cookies.putObject("whiteCards",$scope.whiteCards)
  })

  socket.on('display_blackcard', function(data){
    $scope.blackCard = data.blackCard
  })

  var timer;
  socket.on('sync_gamestate', function(data){
    $scope.isWaitingRoom = false
    $scope.gameState=data.gameState

    switch(data.gameState){
      case 0:
        delete $scope.winner
        delete $scope.winnerCards
        $scope.myPlayedCards = new Array()
        $scope.playedCards = new Array()
        break
      case 1:
        delete $scope.winner
        delete $scope.winnerCards
        $scope.myPlayedCards = new Array()
        $scope.playedCards = new Array()
        socket.emit('give_whitecards', {room: $scope.room, amount: 10 - $scope.whiteCards.length})
        $scope.time=30
        $interval.cancel(timer)
        timer = $interval(function tick(){
          if($scope.time>0) 
            $scope.time--
          else
            //Time is over so let's stop the timer here
            $interval.cancel(timer)
          return tick;
        }(),1000)
        break
      case 2:
        break
      case 3:
        $scope.winner=data.args.winner
        $scope.winnerCards=data.args.winnerCards
        break
    }
  })

  socket.on('display_played_cards', function(data){
    $scope.playedCards=data.cards
  })

  $scope.startGame = function(){
    socket.emit('start_game',{room: $scope.room})
    $scope.showNewGameMaster=true
    $timeout(function(){
      $scope.showNewGameMaster=false
    },3000)
  }

  $scope.playCard = function(index){
    if(!$scope.myPlayedCards) $scope.myPlayedCards=[]
    $scope.myPlayedCards.push($scope.whiteCards[index])
    socket.emit("play_card",{text: $scope.whiteCards[index], player: $scope.playerid, room: $scope.room})
    $scope.whiteCards.splice(index,1)
    $cookies.putObject("whiteCards",$scope.whiteCards)
  }

  $scope.pickWinner = function(data){
    console.log("Il giocatore " + data.id + " ha giocato la/e carta/e più divertente/i: " + JSON.stringify(data.cards))
    if($scope.iAmGameMaster)  socket.emit('pick_winner', {room:$scope.room, winner:data.id, winnerCards:data.cards})
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
      socket.emit("create_room", {name: $scope.playerName, lang: $scope.lang})
    } else {
      alert("Inserisci un nome di almeno 3 caratteri")
    }
  }

  $scope.joinRoom = function() {
    if(!$scope.roomId){
      alert("Inserisci un id di 4 cifre")
    }
    else if(!$scope.playerName || $scope.playerName.length <= 2){
      alert("Inserisci un nome di almeno 3 caratteri")
    }
    else{
      socket.emit("join_room", { 
        name: $scope.playerName,
        roomId: $scope.roomId })
    }
  }

  socket.on('load_game_page', function(data){
    $location.path("/"+data.room)
  })

  $scope.$on('$destroy', function (event) {
      socket.removeAllListeners()
      // or something like
      // socket.removeListener(this);
  })
})