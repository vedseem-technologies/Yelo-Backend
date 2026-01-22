const FreeSubcategory = require("./free-subcategory.model")
const Category = require("./category.model")
const { updateCategoryCounts } = require("./category.service")

// GET all free subcategories
exports.getAllFreeSubcategories = async (req, res) => {
  try {
    const { includeInactive } = req.query
    const query = includeInactive === 'true' ? {} : { isActive: true }
    
    const freeSubcategories = await FreeSubcategory.find(query)
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      success: true,
      data: freeSubcategories
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// POST assign free subcategory to a category
exports.assignToCategory = async (req, res) => {
  try {
    const { freeSubcategoryId } = req.params
    const { categorySlug } = req.body

    if (!categorySlug) {
      return res.status(400).json({
        success: false,
        message: "Category slug is required"
      })
    }

    // Get free subcategory
    const freeSubcat = await FreeSubcategory.findById(freeSubcategoryId)
    if (!freeSubcat) {
      return res.status(404).json({
        success: false,
        message: "Free subcategory not found"
      })
    }

    // Get target category
    const category = await Category.findOne({ 
      $or: [
        { slug: categorySlug },
        { slug: categorySlug.replace(/-/g, "'") },
        { slug: categorySlug.replace(/'/g, "-") }
      ]
    })
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      })
    }

    // Check if subcategory already exists in category
    const subExists = category.subcategories.some(sub => sub.slug === freeSubcat.slug)
    if (subExists) {
      return res.status(400).json({
        success: false,
        message: "Subcategory with this slug already exists in the category"
      })
    }

    // Add subcategory to category
    category.subcategories.push({
      name: freeSubcat.name,
      slug: freeSubcat.slug,
      image: freeSubcat.image || null,
      icon: freeSubcat.icon || null,
      productCount: freeSubcat.productCount || 0,
      isActive: freeSubcat.isActive !== false
    })

    await category.save()

    // Delete free subcategory (it's now assigned)
    await FreeSubcategory.deleteOne({ _id: freeSubcategoryId })

    await updateCategoryCounts()

    res.json({
      success: true,
      message: "Subcategory assigned to category successfully",
      data: category
    })
  } catch (err) {
    console.error('Error assigning free subcategory:', err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// DELETE free subcategory (permanently delete)
exports.deleteFreeSubcategory = async (req, res) => {
  try {
    const { freeSubcategoryId } = req.params

    const freeSubcat = await FreeSubcategory.findById(freeSubcategoryId)
    if (!freeSubcat) {
      return res.status(404).json({
        success: false,
        message: "Free subcategory not found"
      })
    }

    await FreeSubcategory.deleteOne({ _id: freeSubcategoryId })

    res.json({
      success: true,
      message: "Free subcategory deleted successfully"
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

