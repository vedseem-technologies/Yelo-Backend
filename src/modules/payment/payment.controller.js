const Razorpay = require("razorpay")
const crypto = require("crypto")
const Order = require("../order/order.model")
const User = require("../user/user.model")

// Initialize Razorpay with test key
// Note: Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables
// The key provided: KqP21tBbBUWeiXP78AKXGJF0
// For test mode, key_id format is usually "rzp_test_XXXX" or just the key part
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "KqP21tBbBUWeiXP78AKXGJF0",
  key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || "YOUR_SECRET_KEY_HERE"
})

// Create Razorpay order
async function createRazorpayOrder(req, res) {
  try {
    const userId = req.user.userId
    const { orderId, amount } = req.body

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Order ID and amount are required"
      })
    }

    // Verify order belongs to user
    const order = await Order.findOne({ _id: orderId, userId })
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }

    // Get user details
    const user = await User.findById(userId).lean()

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      receipt: `order_${orderId}`,
      notes: {
        orderId: orderId.toString(),
        userId: userId.toString()
      }
    }

    const razorpayOrder = await razorpay.orders.create(options)

    // Update order with Razorpay order ID
    await Order.findByIdAndUpdate(orderId, {
      razorpayOrderId: razorpayOrder.id
    })

    res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: razorpay.key_id,
        name: "Yelo Fashion",
        description: `Order #${orderId.toString().slice(-8)}`,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || ""
        }
      }
    })
  } catch (err) {
    console.error("Error creating Razorpay order:", err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// Verify Razorpay payment
async function verifyPayment(req, res) {
  try {
    const userId = req.user.userId
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body

    console.log(`[Payment Controller] Verifying payment for Order ID: ${orderId}`)

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      console.error("[Payment Controller] Missing payment parameters")
      return res.status(400).json({
        success: false,
        message: "All payment parameters are required"
      })
    }

    // Verify order belongs to user
    const order = await Order.findOne({ _id: orderId, userId })
    if (!order) {
      console.error(`[Payment Controller] Order not found: ${orderId}`)
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }

    // Verify signature
    const text = `${razorpayOrderId}|${razorpayPaymentId}`
    const secretKey = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || "YOUR_SECRET_KEY_HERE"
    const generatedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(text)
      .digest("hex")

    if (generatedSignature !== razorpaySignature) {
      console.error("[Payment Controller] Signature verification failed")
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      })
    }

    console.log("[Payment Controller] Signature verified. Proceeding to stock deduction...")

    // --- ONLINE PAYMENT STOCK DEDUCTION START ---
    const { reduceStock } = require("../product/stock.service")
    try {
      const itemsToDeduct = order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
      await reduceStock(itemsToDeduct)
      console.log("[Payment Controller] Stock deducted successfully for Online order.")
    } catch (error) {
      console.error("[Payment Controller] Stock deduction failed for Online order:", error.message)
      // Note: Payment is already successful at Gateway, but stock failed.
      // In a real production system, this should trigger a "Refund" or "Manual Review" workflow.
      // For now, we return an error to the frontend, but the order remains in PLACED/PAID state potentially or we could fail the confirmation.
      // Better approach here: Mark order as "PAYMENT_RECEIVED_STOCK_FAILED" or similar if we want to handle it manually, 
      // OR refund immediately. 
      // As per requirements "Abort order success", we will return error.

      // We should NOT mark order as CONFIRMED.
      return res.status(400).json({
        success: false,
        message: "Payment successful but stock deduction failed. Please contact support.",
        error: error.message
      })
    }
    // --- ONLINE PAYMENT STOCK DEDUCTION END ---

    // Update order with payment details
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED"
      },
      { new: true }
    )
      .populate("items.productId", "name slug images price brand")

    console.log(`[Payment Controller] Order ${orderId} marked as PAID and CONFIRMED.`)

    res.json({
      success: true,
      message: "Payment verified successfully",
      data: updatedOrder
    })
  } catch (err) {
    console.error("[Payment Controller] Error verifying payment:", err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

module.exports = {
  createRazorpayOrder,
  verifyPayment
}

