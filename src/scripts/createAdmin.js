const db = require("../config/db");
const bcrypt = require("bcryptjs");

async function createAdmin() {
  const name = "Admin";
  const email = "admin@seyu.sn";
  const password = "P@sser123";

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
    [name, email, hash, "admin"]
  );

  console.log("✅ Admin créé !");
  console.log("📧 Email :", email);
  console.log("🔑 Password :", password);
  process.exit();
}

createAdmin().catch((e) => {
  console.log("❌ Erreur :", e.message);
  process.exit(1);
});
