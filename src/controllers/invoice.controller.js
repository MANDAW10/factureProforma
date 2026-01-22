const db = require("../config/db");
const generatePdfBuffer = require("../services/pdf.buffer.service");

// ✅ Générer numéro facture PF-2026-0001
function makeInvoiceNumber(lastId) {
  const year = new Date().getFullYear();
  const num = String(lastId + 1).padStart(4, "0");
  return `PF-${year}-${num}`;
}

// ✅ GET ALL INVOICES (Historique)
exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT invoices.*, clients.name AS client_name
      FROM invoices
      JOIN clients ON clients.id = invoices.client_id
      ORDER BY invoices.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET ALL ERROR:", err);
    res.status(500).json({ error: "Erreur récupération des factures" });
  }
};

// ✅ CREATE INVOICE + ITEMS
exports.create = async (req, res) => {
  try {
    const { client_id, issue_date, due_date, notes, tva_rate, items } = req.body;

    // ✅ Validation simple
    if (!client_id || !issue_date) {
      return res.status(400).json({ error: "Client et date d'émission obligatoires" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Ajoutez au moins un article" });
    }

    // ✅ Récupérer dernier ID facture
    const [last] = await db.query("SELECT id FROM invoices ORDER BY id DESC LIMIT 1");
    const lastId = last.length ? last[0].id : 0;
    const invoiceNumber = makeInvoiceNumber(lastId);

    // ✅ Calcul totals
    let subtotal = 0;

    const cleanItems = items.map((it) => {
      const quantity = Number(it.quantity || 0);
      const unit_price = Number(it.unit_price || 0);
      const total = quantity * unit_price;

      subtotal += total;

      return {
        description: it.description || "",
        quantity,
        unit_price,
        unit: it.unit || "FCFA",
        total,
      };
    });

    const rate = Number(tva_rate || 18);
    const tvaAmount = subtotal * (rate / 100);
    const totalTTC = subtotal + tvaAmount;

    // ✅ INSERT invoice
    const [result] = await db.query(
      `
      INSERT INTO invoices(invoice_number, client_id, issue_date, due_date, notes, tva_rate, subtotal, tva_amount, total)
      VALUES(?,?,?,?,?,?,?,?,?)
      `,
      [
        invoiceNumber,
        client_id,
        issue_date,
        due_date || null,
        notes || "",
        rate,
        subtotal,
        tvaAmount,
        totalTTC,
      ]
    );

    const invoiceId = result.insertId;

    // ✅ INSERT items
    for (const it of cleanItems) {
      await db.query(
        `
        INSERT INTO invoice_items(invoice_id, description, quantity, unit_price, unit, total)
        VALUES(?,?,?,?,?,?)
        `,
        [invoiceId, it.description, it.quantity, it.unit_price, it.unit, it.total]
      );
    }

    // ✅ Retour PRO avec liens PDF / print
    res.json({
      message: "✅ Facture créée",
      invoiceId,
      invoiceNumber,

      pdf_view: `/api/invoices/${invoiceId}/pdf`,
      pdf_download: `/api/invoices/${invoiceId}/pdf/download`,
      print: `/api/invoices/${invoiceId}/print`,
    });
  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ error: "Erreur création facture" });
  }
};

// ✅ VIEW PDF (inline)
exports.viewPdf = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { fileName, buffer } = await generatePdfBuffer(invoiceId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error("VIEW PDF ERROR:", err);
    res.status(500).json({ error: "Erreur affichage PDF" });
  }
};

// ✅ DOWNLOAD PDF (attachment)
exports.downloadPdf = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { fileName, buffer } = await generatePdfBuffer(invoiceId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error("DOWNLOAD PDF ERROR:", err);
    res.status(500).json({ error: "Erreur téléchargement PDF" });
  }
};

// ✅ PRINT PAGE (auto print)
exports.printPage = (req, res) => {
  const invoiceId = req.params.id;

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Impression Facture</title>
      <style>
        html, body { margin:0; padding:0; height:100%; }
        iframe { width:100%; height:100%; border:none; }
      </style>
    </head>
    <body>
      <iframe id="pdfFrame" src="/api/invoices/${invoiceId}/pdf"></iframe>

      <script>
        const frame = document.getElementById("pdfFrame");
        frame.onload = () => {
          setTimeout(() => {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          }, 800);
        };
      </script>
    </body>
    </html>
  `);
};

// ✅ DELETE INVOICE (SUPPRIMER)
exports.remove = async (req, res) => {
  try {
    const invoiceId = req.params.id;

    // ✅ supprimer d'abord les articles
    await db.query("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId]);

    // ✅ supprimer la facture
    const [result] = await db.query("DELETE FROM invoices WHERE id = ?", [invoiceId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Facture introuvable" });
    }

    res.json({ message: "✅ Facture supprimée" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Erreur suppression facture" });
  }
};
