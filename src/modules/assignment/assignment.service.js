const Shop = require("../shop/shop.model")
const Product = require("../product/product.model")
const matchesShopCriteria = require("./criteriaMatcher")

/**
 * Generate a slug from category name
 * Converts "Women's Wear" to "womens-wear"
 */
function generateCategorySlug(category) {
  return category
    .toLowerCase()
    .replace(/'/g, '') // Remove apostrophes
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Ensure category-based shop exists for luxury products
 */
async function ensureCategoryShop(product, majorCategory) {
  // Only create category shops for LUXURY products with categories
  if (majorCategory !== "LUXURY" || !product.category) {
    return null
  }

  const categorySlug = generateCategorySlug(product.category)
  const shopSlug = `luxury-${categorySlug}`
  
  // Check if shop already exists
  let shop = await Shop.findOne({ slug: shopSlug })
  
  if (!shop) {
    // Ensure luxury-shop exists first (parent shop)
    const parentShop = await Shop.findOne({ slug: "luxury-shop" })
    if (!parentShop) {
      console.warn("⚠️ Parent shop 'luxury-shop' doesn't exist. Creating it first...")
      await Shop.create({
        slug: "luxury-shop",
        name: "Luxury Collection",
        route: "/luxury/shop",
        majorCategory: "LUXURY",
        shopType: "BRAND_BASED",
        criteria: {},
        defaultSort: "newest",
        hasSidebar: false,
        hasBottomBar: false,
        uiTheme: "luxury"
      })
    }
    
    // Create the shop
    const shopName = `Luxury ${product.category}`
    const route = `/luxury/shop/${categorySlug}`
    
    // Normalize category for matching (handle variations)
    const categoryForMatch = product.category.toLowerCase().replace(/'/g, '').trim()
    
    try {
      shop = await Shop.create({
        slug: shopSlug,
        name: shopName,
        route: route,
        majorCategory: "LUXURY",
        shopType: "CATEGORY_BASED",
        parentShopSlug: "luxury-shop",
        criteria: {
          categoryMatch: categoryForMatch
        },
        defaultSort: "newest",
        hasSidebar: false,
        hasBottomBar: false,
        uiTheme: "luxury"
      })
      
    } catch (error) {
   
      if (error.code === 11000) {
        shop = await Shop.findOne({ slug: shopSlug })
      } else {
        console.error(` Error creating shop ${shopSlug}:`, error.message)
        throw error
      }
    }
  }
  
  return shop
}

async function assignProductToShops(product) {
 
  let majorCategory = product.majorCategory
  const hasBrand = product.brand && product.brand.trim() !== ''
  

  if (hasBrand && majorCategory !== "LUXURY") {
    majorCategory = "LUXURY"
    await Product.updateOne(
      { _id: product._id },
      { majorCategory: majorCategory }
    )
   
    product.majorCategory = majorCategory
  } else if (!majorCategory) {
    majorCategory = hasBrand ? "LUXURY" : "AFFORDABLE"
    await Product.updateOne(
      { _id: product._id },
      { majorCategory: majorCategory }
    )
    
    product.majorCategory = majorCategory
  }

  const categoryShop = await ensureCategoryShop(product, majorCategory)

  
  const shops = await Shop.find({
    majorCategory: product.majorCategory || majorCategory
  })

  const matchedShopSlugs = []

  for (const shop of shops) {
    if (matchesShopCriteria(product, shop.criteria)) {
      matchedShopSlugs.push(shop.slug)
    }
  }

  if (majorCategory === "AFFORDABLE") {
    const productPrice = product.price || 0
    
    if (productPrice <= 2000 && !matchedShopSlugs.includes('affordable')) {
      matchedShopSlugs.push('affordable')
    }
    
    if (productPrice <= 999 && !matchedShopSlugs.includes('under-999')) {
      matchedShopSlugs.push('under-999')
    }
    
    const hasDiscount = product.discount > 0 || (product.originalPrice && product.originalPrice > product.price)
    if (hasDiscount && productPrice <= 2000 && !matchedShopSlugs.includes('offers')) {
      matchedShopSlugs.push('offers')
    }
    
    const productDate = product.dateAdded || product.createdAt
    if (productDate && productPrice <= 2000) {
      const daysSinceAdded = (Date.now() - new Date(productDate)) / (1000 * 60 * 60 * 24)
      if (daysSinceAdded <= 7 && !matchedShopSlugs.includes('fresh-arrival')) {
        matchedShopSlugs.push('fresh-arrival')
      }
    }
    
    if (hasDiscount && productDate && productPrice <= 2000) {
      const daysSinceAdded = (Date.now() - new Date(productDate)) / (1000 * 60 * 60 * 24)
      if (daysSinceAdded <= 7 && !matchedShopSlugs.includes('todays-deal')) {
        matchedShopSlugs.push('todays-deal')
      }
    }
    
    if (productPrice <= 5000) {
      const rating = product.rating || 0
      const reviews = product.reviews || 0
      if (rating >= 4 && reviews >= 5 && !matchedShopSlugs.includes('best-sellers')) {
        matchedShopSlugs.push('best-sellers')
      }
    }
  }

  if (majorCategory === "LUXURY") {
    // If product has a brand, it MUST be in luxury-shop
    if (product.brand && product.brand.trim() !== '') {
      if (!matchedShopSlugs.includes('luxury-shop')) {
        matchedShopSlugs.push('luxury-shop')
      }
    }
    const luxuryShop = await Shop.findOne({ slug: 'luxury-shop' })
    if (!luxuryShop) {
      console.warn(' luxury-shop does not exist! Creating it...')
      await Shop.create({
        slug: "luxury-shop",
        name: "Luxury Collection",
        route: "/luxury/shop",
        majorCategory: "LUXURY",
        shopType: "BRAND_BASED",
        criteria: {},
        defaultSort: "newest",
        hasSidebar: false,
        hasBottomBar: false,
        uiTheme: "luxury"
      })
    }
  }

  if (product.isTrending === true) {
    if (!matchedShopSlugs.includes('trending')) {
      matchedShopSlugs.push('trending')
    }
  }

  const uniqueShopSlugs = [...new Set(matchedShopSlugs)]

  await Product.updateOne(
    { _id: product._id },
    { assignedShops: uniqueShopSlugs }
  )

  return uniqueShopSlugs
}

async function reassignSingleProduct(productId) {
  const product = await Product.findById(productId)
  if (!product) return

  await assignProductToShops(product)
}
async function reassignAllProducts() {
  
  const products = await Product.find({ isActive: true }).lean()
  let reassignedCount = 0
  let errorCount = 0
  
  for (const productData of products) {
    try {
   
      const product = await Product.findById(productData._id)
      if (!product) {
        console.error(`Product ${productData._id} not found`)
        continue
      }
      
      if (!product.majorCategory) {
        product.majorCategory = (product.brand && product.brand.trim() !== '') ? "LUXURY" : "AFFORDABLE"
        await Product.updateOne(
          { _id: product._id },
          { majorCategory: product.majorCategory }
        )
      }
      
      await assignProductToShops(product)
      reassignedCount++
    } catch (error) {
      errorCount++
      console.error(`Error reassigning product ${productData._id} (${productData.name}):`, error.message)
      console.error(error.stack)
    }
  }
  
  return reassignedCount
}

module.exports = {
  assignProductToShops,
  reassignSingleProduct,
  reassignAllProducts
}
