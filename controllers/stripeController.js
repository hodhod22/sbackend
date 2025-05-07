const { responseReturn } = require("../utiles/response");
const User = require("../models/User");
const stripe = require("stripe")(
  "STRIPE_SECRET_KEY"
);
class stripeController {
  create_payment = async (req, res) => {
    const { price } = req.body;

    try {
      const payment = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      responseReturn(res, 200, { clientSecret: payment.client_secret });
    } catch (error) {
      console.log(error.message);
    }
  };
  // End Method
  order_confirm = async (req, res) => {
    const { orderId } = req.params;
    const { price, accountNum } = req.body;
    try {
      let user;
      user = await User.findById(orderId);
      user.balance["USD"] += parseInt(price);
      
      await user.save();
      responseReturn(res, 200, { message: "success" });
    } catch (error) {
      console.error("Transfer error: ", error);
      res
        .status(500)
        .json({ message: "Something went wrong. Please try again." });
    }
  };
  // End Method
}

module.exports = new stripeController();
