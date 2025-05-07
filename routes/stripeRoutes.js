const stripeController = require("../controllers/stripeController");

const router = require("express").Router();

//Customer

router.post("/create-payment", stripeController.create_payment);

router.post("/confirm/:orderId", stripeController.order_confirm);

module.exports = router;
