if(process.env.NODE_ENV !== "production"){
    require("dotenv").config();
}
const app = require("express")();
const server = require('http').createServer(app);
const io = require("socket.io")(server);
const exphbs = require("express-handlebars");
const axios = require("axios");
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));

app.engine("handlebars", exphbs());
app.set('view engine', 'handlebars');

let nextRoomId = 1;

app.get("/", (req, res) => {
    res.render("landing", {
        rooms,
    });
})

app.get("/room/:id", (req, res) => {
    if(rooms[req.params.id] === undefined) {
        res.redirect("/");
        return;
    }
    res.render("room", {
        room: rooms[req.params.id]
    });
});

app.post("/newRoom", (req, res) => {
    rooms[nextRoomId] = createRoom(nextRoomId, createVideo(req.body.videoId));
    res.redirect(`/room/${nextRoomId}`);
    nextRoomId++;
})

const rooms = {}

function createRoom(id, video){
    return { 
        id,
        video,
        viewers: {},
        drawings: [],
    }
}
function createVideo(id){
    return { id, isPlaying: false, time: 0}
}

function unreadyViewers(roomId){
    const viewers = rooms[roomId].viewers;
    let unreadyViewers = {};
    for(const key of Object.keys(viewers)){
        unreadyViewers[key] = {key, isReady: false}
    }
    rooms[roomId].viewers = unreadyViewers;
}

io.on('connection', socket => {
    socket.on("joinRoom", roomId => {
        rooms[roomId].viewers[socket.id] = { id: socket.id, isReady: true };
        socket.join(roomId);
        socket.roomId = roomId;
        // socket.to(roomId).emit('waitForSync');
        // socket.emit("syncViewer", rooms[socket.roomId].video);
    });

    socket.on("inSync", () => {
        rooms[socket.roomId].viewers[socket.id].isReady = true;
    })

    socket.on("videoId", id => {
        unreadyViewers(socket.roomId);
        io.to(socket.roomId).emit("videoId", id);
    });

    socket.on("videoPaused", (time) => {
        unreadyViewers(socket.roomId);
        io.to(socket.roomId).emit("videoPaused", time);
    });

    socket.on("videoRate", rate => {
        unreadyViewers(socket.roomId);
        io.to(socket.roomId).emit("videoRate", rate);
    });

    socket.on("videoTime", time => {
        unreadyViewers(socket.roomId);
        io.to(socket.roomId).emit("videoTime", time);
    });

    socket.on("videoPlayed", () => {
        const viewers = rooms[socket.roomId].viewers;
        if(Object.values(viewers).every(viewer => viewer.isReady)) io.to(socket.roomId).emit("videoPlayed");
    });
    
    //CANVAS
    socket.on('drawing', drawing => {
        rooms[socket.roomId].drawings.push(drawing);
        io.to(socket.roomId).emit('drawing', drawing);
    });
    socket.on('erase', () => {
        rooms[socket.roomId].drawings = [];
        io.to(socket.roomId).emit('erase');
    })

    socket.on("disconnect", () => {
        delete rooms[socket.roomId].viewers[socket.id];
        if(Object.keys(rooms[socket.roomId].viewers).length === 0) delete rooms[socket.roomId];
    })
})


const PORT = process.env.PORT || 7000;
server.listen(PORT, function(){
    console.log("Works fine");
})

