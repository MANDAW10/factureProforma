const db = require("../config/db");

// ✅ Recuperer TOUS LES CLIENTS
exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM clients ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    console.error("GET CLIENTS ERROR:", err);
    res.status(500).json({ error: "Erreur chargement clients" });
  }
};

// ✅ CREATE CLIENT
exports.create = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Le nom du client est obligatoire" });
    }

    const [result] = await db.query(
      "INSERT INTO clients(name,email,phone,address) VALUES(?,?,?,?)",
      [name.trim(), email || "", phone || "", address || ""]
    );

    res.json({
      message: "✅ Client ajouté",
      clientId: result.insertId, // ✅ IMPORTANT pour le frontend
    });
  } catch (err) {
    console.error("CREATE CLIENT ERROR:", err);
    res.status(500).json({ error: "Erreur ajout client" });
  }
};
