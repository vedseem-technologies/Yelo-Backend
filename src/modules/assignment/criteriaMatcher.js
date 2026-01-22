function matchesShopCriteria(product, criteria) {
    // If no criteria defined, accept all products (fallback to accept all)
    if (!criteria || Object.keys(criteria).length === 0) return true
  
    // Price - product must fall within price range if specified
    if (criteria.priceMin != null && (product.price || 0) < criteria.priceMin)
      return false
  
    if (criteria.priceMax != null && (product.price || 0) > criteria.priceMax)
      return false
  
    // Rating (skip if product has no reviews yet, but still check if minReviews is required)
    if (criteria.minRating != null) {
      // Only check rating if product has reviews, otherwise allow it
      if (product.reviews > 0 && (product.rating || 0) < criteria.minRating) {
        return false
      }
      // If minRating is required but product has no reviews, don't exclude it (allow new products)
    }
  
    if (criteria.minReviews != null && (product.reviews || 0) < criteria.minReviews) {
      return false
    }
  
    // Discount
    if (criteria.hasDiscount) {
      const hasDiscount =
        product.discount > 0 ||
        (product.originalPrice && product.originalPrice > product.price)
      if (!hasDiscount) return false
    }
  
    // Time-based (check both dateAdded and createdAt)
    if (criteria.daysSinceAdded) {
      const productDate = product.dateAdded || product.createdAt
      if (productDate) {
        const days =
          (Date.now() - new Date(productDate)) / (1000 * 60 * 60 * 24)
        if (days > criteria.daysSinceAdded) return false
      }
      // If no date field exists, skip the time check (allow product)
    }
  
    // Category match - improved to handle variations (including singular/plural)
    if (criteria.categoryMatch) {
      const categoryMatchLower = criteria.categoryMatch.toLowerCase()
      const categoryMatchWords = categoryMatchLower.split(/[\s-]+/).filter(w => w.length > 0)
      
      // Check product category
      const productCategory = (product.category || "").toLowerCase()
      const productType = (product.productType || "").toLowerCase()
      const productName = (product.name || "").toLowerCase()
      
      // Combine all text for matching
      const combinedText = `${productCategory} ${productType} ${productName}`
      
      // Check if categoryMatch is included in any of the fields (direct match)
      if (combinedText.includes(categoryMatchLower)) {
        // Direct match found
      } else {
        // Try reverse matching: check if product text includes categoryMatch or vice versa
        // This handles singular/plural variations (e.g., "sweatshirt" matches "sweatshirts")
        const categoryMatchBase = categoryMatchLower.replace(/s$/, '') // Remove trailing 's' for plural
        const productTextBase = combinedText.replace(/s$/, '') // Remove trailing 's' from product text
        
        // Check if base forms match (handles singular/plural)
        const baseMatch = categoryMatchBase === productTextBase || 
                         combinedText.includes(categoryMatchBase) ||
                         categoryMatchLower.includes(productTextBase.split(' ').pop()) // Check last word
        
        if (baseMatch) {
          // Base match found (singular/plural handled)
        } else if (categoryMatchWords.length > 0) {
          // Check if all words from categoryMatch are present (word-by-word matching)
          const allWordsMatch = categoryMatchWords.every(word => {
            const wordBase = word.replace(/s$/, '') // Remove trailing 's'
            return productCategory.includes(word) || 
                   productCategory.includes(wordBase) ||
                   productType.includes(word) || 
                   productType.includes(wordBase) ||
                   productName.includes(word) ||
                   productName.includes(wordBase)
          })
          if (!allWordsMatch) return false
        } else {
          return false
        }
      }
    }

    // Brand match - check if product brand matches any in the array
    if (criteria.brandMatch && Array.isArray(criteria.brandMatch) && criteria.brandMatch.length > 0) {
      const productBrand = (product.brand || "").toLowerCase()
      const matchesBrand = criteria.brandMatch.some(brand => 
        productBrand.includes(brand.toLowerCase()) || brand.toLowerCase().includes(productBrand)
      )
      if (!matchesBrand) return false
    }
  
    // Trending
    if (
      criteria.isTrending !== undefined &&
      product.isTrending !== criteria.isTrending
    )
      return false
  
    return true
  }
  
  module.exports = matchesShopCriteria
  