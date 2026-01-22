/**
 * Script to merge duplicate categories and delete the image versions
 * Run with: node merge-and-delete-duplicates.js
 */

const mongoose = require('mongoose')
const Category = require('./src/modules/category/category.model')

mongoose.connect('mongodb://localhost:27017/fashion')
  .then(async () => {
    console.log('Connected to database')
    
    // Handle men's-wear duplicates
    const mensWearCategories = await Category.find({ 
      $or: [
        { slug: "men's-wear" },
        { slug: 'mens-wear' }
      ],
      isActive: true 
    })
    
    console.log(`Found ${mensWearCategories.length} men's-wear categories`)
    
    if (mensWearCategories.length > 1) {
      const imageCategory = mensWearCategories.find(c => c.image)
      const nonImageCategory = mensWearCategories.find(c => !c.image)
      
      if (imageCategory && nonImageCategory) {
        console.log('\n=== Merging Men\'s Wear Categories ===')
        console.log('Image category ID:', imageCategory._id, 'Subcategories:', imageCategory.subcategories.length)
        console.log('Non-image category ID:', nonImageCategory._id, 'Subcategories:', nonImageCategory.subcategories.length)
        
        // Merge subcategories from image category into non-image category
        const existingSlugs = new Set(nonImageCategory.subcategories.map(s => s.slug))
        const subcategoriesToAdd = imageCategory.subcategories.filter(s => !existingSlugs.has(s.slug))
        
        console.log(`Adding ${subcategoriesToAdd.length} subcategories to non-image category`)
        
        nonImageCategory.subcategories.push(...subcategoriesToAdd)
        await nonImageCategory.save()
        console.log('✅ Merged subcategories into non-image category')
        
        // Permanently delete the image category
        await Category.deleteOne({ _id: imageCategory._id })
        console.log('✅ Deleted image category')
      } else if (imageCategory && !nonImageCategory) {
        // Only image category exists - remove image to make it compatible with frontend
        console.log('\n=== Removing image from Men\'s Wear Category ===')
        imageCategory.image = null
        await imageCategory.save()
        console.log('✅ Removed image from category')
      } else {
        console.log('⚠️ Unexpected category combination')
      }
    } else if (mensWearCategories.length === 1) {
      const cat = mensWearCategories[0]
      if (cat.image) {
        console.log('\n=== Removing image from Men\'s Wear Category ===')
        cat.image = null
        await cat.save()
        console.log('✅ Removed image from category')
      } else {
        console.log('✅ Men\'s Wear category is already correct (no image)')
      }
    }
    
    // Handle women's-wear duplicates
    const womensWearCategories = await Category.find({ 
      $or: [
        { slug: "women's-wear" },
        { slug: 'womens-wear' }
      ],
      isActive: true 
    })
    
    console.log(`\nFound ${womensWearCategories.length} women's-wear categories`)
    
    if (womensWearCategories.length > 1) {
      const imageCategory = womensWearCategories.find(c => c.image)
      const nonImageCategory = womensWearCategories.find(c => !c.image)
      
      if (imageCategory && nonImageCategory) {
        console.log('\n=== Merging Women\'s Wear Categories ===')
        console.log('Image category ID:', imageCategory._id, 'Subcategories:', imageCategory.subcategories.length)
        console.log('Non-image category ID:', nonImageCategory._id, 'Subcategories:', nonImageCategory.subcategories.length)
        
        // Merge subcategories from image category into non-image category
        const existingSlugs = new Set(nonImageCategory.subcategories.map(s => s.slug))
        const subcategoriesToAdd = imageCategory.subcategories.filter(s => !existingSlugs.has(s.slug))
        
        console.log(`Adding ${subcategoriesToAdd.length} subcategories to non-image category`)
        
        nonImageCategory.subcategories.push(...subcategoriesToAdd)
        await nonImageCategory.save()
        console.log('✅ Merged subcategories into non-image category')
        
        // Permanently delete the image category
        await Category.deleteOne({ _id: imageCategory._id })
        console.log('✅ Deleted image category')
      } else if (imageCategory && !nonImageCategory) {
        // Only image category exists - remove image to make it compatible with frontend
        console.log('\n=== Removing image from Women\'s Wear Category ===')
        imageCategory.image = null
        await imageCategory.save()
        console.log('✅ Removed image from category')
      }
    } else if (womensWearCategories.length === 1) {
      const cat = womensWearCategories[0]
      if (cat.image) {
        console.log('\n=== Removing image from Women\'s Wear Category ===')
        cat.image = null
        await cat.save()
        console.log('✅ Removed image from category')
      } else {
        console.log('✅ Women\'s Wear category is already correct (no image)')
      }
    }
    
    console.log('\n✅ Done! Categories merged and duplicates deleted.')
    process.exit(0)
  })
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })

