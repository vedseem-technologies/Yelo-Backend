const Category = require("./category.model")
const Product = require("../product/product.model")

/**
 * Auto-create or update category
 */
async function ensureCategory(categoryName, productType = null, majorCategory = "ALL") {
  if (!categoryName) return null

  const categorySlug = categoryName.toLowerCase().replace(/\s+/g, "-")
  
  let category = await Category.findOne({ slug: categorySlug })
  
  if (!category) {
    // Create new category
    category = await Category.create({
      name: categoryName,
      slug: categorySlug,
      majorCategory,
      subcategories: productType ? [{
        name: productType,
        slug: productType.toLowerCase().replace(/\s+/g, "-"),
        productCount: 0
      }] : []
    })
  } else {
    // If productType exists and is not in subcategories, add it
    if (productType) {
      const subcategorySlug = productType.toLowerCase().replace(/\s+/g, "-")
      const subcategoryExists = category.subcategories.some(
        sub => sub.slug === subcategorySlug
      )
      
      if (!subcategoryExists) {
        category.subcategories.push({
          name: productType,
          slug: subcategorySlug,
          productCount: 0
        })
        await category.save()
      }
    }
  }

  return category
}

/**
 * Update category product counts based on actual products
 */
async function updateCategoryCounts() {
  // Clear cache before updating (force fresh data)
  categoryCountsCache = null
  categoryCountsCacheTime = null
  
  const categories = await Category.find({ isActive: true })
  
  for (const category of categories) {
    // Count products in this category - match by slug, name, or subcategory
    // Also check if any product's subcategory matches this category's subcategories
    const categoryMatchConditions = [
      { category: category.slug },
      { category: category.name },
      { category: { $regex: new RegExp(`^${category.slug}$`, 'i') } },
      { category: { $regex: new RegExp(`^${category.name}$`, 'i') } }
    ]
    
    // If category has subcategories, also match products by subcategory field
    if (category.subcategories && category.subcategories.length > 0) {
      const subcategorySlugs = category.subcategories.map(sub => sub.slug)
      const subcategoryNames = category.subcategories.map(sub => sub.name)
      
      categoryMatchConditions.push(
        { subcategory: { $in: subcategorySlugs } },
        { subcategory: { $in: subcategoryNames } }
      )
      
      // Also match productType if it matches subcategory (case-insensitive)
      for (const sub of category.subcategories) {
        categoryMatchConditions.push(
          { productType: { $regex: new RegExp(`^${sub.slug}$`, 'i') } },
          { productType: { $regex: new RegExp(`^${sub.name}$`, 'i') } }
        )
      }
    }
    
    const productCount = await Product.countDocuments({
      $or: categoryMatchConditions,
      isActive: true
    })
    
    category.productCount = productCount

    // Update subcategory counts - match productType or subcategory field with subcategory name or slug
    // Also match products even if category doesn't match exactly (for flexibility)
    for (const subcategory of category.subcategories) {
      const subcategoryMatchConditions = [
        // Match by productType
        { productType: subcategory.name },
        { productType: subcategory.slug },
        { productType: { $regex: new RegExp(`^${subcategory.slug}$`, 'i') } },
        { productType: { $regex: new RegExp(`^${subcategory.name}$`, 'i') } },
        // Match by subcategory field
        { subcategory: subcategory.slug },
        { subcategory: subcategory.name },
        { subcategory: { $regex: new RegExp(`^${subcategory.slug}$`, 'i') } },
        { subcategory: { $regex: new RegExp(`^${subcategory.name}$`, 'i') } }
      ]
      
      // Try to match with category first, but if no results, match without category requirement
      const subcategoryCountWithCategory = await Product.countDocuments({
        $and: [
          {
            $or: [
              { category: category.slug },
              { category: category.name },
              { category: { $regex: new RegExp(`^${category.slug}$`, 'i') } },
              { category: { $regex: new RegExp(`^${category.name}$`, 'i') } }
            ]
          },
          {
            $or: subcategoryMatchConditions
          },
          { isActive: true }
        ]
      })
      
      // If we got results with category match, use that. Otherwise, count without category requirement
      const subcategoryCount = subcategoryCountWithCategory > 0 
        ? subcategoryCountWithCategory
        : await Product.countDocuments({
            $and: [
              { $or: subcategoryMatchConditions },
              { isActive: true }
            ]
          })
      
      subcategory.productCount = subcategoryCount
    }

    await category.save()
  }
}

// Cache for category counts (expires after 5 minutes)
let categoryCountsCache = null
let categoryCountsCacheTime = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get all categories with active products only
 * @param {string|null} majorCategory - Filter by major category
 * @param {boolean} forceUpdateCounts - Force update counts (default: false, uses cache)
 */
