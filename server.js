const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const cron = require("node-cron");
const { reconcilePayments } = require("./controllers/payoutController");

const app = express();
const dotenv = require("dotenv");

dotenv.config();

// Import your user model
const User = require("./models/User");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(
  cors({
    origin: ["https://vercelone-pi.vercel.app"],
    credentials: true,
  })
);
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../dist")));

// Handle React routing, return all requests to React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
// Routes: auth, payments, accounts
const authRoutes = require("./routes/auth");
const paymentRoutes = require("./routes/payment");
const accountRoutes = require("./routes/account");
const adminRoutes = require("./routes/admin");
const payoutRoutes = require("./routes/payment");
const currencyRoutes = require("./routes/currency");
const apiRoutes = require("./routes/api");
const webhookRoutes = require("./routes/webhook"); // Import the webhook routes
// Routes
app.use("/api", apiRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/webhook", webhookRoutes); // Use the webhook routes
app.use("/api", require("./routes/stripeRoutes"));

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/payouts", payoutRoutes);
app.get("/", (req, res) => res.send("My backend"));
// Run reconciliation every hour
cron.schedule("0 * * * *", () => {
  console.log("Running payment reconciliation...");
  reconcilePayments();
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
