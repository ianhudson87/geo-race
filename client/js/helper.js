var socket = io.connect();

//////////////////////////////////
// GAME SETTINGS
const tickrate = 10
const ticktime = 1000/tickrate
const canvas_width = 640
const canvas_height = 480

const width_multiplier = 2
const height_multiplier = 1

const movement_stop_state = 0 // state for not moving
const movement_walk_state = 1 // state for not moving
const movement_run_state = 2 // state for not moving

const xhair_up_act = 0 // action type for moving xhair up
const xhair_down_act = 1 // action type for moving xhair down
const xhair_shoot_act = 2 // action type for shooting

const racer_alive_color = "#00FF00"
const racer_dead_color = "#FF0000"
const player_colors = ["#FF0000", "#0000FF", "#FFFF00", "#00FFFF", "#000000"]

//////////////////////////////////
// GAME DATA
var num_racers = 0 // will change when game starts
var game_state = {} // USE THIS TO KEEP TRACK OF ALL GAME DATA. Same as server game_state
var race_win_position = 0 // change when game starts
var ordered_racer_pos = [] // racer positions in order
var one_key_down = false // keeps track if a key is down or not


//////////////////////////////////
// canvas
var game_canvas = document.getElementById("game_canvas")
//game_canvas.style.width = canvas_width.toString().concat("px")
//game_canvas.style.height = canvas_height.toString().concat("px")
var ctx = game_canvas.getContext("2d");

var racer_spacing = 0 // changes when game starts. vert spacing in px of the racers
const racer_size = 10 // size of racer in px

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
        race_win_position = data.race_win_position
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
    // console.log(data.game_state)

    // order the racer positions based on how they are lined up
    let bot_index = 0
    for(let i=0; i<num_racers; i++){
        if(game_state.player_race_positions.includes(i)){
            // i is at position of human. use lookup table
            player_positions_index = game_state.player_race_positions.indexOf(i) // index wanted for player_positions array

            let racer_position = game_state.player_positions[player_positions_index]
            ordered_racer_pos[i] = racer_position

        }
        else{
            // i is at position of bot. use bot_index counter

            let racer_position = game_state.bot_positions[bot_index]
            ordered_racer_pos[i] = racer_position

            bot_index++
        }
    }

})

// handler for when game is over
socket.on("game_over", (data)=>{
    if(data.success){
        alert("Game Over. Winner: " + data.winner_name)
        // console.log(data)
    }
})

// update display
var game_display = setInterval(update_display, ticktime);

/////////////////////////////////
// handle game actions: z=walk; x=run; o=xhairup; l=xhairdown; enter=shoot
$(document).on("keyup keydown", (e) => {
    if(!one_key_down && e.type=="keydown"){
        // no keys are down and key is pressed
        switch(e.which){
            case 90:
                // z down
                socket.emit("change_movement", {
                    move_type: movement_walk_state // walk
                })
                break
            case 88:
                // x down
                socket.emit("change_movement", {
                    move_type: movement_run_state // run
                })
                break
            case 79:
                // o down
                socket.emit("xhair_action", {
                    action_type: xhair_up_act // xhair up
                })
                break
            case 76:
                // l down
                socket.emit("xhair_action", {
                    action_type: xhair_down_act // xhair down
                })
                break
            case 13:
                // enter down
                socket.emit("xhair_action", {
                    action_type: xhair_shoot_act // xhair shoot
                })
                break
        }

        // set key pressed flag
        one_key_down = true
    }
    else if(one_key_down && e.type=="keyup"){
        // key is down and key has been released
        switch(e.which){
            case 90:
                // z up
            case 88:
                // x up
                socket.emit("change_movement", {
                    move_type: movement_stop_state // stop walk/run
                })
                break
        }

        // set key pressed flag
        one_key_down = false
    }
    
});

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
    ctx.clearRect(0, 0, canvas_width, canvas_height);

    // draw racers
    display_racers()

    // draw crosshairs
    display_xhairs()

    // draw finish line
    display_finish()
}

function display_racers(){
    // go through each racer and display them
    ordered_racer_pos.forEach((racer_pos, racer_index) => {
        // determine if racer is alive
        racer_color = game_state.racers_shot.includes(racer_index) ? racer_dead_color : racer_alive_color

        draw_square(racer_pos*width_multiplier, racer_spacing*(racer_index+0.5), racer_size, racer_color)
    })
}

function display_xhairs(){
    if(!game_state.player_crosshair){
        // game not started yet
        return
    }
    game_state.player_crosshair.forEach((xhair_pos, player_index) => {
        // xhair_pos is the index of the racer that xhair is on
        // player_index is the index of the player with the xhair
        let racer_pos = ordered_racer_pos[xhair_pos]
        let xhair_color = player_colors[player_index]
        draw_circle(racer_pos*width_multiplier, racer_spacing*(xhair_pos+0.5), 10, xhair_color)
        
    })
}

function display_finish(){
    draw_line((race_win_position + racer_size*0.5)*width_multiplier, 0,
    (race_win_position + racer_size*0.5)*width_multiplier, canvas_height)
}


// shape drawing
function draw_square(center_x, center_y, side_length, color){
    let xcoord = center_x-side_length*0.5
    let ycoord = center_y-side_length*0.5

    ctx.fillStyle = color
    ctx.fillRect(xcoord, ycoord, side_length, side_length)
}

function draw_text(x_position, y_position, text, color){
    ctx.fillStyle = color
    ctx.fillText(text, x_position, y_position)
}

function draw_circle(center_x, center_y, radius, color){
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.arc(center_x, center_y, radius, 0, 2 * Math.PI)
    ctx.stroke()
}

function draw_line(start_x, start_y, end_x, end_y){
    ctx.beginPath();
    ctx.moveTo(start_x, start_y);
    ctx.lineTo(end_x, end_y);
    ctx.stroke();
}