const express = require("express");
const cors = require("cors");

const clientRoutes = require("./routes/client.routes");
const invoiceRoutes = require("./routes/invoice.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/invoices", express.static("invoices"));

app.use("/api/clients", clientRoutes);
app.use("/api/invoices", invoiceRoutes);

module.exports = app;
