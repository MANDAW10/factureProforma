const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe obligatoires" });
    }

    // ✅ check secret
    if (!process.env.JWT_SECRET) {
      console.log("❌ JWT_SECRET manquant dans .env");
      return res.status(500).json({ error: "JWT_SECRET manquant" });
    }

    // ✅ user
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // ✅ password compare
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // ✅ generate token
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "✅ Connexion réussie",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR FULL:", err);
    return res.status(500).json({ error: "Erreur serveur login" });
  }
};
