const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cron = require("node-cron");
const { reconcilePayments } = require("./controllers/payoutController");

const app = express();
const dotenv = require("dotenv");

dotenv.config();



app.use(
  cors({
    origin: "https://poolbeferest.com", // Allow only your frontend
    credentials: true, // Allow cookies if needed
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Enable trust proxy for cookies to work on deployment
app.set("trust proxy", 1);
mongoose.connect(process.env.MONGO_URI);


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
