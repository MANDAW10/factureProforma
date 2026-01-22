const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const INVOICE_DIR = path.join(process.cwd(), "invoices");

function ensureFolder() {
  if (!fs.existsSync(INVOICE_DIR)) {
    fs.mkdirSync(INVOICE_DIR, { recursive: true });
  }
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("fr-FR");
}

function centerText(doc, text, y, size = 14) {
  doc.fontSize(size).text(text, 0, y, { align: "center" });
}

function drawBox(doc, x, y, w, h, border = 1, color = "#000") {
  doc.save();
  doc.lineWidth(border);
  doc.strokeColor(color);
  doc.rect(x, y, w, h).stroke();
  doc.restore();
}

function fillBox(doc, x, y, w, h, color = "#eee") {
  doc.save();
  doc.fillColor(color);
  doc.rect(x, y, w, h).fill();
  doc.restore();
}

function drawLine(doc, x1, y1, x2, y2, w = 1) {
  doc.save();
  doc.lineWidth(w);
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.restore();
}

/**
 * ✅ Génère et sauvegarde le PDF dans /invoices
 * Retourne fileName + filePath
 */
async function buildPdfFile(invoiceId) {
  ensureFolder();

  // =========================
  // ✅ Load DB data
  // =========================
  const [[invoice]] = await db.query(
    `
    SELECT invoices.*,
           clients.name AS client_name, clients.email, clients.phone, clients.address
    FROM invoices
    JOIN clients ON clients.id = invoices.client_id
    WHERE invoices.id = ?
    `,
    [invoiceId]
  );

  const [items] = await db.query(
    `SELECT * FROM invoice_items WHERE invoice_id = ?`,
    [invoiceId]
  );

  if (!invoice) throw new Error("Facture introuvable");

  const fileName = `${invoice.invoice_number}.pdf`;
  const filePath = path.join(INVOICE_DIR, fileName);

  // ✅ Si le fichier existe déjà -> on le retourne (option PRO)
  if (fs.existsSync(filePath)) {
    return { fileName, filePath };
  }

  // =========================
  // ✅ PDF CONFIG
  // =========================
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // =========================
  // ✅ Assets
  // =========================
  const logoPath = path.join(process.cwd(), "public/assets/logo.png");
  const cachetPath = path.join(process.cwd(), "public/assets/cachet.png");
  const signPath = path.join(process.cwd(), "public/assets/signature.png");

  // =========================
  // ✅ Colors (comme ton image)
  // =========================
  const BLACK = "#111";
  const GRAY_HEAD = "#6f6f6f";
  const GREEN = "#a9d08e";
  const BLUE_LINK = "#1d4ed8";

  // =========================
  // ✅ HEADER
  // =========================
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 60, 45, { width: 85 });
  }

  doc.fillColor(BLACK).font("Helvetica-Bold");
  centerText(doc, "FACTURE PROFORMA", 65, 16);

  // Left company block
  doc.font("Helvetica").fontSize(10).fillColor(BLACK);
  doc.text("SEYU RENAISSANCE SARL", 60, 150);
  doc.text("Doukhoura, route de Mbour apres Dougar", 60, 168);
  doc.text("00221 77 745 74 74", 60, 186);

  doc.fillColor(BLUE_LINK);
  doc.text("contact@seyurenaissance.com", 60, 204, {
    link: "mailto:contact@seyurenaissance.com",
    underline: true
  });

  // Right invoice block
  doc.fillColor(BLACK);
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("FACTURE N°", 410, 150);

  doc.font("Helvetica").fontSize(10);
  // Affiche la date issue_date à droite
  doc.text(invoice.issue_date || "", 410, 168);

  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Client:", 410, 188);
  doc.font("Helvetica").text(invoice.client_name || "-", 455, 188);

  // =========================
  // ✅ TABLE (même structure)
  // =========================
  // Table positions
  let y = 270;
  const x = 70;
  const tableW = 470;
  const rowH = 22;
  const headH = 26;

  // Column widths (comme ton image)
  const wDesc = 170;
  const wQty = 80;
  const wPU = 80;
  const wUnit = 60;
  const wTot = 80;

  // Header background
  fillBox(doc, x, y, tableW, headH, GRAY_HEAD);
  drawBox(doc, x, y, tableW, headH, 2);

  // Column separators (header)
  drawLine(doc, x + wDesc, y, x + wDesc, y + headH, 2);
  drawLine(doc, x + wDesc + wQty, y, x + wDesc + wQty, y + headH, 2);
  drawLine(doc, x + wDesc + wQty + wPU, y, x + wDesc + wQty + wPU, y + headH, 2);
  drawLine(doc, x + wDesc + wQty + wPU + wUnit, y, x + wDesc + wQty + wPU + wUnit, y + headH, 2);

  // Header text
  doc.fillColor("white").font("Helvetica-Bold").fontSize(11);
  doc.text("Descriptions", x, y + 7, { width: wDesc, align: "center" });
  doc.text("Qte / M2", x + wDesc, y + 7, { width: wQty, align: "center" });
  doc.text("PU", x + wDesc + wQty, y + 7, { width: wPU, align: "center" });
  doc.text("Unité", x + wDesc + wQty + wPU, y + 7, { width: wUnit, align: "center" });
  doc.text("Total HT", x + wDesc + wQty + wPU + wUnit, y + 7, { width: wTot, align: "center" });

  y += headH;

  // Rows items
  doc.fillColor(BLACK).font("Helvetica").fontSize(10);

  if (!items.length) {
    drawBox(doc, x, y, tableW, rowH, 1);
    doc.fillColor("#777").text("Aucun article", x + 8, y + 6);
    y += rowH;
  } else {
    for (const it of items) {
      // Row border
      drawBox(doc, x, y, tableW, rowH, 1);

      // Column separators
      drawLine(doc, x + wDesc, y, x + wDesc, y + rowH, 1);
      drawLine(doc, x + wDesc + wQty, y, x + wDesc + wQty, y + rowH, 1);
      drawLine(doc, x + wDesc + wQty + wPU, y, x + wDesc + wQty + wPU, y + rowH, 1);
      drawLine(doc, x + wDesc + wQty + wPU + wUnit, y, x + wDesc + wQty + wPU + wUnit, y + rowH, 1);

      doc.fillColor(BLACK).font("Helvetica").fontSize(10);

      doc.text(it.description || "", x + 6, y + 6, { width: wDesc - 10 });
      doc.text(String(it.quantity || 0), x + wDesc, y + 6, { width: wQty, align: "center" });
      doc.text(String(it.unit_price || 0), x + wDesc + wQty, y + 6, { width: wPU, align: "center" });
      doc.text(it.unit || "CFA", x + wDesc + wQty + wPU, y + 6, { width: wUnit, align: "center" });
      doc.text(String(it.total || 0), x + wDesc + wQty + wPU + wUnit, y + 6, { width: wTot, align: "center" });

      y += rowH;
    }
  }

  // =========================
  // ✅ Payment box (green left)
  // =========================
  const payX = x;
  const payY = y;
  const payW = 230;
  const payH = 70;

  fillBox(doc, payX, payY, payW, payH, GREEN);
  drawBox(doc, payX, payY, payW, payH, 1);

  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(10);
  doc.text("Condition de paiement", payX, payY + 8, {
    width: payW,
    align: "center"
  });

  doc.font("Helvetica").fontSize(8).fillColor(BLACK);
  doc.text(
    "Les conditions de paiement acceptés incluent le\ncheque, le virement bancaire",
    payX + 10,
    payY + 28,
    { width: payW - 20, align: "center" }
  );

  // =========================
  // ✅ Totals table (right)
  // =========================
  const totX = x + tableW - 200;
  const totY = payY;
  const totW2 = 200;
  const totH2 = payH;

  drawBox(doc, totX, totY, totW2, totH2, 2);

  const r = totH2 / 3;
  drawLine(doc, totX, totY + r, totX + totW2, totY + r, 1);
  drawLine(doc, totX, totY + r * 2, totX + totW2, totY + r * 2, 1);

  doc.fillColor(BLACK).font("Helvetica").fontSize(10);

  doc.text("TOTAL HT", totX + 10, totY + 7);
  doc.text(formatMoney(invoice.subtotal), totX + 10, totY + 7, { width: totW2 - 20, align: "right" });

  doc.text(`TVA ${invoice.tva_rate}%`, totX + 10, totY + r + 7);
  doc.text(formatMoney(invoice.tva_amount), totX + 10, totY + r + 7, { width: totW2 - 20, align: "right" });

  doc.font("Helvetica-Bold");
  doc.text("TOTAL TTC", totX + 10, totY + r * 2 + 7);
  doc.text(formatMoney(invoice.total), totX + 10, totY + r * 2 + 7, { width: totW2 - 20, align: "right" });

  // =========================
  // ✅ SERVICE COMPTABLE + cachet + signature
  // =========================
  const serviceY = 545;
  const serviceX = 320;
  const serviceW = 240;
  const serviceH = 26;

  fillBox(doc, serviceX, serviceY, serviceW, serviceH, GREEN);
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(16);
  doc.text("SERVICE COMPTABLE", serviceX, serviceY + 5, { width: serviceW, align: "center" });

  // Cachet
  if (fs.existsSync(cachetPath)) {
    doc.image(cachetPath, 410, 595, { width: 105 });
  }

  // Signature
  if (fs.existsSync(signPath)) {
    doc.image(signPath, 440, 720, { width: 90 });
  }

  // =========================
  // ✅ FOOTER (comme ton image)
  // =========================
  doc.font("Helvetica").fontSize(8).fillColor(BLACK);

  doc.text(
    "SEYU RENAISSANCE SARL, AU CAPITAL DE 1 000 000 , SIEGE SOCIAL : NDOUKHOURA, ROUTE DE M",
    0,
    790,
    { align: "center" }
  );
  doc.text(
    "NINEA: 010996728 2E2, RCCM: SN.DKR.2024.M.46102",
    0,
    804,
    { align: "center" }
  );

  // ✅ finish
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { fileName, filePath };
}

module.exports = { buildPdfFile, INVOICE_DIR };
