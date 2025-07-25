const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Lyckad anslutning till MongoDB Atlas!");
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error("❌ Kunde inte ansluta till MongoDB Atlas:", err);
  });
