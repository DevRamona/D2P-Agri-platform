const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const BuyerOrder = require("../models/BuyerOrder");
const Batch = require("../models/Batch");

const scoreOrder = (order) => {
  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const escrowStatus = String(order.escrowStatus || "").toLowerCase();
  const trackingStage = String(order.trackingStage || "").toLowerCase();

  let score = 0;
  if (status === "completed" || escrowStatus === "released" || trackingStage === "delivered") score += 1000;
  if (paymentStatus === "deposit_paid" || escrowStatus === "funded") score += 500;
  if (status === "active") score += 100;
  if (trackingStage === "released_for_delivery") score += 80;
  if (trackingStage === "hub_inspection") score += 60;
  if (trackingStage === "farmer_dispatching") score += 40;
  if (trackingStage === "payment_confirmed") score += 20;

  const timestamp =
    order.completedAt ||
    order.escrowReleasedAt ||
    order.escrowFundedAt ||
    order.paymentConfirmedAt ||
    order.trackingUpdatedAt ||
    order.updatedAt ||
    order.createdAt ||
    new Date(0);

  return { score, timestamp: new Date(timestamp).getTime() };
};

const sortOrdersForKeep = (orders) =>
  [...orders].sort((left, right) => {
    const leftScore = scoreOrder(left);
    const rightScore = scoreOrder(right);
    if (rightScore.score !== leftScore.score) {
      return rightScore.score - leftScore.score;
    }
    return rightScore.timestamp - leftScore.timestamp;
  });

const shouldMarkBatchSold = (order) => {
  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const escrowStatus = String(order.escrowStatus || "").toLowerCase();

  return status === "completed" || paymentStatus === "deposit_paid" || escrowStatus === "funded" || escrowStatus === "released";
};

const cancelDuplicateOrder = async (order, now) => {
  const previousStatus = order.status;
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const escrowStatus = String(order.escrowStatus || "").toLowerCase();

  order.status = "cancelled";
  order.trackingStage = "cancelled";
  order.cancelledAt = now;
  order.trackingUpdatedAt = now;

  if (paymentStatus === "deposit_paid") {
    order.paymentStatus = "refunded";
  }

  if (escrowStatus === "funded") {
    order.escrowStatus = "refunded";
  } else if (escrowStatus === "released") {
    order.escrowStatus = "released";
  } else {
    order.escrowStatus = "awaiting_payment";
  }

  await order.save();

  return {
    batchId: String(order.batch),
    orderId: String(order._id),
    orderNumber: order.orderNumber || null,
    previousStatus,
  };
};

const cleanupDuplicateBatchOrders = async () => {
  const duplicateGroups = await BuyerOrder.aggregate([
    {
      $match: {
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: "$batch",
        orderIds: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ]);

  const summary = {
    duplicateGroups: duplicateGroups.length,
    cancelledOrders: [],
    keptOrders: [],
    manualReview: [],
  };

  for (const group of duplicateGroups) {
    const orders = await BuyerOrder.find({ _id: { $in: group.orderIds } }).sort({ createdAt: -1 });
    const ordered = sortOrdersForKeep(orders);
    const keepOrder = ordered[0];
    const duplicates = ordered.slice(1);
    const settledDuplicates = duplicates.filter((order) => {
      const status = String(order.status || "").toLowerCase();
      const escrowStatus = String(order.escrowStatus || "").toLowerCase();
      return status === "completed" || escrowStatus === "released";
    });

    summary.keptOrders.push({
      batchId: String(group._id),
      orderId: String(keepOrder._id),
      orderNumber: keepOrder.orderNumber || null,
      status: keepOrder.status,
      paymentStatus: keepOrder.paymentStatus,
      escrowStatus: keepOrder.escrowStatus,
    });

    if (settledDuplicates.length > 0) {
      summary.manualReview.push({
        batchId: String(group._id),
        keptOrderNumber: keepOrder.orderNumber || null,
        settledDuplicates: settledDuplicates.map((order) => ({
          orderId: String(order._id),
          orderNumber: order.orderNumber || null,
          status: order.status,
          escrowStatus: order.escrowStatus,
        })),
      });
      continue;
    }

    const now = new Date();
    for (const order of duplicates) {
      const cancelled = await cancelDuplicateOrder(order, now);
      summary.cancelledOrders.push(cancelled);
    }

    if (group._id) {
      if (shouldMarkBatchSold(keepOrder)) {
        await Batch.findByIdAndUpdate(group._id, {
          $set: {
            status: "sold",
            soldAt: keepOrder.completedAt || keepOrder.escrowFundedAt || keepOrder.paymentConfirmedAt || keepOrder.createdAt || now,
          },
        });
      } else {
        await Batch.findByIdAndUpdate(group._id, {
          $set: {
            status: "active",
          },
          $unset: {
            soldAt: 1,
          },
        });
      }
    }
  }

  return summary;
};

const runCleanupScript = async () => {
  await connectDb();
  const summary = await cleanupDuplicateBatchOrders();
  console.log(JSON.stringify(summary, null, 2));
  return summary;
};

if (require.main === module) {
  runCleanupScript()
    .catch((error) => {
      console.error("DUPLICATE_ORDER_CLEANUP_FAILED", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.connection.close();
    });
}

module.exports = {
  cleanupDuplicateBatchOrders,
  runCleanupScript,
  scoreOrder,
  sortOrdersForKeep,
};
