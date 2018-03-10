let app = angular.module('CAHOnline',['ngRoute','ngCookies','ngOrderObjectBy', 'ngAnimate', 'ngSanitize'])
app.factory('socket', function ($rootScope) {
  let socket = io('/')
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        let args = arguments
        $rootScope.$apply(function () {
          callback.apply(socket, args)
        })
      })
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        let args = arguments
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

  /* Listeners */
  socket.on('first_load', function(data){
    $scope.playerid=socket.id()
    let lastId = $cookies.get("lastId")

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
      let playerObject = data.players[lastId]
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

  let timer;
  socket.on('sync_gamestate', function(data){
    $scope.isWaitingRoom = false
    if(data.gameState == 1 && $scope.gameState != 3 && $scope.gameState != 0){
      $scope.skippingRound=true
      $timeout(function(){
        $scope.skippingRound=false
      },3000)
    }
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
        $timeout(function(){
          timer = $interval(function tick(){
            if($scope.time>0) 
              $scope.time--
            else
              //Time is over so let's stop the timer here
              $interval.cancel(timer)
            return tick;
          }(),1000)
        }, 1)
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

  /* Functions */

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
  
  /* Init */
  /* Should be called after all listeners, and maybe functions. */
  socket.emit('get_first_load',{room: $scope.room})
})

app.controller('mainCtrl', function($scope, $location, $cookies, $timeout, socket) {
  //if user clicked to go back to home we should remove him from the players, until he joins another room
  socket.emit("delete_player")
  $cookies.remove("lastId")

  $scope.createRoom = function() {
    let cbs = document.getElementsByClassName("set--mark");
    let sets = [];
    for(let i=0; i<cbs.length; i++){
      if(cbs[i].checked) sets.push(cbs[i].id.split("_").join(" "))
    }
    console.log(sets);
    if(sets.length < 1){
      $scope.setsWrong = true
      $timeout(function(){
        $scope.setsWrong = false
      },1000)
    }
    else
      socket.emit("create_room", {playerName: $scope.playerName, roomName: $scope.roomName, sets: sets})
  }

  $scope.joinRoom = function() {
    socket.emit("join_room", { 
      playerName: $scope.playerName,
      roomId: $scope.roomId
    })
  }
  
  $scope.loadRooms = function(){
    socket.emit('get_rooms');
  }

  $scope.menuJoin = function(){
    if(!$scope.playerName || $scope.playerName.length <= 2){
      $scope.playerNameWrong = true
      $timeout(function(){
        $scope.playerNameWrong = false
      },2000)
    }
    else{
      $scope.loadRooms()
      $scope.homeIntro=!$scope.homeIntro
      $scope.homeJoinRoom=!$scope.homeJoinRoom
    }
  }

  $scope.menuCreate = function(){
    if(!$scope.playerName || $scope.playerName.length <= 2){
      $scope.playerNameWrong = true
      $timeout(function(){
        $scope.playerNameWrong = false
      },900)
    }
    else{
      $scope.homeIntro=!$scope.homeIntro
      $scope.homeCreateRoom=!$scope.homeCreateRoom
    }
  }

  socket.on('show_rooms', function(data){
    $scope.roomList = data.rooms
    $scope.roomCount = Object.keys(data.rooms).length;
  });

  $scope.getRoom = function(id){
    $scope.roomId = parseInt(id);
  }

  socket.on('load_game_page', function(data){
    $location.path("/"+data.room)
  })

  socket.on('show_sets', function(data){
    $scope.gameSets = data.sets;
  })
  socket.emit('get_sets');

  $scope.$on('$destroy', function (event) {
      socket.removeAllListeners()
      // or something like
      // socket.removeListener(this);
  })
})