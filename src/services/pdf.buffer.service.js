function formatMoneySafe(n) {
  return Number(n || 0)
    .toLocaleString("fr-FR")
    .replace(/\s/g, "\u00A0"); // ✅ espace insécable
}


const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

function formatMoney(n) {
  return Number(n || 0).toLocaleString("fr-FR");
}

function formatDateFR(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString("fr-FR"); // JJ/MM/AAAA
}

function drawLine(doc, x1, y1, x2, y2, w = 1) {
  doc.save();
  doc.lineWidth(w).moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.restore();
}

function drawBox(doc, x, y, w, h, border = 1) {
  doc.save();
  doc.lineWidth(border).rect(x, y, w, h).stroke();
  doc.restore();
}

function drawFilledBox(doc, x, y, w, h, color) {
  doc.save();
  doc.fillColor(color).rect(x, y, w, h).fill();
  doc.restore();
}

/**
 * ✅ Génère le PDF en mémoire (Buffer)
 */
module.exports = async function generatePdfBuffer(invoiceId) {
  try {
    // =========================
    // ✅ DATA
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

    if (!invoice) {
      // ✅ mini PDF propre
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.fontSize(18).text("Facture introuvable", { align: "center" });
      doc.end();

      const buffer = await new Promise((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
      });

      return { fileName: "facture.pdf", buffer };
    }

    // =========================
    // ✅ PDF CONFIG
    // =========================
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const fileName = `${invoice.invoice_number}.pdf`;

    // =========================
    // ✅ Images
    // =========================
    const logoPath = path.join(process.cwd(), "public/assets/logo.jpg");
    const cachetPath = path.join(process.cwd(), "public/assets/cachet.jpg");
    const signPath = path.join(process.cwd(), "public/assets/signature.jpg");

    // =========================
    // ✅ COLORS
    // =========================
    const GREEN = "#a9d08e";
    const DARK = "#111827";
    const HEAD_GRAY = "#6f6f6f";
    const MUTED = "#6b7280";
    const BLUE_LINK = "#1d4ed8";

    // =========================
    // ✅ HEADER
    // =========================
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 60, 55, { width: 100 });
    }

    // Titre à droite comme image
    doc
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("FACTURE PROFORMA", 0, 75, { align: "right" });

    // Bloc gauche entreprise
    doc.font("Helvetica").fontSize(12).fillColor(DARK);
    doc.text("SEYU RENAISSANCE SARL", 60, 150);
    doc.text("Doukhoura, route de Mbour apres Dougar", 60, 168);
    doc.text("+221 77 745 74 74", 60, 186);

    doc.fillColor(BLUE_LINK);
    doc.text("contact@seyurenaissance.com", 60, 204, {
      link: "mailto:contact@seyurenaissance.com",
      underline: true,
    });

    doc.fillColor(DARK);

    // Bloc droit facture
    // FACTURE N° + numéro sur même ligne
    doc.font("Helvetica-Bold").fontSize(11).text("FACTURE N°", 410, 150);
    doc.font("Helvetica").fontSize(11).text(invoice.invoice_number || "-", 480, 150);

    // Date sur même ligne
    doc.font("Helvetica-Bold").fontSize(11).text("Date:", 410, 168);
    doc.font("Helvetica").fontSize(11).text(formatDateFR(invoice.issue_date) || "-", 450, 168);

    // Client sur même ligne
    doc.font("Helvetica-Bold").fontSize(11).text("Client:", 410, 188);
    doc.font("Helvetica").fontSize(11).text(invoice.client_name || "-", 455, 188);

    // =========================
    // ✅ TABLE (SANS LIGNES VERTICALES)
    // =========================
    const startTableY = 270;
    let y = startTableY;

    const tableX = 70;
    const tableW = 470;
    const headH = 26;

    const wDesc = 170;
    const wQty = 80;
    const wPU = 80;
    const wUnit = 60;
    const wTotal = 80;

    // Header gris
    drawFilledBox(doc, tableX, y, tableW, headH, HEAD_GRAY);
    drawBox(doc, tableX, y, tableW, headH, 1);

    doc.font("Helvetica-Bold").fontSize(10).fillColor("white");

    doc.text("Descriptions", tableX + 6, y + 7, { width: wDesc - 12, align: "left" });
    doc.text("Qte / M2", tableX + wDesc, y + 7, { width: wQty, align: "center" });
    doc.text("PU", tableX + wDesc + wQty, y + 7, { width: wPU, align: "center" });
    doc.text("Unité", tableX + wDesc + wQty + wPU, y + 7, { width: wUnit, align: "center" });
    doc.text("Total HT", tableX + wDesc + wQty + wPU + wUnit, y + 7, { width: wTotal, align: "center" });

    y += headH;

    // ligne horizontale sous header
    doc.fillColor(DARK);
    drawLine(doc, tableX, y, tableX + tableW, y, 1);

    const maxY = 520;

    // ✅ fonction pour une ligne d’article sans traits verticaux
    function drawRow(it) {
      const descText = it.description || "";

      doc.font("Helvetica").fontSize(10).fillColor(DARK);

      const descHeight = doc.heightOfString(descText, { width: wDesc - 12 });
      const rowH = Math.max(22, descHeight + 10);

      // nouvelle page si nécessaire
      if (y + rowH > maxY) {
        doc.addPage();
        y = 90;

        // refaire header
        drawFilledBox(doc, tableX, y, tableW, headH, HEAD_GRAY);
        drawBox(doc, tableX, y, tableW, headH, 1);

        doc.font("Helvetica-Bold").fontSize(11).fillColor("white");
        doc.text("Descriptions", tableX + 6, y + 7, { width: wDesc - 12, align: "left" });
        doc.text("Qte / M2", tableX + wDesc, y + 7, { width: wQty, align: "center" });
        doc.text("PU", tableX + wDesc + wQty, y + 7, { width: wPU, align: "center" });
        doc.text("Unité", tableX + wDesc + wQty + wPU, y + 7, { width: wUnit, align: "center" });
        doc.text("Total HT", tableX + wDesc + wQty + wPU + wUnit, y + 7, { width: wTotal, align: "center" });

        y += headH;
        drawLine(doc, tableX, y, tableX + tableW, y, 1);
      }

      doc.fillColor(DARK);

// ✅ Description (Helvetica normal)
doc.font("Helvetica").fontSize(10);
doc.text(descText, tableX + 6, y + 6, { width: wDesc - 12, align: "left" });

// ✅ Qté / PU / Total en Courier = pas de bug
doc.font("Courier").fontSize(10);

doc.text(formatMoneySafe(it.quantity), tableX + wDesc, y + 6, {
  width: wQty,
  align: "center",
  lineBreak: false,
});

doc.text(formatMoneySafe(it.unit_price), tableX + wDesc + wQty, y + 6, {
  width: wPU,
  align: "center",
  lineBreak: false,
});

doc.font("Helvetica").fontSize(10);
doc.text(it.unit || "CFA", tableX + wDesc + wQty + wPU, y + 6, {
  width: wUnit,
  align: "center",
  lineBreak: false,
});

// ✅ Total (Courier)
doc.font("Courier").fontSize(10);
doc.text(formatMoneySafe(it.total), tableX + wDesc + wQty + wPU + wUnit, y + 6, {
  width: wTotal,
  align: "center",
  lineBreak: false,
});



      y += rowH;

      // ligne horizontale séparatrice
      drawLine(doc, tableX, y, tableX + tableW, y, 1);
    }

    if (!items || items.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(MUTED);
      doc.text("Aucun article", tableX + 10, y + 8);
      y += 22;
      drawLine(doc, tableX, y, tableX + tableW, y, 1);
    } else {
      for (const it of items) {
        drawRow(it);
      }
    }

    // ✅ bordure extérieure finale du tableau
    drawBox(doc, tableX, startTableY, tableW, y - startTableY, 1);

    // =========================
    // ✅ PAYMENT BOX + TOTALS (comme ton image)
    // =========================
    const payX = tableX;
    const payY = y;
    const payW = 250;
    const payH = 70;

    drawFilledBox(doc, payX, payY, payW, payH, GREEN);

    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10);
    doc.text("Condition de paiement", payX, payY + 8, {
      width: payW,
      align: "center",
    });

    doc.font("Helvetica").fontSize(8).fillColor(DARK);
    doc.text(
      "Les conditions de paiement acceptés incluent le\ncheque, le virement bancaire",
      payX + 10,
      payY + 30,
      { width: payW - 20, align: "center" }
    );

    

