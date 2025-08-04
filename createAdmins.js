require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/Admin");

const admins = [
  {
    name: "Andre Söderberg",
    email: "andre.soderberg@outlook.com",
    password: "Cmq7$k9WpX3!gLaB"
  },
  {
    name: "Vincent Korpela",
    email: "vincent.korpela@gmail.com",
    password: "Rz#2mN84s@TgV6wq"
  }
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: "adminportal"
  });

  for (const admin of admins) {
    const exists = await Admin.findOne({ email: admin.email });
    if (exists) {
      console.log(`⏩ ${admin.email} finns redan`);
      continue;
    }

    const newAdmin = new Admin(admin); // bcrypt hash sker i pre('save')
    await newAdmin.save();
    console.log(`✅ Skapade admin: ${admin.email}`);
  }

  mongoose.disconnect();
}

run();
