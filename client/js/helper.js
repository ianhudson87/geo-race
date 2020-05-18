var socket = io.connect();

var game_canvas = document.getElementById("game_canvas")
var ctx = game_canvas.getContext("2d");
ctx.fillStyle = "#FF0000";
ctx.fillRect(0, 0, 150, 75);

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

///// Helper functions
function hide_join_create(){
    $("#join_create_div").css("display", "none")
}

function show_game(){
    $("#game_div").css("display", "block")
}