// ✅ Totaux à droite
const totX = tableX + tableW - 200;
const totY = payY;
const totW = 200;
const totH = payH;

drawBox(doc, totX, totY, totW, totH, 1);

const rr = totH / 3;
drawLine(doc, totX, totY + rr, totX + totW, totY + rr, 1);
drawLine(doc, totX, totY + rr * 2, totX + totW, totY + rr * 2, 1);

// ✅ Labels
doc.fillColor(DARK).font("Helvetica").fontSize(10);

doc.text("TOTAL HT", totX + 10, totY + 8);
doc.text(`TVA ${invoice.tva_rate}%`, totX + 10, totY + rr + 8);

// ✅ TOTAL TTC label (gras)
doc.font("Helvetica-Bold");
doc.text("TOTAL TTC", totX + 10, totY + rr * 2 + 8);

// ✅ Valeurs alignées à droite (Courier = stable)
doc.font("Courier").fontSize(10);
doc.text(formatMoneySafe(invoice.subtotal), totX + 10, totY + 8, {
  width: totW - 20,
  align: "right",
  lineBreak: false,
});

doc.font("Courier").fontSize(10);
doc.text(formatMoneySafe(invoice.tva_amount), totX + 10, totY + rr + 8, {
  width: totW - 20,
  align: "right",
  lineBreak: false,
});

