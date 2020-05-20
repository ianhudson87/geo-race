var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var port = process.env.PORT || 3000;

// global variables
const tickrate = 5
const ticktime = 1000/tickrate
const num_racers = 10 // number of bots+humans
const bot_movement_toggle_chance = 0.1 // chance that bot changes walking->stop or vice versa each tick
const race_win_position = 150 // position that is the finish line
const race_initial_position = 10 // position racers start out at
const initial_bullets = 1 // number of bullets players start out with

const movement_stop_state = 0 // state for not moving
const movement_walk_state = 1 // state for not moving
const movement_run_state = 2 // state for not moving

const xhair_up_act = 0 // action type for moving xhair up
const xhair_down_act = 1 // action type for moving xhair down
const xhair_shoot_act = 2 // action type for shooting


// serve up all client files
var htmlPath = path.join(__dirname, 'client');
app.use(express.static(htmlPath));

// app.get('/', function(req, res){
//   res.sendFile(__dirname + '/client/index.html');
// });


// object of objects
// first object is all the rooms
// second object is password, users and other stuff
rooms_obj = {}
/* EXAMPLE
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
        player_bullets_remaining: [1, 0], // how many shots player has left

        bot_positions: [bot1pos, bot2pos, ..., bot(n-players)pos],
        bot_movement_state: [1, 0, 1, ...], // 0=stop, 1=walk

        racers_shot: [5] // index of racers that have been shot
    }
  }
}
*/


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

        // console.log(rooms_obj)
    })

    // JOINING ROOM
    socket.on("join_room", (data)=>{
        if(data.room in rooms_obj){
            // room exists
            let room = rooms_obj[data.room]

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
        // console.log(rooms_obj)
    })

    // STARTING GAME
    socket.on("start_game", ()=>{
        // find room the user is in
        for(let room_name in rooms_obj){
            // room_name is a string (key)
            let room = rooms_obj[room_name]

            // console.log(room.socketids)

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
                            num_racers: num_racers,
                            race_win_position: race_win_position
                        })
                        // console.log(room.game_state)
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
    socket.on("change_movement", (data)=>{
        // get which room player is in and which index they are
        let data2 = get_room_and_index_of_user(socket) // data2 has room and player_index of user
        let room = data2.room
        let player_index = data2.player_index
        if(player_index>-1){
            // player is in this room and index is index of player
            room.game_state.player_movement_state[player_index] = data.move_type
        }
    })

    socket.on("xhair_action", (data)=>{
        let data2 = get_room_and_index_of_user(socket) // data2 has room and player_index of user
        let room = data2.room
        let game_state = room.game_state
        let player_index = data2.player_index
        let current_xhair_pos = room.game_state.player_crosshair[player_index] // index of racer xhair is on

        switch(data.action_type){
            case xhair_up_act:
                // xhair up
                if(game_state.player_bullets_remaining[player_index] > 0){
                    // player has bullets remaining
                    game_state.player_crosshair[player_index] = (current_xhair_pos-1) % num_racers
                }
                break
            case xhair_down_act:
                // xhair down
                if(game_state.player_bullets_remaining[player_index] > 0){
                    // player has bullets remaining
                    game_state.player_crosshair[player_index] = (current_xhair_pos+1) % num_racers
                }
                break
            case xhair_shoot_act:
                // shoot
                if(game_state.player_bullets_remaining[player_index] > 0){
                    // player has bullets remaining
                    if(!game_state.racers_shot.includes(current_xhair_pos)){
                        // player under xhair not already shot
                        
                        // remove one bullet
                        game_state.player_bullets_remaining[player_index]--

                        // add player under xhair to shot
                        game_state.racers_shot.push(current_xhair_pos)
                    }
                }
                break
        }
    })

});

// GAME LOOP
var game = setInterval(game_loop, ticktime);

