var socket = io.connect();

//////////////////////////////////
// GAME SETTINGS
const tickrate = 0.5
const ticktime = 1000/tickrate
const canvas_width = 640
const canvas_height = 480

//////////////////////////////////
// GAME DATA
var num_racers = 0 // will change when game starts
var game_state = {}


//////////////////////////////////
// canvas
var game_canvas = document.getElementById("game_canvas")
//game_canvas.style.width = canvas_width.toString().concat("px")
//game_canvas.style.height = canvas_height.toString().concat("px")
var ctx = game_canvas.getContext("2d");

var racer_spacing = 0 // will change when game starts. vertical spacing in px of the racers
var racer_size = 10 // size of racer in px

ctx.fillStyle = "#FF0000";
ctx.fillRect(0, 0, 150, 75);
ctx.fillStyle = "#0000FF";
ctx.fillRect(100, 100, 10, 10);

/////////////////////////////////
// create room handler
$("#create_btn").click(()=>{
    socket.emit("create_room", {
        nickname: $("#nickname_input").val(),
        room: $("#room_input").val(),
        password: $("#password_input").val()
    })
})

// join room handler
$("#join_btn").click(()=>{
    socket.emit("join_room", {
        nickname: $("#nickname_input").val(),
        room: $("#room_input").val(),
        password: $("#password_input").val()
    })
})

// create room response handler
socket.on("create_room_res", (data)=>{
    if(data.success){
        hide_join_create()
        show_game()
        alert(data.msg)
    }
    else{
        alert(data.msg)
    }
})

// join room response handler
socket.on("join_room_res", (data)=>{
    if(data.success){
        hide_join_create()
        show_game()
        alert(data.msg)
    }
    else{
        alert(data.msg)
    }
})

// start game handler
$("#start_game_btn").click(() => {
    socket.emit("start_game")
})

// start game response handler
socket.on("start_game_res", (data)=>{
    if(data.success){
        num_racers = data.num_racers
        racer_spacing = canvas_height/(num_racers+1)
        alert(data.msg)
    }
    else{
        alert(data.msg)
    }
})

// update users display handler
socket.on("update_users_display", (data)=>{
    let users_text = ""
    data.users.forEach(user => {
        users_text = users_text.concat(user)
    })
    $("#users_display").html(users_text)
})

// update game data handler
socket.on("update_game_state", (data)=>{
    game_state = data.game_state
    console.log(data.game_state)
})

// update display
var game_display = setInterval(update_display, ticktime);

/////////////////////////////
// Helper functions
function hide_join_create(){
    $("#join_create_div").css("display", "none")
}

function show_game(){
    $("#game_div").css("display", "block")
}

function update_display(){
    // clear canvas
    console.log(canvas_width)
    //ctx.clearRect(0, 0, canvas_width, canvas_height);

    let bot_index = 0
    let human_index = 0

    for(let i=0; i<num_racers; i++){
        if(game_state.player_race_positions.includes(i)){
            // i is at position of human

            let race_position=game_state.player_positions[human_index]
            ctx.fillStyle = "#00FF00";
            ctx.fillRect(race_position+0.5, racer_spacing*(i+0.5), racer_size, racer_size);
            ctx.fillText(i.toString(), race_position+0.5, racer_spacing*(i+0.5));


            human_index++
        }
        else{
            // i is at position of bot

            let race_position=game_state.bot_positions[bot_index]
            ctx.fillStyle = "#00FF00";
            ctx.fillRect(race_position+0.5, racer_spacing*(i+0.5), racer_size, racer_size);
            ctx.fillText(i.toString(), race_position+0.5, racer_spacing*(i+0.5));

            bot_index++
        }
    }

}
