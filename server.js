var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var port = process.env.PORT || 3000;

// global variables
const tickrate = 3
const ticktime = 1000/tickrate
const num_racers = 10 // number of bots+humans
const bot_movement_toggle_chance = 0.1 // chance that bot changes walking->stop or vice versa each tick
const win_position = 100 // position that is the finish line


// serve up all client files
var htmlPath = path.join(__dirname, 'client');
app.use(express.static(htmlPath));

// app.get('/', function(req, res){
//   res.sendFile(__dirname + '/client/index.html');
// });


// object of objects
// first object is all the rooms
// second object is password, users and other stuff
/*
rooms_obj = {
  room1: {
    password: "pass1",
    users: ["user1", "user2"],
    socketids: [user1id, user2id],
    game_started: false
  },

  room2: {
    password: "pass2",
    users: ["user3", "user4"],
    socketids: [user3id, user4id],
    game_started: true,
    game_state: {
        player_positions: [player1pos, player2pos], // positions along their path
        player_movement_state: [0, 2] // 0=stop, 1=walk, 2=run
        player_crosshair: [p1crosshairpos, p2crosshairpos],
        player_race_positions: [], // which player are they in the race
        bot_positions: [bot1pos, bot2pos, ..., bot(n-players)pos],
        bot_movement_state: [1, 0, 1, ...] // 0=stop, 1=walk
    }
  }
}
*/

rooms_obj = {}


io.on('connection', function(socket){

    // CREATING ROOM
    socket.on("create_room", (data)=>{
        if(data.room in rooms_obj){
            // room name already taken
            socket.emit("create_room_res", {
                success: false,
                msg: "room name already taken"
            })
        }
        else{
            // create room
            rooms_obj[data.room] = {
                password: data.password,
                users: [data.nickname],
                socketids: [socket.id],
                game_started: false
            }

            // join socket room
            socket.join(data.room)

            socket.emit("create_room_res", {
                success: true,
                msg: "room created"
            })
            
            socket.emit('update_users_display', {
                users : rooms_obj[data.room].users
            })
        }

        console.log(rooms_obj)
    })

    // JOINING ROOM
    socket.on("join_room", (data)=>{
        if(data.room in rooms_obj){
            // room exists
            room = rooms_obj[data.room]

            if(data.password == room.password){
                // password is correct

                if(room.users.includes(data.nickname)){
                    // username already taken

                    socket.emit("join_room_res", {
                        success: false,
                        msg: "couldn't join room, username already used"
                    })
                }
                else{
                    // everything is good
                    rooms_obj[data.room].users.push(data.nickname)
                    rooms_obj[data.room].socketids.push(socket.id)

                    // join socket room
                    socket.join(data.room)

                    socket.emit("join_room_res", {
                        success: true,
                        msg: "joined room"
                    })

                    io.sockets.in(data.room).emit('update_users_display', {
                        users : rooms_obj[data.room].users
                    })
                }
            
            }
            else{
                // password incorrect
                socket.emit("join_room_res", {
                success: false,
                msg: "couldn't join room, wrong password"
                })
            }
        
        }
        else{
            // room doesn't exist
            socket.emit("join_room_res", {
                success: false,
                msg: "couldn't join room, room doesn't exist"
            })
        }
        console.log(rooms_obj)
    })

    // STARTING GAME
    socket.on("start_game", ()=>{

        // find room the user is in
        for(let room_name in rooms_obj){
            // room_name is a string (key)
            room = rooms_obj[room_name]

            console.log(room.socketids)

            if(room.socketids.includes(socket.id)){
                // user is in this room

                if(room.game_started){
                    // game is already started
                    socket.emit("start_game_res", {
                        success: false,
                        msg: "game not started, game already started"
                    })
                }
                else{
                    if(room.socketids.length > 1){
                        // enough players to start game
                        room.game_started = true

                        room.game_state = initiate_game(room.socketids.length)
    
                        io.sockets.in(room_name).emit("start_game_res", {
                            success: true,
                            msg: "game started",
                            num_racers: num_racers
                        })
                        console.log(room.game_state)
                    }
                    else{
                        socket.emit("start_game_res", {
                            success: false,
                            msg: "game not started, not enough people"
                        })
                    }
                }
                break;
            }
        }
    })

    // GAME ACTIONS

});

// GAME LOOP
var game = setInterval(game_loop, ticktime);

function game_loop() {
    // go through each of the games and determine if they are started
    // if they are started, then update the values in them
    for(let room_name in rooms_obj){
        // room_name is a string (key)
        room = rooms_obj[room_name]
        if(room.game_started){
            // game is in progress

            let game_state = room['game_state']

            // update player positions
            game_state['player_positions'] = game_state['player_positions'].map((val, index)=>{
                let movement_state = game_state.player_movement_state[index]
                return val + movement_state
            })

            // update bot positions
            game_state['bot_positions'] = game_state['bot_positions'].map((val, index)=>{
                let movement_state = game_state.bot_movement_state[index]
                return val + movement_state
            })

            // randomize bot movement states
            game_state['bot_movement_state'] = game_state['bot_movement_state'].map((val)=>{
                if(bernoulli(bot_movement_toggle_chance)){
                    // flip bot movement state
                    console.log('here')
                    return (val+1)%2
                }
                return val
            })

            // tell client to update game data
            io.sockets.in(room_name).emit('update_game_state', {
                game_state: game_state
            });

            // check if win condition is met
            // game_state['player_positions'].some((val, index) => {
            //     if(val >= )
            // })
            console.log(game_state)
        }
    }
}


// HELPER FUNCTION
function initiate_game(num_players){
    // returns object that is a randomized game_state
    let game_state = {
        player_positions: Array(num_players).fill(0),
        player_movement_state: Array(num_players).fill(0),
        player_crosshair: sample_no_replacement(num_racers, num_players),
        player_race_positions: sample_no_replacement(num_racers, num_players),
        bot_positions: Array(num_racers - num_players).fill(0),
        bot_movement_state: Array(num_racers - num_players).fill(0),
    }

    return game_state
}

function sample_no_replacement(sample_size, n){
    // returns array of n numbers that are sampled from 0-(sample_size-1) w/o replacement
    let bucket = []
    let output = []

    for (let i=0; i<sample_size; i++) {
        bucket.push(i)
    }

    for (let i=0; i<n; i++) {
        let randomIndex = Math.floor(Math.random()*bucket.length)
        output.push(bucket[randomIndex])
        bucket.splice(randomIndex, 1)
    }

    return output
}

function bernoulli(p){
    // returns true with probability p
    return (Math.random() < p)
}



http.listen(port, function(){
  console.log('listening on *:' + port)
});