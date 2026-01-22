/**
 * Optimal Compound Indexes for Product Collection
 * 
 * This script creates indexes to support:
 * - Filtering by category/brand/isActive
 * - Sorting by price, createdAt, rating, reviews
 * 
 * Run this once to create all indexes:
 * node -e "require('./src/modules/product/create-indexes.js')"
 * 
 * Or use MongoDB shell:
 * mongo your-database-name < create-indexes.js
 */

const mongoose = require('mongoose')
const Product = require('./product.model')

async function createOptimalIndexes() {
  try {
    console.log('🔧 Creating optimal compound indexes for products collection...\n')

    // Index 1: Category + Price Sorting (most common: category browsing with price sort)
    // Supports: { category: "X", isActive: true } → sort by price
    await Product.collection.createIndex(
      { category: 1, isActive: 1, price: 1 },
      { 
        name: 'category_isActive_price',
        background: true,
        sparse: false
      }
    )
    console.log('✅ Index 1: category_isActive_price')

    // Index 2: Category + CreatedAt Sorting (newest products in category)
    // Supports: { category: "X", isActive: true } → sort by createdAt
    await Product.collection.createIndex(
      { category: 1, isActive: 1, createdAt: -1 },
      { 
        name: 'category_isActive_createdAt',
        background: true
      }
    )
    console.log('✅ Index 2: category_isActive_createdAt')

    // Index 3: Category + Rating Sorting (highest rated in category)
    // Supports: { category: "X", isActive: true } → sort by rating
    await Product.collection.createIndex(
      { category: 1, isActive: 1, rating: -1 },
      { 
        name: 'category_isActive_rating',
        background: true
      }
    )
    console.log('✅ Index 3: category_isActive_rating')

    // Index 4: Category + Popular Sorting (reviews, rating)
    // Supports: { category: "X", isActive: true } → sort by reviews, rating
    await Product.collection.createIndex(
      { category: 1, isActive: 1, reviews: -1, rating: -1 },
      { 
        name: 'category_isActive_popular',
        background: true
      }
    )
    console.log('✅ Index 4: category_isActive_popular')

    // Index 5: Brand + Price Sorting (brand browsing with price sort)
    // Supports: { brand: "X", isActive: true } → sort by price
    await Product.collection.createIndex(
      { brand: 1, isActive: 1, price: 1 },
      { 
        name: 'brand_isActive_price',
        background: true,
        sparse: true // Sparse because brand can be null/undefined
      }
    )
    console.log('✅ Index 5: brand_isActive_price')

    // Index 6: Brand + CreatedAt Sorting
    // Supports: { brand: "X", isActive: true } → sort by createdAt
    await Product.collection.createIndex(
      { brand: 1, isActive: 1, createdAt: -1 },
      { 
        name: 'brand_isActive_createdAt',
        background: true,
        sparse: true
      }
    )
    console.log('✅ Index 6: brand_isActive_createdAt')

    // Index 7: Brand + Rating Sorting
    // Supports: { brand: "X", isActive: true } → sort by rating
    await Product.collection.createIndex(
      { brand: 1, isActive: 1, rating: -1 },
      { 
        name: 'brand_isActive_rating',
        background: true,
        sparse: true
      }
    )
    console.log('✅ Index 7: brand_isActive_rating')

    // Index 8: Category + Brand + Price (combined filters)
    // Supports: { category: "X", brand: "Y", isActive: true } → sort by price
    await Product.collection.createIndex(
      { category: 1, brand: 1, isActive: 1, price: 1 },
      { 
        name: 'category_brand_isActive_price',
        background: true,
        sparse: true
      }
    )
    console.log('✅ Index 8: category_brand_isActive_price')

    // Index 9: IsActive + Global Sorting (for getAllProducts without category/brand)
    // Supports: { isActive: true } → sort by price, createdAt, rating
    await Product.collection.createIndex(
      { isActive: 1, price: 1 },
      { 
        name: 'isActive_price',
        background: true
      }
    )
    console.log('✅ Index 9: isActive_price')

    await Product.collection.createIndex(
      { isActive: 1, createdAt: -1 },
      { 
        name: 'isActive_createdAt',
        background: true
      }
    )
    console.log('✅ Index 10: isActive_createdAt')

    await Product.collection.createIndex(
      { isActive: 1, rating: -1 },
      { 
        name: 'isActive_rating',
        background: true
      }
    )
    console.log('✅ Index 11: isActive_rating')

    // Index 12: Popular/Trending products
    // Supports: { isTrending: true, isActive: true } → sort by reviews, rating
    await Product.collection.createIndex(
      { isTrending: 1, isActive: 1, reviews: -1, rating: -1 },
      { 
        name: 'isTrending_isActive_popular',
        background: true
      }
    )
    console.log('✅ Index 12: isTrending_isActive_popular')

    // Index 13: Subcategory filtering - Price Low (for category/subcategory pages)
    // Supports: { category: "X", subcategory: "Y", isActive: true } → sort by price (ascending)
    await Product.collection.createIndex(
      { category: 1, subcategory: 1, isActive: 1, price: 1 },
      { 
        name: 'category_subcategory_isActive_price_low',
        background: true
      }
    )
    console.log('✅ Index 13: category_subcategory_isActive_price_low')

    // Index 14: Subcategory filtering - Price High (for category/subcategory pages)
    // Supports: { category: "X", subcategory: "Y", isActive: true } → sort by price (descending)
    await Product.collection.createIndex(
      { category: 1, subcategory: 1, isActive: 1, price: -1 },
      { 
        name: 'category_subcategory_isActive_price_high',
        background: true
      }
    )
    console.log('✅ Index 14: category_subcategory_isActive_price_high')

    // Index 15: Subcategory filtering - CreatedAt (newest products)
    // Supports: { category: "X", subcategory: "Y", isActive: true } → sort by createdAt
    await Product.collection.createIndex(
      { category: 1, subcategory: 1, isActive: 1, createdAt: -1 },
      { 
        name: 'category_subcategory_isActive_createdAt',
        background: true
      }
    )
    console.log('✅ Index 15: category_subcategory_isActive_createdAt')

    // Index 16: Subcategory filtering - Rating (highest rated)
    // Supports: { category: "X", subcategory: "Y", isActive: true } → sort by rating
    await Product.collection.createIndex(
      { category: 1, subcategory: 1, isActive: 1, rating: -1 },
      { 
        name: 'category_subcategory_isActive_rating',
        background: true
      }
    )
    console.log('✅ Index 16: category_subcategory_isActive_rating')

    // Index 17: Subcategory filtering - Popular (reviews + rating)
    // Supports: { category: "X", subcategory: "Y", isActive: true } → sort by reviews, rating
    await Product.collection.createIndex(
      { category: 1, subcategory: 1, isActive: 1, reviews: -1, rating: -1 },
      { 
        name: 'category_subcategory_isActive_popular',
        background: true
      }
    )
    console.log('✅ Index 17: category_subcategory_isActive_popular')

    // Index 18: AssignedShops + Price Sorting (for shop pages)
    // Supports: { assignedShops: "luxury-shop", isActive: true } → sort by price
    await Product.collection.createIndex(
      { assignedShops: 1, isActive: 1, price: 1 },
      { 
        name: 'assignedShops_isActive_price',
        background: true
      }
    )
    console.log('✅ Index 18: assignedShops_isActive_price')

    // Index 19: AssignedShops + CreatedAt Sorting
    // Supports: { assignedShops: "luxury-shop", isActive: true } → sort by createdAt
    await Product.collection.createIndex(
      { assignedShops: 1, isActive: 1, createdAt: -1 },
      { 
        name: 'assignedShops_isActive_createdAt',
        background: true
      }
    )
    console.log('✅ Index 19: assignedShops_isActive_createdAt')

    // Index 20: AssignedShops + Rating Sorting
    // Supports: { assignedShops: "luxury-shop", isActive: true } → sort by rating
    await Product.collection.createIndex(
      { assignedShops: 1, isActive: 1, rating: -1 },
      { 
        name: 'assignedShops_isActive_rating',
        background: true
      }
    )
    console.log('✅ Index 20: assignedShops_isActive_rating')

    // Index 21: AssignedShops + Popular Sorting (reviews + rating)
    // Supports: { assignedShops: "luxury-shop", isActive: true } → sort by reviews, rating
    await Product.collection.createIndex(
      { assignedShops: 1, isActive: 1, reviews: -1, rating: -1 },
      { 
        name: 'assignedShops_isActive_popular',
        background: true
      }
    )
    console.log('✅ Index 21: assignedShops_isActive_popular')

    console.log('\n✨ All indexes created successfully!')
    console.log('\n📊 View indexes:')
    console.log('   db.products.getIndexes()')

  } catch (error) {
    console.error('❌ Error creating indexes:', error.message)
    throw error
  }
}

// If run directly, execute the function
if (require.main === module) {
  // Connect to MongoDB first
  const connectDB = require('../../config/db')
  connectDB()
    .then(() => createOptimalIndexes())
    .then(() => {
      console.log('\n✅ Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Failed:', error.message)
      process.exit(1)
    })
}

module.exports = { createOptimalIndexes }
