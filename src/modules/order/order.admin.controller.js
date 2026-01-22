const Order = require("./order.model")
const User = require("../user/user.model")

/**
 * Get all orders for admin with full details (paginated)
 */
async function getAllAdminOrders(req, res) {
  try {
    const { status, page = 1, limit = 10 } = req.query
    
    // Build query
    const query = {}
    if (status) {
      query.orderStatus = status.toUpperCase()
    }
    
    // Parse and validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10)) // Max 100 per page
    const skip = (pageNum - 1) * limitNum
    
    // Get total count for pagination info
    const totalOrders = await Order.countDocuments(query)
    
    // Fetch orders with pagination - minimal fields only for list view
    // Only populate essential user fields (no items or vendors to save bandwidth)
    const orders = await Order.find(query)
      .populate({
        path: "userId",
        model: "User", // Explicitly specify model
        select: "name phone email fullName _id", // Include _id and ensure name is selected
        lean: true // Use lean for better performance
      })
      .select("_id orderId userId totalAmount paymentMethod orderStatus createdAt updatedAt") // Only grid-visible fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .maxTimeMS(10000) // 10 second timeout for the query
    
    // Debug: Log userId data structure for first few orders to verify population
    orders.slice(0, 3).forEach((order, index) => {
      if (order.userId) {
        // console.log(`🔍 Order ${index + 1} userId data:`, {
        //   orderId: order._id || order.orderId,
        //   hasUserId: !!order.userId,
        //   userIdType: typeof order.userId,
        //   userIdIsObject: typeof order.userId === 'object',
        //   userIdKeys: order.userId && typeof order.userId === 'object' ? Object.keys(order.userId) : [],
        //   hasName: !!order.userId?.name,
        //   hasFullName: !!order.userId?.fullName,
        //   name: order.userId?.name,
        //   fullName: order.userId?.fullName,
        //   email: order.userId?.email,
        //   phone: order.userId?.phone
        // });
      } else {
        console.warn(`⚠️ Order ${index + 1} has no userId:`, {
          orderId: order._id || order.orderId,
          userId: order.userId
        });
      }
    });
    
    res.json({
      success: true,
      data: orders,
      count: orders.length,
      total: totalOrders,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalOrders / limitNum)
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

/**
 * Get single order by ID for admin
 */
async function getAdminOrderById(req, res) {
  try {
    const { id } = req.params
    const startTime = Date.now()
    
    console.log(`🔍 Fetching order details for ID: ${id}`)
    
    // Fetch order with minimal populate first - just get the basic order
    const order = await Order.findById(id)
      .lean()
      .maxTimeMS(5000) // 5 second timeout for initial fetch
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }
    
    const fetchTime = Date.now() - startTime
    console.log(`✅ Order fetched in ${fetchTime}ms`)
    
    // Populate userId separately with timeout
    if (order.userId) {
      try {
        const userPromise = User.findById(order.userId)
          .select("name phone email avatar fullName _id")
          .lean()
          .maxTimeMS(3000) // 3 second timeout for user
        
        // Add overall timeout
        const userTimeout = new Promise((resolve) => {
          setTimeout(() => resolve(null), 3000)
        })
        
        const user = await Promise.race([userPromise, userTimeout])
        
        if (user) {
          order.userId = user
        } else {
          order.userId = { _id: order.userId, name: 'User not found' }
        }
      } catch (userError) {
        console.warn('⚠️ Failed to populate user:', userError.message)
        order.userId = { _id: order.userId, name: 'Failed to load user' }
      }
    }
    
    // Populate product items separately with timeout
    if (order.items && order.items.length > 0) {
      const Product = require("../product/product.model")
      try {
        const productIds = order.items
          .filter(item => item.productId)
          .map(item => item.productId)
        
        if (productIds.length > 0) {
          const productPromise = Product.find({ _id: { $in: productIds } })
            .select("name slug images price brand vendorSlug sizes colors description")
            .lean()
            .maxTimeMS(5000) // 5 second timeout for products
          
          // Add overall timeout
          const productTimeout = new Promise((resolve) => {
            setTimeout(() => resolve([]), 5000)
          })
          
          const products = await Promise.race([productPromise, productTimeout])
          
          if (products && products.length > 0) {
            const productMap = new Map()
            products.forEach(product => {
              productMap.set(product._id.toString(), product)
            })
            
            // Assign products to items
            order.items.forEach(item => {
              if (item.productId) {
                const product = productMap.get(item.productId.toString())
                if (product) {
                  item.productId = product
                }
              }
            })
          }
        }
      } catch (productError) {
        console.warn('⚠️ Failed to populate products:', productError.message)
        // Continue without products - will show basic order info
      }
    }
    
    // Vendor lookups - completely optional, skip if it takes too long or fails
    const Vendor = require("../vendors/vendors.model")
    if (order.items && order.items.length > 0) {
      const vendorStartTime = Date.now()
      try {
        // Use Promise.race with a timeout to skip vendor lookup if it's slow
        const vendorTimeout = new Promise((resolve) => {
          setTimeout(() => resolve(0), 3000) // 3 second max for all vendors
        })
        
        const vendorSlugs = [...new Set(
          order.items
            .filter(item => item.productId && item.productId.vendorSlug)
            .map(item => item.productId.vendorSlug)
        )]
        
        if (vendorSlugs.length > 0) {
          const vendorPromise = Promise.all(
            vendorSlugs.map(slug =>
              Vendor.findOne({ slug })
                .select("name slug email phone address")
                .lean()
                .maxTimeMS(2000)
                .catch(() => null)
            )
          ).then(vendors => {
            const vendorMap = new Map()
            vendors.forEach((vendor, index) => {
              if (vendor) {
                vendorMap.set(vendorSlugs[index], vendor)
              }
            })
            // Assign vendors to items
            order.items.forEach(item => {
              if (item.productId && item.productId.vendorSlug) {
                const vendor = vendorMap.get(item.productId.vendorSlug)
                if (vendor) {
                  item.productId.vendorId = vendor
                }
              }
            })
            return vendorMap.size
          })
          
          // Race between vendor fetch and timeout - skip vendors if timeout
          const vendorCount = await Promise.race([vendorPromise, vendorTimeout])
          if (vendorCount && vendorCount > 0) {
            console.log(`✅ Vendors populated: ${vendorCount} vendors in ${Date.now() - vendorStartTime}ms`)
          }
        }
      } catch (vendorError) {
        console.warn('⚠️ Vendor lookup skipped (non-critical):', vendorError.message)
        // Continue without vendors - not critical for order details
      }
    }
    
    const totalTime = Date.now() - startTime
    console.log(`✅ Order details fetch completed in ${totalTime}ms`)
    
    // Debug: Log userId data
    if (order.userId) {
      console.log('🔍 Order details userId data:', {
        orderId: order._id || order.orderId,
        hasName: !!order.userId?.name,
        hasFullName: !!order.userId?.fullName,
        name: order.userId?.name || 'MISSING',
        fullName: order.userId?.fullName || 'MISSING',
        email: order.userId?.email || 'MISSING',
        phone: order.userId?.phone || 'MISSING'
      });
    } else {
      console.warn('⚠️ Order has no userId populated:', {
        orderId: order._id || order.orderId,
        userId: order.userId
      });
    }
    
    res.json({
      success: true,
      data: order
    })
  } catch (err) {
    console.error('❌ Error fetching order details:', err.message)
    res.status(err.message === "Order not found" ? 404 : 500).json({
      success: false,
      message: err.message || 'Failed to fetch order details'
    })
  }
}

/**
 * Update order status (admin only)
 */
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      })
    }
    
    const validStatuses = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"]
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      })
    }
    
    const order = await Order.findByIdAndUpdate(
      id,
      { 
        orderStatus: status.toUpperCase(),
        $push: {
          statusHistory: {
            status: status.toUpperCase(),
            updatedAt: new Date()
          }
        }
      },
      { new: true }
    )
      .populate({
        path: "userId",
        select: "name phone email avatar fullName"
      })
      .populate({
        path: "items.productId",
        select: "name slug images price brand vendorSlug sizes colors description"
      })
      .lean()
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }
    
    // Manually populate vendor information from vendorSlug (same as getAllAdminOrders)
    const Vendor = require("../vendors/vendors.model")
    const vendorCache = new Map()
    
    for (const item of order.items || []) {
      if (item.productId && item.productId.vendorSlug) {
        if (vendorCache.has(item.productId.vendorSlug)) {
          item.productId.vendorId = vendorCache.get(item.productId.vendorSlug)
        } else {
          const vendor = await Vendor.findOne({ slug: item.productId.vendorSlug })
            .select("name slug email phone address")
            .lean()
          if (vendor) {
            vendorCache.set(item.productId.vendorSlug, vendor)
            item.productId.vendorId = vendor
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: "Order status updated successfully",
      data: order
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

/**
 * Reassign order to shop (admin only)
 */
async function reassignOrderToShop(req, res) {
  try {
    const { id } = req.params
    const { shopSlug } = req.body
    
    if (!shopSlug) {
      return res.status(400).json({
        success: false,
        message: "shopSlug is required"
      })
    }
    
    const order = await Order.findByIdAndUpdate(
      id,
      { assignedShop: shopSlug },
      { new: true }
    )
      .populate({
        path: "userId",
        select: "name phone email"
      })
      .lean()
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }
    
    res.json({
      success: true,
      message: "Order reassigned to shop successfully",
      data: order
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

/**
 * Complete order (admin only)
 */
async function completeOrderAdmin(req, res) {
  try {
    const { id } = req.params
    
    const order = await Order.findById(id)
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }

    // Check if order is already completed
    if (order.orderStatus === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Order is already completed"
      })
    }

    // Check if order is cancelled
    if (order.orderStatus === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot complete a cancelled order"
      })
    }

    // Update order status to COMPLETED
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { 
        orderStatus: "COMPLETED",
        $push: {
          statusHistory: {
            status: "COMPLETED",
            updatedAt: new Date()
          }
        }
      },
      { new: true }
    )
      .populate({
        path: "userId",
        select: "name phone email avatar fullName"
      })
      .populate({
        path: "items.productId",
        select: "name slug images price brand vendorSlug sizes colors description"
      })
      .lean()
    
    // Manually populate vendor information from vendorSlug
    const Vendor = require("../vendors/vendors.model")
    const vendorCache = new Map()
    
    for (const item of updatedOrder.items || []) {
      if (item.productId && item.productId.vendorSlug) {
        if (vendorCache.has(item.productId.vendorSlug)) {
          item.productId.vendorId = vendorCache.get(item.productId.vendorSlug)
        } else {
          const vendor = await Vendor.findOne({ slug: item.productId.vendorSlug })
            .select("name slug email phone address")
            .lean()
          if (vendor) {
            vendorCache.set(item.productId.vendorSlug, vendor)
            item.productId.vendorId = vendor
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: "Order marked as completed successfully",
      data: updatedOrder
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

module.exports = {
  getAllAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  reassignOrderToShop,
  completeOrderAdmin
}

