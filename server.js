const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cron = require("node-cron");
const { reconcilePayments } = require("./controllers/payoutController");
const { checkPendingPayouts } = require("./utils/payoutStatusChecker");
const path = require("path");

const dotenv = require("dotenv");

dotenv.config();
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3001",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose.connect(process.env.MONGO_URI);

// Routes: auth, payments, accounts

const authRoutes = require("./routes/auth");
const paymentRoutes = require("./routes/payment");
const accountRoutes = require("./routes/account");
const adminRoutes = require("./routes/admin");
const payoutRoutes = require("./routes/payout");
const currencyRoutes = require("./routes/currency");
const apiRoutes = require("./routes/api");
const webhookRoutes = require("./routes/webhook"); // Import the webhook routes
const paypalRoutes = require("./routes/paypalRoutes");
const userRoutes = require("./routes/users");
// Routes
app.use("/api/paypal", paypalRoutes);

app.use("/api", apiRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/webhook", webhookRoutes); // Use the webhook routes
app.use("/api", require("./routes/stripeRoutes"));

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/users", userRoutes);

// Run reconciliation every hour
cron.schedule("0 * * * *", () => {
  console.log("Running payment reconciliation...");
  reconcilePayments();
});

// Set up periodic payout status checking (every 30 minutes)
const PAYOUT_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
console.log({ verifyUserPayments: checkPendingPayouts });

// Initial check after 1 minute (to allow server to fully start)
setTimeout(() => {
  checkPendingPayouts()
    .then((stats) =>
      console.log("Initial payout status check completed:", stats)
    )
    .catch((err) =>
      console.error("Error in initial payout status check:", err)
    );
}, 60 * 1000);

// Regular interval checks
setInterval(() => {
  checkPendingPayouts().catch((err) =>
    console.error("Error in scheduled payout status check:", err)
  );
}, PAYOUT_CHECK_INTERVAL);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
