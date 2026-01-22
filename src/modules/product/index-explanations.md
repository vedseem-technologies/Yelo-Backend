# MongoDB Compound Indexes for Products Collection

## Index Strategy: ESR Rule (Equality, Sort, Range)

MongoDB indexes follow the **ESR Rule**:
1. **Equality** fields first (exact matches: category, brand, isActive)
2. **Sort** fields next (orderBy: price, createdAt, rating)
3. **Range** fields last (price ranges: minPrice, maxPrice)

---

## 📋 Complete Index List

### **Index 1: `category_isActive_price`**
```javascript
{ category: 1, isActive: 1, price: 1 }
```
**Supports Queries:**
- ✅ `{ category: "Women's Wear", isActive: true }` → `sort({ price: 1 })` (price-low)
- ✅ `{ category: "Women's Wear", isActive: true }` → `sort({ price: -1 })` (price-high)
- ✅ `{ category: "Women's Wear", isActive: true, price: { $gte: 100, $lte: 500 } }` → `sort({ price: 1 })`

**Use Case:** Category pages with price sorting

---

### **Index 2: `category_isActive_createdAt`**
```javascript
{ category: 1, isActive: 1, createdAt: -1 }
```
**Supports Queries:**
- ✅ `{ category: "Women's Wear", isActive: true }` → `sort({ createdAt: -1 })` (newest)
- ✅ New products in category page

**Use Case:** Show newest products first in a category

---

### **Index 3: `category_isActive_rating`**
```javascript
{ category: 1, isActive: 1, rating: -1 }
```
**Supports Queries:**
- ✅ `{ category: "Women's Wear", isActive: true }` → `sort({ rating: -1 })`
- ✅ Highest rated products in category

**Use Case:** Top-rated products in category

---

### **Index 4: `category_isActive_popular`**
```javascript
{ category: 1, isActive: 1, reviews: -1, rating: -1 }
```
**Supports Queries:**
- ✅ `{ category: "Women's Wear", isActive: true }` → `sort({ reviews: -1, rating: -1 })` (popular)
- ✅ Most reviewed and highest rated

**Use Case:** Default "popular" sort on category pages

---

### **Index 5: `brand_isActive_price`** (Sparse)
```javascript
{ brand: 1, isActive: 1, price: 1 }
```
**Supports Queries:**
- ✅ `{ brand: "Nike", isActive: true }` → `sort({ price: 1 })`
- ✅ `{ brand: { $in: ["Nike", "Adidas"] }, isActive: true }` → `sort({ price: 1 })`

**Use Case:** Brand filtering with price sort
**Note:** Sparse index (skips documents where brand is null/undefined)

---

### **Index 6: `brand_isActive_createdAt`** (Sparse)
```javascript
{ brand: 1, isActive: 1, createdAt: -1 }
```
**Supports Queries:**
- ✅ `{ brand: "Nike", isActive: true }` → `sort({ createdAt: -1 })`

**Use Case:** Newest products by brand

---

### **Index 7: `brand_isActive_rating`** (Sparse)
```javascript
{ brand: 1, isActive: 1, rating: -1 }
```
**Supports Queries:**
- ✅ `{ brand: "Nike", isActive: true }` → `sort({ rating: -1 })`

**Use Case:** Top-rated products by brand

---

### **Index 8: `category_brand_isActive_price`** (Sparse)
```javascript
{ category: 1, brand: 1, isActive: 1, price: 1 }
```
**Supports Queries:**
- ✅ `{ category: "Men's Wear", brand: "Nike", isActive: true }` → `sort({ price: 1 })`
- ✅ Combined category + brand filtering with price sort

**Use Case:** Filter by both category AND brand

---

### **Index 9: `isActive_price`**
```javascript
{ isActive: 1, price: 1 }
```
**Supports Queries:**
- ✅ `{ isActive: true }` → `sort({ price: 1 })` or `sort({ price: -1 })`
- ✅ Global product listing without category/brand filter

**Use Case:** Admin panel, all products listing

---

### **Index 10: `isActive_createdAt`**
```javascript
{ isActive: 1, createdAt: -1 }
```
**Supports Queries:**
- ✅ `{ isActive: true }` → `sort({ createdAt: -1 })`
- ✅ All newest products

**Use Case:** Global newest products

---

### **Index 11: `isActive_rating`**
```javascript
{ isActive: 1, rating: -1 }
```
**Supports Queries:**
- ✅ `{ isActive: true }` → `sort({ rating: -1 })`

**Use Case:** Global top-rated products

---

### **Index 12: `isTrending_isActive_popular`**
```javascript
{ isTrending: 1, isActive: 1, reviews: -1, rating: -1 }
```
**Supports Queries:**
- ✅ `{ isTrending: true, isActive: true }` → `sort({ reviews: -1, rating: -1 })`
- ✅ Trending products page

**Use Case:** Trending/featured products section

---

### **Index 13: `category_subcategory_isActive_price`**
```javascript
{ category: 1, subcategory: 1, isActive: 1, price: 1 }
```
**Supports Queries:**
- ✅ `{ category: "Women's Wear", subcategory: "Jackets", isActive: true }` → `sort({ price: 1 })`
- ✅ Category/subcategory pages

