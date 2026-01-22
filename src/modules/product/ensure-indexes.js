/**
 * Ensure Product Indexes are Created
 * This script ensures all compound indexes are created and ready
 * Run this on server startup or manually to verify indexes
 */

const Product = require('./product.model')

async function ensureProductIndexes() {
  try {
    console.log('🔧 Ensuring product indexes are created...')
    
    // First, check for and drop old indexes with typos or conflicts
    try {
      const indexes = await Product.collection.getIndexes()
      const indexNames = Object.keys(indexes)
      
      // List of old/incorrect index names to drop
      const indexesToDrop = [
        'category_subcategorry_isActive_price', // Typo: double 'r'
        'category_subcategory_isActive_price' // Old name without _low suffix
      ]
      
      for (const oldIndexName of indexesToDrop) {
        if (indexNames.includes(oldIndexName)) {
          try {
            console.log(`🗑️  Dropping old index: ${oldIndexName}`)
            await Product.collection.dropIndex(oldIndexName)
            console.log(`✅ Dropped old index: ${oldIndexName}`)
          } catch (dropError) {
            // Index might not exist or might be in use, that's okay
            if (!dropError.message.includes('index not found')) {
              console.warn(`⚠️  Could not drop index ${oldIndexName}:`, dropError.message)
            }
          }
        }
      }
    } catch (cleanupError) {
      console.warn('⚠️  Error during index cleanup (non-critical):', cleanupError.message)
    }
    
    // Mongoose will automatically create indexes defined in schema
    // But we can explicitly ensure they exist using ensureIndexes()
    try {
      await Product.ensureIndexes()
      console.log('✅ Product indexes ensured')
    } catch (ensureError) {
      // Handle the case where index already exists with different name
      if (ensureError.message.includes('already exists with a different name')) {
        console.warn('⚠️  Index conflict detected (non-critical):', ensureError.message)
        console.log('💡 This usually means an index with the same fields but different name exists')
        console.log('💡 The existing index will still work, but consider dropping the old one manually')
      } else {
        throw ensureError
      }
    }
    
    // List all indexes to verify
    const indexes = await Product.collection.getIndexes()
    const indexNames = Object.keys(indexes)
    
    console.log(`📊 Total indexes: ${indexNames.length}`)
    console.log('📋 Index names:', indexNames.join(', '))
    
    // Check for our compound indexes
    const expectedIndexes = [
      'category_isActive_price',
      'category_isActive_createdAt',
      'category_isActive_rating',
      'category_isActive_popular',
      'category_subcategory_isActive_price_low',
      'category_subcategory_isActive_price_high',
      'category_subcategory_isActive_createdAt',
      'category_subcategory_isActive_rating',
      'category_subcategory_isActive_popular',
      'assignedShops_isActive_price',
      'assignedShops_isActive_createdAt',
      'assignedShops_isActive_rating',
      'assignedShops_isActive_popular',
      'isActive_price',
      'isActive_createdAt',
      'isActive_rating'
    ]
    
    const missingIndexes = expectedIndexes.filter(name => !indexNames.includes(name))
    
    if (missingIndexes.length > 0) {
      console.warn('⚠️  Missing indexes:', missingIndexes.join(', '))
      console.log('💡 Indexes may still be building in the background...')
    } else {
      console.log('✅ All expected indexes found!')
    }
    
    return { success: true, indexes: indexNames }
  } catch (error) {
    console.error('❌ Error ensuring indexes:', error.message)
    // Don't throw - this is non-critical
    console.warn('⚠️ Index creation warning (non-critical):', error.message)
    return { success: false, error: error.message }
  }
}

module.exports = { ensureProductIndexes }