doc.font("Courier-Bold").fontSize(10);
doc.text(formatMoneySafe(invoice.total), totX + 10, totY + rr * 2 + 8, {
  width: totW - 20,
  align: "right",
  lineBreak: false,
});


    // =========================
    // ✅ SERVICE COMPTABLE
    // =========================
    const serviceX = 310;
    const serviceY = 545;
    const serviceW = 230;
    const serviceH = 26;

    drawFilledBox(doc, serviceX, serviceY, serviceW, serviceH, GREEN);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(14);
    doc.text("SERVICE COMPTABLE", serviceX, serviceY + 6, {
      width: serviceW,
      align: "center",
    });

    // Cachet + Signature
    if (fs.existsSync(cachetPath)) {
      doc.image(cachetPath, 370, 590, { width: 110 });
    }
    if (fs.existsSync(signPath)) {
      doc.image(signPath, 390, 700, { width: 100 });
    }

    // =========================
    // ✅ FOOTER
    // =========================
    doc.font("Helvetica").fontSize(8).fillColor(DARK);
    doc.text(
      "SEYU RENAISSANCE SARL, AU CAPITAL DE 1 000 000 , SIEGE SOCIAL : NDOUKHOURA, ROUTE DE M",
      0,
      780,
      { align: "center" }
    );
    doc.text(
      "NINEA: 010996728 2E2, RCCM: SN.DKR.2024.M.46102",
      0,
      792,
      { align: "center" }
    );

    // ✅ finalize
    doc.end();

    const buffer = await new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
    });

    return { fileName, buffer };
  } catch (err) {
    console.error("PDF BUFFER SERVICE ERROR:", err);

    // ✅ fallback -> mini PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.fontSize(16).text("Erreur génération PDF", { align: "center" });
    doc.fontSize(10).fillColor("#666").text(String(err.message || err), { align: "center" });
    doc.end();

    const buffer = await new Promise((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    return { fileName: "facture.pdf", buffer };
  }
};
