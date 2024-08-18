import express from "express";
import userRoute from "./routes/user.js";
import chatRoute from "./routes/chat.js";
import adminRoute from "./routes/admin.js";
import { connectDB } from "./utils/featues.js";
import dotenv from "dotenv";
import { createServer } from "http";
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { corsOptions } from "./constants/config.js";
import { v2 as cloudinary } from "cloudinary";

import { Server } from "socket.io";
import { CHAT_JOINED, CHAT_LEAVED, NEW_MESSAGE, NEW_MESSAGE_ALERT, ONLINE_USERS, START_TYPING, STOP_TYPING } from "./constants/events.js";

import { getSockets } from "./lib/helper.js";
import { v4 as uuid } from "uuid";
import { Message } from "./models/message.js";
import { socketAuthenticator } from "./middlewares/auth.js";
dotenv.config({
  path: "./.env",
});
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
app.set("io",io);
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const mongoURI = process.env.MONGO_URI;
const port = 3000 || process.env.PORT;

const envMode = process.env.NODE_ENV.trim() || "PRODUCTION";
const adminSecretKey = process.env.ADMIN_SECRET_KEY || "adsasdsdfsdfsdfd";
const userSocketIDs = new Map();
const onlineUsers = new Set();

connectDB(mongoURI);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


app.use("/api/v1/user", userRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/admin", adminRoute);
app.get("/", (req, res) => {
  res.send("hello world");
});
io.use((socket, next) => {
  cookieParser()(
    socket.request,
    socket.request.res,
    async (err) => await socketAuthenticator(err, socket, next)
  );
});

io.on("connection", (socket) => {
  const user = socket.user;
  userSocketIDs.set(user._id.toString(), socket.id);

  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageComm = {
      content: message,
      _id: uuid(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toISOString(),
    };
    const messageSave = {
      content: message,
      sender: user._id,
      chat: chatId,
    };
    // console.log("Emiiting",messageComm )
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(NEW_MESSAGE, {
      chatId,
      message: messageComm,
    });
    io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });
    try {
      await Message.create(messageSave);
    } catch (error) {
      console.log(error);
    }
  });
  socket.on(START_TYPING,({members,chatId})=>{
    // console.log("start - typing",chatId);
    const membersSockets = getSockets(members);

    socket.to(membersSockets).emit(START_TYPING,{chatId});

  });
  socket.on(STOP_TYPING,({members,chatId})=>{
    // console.log("stop - typing",chatId);
    const membersSockets = getSockets(members);

    socket.to(membersSockets).emit(STOP_TYPING,{chatId});

  })
  socket.on(CHAT_JOINED,({userId,members})=>{
   onlineUsers.add(userId.toString());
   const membersSocket= getSockets(members);
   io.to(membersSocket).emit(ONLINE_USERS,Array.from(onlineUsers));
  });
  socket.on(CHAT_LEAVED,({userId,members})=>{
    onlineUsers.delete(userId.toString());
    const membersSocket= getSockets(members);
   io.to(membersSocket).emit(ONLINE_USERS,Array.from(onlineUsers));
  })


  socket.on("disconnect", () => {
    console.log("user disconnected");
    userSocketIDs.delete(user._id.toString());
    onlineUsers.delete(user._id.toString());
    socket.broadcast.emit(ONLINE_USERS,Array.from(onlineUsers))

  });
});
app.use(errorMiddleware);
server.listen(port, () => {
  console.log(`server is listening on port ${port} in ${envMode}`);
});

export { adminSecretKey, envMode, userSocketIDs };
