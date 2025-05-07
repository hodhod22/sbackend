const { getPayoutStatus } = require("./paypal");
const User = require("../models/User");

/**
 * Checks the status of all pending payouts and updates the database
 * @returns {Promise<{updated: number, errors: number}>} Statistics about the update
 */
async function checkPendingPayouts() {
  console.log("Checking pending payout statuses...");

  const stats = {
    checked: 0,
    updated: 0,
    errors: 0,
  };

  try {
    // Find users with pending payouts
    const users = await User.find({
      "withdrawalHistory.status": "pending",
      "withdrawalHistory.payoutBatchId": { $exists: true, $ne: null },
    });

    console.log(`Found ${users.length} users with pending payouts`);

    for (const user of users) {
      // Filter to get only pending withdrawals with a batch ID
      const pendingWithdrawals = user.withdrawalHistory.filter(
        (w) => w.status === "pending" && w.payoutBatchId
      );

      stats.checked += pendingWithdrawals.length;

      // Check each pending withdrawal
      for (const withdrawal of pendingWithdrawals) {
        try {
          // Get the current status from PayPal
          const payoutStatus = await getPayoutStatus(withdrawal.payoutBatchId);
          const batchStatus = payoutStatus.batch_header.batch_status;

          // Map PayPal status to our status
          let newStatus = "pending";
          if (batchStatus === "SUCCESS" || batchStatus === "COMPLETED") {
            newStatus = "approved";
          } else if (
            batchStatus === "DENIED" ||
            batchStatus === "FAILED" ||
            batchStatus === "CANCELED"
          ) {
            newStatus = "rejected";
          }

          // Update if status has changed
          if (newStatus !== "pending") {
            console.log(
              `Updating payout ${withdrawal.payoutBatchId} status from pending to ${newStatus}`
            );

            // Find and update this specific withdrawal
            const withdrawalToUpdate = user.withdrawalHistory.id(
              withdrawal._id
            );
            if (withdrawalToUpdate) {
              withdrawalToUpdate.status = newStatus;
              await user.save();
              stats.updated++;
            }
          }
        } catch (error) {
          console.error(
            `Error checking payout ${withdrawal.payoutBatchId}:`,
            error.message
          );
          stats.errors++;
        }
      }
    }

    console.log(
      `Payout status check completed: ${stats.checked} checked, ${stats.updated} updated, ${stats.errors} errors`
    );
    return stats;
  } catch (error) {
    console.error("Error in checkPendingPayouts:", error);
    stats.errors++;
    return stats;
  }
}

module.exports = {
  checkPendingPayouts,
};
