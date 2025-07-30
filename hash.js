const bcrypt = require("bcrypt");

bcrypt.hash("AdminTest123", 10)
  .then(hash => {
    console.log("🔐 Hashed password:", hash);
  })
  .catch(err => {
    console.error("❌ Error hashing:", err);
  });
