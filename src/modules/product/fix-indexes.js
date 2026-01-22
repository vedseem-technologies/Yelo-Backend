/**
 * Fix Product Index Conflicts
 * This script drops old/incorrect indexes and ensures correct ones exist
 * Run this once to fix index conflicts
 * 
 * Usage: node -e "require('./src/modules/product/fix-indexes.js')"
 */

const mongoose = require('mongoose')
require('dotenv').config()

const connectDB = require('../../config/db')
const Product = require('./product.model')

async function fixIndexes() {
  try {
    console.log('🔧 Connecting to database...')
    await connectDB()
    console.log('✅ Connected to database\n')

    const collection = Product.collection
    
    // Get all current indexes
    console.log('📋 Checking existing indexes...')
    const indexes = await collection.getIndexes()
    const indexNames = Object.keys(indexes)
    console.log(`Found ${indexNames.length} indexes:\n${indexNames.join('\n')}\n`)

    // List of old/incorrect index names to drop
    const indexesToDrop = [
      'category_subcategorry_isActive_price', // Typo: double 'r'
      'category_subcategory_isActive_price' // Old name without _low suffix
    ]

    console.log('🗑️  Dropping old/incorrect indexes...')
    for (const oldIndexName of indexesToDrop) {
      if (indexNames.includes(oldIndexName)) {
        try {
          console.log(`   Dropping: ${oldIndexName}`)
          await collection.dropIndex(oldIndexName)
          console.log(`   ✅ Dropped: ${oldIndexName}`)
        } catch (dropError) {
          if (dropError.message.includes('index not found')) {
            console.log(`   ℹ️  Index ${oldIndexName} not found (already dropped)`)
          } else {
            console.error(`   ❌ Error dropping ${oldIndexName}:`, dropError.message)
          }
        }
      } else {
        console.log(`   ℹ️  Index ${oldIndexName} not found (no action needed)`)
      }
    }

    console.log('\n🔧 Ensuring correct indexes are created...')
    try {
      await Product.ensureIndexes()
      console.log('✅ Indexes ensured successfully\n')
    } catch (ensureError) {
      if (ensureError.message.includes('already exists with a different name')) {
        console.warn('⚠️  Index conflict detected:', ensureError.message)
        console.log('💡 Some indexes may have the same fields but different names')
        console.log('💡 This is usually non-critical - MongoDB will use the existing index\n')
      } else {
        throw ensureError
      }
    }

    // List indexes again to verify
    console.log('📋 Final index list:')
    const finalIndexes = await collection.getIndexes()
    const finalIndexNames = Object.keys(finalIndexes)
    console.log(`Total: ${finalIndexNames.length} indexes`)
    finalIndexNames.forEach(name => {
      const index = finalIndexes[name]
      const keys = Object.keys(index.key).map(k => `${k}:${index.key[k]}`).join(', ')
      console.log(`  - ${name}: { ${keys} }`)
    })

    console.log('\n✅ Index fix completed!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error fixing indexes:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  fixIndexes()
}

module.exports = { fixIndexes }
