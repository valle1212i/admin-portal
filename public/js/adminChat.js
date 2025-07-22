const socket = io("https://source-database.onrender.com"); // Om det är där server.js/socket.io körs

socket.on("newMessage", (msg) => {
  // Visa bara meddelanden från kunden
  if (msg.sender === "customer") {
    renderIncomingMessage(msg);
  }
});

function sendAdminMessage(customerId, text) {
  const msg = {
    customerId,
    message: text,
    sender: "admin",
    timestamp: new Date()
  };

  socket.emit("sendMessage", msg);

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg)
  });
}
// Lägg till sessionId (krävs nu i modellen)
const msg = {
    customerId,
    message: text,
    sender: "admin",
    timestamp: new Date(),
    sessionId: activeSessionId // 👈 Du behöver ha den sparad per kund
  };
  