const express = require("express");
const router = express.Router();

const clientController = require("../controllers/client.controller");
const { authRequired } = require("../middlewares/auth.middleware");

router.get("/", authRequired, clientController.getAll);
router.post("/", authRequired, clientController.create);

module.exports = router;
