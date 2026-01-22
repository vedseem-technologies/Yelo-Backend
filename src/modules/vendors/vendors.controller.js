const Vendor = require("./vendors.model")
const Product = require("../product/product.model")

// Helper function to generate slug from name
function generateSlug(name) {
  if (!name) return ''
  
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')  // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')  // Remove special characters except hyphens
    .replace(/-+/g, '-')  // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '')  // Remove leading/trailing hyphens
}

exports.createVendor = async (req, res) => {
  try {
    // Auto-generate slug from name if not provided
    if (!req.body.slug && req.body.name) {
      let baseSlug = generateSlug(req.body.name)
      let slug = baseSlug
      let counter = 1
      
      // Ensure slug uniqueness
      while (await Vendor.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`
        counter++
      }
      
      req.body.slug = slug
    }
    
    // If slug is provided, ensure it's in the correct format
    if (req.body.slug) {
      req.body.slug = generateSlug(req.body.slug)
    }
    
    const vendor = await Vendor.create(req.body)
    res.status(201).json({ success: true, data: vendor })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

exports.getAllVendors = async (req, res) => {
  const vendors = await Vendor.find()
  res.json({ success: true, data: vendors })
}

exports.getVendorById = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id)
  if (!vendor)
    return res.status(404).json({ success: false, message: "Vendor not found" })

  res.json({ success: true, data: vendor })
}

exports.updateVendor = async (req, res) => {
  const vendor = await Vendor.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  )
  res.json({ success: true, data: vendor })
}

exports.deleteVendor = async (req, res) => {
  await Vendor.findByIdAndDelete(req.params.id)
  res.json({ success: true, message: "Vendor deleted" })
}

exports.getVendorProducts = async (req, res) => {
  try {
    const { slug } = req.params
    const {
      page = 1,
      limit = 50,
      sort = "popular"
    } = req.query

    const query = {
      vendorSlug: slug,
      isActive: true
    }

    const sortOptions = {
      popular: { reviews: -1, rating: -1 },
      "price-low": { price: 1 },
      "price-high": { price: -1 },
      newest: { dateAdded: -1 }
    }

    const sortQuery = sortOptions[sort] || sortOptions.popular
    const skip = (Number(page) - 1) * Number(limit)

    const products = await Product.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(Number(limit))
      .lean()

    const total = await Product.countDocuments(query)

    res.json({
      success: true,
      count: products.length,
      total,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

exports.getVendorBySlug = async (req, res) => {
  try {
    const { slug } = req.params
    const vendor = await Vendor.findOne({ slug, isActive: true }).lean()
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      })
    }

    res.json({
      success: true,
      data: vendor
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}
  
