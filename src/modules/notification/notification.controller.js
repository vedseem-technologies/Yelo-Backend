const Order = require("../order/order.model")
const Cart = require("../cart/cart.model")
const Wishlist = require("../wishlist/wishlist.model")
const Product = require("../product/product.model")

/**
 * Get related products based on user's purchases, cart, and wishlist
 * Returns new products related to items the user has interacted with
 */
async function getRelatedProducts(req, res) {
  try {
    const userId = req.user.userId
    const { days = 7, limit = 50 } = req.query

    // Calculate date threshold (products added in last N days)
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(days))

    // 1. Get user's purchased products (from orders)
    const orders = await Order.find({ userId }, null, { allowDiskUse: true })
      .populate("items.productId", "category brand subcategory productType assignedShops majorCategory")
      .lean()

    const purchasedProductIds = new Set()
    const purchasedCategories = new Set()
    const purchasedBrands = new Set()
    const purchasedSubcategories = new Set()
    const purchasedProductTypes = new Set()
    const purchasedShops = new Set()
    const purchasedMajorCategories = new Set()

    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.productId) {
          const product = item.productId
          purchasedProductIds.add(product._id.toString())
          
          if (product.category) purchasedCategories.add(product.category)
          if (product.brand) purchasedBrands.add(product.brand)
          if (product.subcategory) purchasedSubcategories.add(product.subcategory)
          if (product.productType) purchasedProductTypes.add(product.productType)
          if (product.majorCategory) purchasedMajorCategories.add(product.majorCategory)
          
          if (product.assignedShops && Array.isArray(product.assignedShops)) {
            product.assignedShops.forEach(shop => purchasedShops.add(shop))
          }
        }
      })
    })

    // 2. Get user's cart products
    const cart = await Cart.findOne({ userId })
      .populate("items.productId", "category brand subcategory productType assignedShops majorCategory")
      .lean()

    const cartProductIds = new Set()
    if (cart && cart.items) {
      cart.items.forEach(item => {
        if (item.productId) {
          const product = item.productId
          cartProductIds.add(product._id.toString())
          
          if (product.category) purchasedCategories.add(product.category)
          if (product.brand) purchasedBrands.add(product.brand)
          if (product.subcategory) purchasedSubcategories.add(product.subcategory)
          if (product.productType) purchasedProductTypes.add(product.productType)
          if (product.majorCategory) purchasedMajorCategories.add(product.majorCategory)
          
          if (product.assignedShops && Array.isArray(product.assignedShops)) {
            product.assignedShops.forEach(shop => purchasedShops.add(shop))
          }
        }
      })
    }

    // 3. Get user's wishlist products
    const wishlist = await Wishlist.findOne({ userId })
      .populate("products", "category brand subcategory productType assignedShops majorCategory")
      .lean()

    const wishlistProductIds = new Set()
    if (wishlist && wishlist.products) {
      wishlist.products.forEach(product => {
        if (product) {
          wishlistProductIds.add(product._id.toString())
          
          if (product.category) purchasedCategories.add(product.category)
          if (product.brand) purchasedBrands.add(product.brand)
          if (product.subcategory) purchasedSubcategories.add(product.subcategory)
          if (product.productType) purchasedProductTypes.add(product.productType)
          if (product.majorCategory) purchasedMajorCategories.add(product.majorCategory)
          
          if (product.assignedShops && Array.isArray(product.assignedShops)) {
            product.assignedShops.forEach(shop => purchasedShops.add(shop))
          }
        }
      })
    }

    // Combine all product IDs that user has interacted with
    const allInteractedProductIds = new Set([
      ...purchasedProductIds,
      ...cartProductIds,
      ...wishlistProductIds
    ])

    // If user has no purchases, cart, or wishlist, return empty array
    if (allInteractedProductIds.size === 0 && 
        purchasedCategories.size === 0 && 
        purchasedBrands.size === 0 &&
        purchasedSubcategories.size === 0 &&
        purchasedProductTypes.size === 0 &&
        purchasedShops.size === 0 &&
        purchasedMajorCategories.size === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      })
    }

    // 4. Find new products related to user's interests
    // Products must:
    // - Be active
    // - Be added recently (after dateThreshold)
    // - Match at least one: category, brand, subcategory, productType, assignedShops, or majorCategory
    // - NOT be in user's purchased/cart/wishlist already

    const matchConditions = []

    // Match by category
    if (purchasedCategories.size > 0) {
      matchConditions.push({ category: { $in: Array.from(purchasedCategories) } })
    }

    // Match by brand
    if (purchasedBrands.size > 0) {
      matchConditions.push({ brand: { $in: Array.from(purchasedBrands) } })
    }

    // Match by subcategory
    if (purchasedSubcategories.size > 0) {
      matchConditions.push({ subcategory: { $in: Array.from(purchasedSubcategories) } })
    }

    // Match by productType
    if (purchasedProductTypes.size > 0) {
      matchConditions.push({ productType: { $in: Array.from(purchasedProductTypes) } })
    }

    // Match by assignedShops
    if (purchasedShops.size > 0) {
      matchConditions.push({ assignedShops: { $in: Array.from(purchasedShops) } })
    }

    // Match by majorCategory
    if (purchasedMajorCategories.size > 0) {
      matchConditions.push({ majorCategory: { $in: Array.from(purchasedMajorCategories) } })
    }

    // If no match conditions, return empty
    if (matchConditions.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      })
    }

    // Build query - optimize to avoid complex query planner
    const query = {
      isActive: true,
      createdAt: { $gte: dateThreshold },
      $or: matchConditions // Match at least one condition
    }

    // Find related products with allowDiskUse for large sorts
    let relatedProducts = await Product.find(query, null, { allowDiskUse: true })
      .sort({ createdAt: -1 }) // Newest first
      .limit(parseInt(limit) * 2) // Get more initially to filter out excluded ones
      .lean()
    
    // Filter out products user already has (client-side filtering to avoid complex $nin)
    if (allInteractedProductIds.size > 0) {
      relatedProducts = relatedProducts.filter(
        product => !allInteractedProductIds.has(product._id.toString())
      )
    }
    
    // Limit to requested amount after filtering
    relatedProducts = relatedProducts.slice(0, parseInt(limit))

    // Format products as notifications
    const notifications = relatedProducts.map(product => {
      // Determine notification type based on match
      let matchReason = "New product"
      if (product.category && purchasedCategories.has(product.category)) {
        matchReason = `New in ${product.category}`
      } else if (product.brand && purchasedBrands.has(product.brand)) {
        matchReason = `New from ${product.brand}`
      } else if (product.subcategory && purchasedSubcategories.has(product.subcategory)) {
        matchReason = `New in ${product.subcategory}`
      } else if (product.productType && purchasedProductTypes.has(product.productType)) {
        matchReason = `New ${product.productType}`
      } else if (product.majorCategory && purchasedMajorCategories.has(product.majorCategory)) {
        matchReason = `New in ${product.majorCategory} collection`
      }

      // Calculate time ago
      const timeDiff = Date.now() - new Date(product.createdAt).getTime()
      const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60))
      const minutesAgo = Math.floor(timeDiff / (1000 * 60))

      let timeAgo = "Just now"
      if (daysAgo > 0) {
        timeAgo = `${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`
      } else if (hoursAgo > 0) {
        timeAgo = `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`
      } else if (minutesAgo > 0) {
        timeAgo = `${minutesAgo} ${minutesAgo === 1 ? 'minute' : 'minutes'} ago`
      }

      return {
        id: product._id.toString(),
        type: "new_product",
        title: matchReason,
        message: product.name,
        product: {
          id: product._id.toString(),
          name: product.name,
          slug: product.slug,
          baseSlug: product.baseSlug,
          vendorSlug: product.vendorSlug,
          price: product.price,
          originalPrice: product.originalPrice,
          images: product.images || [],
          brand: product.brand,
          category: product.category,
          emoji: product.emoji
        },
        timeAgo,
        createdAt: product.createdAt,
        read: false
      }
    })

    res.json({
      success: true,
      data: notifications,
      count: notifications.length
    })

  } catch (err) {
    console.error("Error fetching related products:", err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

module.exports = {
  getRelatedProducts
}
