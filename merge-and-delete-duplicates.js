/**
 * Script to merge duplicate categories and delete the image versions
 * Run with: node merge-and-delete-duplicates.js
 */

const mongoose = require('mongoose')
const Category = require('./src/modules/category/category.model')

mongoose.connect('mongodb://localhost:27017/fashion')
  .then(async () => {
    
    const mensWearCategories = await Category.find({ 
      $or: [
        { slug: "men's-wear" },
        { slug: 'mens-wear' }
      ],
      isActive: true 
    })
    
    if (mensWearCategories.length > 1) {
      const imageCategory = mensWearCategories.find(c => c.image)
      const nonImageCategory = mensWearCategories.find(c => !c.image)
      
      if (imageCategory && nonImageCategory) {
        
        // Merge subcategories from image category into non-image category
        const existingSlugs = new Set(nonImageCategory.subcategories.map(s => s.slug))
        const subcategoriesToAdd = imageCategory.subcategories.filter(s => !existingSlugs.has(s.slug))
        
   
        
        nonImageCategory.subcategories.push(...subcategoriesToAdd)
        await nonImageCategory.save()
        
        // Permanently delete the image category
        await Category.deleteOne({ _id: imageCategory._id })
      } else if (imageCategory && !nonImageCategory) {
        // Only image category exists - remove image to make it compatible with frontend
        imageCategory.image = null
        await imageCategory.save()
      } else {
        console.log('Unexpected category combination')
      }
    } else if (mensWearCategories.length === 1) {
      const cat = mensWearCategories[0]
      if (cat.image) {
        cat.image = null
        await cat.save()
      } else {
        console.log('Men\'s Wear category is already correct (no image)')
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
    
    
    if (womensWearCategories.length > 1) {
      const imageCategory = womensWearCategories.find(c => c.image)
      const nonImageCategory = womensWearCategories.find(c => !c.image)
      
      if (imageCategory && nonImageCategory) {
        
        // Merge subcategories from image category into non-image category
        const existingSlugs = new Set(nonImageCategory.subcategories.map(s => s.slug))
        const subcategoriesToAdd = imageCategory.subcategories.filter(s => !existingSlugs.has(s.slug))
        
        
        nonImageCategory.subcategories.push(...subcategoriesToAdd)
        await nonImageCategory.save()

        // Permanently delete the image category
        await Category.deleteOne({ _id: imageCategory._id })
      } else if (imageCategory && !nonImageCategory) {
        // Only image category exists - remove image to make it compatible with frontend
       
        imageCategory.image = null
        await imageCategory.save()
      }
    } else if (womensWearCategories.length === 1) {
      const cat = womensWearCategories[0]
      if (cat.image) {
       
        cat.image = null
        await cat.save()
      } else {
        console.log(' Women\'s Wear category is already correct (no image)')
      }
    }

    process.exit(0)
  })
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })

