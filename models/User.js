const mongoose = require("mongoose");
const withdrawalSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  iban: { type: String, required: true },
  previousBalance: { type: Number, required: true }, // New field
  newBalance: { type: Number, required: true }, // New field
  phone: { type: String },
  email: { type: String },
  description: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  date: { type: Date, default: Date.now }, // Ensures default valid date
});
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  accountNumber: { type: String, unique: true, required: true },
  role: { type: String, default: "user" },
  balance: {
    USD: { type: Number, default: 0 },
    GBP: { type: Number, default: 0 },
    EUR: { type: Number, default: 0 },
    IRR: { type: Number, default: 0 },
  },
  withdrawalHistory: [withdrawalSchema],
  pendingPayments: [
    {
      authority: { type: String, required: true },
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
      status: { type: String, default: "pending" },
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
