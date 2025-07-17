const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*", // ändra till specifik URL vid behov
  },
});

http.listen(3000, () => console.log("🚀 Servern körs på http://localhost:3000"));

// Socket.IO-anslutning
io.on("connection", (socket) => {
  console.log("🟢 En användare anslöt");

  socket.on("sendMessage", (msg) => {
    console.log("✉️ Meddelande mottaget:", msg);
    io.emit("newMessage", msg); // broadcast till alla
  });

  socket.on("disconnect", () => {
    console.log("🔴 Användare frånkopplad");
  });
});


const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Servera statiska filer från public/
app.use(express.static(path.join(__dirname, "public")));

const chatRoutes = require('./routes/chat'); // rätt – liten bokstav
app.use("/api/chat", chatRoutes);

const serverStatus = require('./routes/serverStatus');
app.use("/api/server-status", serverStatusRoute);

// MongoDB-anslutning
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB anslutning lyckades"))
  .catch(err => console.error("🔴 MongoDB anslutning misslyckades:", err));

// REST API-routes
const customerRoutes = require("./routes/customers");
app.use("/api/customers", customerRoutes);

// Visa dashboard HTML
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

