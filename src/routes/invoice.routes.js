const express = require("express");
const router = express.Router();

const invoiceController = require("../controllers/invoice.controller");
const { authRequired } = require("../middlewares/auth.middleware");

// ✅ Historique des factures
router.get("/", authRequired, invoiceController.getAll);

// ✅ Créer une facture + articles
router.post("/", authRequired, invoiceController.create);

// ✅ Supprimer facture
router.delete("/:id", authRequired, invoiceController.remove);

// ✅ PDF
router.get("/:id/pdf", authRequired, invoiceController.viewPdf);
router.get("/:id/pdf/view", authRequired, invoiceController.viewPdf);
router.get("/:id/pdf/download", authRequired, invoiceController.downloadPdf);
router.get("/:id/print", authRequired, invoiceController.printPage);

module.exports = router;
