const mysql = require("mysql2/promise");
require("dotenv").config();

let db;

if (process.env.DATABASE_URL) {
  // ✅ Railway / Render URL format: mysql://user:pass@host:port/db
  db = mysql.createPool(process.env.DATABASE_URL);
} else {
  // ✅ Variables séparées
  db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

module.exports = db;
