const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: String,
  role: {
    type: String,
    default: "admin"
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 🔐 Hasha lösenord innan sparning
AdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ⚠️ Korrekt collection "adminusers"
module.exports = mongoose.model("Admin", AdminSchema, "adminusers");
