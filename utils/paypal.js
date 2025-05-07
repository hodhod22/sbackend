const checkoutSDK = require("@paypal/checkout-server-sdk");
const payoutSDK = require("@paypal/payouts-sdk");
const dotenv = require("dotenv");
const fetch = require("node-fetch");

// Load environment variables
dotenv.config();

// Store access token
let paypalAccessToken = null;
let tokenExpiry = null;

// Function to get a fresh access token
async function getPayPalAccessToken() {
  // If we have a valid token that's not expired, return it
  if (paypalAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return paypalAccessToken;
  }

  // Otherwise, get a new token
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET_KEY;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials missing. Check your .env file.");
  }

  try {
    console.log("Getting new PayPal access token...");

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: "grant_type=client_credentials",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("PayPal token error:", data);
      throw new Error(
        `Failed to get PayPal token: ${
          data.error_description || "Unknown error"
        }`
      );
    }

    // Set the token and expiry (subtract 5 minutes for safety)
    paypalAccessToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000 - 5 * 60 * 1000;

    console.log("PayPal token obtained successfully");
    return paypalAccessToken;
  } catch (error) {
    console.error("Error getting PayPal token:", error);
    throw error;
  }
}

// Set up PayPal environment
const environment = new checkoutSDK.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET_KEY
);

// Create clients for different SDKs
const checkoutClient = new checkoutSDK.core.PayPalHttpClient(environment);

// Create an order
const createOrder = async (amount, currency) => {
  const request = new checkoutSDK.orders.OrdersCreateRequest();
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount,
        },
      },
    ],
  });

  const response = await checkoutClient.execute(request);
  return response.result;
};

// Capture payment
const captureOrder = async (orderID) => {
  const request = new checkoutSDK.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  const response = await checkoutClient.execute(request);
  return response.result;
};

// Create a payout to PayPal account using direct API call
const createPaypalAccountPayout = async (email, amount, currency, note) => {
  if (!email) {
    throw new Error("Email is required for PayPal account payout");
  }

  // Clean and validate email
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new Error("Invalid email format");
  }

  const token = await getPayPalAccessToken();

  const requestBody = {
    sender_batch_header: {
      sender_batch_id: `Payout_${Date.now()}`,
      email_subject: "You have a payout!",
      email_message:
        "You have received a payout! Thanks for using our service!",
    },
    items: [
      {
        recipient_type: "EMAIL",
        receiver: cleanEmail,
        note: note || "PayPal payout",
        sender_item_id: `Payout_Item_${Date.now()}`,
        amount: {
          value: amount.toString(),
          currency: currency,
        },
      },
    ],
  };

  try {
    console.log(
      "Sending payout request:",
      JSON.stringify(requestBody, null, 2)
    );

    const response = await fetch(
      "https://api-m.sandbox.paypal.com/v1/payments/payouts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("PayPal payout error:", data);
      throw new Error(`PayPal payout failed: ${JSON.stringify(data)}`);
    }

    console.log("PayPal API response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("PayPal payout error:", {
      message: error.message,
      details: error.details,
      name: error.name,
    });
    throw error;
  }
};

// Create a payout to bank account (IBAN) using direct API call
const createBankPayout = async (
  iban,
  amount,
  currency,
  recipientName,
  note
) => {
  if (!iban || !recipientName) {
    throw new Error("IBAN and recipient name are required for bank payout");
  }

  // For sandbox testing, we'll use a reliable approach with EMAIL recipient type
  // In production, you would use actual bank account details

  const token = await getPayPalAccessToken();

  // Generate a unique batch ID
  const batchId = `Bank_Payout_${Date.now()}`;

  // Create a test email from the IBAN (for sandbox testing only)
  const testEmail = `sb-${iban
    .substring(0, 8)
    .toLowerCase()}@business.example.com`;

  const requestBody = {
    sender_batch_header: {
      sender_batch_id: batchId,
      email_subject: "You have a payout!",
      email_message: "You have received a payout from our service.",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: amount.toString(),
          currency: currency,
        },
        receiver: testEmail,
        note: note || `Bank transfer payout (IBAN: ${iban})`,
        sender_item_id: `Item_${batchId}`,
      },
    ],
  };

  try {
    console.log(
      "Sending bank payout request (using EMAIL method for sandbox):",
      JSON.stringify(requestBody, null, 2)
    );

    const response = await fetch(
      "https://api-m.sandbox.paypal.com/v1/payments/payouts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Bank payout error:", data);
      throw new Error(`Bank payout failed: ${JSON.stringify(data)}`);
    }

    // Store the original IBAN in the response for reference
    data.original_iban = iban;
    data.recipient_name = recipientName;

    console.log("PayPal API response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("Bank payout error:", {
      message: error.message,
      details: error.details,
      name: error.name,
    });
    throw error;
  }
};

// Create a payout to card using direct API call
const createCardPayout = async (
  cardNumber,
  amount,
  currency,
  recipientName,
  note
) => {
  if (!cardNumber || !recipientName) {
    throw new Error(
      "Card number and recipient name are required for card payout"
    );
  }

  const cleanCardNumber = cardNumber.trim().replace(/\s/g, "");
  const cleanRecipientName = recipientName.trim();
  const last4 = cleanCardNumber.slice(-4);

  // For sandbox testing, we'll use a reliable approach with EMAIL recipient type
  // In production, you would use actual card details

  const token = await getPayPalAccessToken();

  // Generate a unique batch ID
  const batchId = `Card_Payout_${Date.now()}`;

  // Create a test email from the card number (for sandbox testing only)
  const testEmail = `sb-card${last4}@business.example.com`;

  const requestBody = {
    sender_batch_header: {
      sender_batch_id: batchId,
      email_subject: "You have a card payout!",
      email_message: "You have received a payout to your card.",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: amount.toString(),
          currency: currency,
        },
        receiver: testEmail,
        note: note || `Card payout (Last 4: ${last4})`,
        sender_item_id: `Item_${batchId}`,
      },
    ],
  };

  try {
    console.log(
      "Sending card payout request (using EMAIL method for sandbox):",
      JSON.stringify(requestBody, null, 2)
    );

    const response = await fetch(
      "https://api-m.sandbox.paypal.com/v1/payments/payouts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Card payout error:", data);
      throw new Error(`Card payout failed: ${JSON.stringify(data)}`);
    }

    // Store the original card info in the response for reference
    data.original_card_last4 = last4;
    data.recipient_name = cleanRecipientName;

    console.log("PayPal API response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("Card payout error:", {
      message: error.message,
      details: error.details,
      name: error.name,
    });
    throw error;
  }
};

// Get payout status using direct API call
const getPayoutStatus = async (payoutBatchId) => {
  const token = await getPayPalAccessToken();

  try {
    const response = await fetch(
      `https://api-m.sandbox.paypal.com/v1/payments/payouts/${payoutBatchId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Payout status error:", data);
      throw new Error(`Failed to get payout status: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    console.error("Error getting payout status:", error);
    throw error;
  }
};

module.exports = {
  createOrder,
  captureOrder,
  createPaypalAccountPayout,
  createBankPayout,
  createCardPayout,
  getPayoutStatus,
};
