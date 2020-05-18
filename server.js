var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var port = process.env.PORT || 3000;


// serve up all client files
var htmlPath = path.join(__dirname, 'client');
app.use(express.static(htmlPath));

// app.get('/', function(req, res){
//   res.sendFile(__dirname + '/client/index.html');
// });


// object of objects
// first object is all the rooms
// second object is password and users
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
    game_started: true
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
        for(let room in rooms_obj){
            // room is initially a string
            room = rooms_obj[room]

            console.log(room.socketids)

            if(room.socketids.includes(socket.id)){
                // user is in this room
                if(room.socketids.length > 1){
                    room.game_started = true

                    socket.emit("start_game_res", {
                        success: true,
                        msg: "game started"
                    })

                }
                else{
                    socket.emit("start_game_res", {
                        success: false,
                        msg: "game not started, not enough people"
                    })
                }
            }
        }
    })
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});