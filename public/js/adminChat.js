const socket = io("https://admin-portal-production-a9a5.up.railway.app", {
  withCredentials: true
});

socket.on("newMessage", (msg) => {
  if (msg.sender === "customer") {
    renderIncomingMessage(msg);
  }
});

function sendAdminMessage(customerId, sessionId, text) {
  const msg = {
    customerId,
    sessionId,
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
