require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const serverStatusRoute = require('./routes/serverStatus');
const path = require("path");

const app = express();

// 🔧 Tillåt frontend-domäner (inkl. localhost)
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://customerportal-frontend.onrender.com",
    "https://admin-portal-rn5z.onrender.com",
    "https://admin-portal.onrender.com"
  ],
  credentials: true
}));

const http = require("http").createServer(app);

// ✅ Uppdaterad Socket.IO CORS – inkluderar localhost
const io = require("socket.io")(http, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://admin-portal.onrender.com",
      "https://admin-portal-rn5z.onrender.com",
      "https://customerportal-frontend.onrender.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => console.log(`🚀 Servern körs på http://localhost:${PORT}`));

// 🧠 Socket.IO logik
io.on("connection", (socket) => {
  console.log("🟢 En användare anslöt");

  socket.on("sendMessage", (msg) => {
    console.log("✉️ Meddelande mottaget:", msg);
    io.emit("newMessage", msg); // Broadcast till alla klienter
  });

  socket.on("disconnect", () => {
    console.log("🔴 Användare frånkopplad");
  });
});

// Middleware
app.use(express.json());

// Servera statiska filer från public/
app.use(express.static(path.join(__dirname, "public")));

// API-routes
const chatRoutes = require('./routes/chat');
app.use("/api/chat", chatRoutes);

app.use("/api/server-status", serverStatusRoute);

const customerRoutes = require("./routes/customers");
app.use("/api/customers", customerRoutes);

// MongoDB-anslutning
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB anslutning lyckades"))
  .catch(err => console.error("🔴 MongoDB anslutning misslyckades:", err));

// Admin dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});
