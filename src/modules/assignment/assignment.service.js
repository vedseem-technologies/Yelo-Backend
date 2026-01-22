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
      
      console.log(`✅ Created category shop: ${shopSlug} for category: ${product.category}`)
    } catch (error) {
      // If shop creation fails (e.g., duplicate), just get the existing one
      if (error.code === 11000) {
        shop = await Shop.findOne({ slug: shopSlug })
        console.log(`ℹ️ Shop ${shopSlug} already exists, using existing shop`)
      } else {
        console.error(`❌ Error creating shop ${shopSlug}:`, error.message)
        throw error
      }
    }
  }
  
  return shop
}

async function assignProductToShops(product) {
  // Ensure product has majorCategory set correctly
  // If product has a brand, it should be LUXURY (even if majorCategory was set incorrectly)
  let majorCategory = product.majorCategory
  const hasBrand = product.brand && product.brand.trim() !== ''
  
  // If product has brand, it MUST be LUXURY (correct any misclassifications)
  if (hasBrand && majorCategory !== "LUXURY") {
    majorCategory = "LUXURY"
    // Update the product in the database
    await Product.updateOne(
      { _id: product._id },
      { majorCategory: majorCategory }
    )
    // Also update the product object so it's available for criteria matching
    product.majorCategory = majorCategory
  } else if (!majorCategory) {
    // If no majorCategory set, infer from brand presence
    majorCategory = hasBrand ? "LUXURY" : "AFFORDABLE"
    // Update the product in the database
    await Product.updateOne(
      { _id: product._id },
      { majorCategory: majorCategory }
    )
    // Also update the product object so it's available for criteria matching
    product.majorCategory = majorCategory
  }

  // Ensure category-based shop exists for luxury products
  const categoryShop = await ensureCategoryShop(product, majorCategory)

  // Get all shops - products can match shops with matching majorCategory
  const shops = await Shop.find({
    majorCategory: product.majorCategory || majorCategory
  })

  const matchedShopSlugs = []

  for (const shop of shops) {
    // Check if product matches shop criteria
    if (matchesShopCriteria(product, shop.criteria)) {
      matchedShopSlugs.push(shop.slug)
    }
  }

  // IMPORTANT: Ensure all AFFORDABLE products are assigned to appropriate shops
  // Even if they don't match specific criteria, they should at least be in the main "affordable" shop
  if (majorCategory === "AFFORDABLE") {
    const productPrice = product.price || 0
    
    // Ensure affordable products are in the main affordable shop if price <= 2000
    if (productPrice <= 2000 && !matchedShopSlugs.includes('affordable')) {
      matchedShopSlugs.push('affordable')
    }
    
    // Ensure products under ₹999 are assigned to "under-999" shop
    if (productPrice <= 999 && !matchedShopSlugs.includes('under-999')) {
      matchedShopSlugs.push('under-999')
    }
    
    // Ensure products with discount are assigned to "offers" shop
    const hasDiscount = product.discount > 0 || (product.originalPrice && product.originalPrice > product.price)
    if (hasDiscount && productPrice <= 2000 && !matchedShopSlugs.includes('offers')) {
      matchedShopSlugs.push('offers')
    }
    
    // Ensure fresh products (added within 7 days) are assigned to "fresh-arrival" shop
    const productDate = product.dateAdded || product.createdAt
    if (productDate && productPrice <= 2000) {
      const daysSinceAdded = (Date.now() - new Date(productDate)) / (1000 * 60 * 60 * 24)
      if (daysSinceAdded <= 7 && !matchedShopSlugs.includes('fresh-arrival')) {
        matchedShopSlugs.push('fresh-arrival')
      }
    }
    
    // Ensure products with discount added within 7 days are assigned to "todays-deal" shop
    if (hasDiscount && productDate && productPrice <= 2000) {
      const daysSinceAdded = (Date.now() - new Date(productDate)) / (1000 * 60 * 60 * 24)
      if (daysSinceAdded <= 7 && !matchedShopSlugs.includes('todays-deal')) {
        matchedShopSlugs.push('todays-deal')
      }
    }
    
    // Ensure best-selling products (rating >= 4, reviews >= 5) are assigned to "best-sellers" shop
    if (productPrice <= 5000) {
      const rating = product.rating || 0
      const reviews = product.reviews || 0
      if (rating >= 4 && reviews >= 5 && !matchedShopSlugs.includes('best-sellers')) {
        matchedShopSlugs.push('best-sellers')
      }
    }
  }

  // IMPORTANT: Ensure all LUXURY products with brand are assigned to luxury-shop
  // Even if criteria is empty (which it is for luxury-shop), products should still be assigned
  // This handles the case where luxury-shop has empty criteria but should include all luxury products
  if (majorCategory === "LUXURY") {
    // If product has a brand, it MUST be in luxury-shop
    if (product.brand && product.brand.trim() !== '') {
      if (!matchedShopSlugs.includes('luxury-shop')) {
        matchedShopSlugs.push('luxury-shop')
        console.log(`✅ Added luxury-shop to product ${product.name || product._id} (brand: ${product.brand})`)
      }
    }
    // Also ensure luxury-shop exists in database (safety check)
    const luxuryShop = await Shop.findOne({ slug: 'luxury-shop' })
    if (!luxuryShop) {
      console.warn('⚠️ luxury-shop does not exist! Creating it...')
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

  // If product is trending, add "trending" shop to assigned shops
  if (product.isTrending === true) {
    if (!matchedShopSlugs.includes('trending')) {
      matchedShopSlugs.push('trending')
    }
  }

  // Remove duplicates (shouldn't be needed, but safe)
  const uniqueShopSlugs = [...new Set(matchedShopSlugs)]

  // Update the product with assigned shops
  await Product.updateOne(
    { _id: product._id },
    { assignedShops: uniqueShopSlugs }
  )

  return uniqueShopSlugs
}

// ✅ THIS FUNCTION WAS MISSING OR NOT EXPORTED
async function reassignSingleProduct(productId) {
  const product = await Product.findById(productId)
  if (!product) return

  await assignProductToShops(product)
}

// Reassign all products to shops (useful when shop criteria changes)
async function reassignAllProducts() {
  // Use lean() to get plain objects, but we need to convert back for assignment
  const products = await Product.find({ isActive: true }).lean()
  let reassignedCount = 0
  let errorCount = 0
  
  for (const productData of products) {
    try {
      // Convert plain object back to Mongoose document for assignment
      const product = await Product.findById(productData._id)
      if (!product) {
        console.error(`Product ${productData._id} not found`)
        continue
      }
      
      // Ensure majorCategory is set before assignment
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
  
  console.log(`✅ Reassigned ${reassignedCount} products to shops${errorCount > 0 ? ` (${errorCount} errors)` : ''}`)
  return reassignedCount
}

module.exports = {
  assignProductToShops,
  reassignSingleProduct,
  reassignAllProducts
}
