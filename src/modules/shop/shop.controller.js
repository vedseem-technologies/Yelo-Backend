const {
  getAllShops,
  getShopBySlug,
  createShop,
  updateShop,
  deleteShop
} = require("./shop.service")

const { getProductsByShop } = require("../product/product.service")

async function fetchAllShops(req, res) {
  try {
    const shops = await getAllShops()
    res.json({
      success: true,
      data: shops
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

async function fetchShopBySlug(req, res) {
  try {
    const { slug } = req.params
    const shop = await getShopBySlug(slug)
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found"
      })
    }

    res.json({
      success: true,
      data: shop
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

async function fetchShopProducts(req, res) {
  try {
    const { slug } = req.params
    const { sort, page = 1, limit = 6, ...filters } = req.query

    const data = await getProductsByShop({
      shopSlug: slug,
      sort,
      filters,
      page: Number(page),
      limit: Number(limit)
    })

    res.json({
      success: true,
      data: data.products || [],
      pagination: data.pagination || {
        page: Number(page),
        limit: Number(limit),
        total: 0,
        pages: 0,
        hasMore: false
      }
    })
  } catch (err) {
    console.error('Error in fetchShopProducts:', err)
    // Return empty array instead of error to prevent 404
    res.json({
      success: true,
      data: [],
      pagination: {
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 6),
        total: 0,
        pages: 0,
        hasMore: false
      }
    })
  }
}

async function createShopHandler(req, res) {
  try {
    const shopData = req.body
    
    // Validate required fields
    if (!shopData.slug || !shopData.name || !shopData.route || !shopData.majorCategory || !shopData.shopType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: slug, name, route, majorCategory, shopType"
      })
    }

    // Check if shop with slug already exists
    const existingShop = await getShopBySlug(shopData.slug)
    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: "Shop with this slug already exists"
      })
    }

    const shop = await createShop(shopData)
    
    res.status(201).json({
      success: true,
      data: shop,
      message: "Shop created successfully. All existing products are being reassigned to shops."
    })
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

async function updateShopHandler(req, res) {
  try {
    const { slug } = req.params
    const updateData = req.body

    // Don't allow updating slug (it's used as identifier)
    if (updateData.slug && updateData.slug !== slug) {
      return res.status(400).json({
        success: false,
        message: "Cannot change shop slug"
      })
    }

    const shop = await updateShop(slug, updateData)
    
    res.json({
      success: true,
      data: shop,
      message: "Shop updated successfully. All existing products are being reassigned to shops."
    })
  } catch (err) {
    if (err.message === "Shop not found") {
      return res.status(404).json({
        success: false,
        message: err.message
      })
    }
    res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

async function deleteShopHandler(req, res) {
  try {
    const { slug } = req.params
    
    // Prevent deletion of critical shops
    const criticalShops = ["affordable", "luxury-shop"]
    if (criticalShops.includes(slug)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete critical shop"
      })
    }

    const shop = await deleteShop(slug)
    
    res.json({
      success: true,
      data: shop,
      message: "Shop deleted successfully. All existing products are being reassigned to shops."
    })
  } catch (err) {
    if (err.message === "Shop not found") {
      return res.status(404).json({
        success: false,
        message: err.message
      })
    }
    res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

async function reassignProductsHandler(req, res) {
  try {
    const { reassignAllProducts } = require("../assignment/assignment.service")
    const count = await reassignAllProducts()
    
    res.json({
      success: true,
      message: `Successfully reassigned ${count} products to shops`,
      reassignedCount: count
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

module.exports = {
  fetchAllShops,
  fetchShopBySlug,
  fetchShopProducts,
  createShopHandler,
  updateShopHandler,
  deleteShopHandler,
  reassignProductsHandler
}