async function getActiveCategories(majorCategory = null, forceUpdateCounts = false) {
  // Only update counts if cache is expired or forced
  const now = Date.now()
  const cacheExpired = !categoryCountsCache || !categoryCountsCacheTime || (now - categoryCountsCacheTime > CACHE_DURATION)
  
  // If cache is valid and not forcing update, skip count updates (use existing counts)
  if (!forceUpdateCounts && !cacheExpired && categoryCountsCache) {
    // Return cached data immediately (fast response)
    return categoryCountsCache
  }
  
  // Need to update counts - do it in background if cache exists, otherwise wait
  if (categoryCountsCache && !forceUpdateCounts) {
    // Update counts in background (don't wait for it to complete)
    updateCategoryCounts().then(() => {
      categoryCountsCacheTime = Date.now()
      // Cache will be updated on next request
    }).catch(err => {
      console.error('Error updating category counts:', err)
    })
    
    // Return cached data immediately while update runs in background
    return categoryCountsCache
  }
  
  // First time or forced update - wait for counts (but optimize by skipping if not needed)
  if (forceUpdateCounts || !categoryCountsCache) {
    await updateCategoryCounts()
  }
  
  // Show categories that have products OR have subcategories (so new categories with subcategories appear)
  // Also show categories that have products matching their subcategories (even if category name doesn't match)
  const baseQuery = { 
    isActive: true,
    $or: [
      { productCount: { $gt: 0 } },
      { 'subcategories.0': { $exists: true } } // Has at least one subcategory
    ]
  }
  
  if (majorCategory) {
    baseQuery.$and = [
      {
        $or: [
          { majorCategory },
          { majorCategory: "ALL" }
        ]
      }
    ]
  }

  const categories = await Category.find(baseQuery)
    .sort({ productCount: -1, name: 1 })
    .lean()
    .select('-__v') // Exclude version field for faster queries

  // Handle duplicate categories: merge subcategories from image category into non-image category
  // This ensures we keep all subcategories (like "Jackets") even when filtering out image categories
  const categoryMap = new Map()
  const imageCategories = []
  
  for (const cat of categories) {
    // Handle both "mens-wear" and "men's-wear" formats
    const isMensWear = cat.slug === 'mens-wear' || cat.slug === "men's-wear"
    const isWomensWear = cat.slug === 'womens-wear' || cat.slug === "women's-wear"
    
    if (isMensWear || isWomensWear) {
      // Use a normalized key for lookup, but keep original slug in the data
      const lookupKey = isMensWear ? 'mens-wear' : 'womens-wear'
      
      if (cat.image) {
        // Store image category for merging
        imageCategories.push({ ...cat, lookupKey })
      } else {
        // Store non-image category - merge subcategories if multiple exist
        if (!categoryMap.has(lookupKey)) {
          categoryMap.set(lookupKey, cat)
        } else {
          // Merge subcategories from this category into the existing one
          const existingCat = categoryMap.get(lookupKey)
          const existingSlugs = new Set(existingCat.subcategories.map(s => s.slug))
          const subcategoriesToAdd = cat.subcategories.filter(s => !existingSlugs.has(s.slug))
          if (subcategoriesToAdd.length > 0) {
            existingCat.subcategories = [...existingCat.subcategories, ...subcategoriesToAdd]
          }
        }
      }
    } else {
      categoryMap.set(cat.slug, cat)
    }
  }
  
  // Merge subcategories from image categories into non-image categories
  // If no non-image category exists, keep the image category
  for (const imageCat of imageCategories) {
    const lookupKey = imageCat.lookupKey || (imageCat.slug === "men's-wear" ? 'mens-wear' : (imageCat.slug === "women's-wear" ? 'womens-wear' : imageCat.slug))
    const nonImageCat = categoryMap.get(lookupKey)
    if (nonImageCat) {
      // Merge subcategories: add any missing ones from image category
      const existingSlugs = new Set(nonImageCat.subcategories.map(s => s.slug))
      const subcategoriesToAdd = imageCat.subcategories.filter(s => !existingSlugs.has(s.slug))
      if (subcategoriesToAdd.length > 0) {
        nonImageCat.subcategories = [...nonImageCat.subcategories, ...subcategoriesToAdd]
      }
    } else {
      // No non-image category exists - keep the image category
      categoryMap.set(lookupKey, imageCat)
    }
  }

  // Return all active categories
  // The categoryMap already handles duplicates - prefer non-image versions but keep image if it's the only one
  const filtered = Array.from(categoryMap.values())
    .filter(cat => {
      // All categories in the map are valid (duplicates already handled)
      // Only filter out categories with images that don't have subcategories (for non-mens/womens categories)
      const isMensWear = cat.slug === 'mens-wear' || cat.slug === "men's-wear"
      const isWomensWear = cat.slug === 'womens-wear' || cat.slug === "women's-wear"
      
      // For mens-wear and womens-wear: keep them (duplicates already handled in map)
      if (isMensWear || isWomensWear) {
        return true
      }
      
      // For other categories with images: they must have subcategories
      if (cat.image) {
        return cat.subcategories && Array.isArray(cat.subcategories) && cat.subcategories.length > 0
      }
      
      // All other categories are valid
      return true
    })
    .map(cat => ({
      ...cat,
      subcategories: cat.subcategories.filter(sub => sub.isActive !== false)
    }))
  
  // Update cache
  categoryCountsCache = filtered
  categoryCountsCacheTime = Date.now()
  return filtered
}

/**
 * Get category by slug
 */
async function getCategoryBySlug(slug) {
  await updateCategoryCounts()
  return Category.findOne({ slug, isActive: true }).lean()
}

module.exports = {
  ensureCategory,
  updateCategoryCounts,
  getActiveCategories,
  getCategoryBySlug
}


