const Product = require("../product/product.model")

// GET all brands with product counts
exports.getAllBrands = async (req, res) => {
  try {
    const { majorCategory } = req.query

    const query = { isActive: true }
    if (majorCategory) {
      query.majorCategory = majorCategory
    }

    // Aggregate brands with product counts
    const brands = await Product.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$brand",
          productCount: { $sum: 1 },
          firstProduct: { $first: "$$ROOT" }
        }
      },
      {
        $match: {
          _id: { $ne: null, $ne: "" }
        }
      },
      {
        $project: {
          name: "$_id",
          brandName: "$_id",
          productCount: 1,
          image: { $arrayElemAt: ["$firstProduct.images.url", 0] },
          rating: "$firstProduct.rating",
          reviews: "$firstProduct.reviews"
        }
      },
      { $sort: { productCount: -1, name: 1 } }
    ])

    // Process brands to add slug (do it in JavaScript for compatibility)
    const brandsWithSlug = brands.map(brand => ({
      ...brand,
      slug: (brand.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    }))

    res.json({
      success: true,
      data: brandsWithSlug
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// GET brand by slug
exports.getBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params
    const brandName = slug.split("-").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ")

    const products = await Product.find({
      brand: { $regex: new RegExp(brandName, "i") },
      isActive: true
    })
      .limit(1)
      .lean()

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      })
    }

    const brandData = {
      name: brandName,
      slug: slug,
      productCount: await Product.countDocuments({
        brand: { $regex: new RegExp(brandName, "i") },
        isActive: true
      }),
      image: products[0].images?.[0]?.url || null,
      rating: products[0].rating || 0,
      reviews: products[0].reviews || 0
    }

    res.json({
      success: true,
      data: brandData
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

