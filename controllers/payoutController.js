const axios = require("axios");
const User = require("../models/User");

exports.requestPayout = async (req, res) => {
  const { amount, description, callback_url, mobile, email, userId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.balance.IRR < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const response = await axios.post(
      "https://sandbox.zarinpal.com/pg/v4/payment/request.json",
      {
        merchant_id: process.env.ZARINPAL_MERCHANT_ID,
        amount: amount,
        description: description,
        callback_url: callback_url,
        mobile: mobile,
        email: email,
      }
    );

    const { authority } = response.data.data;

    user.pendingPayments.push({
      authority: authority,
      amount: amount,
      currency: "IRR",
      status: "pending",
    });
    // Create a pending payout record
  
    await user.save();

    res.json({
      paymentUrl: `https://sandbox.zarinpal.com/pg/StartPay/${authority}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
//end
const reconcilePayments = async () => {
  try {
    // Find all users with pending payments
    const users = await User.find({ "pendingPayments.status": "pending" });

    for (const user of users) {
      for (const payment of user.pendingPayments) {
        if (payment.status === "pending") {
          // Verify the payment with Zarinpal
          const verifyResponse = await axios.post(
            "https://sandbox.zarinpal.com/pg/v4/payment/verify.json",
            {
              merchant_id: process.env.ZARINPAL_MERCHANT_ID,
              authority: payment.authority,
              amount: payment.amount,
            }
          );

          const { code, ref_id } = verifyResponse.data.data;

          if (code === 100) {
            // Payment was successful
            payment.status = "approved";
            user.balance.IRR -= payment.amount;

            // Add to withdrawal history
            user.withdrawalHistory.push({
              amount: payment.amount,
              iban: "user_iban", // Replace with actual IBAN
              previousBalance: user.balance.IRR + payment.amount,
              newBalance: user.balance.IRR,
              phone: user.phone,
              email: user.email,
              description: "Withdrawal via Zarinpal",
              status: "approved",
            });
          } else {
            // Payment failed
            payment.status = "rejected";
          }

          await user.save();
        }
      }
    }
  } catch (error) {
    console.error("Error reconciling payments:", error);
  }
};
//end

exports.verifyPayout = async (req, res) => {
  const { authority, status } = req.query;
  
  try {
    const user = await User.findOne({ "pendingPayments.authority": authority });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pendingPayment = user.pendingPayments.find(
      (payment) => payment.authority === authority
    );

    if (status === "OK") {
      const verifyResponse = await axios.post(
        "https://sandbox.zarinpal.com/pg/v4/payment/verify.json",
        {
          merchant_id: process.env.ZARINPAL_MERCHANT_ID,
          authority: authority,
          amount: pendingPayment.amount,
        }
      );

      const { code, ref_id } = verifyResponse.data.data;

      if (code === 100) {
        pendingPayment.status = "approved";
        user.balance.IRR -= pendingPayment.amount;

        user.withdrawalHistory.push({
          amount: pendingPayment.amount,
          iban: "user_iban", // Replace with actual IBAN
          previousBalance: user.balance.IRR + pendingPayment.amount,
          newBalance: user.balance.IRR,
          phone: user.phone,
          email: user.email,
          description: "Withdrawal via Zarinpal",
          status: "approved",
        });

        await user.save();

        res.json({ message: "Payment successful", ref_id });
      } else {
        pendingPayment.status = "rejected";
        await user.save();

        res.status(400).json({ message: "Payment failed" });
      }
    } else {
      pendingPayment.status = "rejected";
      await user.save();

      res.status(400).json({ message: "Payment not successful" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