**Use Case:** Women's Wear → Jackets page with price sort

---

### **Index 14: `category_subcategory_isActive_createdAt`**
```javascript
{ category: 1, subcategory: 1, isActive: 1, createdAt: -1 }
```
**Supports Queries:**
- ✅ `{ category: "Women's Wear", subcategory: "Jackets", isActive: true }` → `sort({ createdAt: -1 })`

**Use Case:** Newest products in category/subcategory

---

## 🚀 How to Create Indexes

### Option 1: Using the Script (Recommended)
```bash
cd backend
node -e "require('./src/modules/product/create-indexes.js')"
```

### Option 2: Using MongoDB Shell
```bash
# Connect to your database
mongosh "your-connection-string"

# Then run each createIndex command
db.products.createIndex({ category: 1, isActive: 1, price: 1 }, { name: 'category_isActive_price', background: true })
# ... (repeat for all indexes)
```

### Option 3: Direct MongoDB Commands
```javascript
// Connect to MongoDB
use your-database-name

// Index 1
db.products.createIndex(
  { category: 1, isActive: 1, price: 1 },
  { name: 'category_isActive_price', background: true }
)

// Index 2
db.products.createIndex(
  { category: 1, isActive: 1, createdAt: -1 },
  { name: 'category_isActive_createdAt', background: true }
)

// Index 3
db.products.createIndex(
  { category: 1, isActive: 1, rating: -1 },
  { name: 'category_isActive_rating', background: true }
)

// Index 4
db.products.createIndex(
  { category: 1, isActive: 1, reviews: -1, rating: -1 },
  { name: 'category_isActive_popular', background: true }
)

// Index 5 (Sparse)
db.products.createIndex(
  { brand: 1, isActive: 1, price: 1 },
  { name: 'brand_isActive_price', background: true, sparse: true }
)

// Index 6 (Sparse)
db.products.createIndex(
  { brand: 1, isActive: 1, createdAt: -1 },
  { name: 'brand_isActive_createdAt', background: true, sparse: true }
)

// Index 7 (Sparse)
db.products.createIndex(
  { brand: 1, isActive: 1, rating: -1 },
  { name: 'brand_isActive_rating', background: true, sparse: true }
)

// Index 8 (Sparse)
db.products.createIndex(
  { category: 1, brand: 1, isActive: 1, price: 1 },
  { name: 'category_brand_isActive_price', background: true, sparse: true }
)

// Index 9
db.products.createIndex(
  { isActive: 1, price: 1 },
  { name: 'isActive_price', background: true }
)

// Index 10
db.products.createIndex(
  { isActive: 1, createdAt: -1 },
  { name: 'isActive_createdAt', background: true }
)

// Index 11
db.products.createIndex(
  { isActive: 1, rating: -1 },
  { name: 'isActive_rating', background: true }
)

// Index 12
db.products.createIndex(
  { isTrending: 1, isActive: 1, reviews: -1, rating: -1 },
  { name: 'isTrending_isActive_popular', background: true }
)

// Index 13
db.products.createIndex(
  { category: 1, subcategory: 1, isActive: 1, price: 1 },
  { name: 'category_subcategory_isActive_price', background: true }
)

// Index 14
db.products.createIndex(
  { category: 1, subcategory: 1, isActive: 1, createdAt: -1 },
  { name: 'category_subcategory_isActive_createdAt', background: true }
)
```

---

## 📊 Verify Indexes

```javascript
// List all indexes
db.products.getIndexes()

// Check index usage
db.products.aggregate([{ $indexStats: {} }])

// Analyze query performance
db.products.find({ category: "Women's Wear", isActive: true }).sort({ price: 1 }).explain("executionStats")
```

---

## ⚠️ Important Notes

1. **Sparse Indexes**: Indexes on `brand` are sparse (skip null/undefined values) because not all products have brands
2. **Background Creation**: All indexes use `background: true` to avoid blocking operations
3. **Index Size**: These indexes will use additional storage (~5-10% of collection size)
4. **Write Performance**: More indexes = slower writes, but much faster reads
5. **Query Optimization**: MongoDB will automatically choose the best index for each query

---

## 🎯 Query Examples That Use These Indexes

### Example 1: Category + Price Sort
```javascript
Product.find({ category: "Women's Wear", isActive: true })
  .sort({ price: 1 })
  .limit(10)
```
**Uses:** `category_isActive_price` index ✅

### Example 2: Brand + Newest
```javascript
Product.find({ brand: "Nike", isActive: true })
  .sort({ createdAt: -1 })
  .limit(10)
```
**Uses:** `brand_isActive_createdAt` index ✅

### Example 3: Category + Brand + Price
```javascript
Product.find({ 
  category: "Men's Wear", 
  brand: "Nike", 
  isActive: true,
  price: { $gte: 100, $lte: 500 }
})
  .sort({ price: 1 })
  .limit(10)
```
**Uses:** `category_brand_isActive_price` index ✅

### Example 4: Popular Products
```javascript
Product.find({ category: "Women's Wear", isActive: true })
  .sort({ reviews: -1, rating: -1 })
  .limit(10)
```
**Uses:** `category_isActive_popular` index ✅
