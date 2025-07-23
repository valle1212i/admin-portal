const socket = io("https://source-database.onrender.com"); // URL till din server/socket.io

socket.on("newMessage", (msg) => {
  // Visa bara meddelanden från kunden
  if (msg.sender === "customer") {
    renderIncomingMessage(msg);
  }
});

// Skicka meddelande som admin, med sessionId
function sendAdminMessage(customerId, sessionId, text) {
  const msg = {
    customerId,
    sessionId,  // Viktigt att skicka med sessionId
    message: text,
    sender: "admin",
    timestamp: new Date()
  };

  socket.emit("sendMessage", msg);

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg)
  }).catch(console.error);
}

// 🆕 Skicka systemmeddelande när chatten startar
function notifyAdminOfNewSession(customerId, sessionId) {
  const systemMsg = {
    customerId,
    sessionId,
    message: "🔔 Ny chatt startad",
    sender: "system",
    timestamp: new Date()
  };

  console.log("📤 Skickar systemmeddelande:", systemMsg);

  socket.emit("sendMessage", systemMsg);

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(systemMsg)
  }).catch(err => {
    console.error("❌ Kunde inte skicka systemmeddelande:", err);
  });
}