function game_loop() {
    // go through each of the games and determine if they are started
    // if they are started, then update the values in them
    for(let room_name in rooms_obj){
        // room_name is a string (key)
        let room = rooms_obj[room_name]
        if(room.game_started){
            // game is in progress

            let game_state = room['game_state']

            // update player positions
            game_state['player_positions'] = game_state['player_positions'].map((val, index)=>{

                let race_position = game_state.player_race_positions[index] // which lane
                
                if(game_state.racers_shot.includes(race_position)){
                    // racer has been shot
                    return val
                }
                else{
                    // raver has not been shot
                    let movement_state = game_state.player_movement_state[index]
                    return val + movement_state
                }
            })

            // update bot positions
            game_state['bot_positions'] = game_state['bot_positions'].map((val, index)=>{

                let num_humans_le_index = 0 // number of humans in lanes less than or equal to index
                game_state.player_race_positions.forEach((pos)=>{
                    if(pos<=index) num_humans_le_index++
                })

                let race_position = index + num_humans_le_index // think about it

                if(game_state.racers_shot.includes(race_position)){
                    // racer has been shot
                    return val
                }
                else{
                    // raver has not been shot
                    let movement_state = game_state.bot_movement_state[index]
                    return val + movement_state
                }
            })

            // randomize bot movement states
            game_state['bot_movement_state'] = game_state['bot_movement_state'].map((val)=>{
                if(bernoulli(bot_movement_toggle_chance)){
                    // flip bot movement state
                    // console.log('here')
                    return (val+1)%2
                }
                return val
            })

            // tell client to update game data
            io.sockets.in(room_name).emit('update_game_state', {
                game_state: game_state
            });

            // check if win condition is met
            // check if player won
            winner_index = find_winner(game_state.player_positions, race_win_position)
            if(winner_index > -1){
                // someone won
                end_game(room, winner_index, room.users[winner_index], room_name)
            }
            
            // check if bot won
            winner_index = find_winner(game_state.bot_positions, race_win_position)
            if(winner_index > -1){
                // someone won
                end_game(room, winner_index, "A bot won, you losers", room_name)
            }

            // console.log(game_state)
        }
    }
}


// HELPER FUNCTION
function initiate_game(num_players){
    // returns object that is a randomized game_state
    let game_state = {
        player_positions: Array(num_players).fill(race_initial_position),
        player_movement_state: Array(num_players).fill(movement_stop_state),
        player_crosshair: sample_no_replacement(num_racers, num_players),
        player_race_positions: sample_no_replacement(num_racers, num_players),

        player_bullets_remaining: Array(num_players).fill(initial_bullets),

        bot_positions: Array(num_racers - num_players).fill(race_initial_position),
        bot_movement_state: Array(num_racers - num_players).fill(movement_stop_state),

        racers_shot: []
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

function get_room_of_user(socket){
    // input socket. output room object that user is in
    for(let room_name in rooms_obj){
        let room = rooms_obj[room_name]
        if(room.socketids.includes(socket.id)){
            return room
            break
        }
    }
    return null
}

function get_room_and_index_of_user(socket){
    // input: socket. output: object that has room user is in and index of user in the room
    for(let room_name in rooms_obj){
        var room = rooms_obj[room_name]
        if(!room.game_started){
            // game is not started. therefore don't need to check this room to change movement states
            continue
        }
        var player_index = room.socketids.indexOf(socket.id)
    }
    return ({
        room: room,
        player_index: player_index
    })
}

function find_winner(positions_array, win_position){
    // input: array of positions, and win condition
    // output: -1 if no winner found. index of winner if found
    let winner_index = -1

    positions_array.some((racer_pos, index) => {
        if(racer_pos >= win_position){
            winner_index = index
            return true // winner false (breaks the some function)
        }
        return false // winner not found (continues the some function)
    })

    return winner_index
}

function end_game(room, winner_index, winner_name, room_name){
    room.game_started = false // set game flag to false

    io.sockets.in(room_name).emit("game_over", {
        success: true,
        winner_index: winner_index,
        winner_name: winner_name
    })
}



http.listen(port, function(){
  console.log('listening on *:' + port)
});