const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

// ✅ Middlewares
app.use(cors());
app.use(express.json());

// ✅ Servir le dossier public (index.html, facture.html, login.html)
app.use(express.static(path.join(__dirname, "public")));

// ✅ Routes
const authRoutes = require("./src/routes/auth.routes");
const clientRoutes = require("./src/routes/client.routes");
const invoiceRoutes = require("./src/routes/invoice.routes");

// ✅ API endpoints
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/invoices", invoiceRoutes);

// ✅ Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Serveur lancé sur http://localhost:" + PORT);
});


