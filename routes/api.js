const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

const authRoutes = require('./auth');
const transactionRoutes = require('./transactions');
const userRoutes = require('./users');
const uploadRoutes = require('./uploads');
const serviceRoutes = require('./services');
const notificationRoutes = require('./notifications');
const categoryRoutes = require('./categories');
const partsCategoryRoutes = require('./partsCategories');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const { User, Product, Transaction, Role, sequelize } = require('../models');

// Configure multer for file uploads with error handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Multiple file upload configuration
const uploadMultiple = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10 // Maximum 10 files
  }
});

// Test endpoint to check database and authentication
router.get('/test', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    console.log('=== TEST ENDPOINT ===');
    console.log('User:', req.user);
    console.log('Session:', req.session);
    
    // Test database connection
    const { Product } = require('../models');
    const productCount = await Product.count();
    
    res.json({
      message: 'Test successful',
      user: req.user,
      productCount: productCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: 'Test failed: ' + error.message });
  }
});

// Example API route
router.get('/status', (req, res) => {
  res.json({ status: 'API is working', timestamp: new Date().toISOString() });
});

// Search/autocomplete endpoint
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'products' } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    let results = [];
    
    if (type === 'products') {
      results = await Product.findAll({
        where: {
          name: {
            [require('sequelize').Op.iLike]: `%${q}%`
          },
          deleted_at: null
        },
        attributes: ['id', 'name', 'price', 'image', 'category'],
        limit: 10,
        order: [['name', 'ASC']]
      });
    } else if (type === 'users') {
      results = await User.findAll({
        where: {
          full_name: {
            [require('sequelize').Op.iLike]: `%${q}%`
          }
        },
        attributes: ['id', 'full_name', 'email'],
        limit: 10,
        order: [['full_name', 'ASC']]
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/users', userRoutes);
router.use('/uploads', uploadRoutes);
router.use('/services', serviceRoutes);
router.use('/categories', categoryRoutes);
router.use('/parts-categories', partsCategoryRoutes);

// Endpoint to get current user profile
router.get('/profile', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = await User.findByPk(req.user.id, {
      include: [{ model: require('../models').Role, as: 'Role' }]
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      profile_picture: user.profile_picture,
      dealership_name: user.dealership_name,
      bio: user.bio,
      role: user.Role ? user.Role.name : 'user'
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Endpoint to upload profile pictures (multiple)
router.post('/profile/upload', ensureAuthenticated, uploadMultiple.array('profile_pictures', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded' });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: require('../models').Role, as: 'Role' }]
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store multiple profile pictures
    const profilePictures = req.files.map((file, index) => ({
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      is_primary: index === 0 // First image is primary
    }));

    // Update user's primary profile picture (first image)
    const primaryImagePath = profilePictures[0].path;
    
    await user.update({
      profile_picture: primaryImagePath
    });

    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      profile_picture: primaryImagePath,
      dealership_name: user.dealership_name,
      role: user.Role ? user.Role.name : 'user',
      all_pictures: profilePictures
    });
  } catch (error) {
    console.error('Error uploading profile pictures:', error);
    res.status(500).json({ error: 'Failed to upload profile pictures' });
  }
});

// Endpoint to update user profile
router.put('/profile/update', ensureAuthenticated, async (req, res) => {
  try {
    console.log('Profile update request received:', req.body);
    const { full_name, dealership_name, bio, password } = req.body;
    
    const user = await User.findByPk(req.user.id, {
      include: [{ model: require('../models').Role, as: 'Role' }]
    });
    if (!user) {
      console.log('User not found for ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Found user:', user.email);
    const updateData = {};
    
    if (full_name !== undefined && full_name !== null) {
      updateData.full_name = full_name;
    }
    
    if (dealership_name !== undefined && dealership_name !== null) {
      updateData.dealership_name = dealership_name;
    }
    
    if (bio !== undefined && bio !== null) {
      updateData.bio = bio;
    }
    
    if (password && password.trim() !== '') {
      // Hash the new password
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      updateData.password_hash = await bcrypt.hash(password, saltRounds);
    }

    console.log('Update data:', updateData);

    if (Object.keys(updateData).length === 0) {
      console.log('No data to update');
      return res.status(400).json({ error: 'No data provided for update' });
    }

    await user.update(updateData);

    console.log('Profile updated successfully');

    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      profile_picture: user.profile_picture,
      dealership_name: user.dealership_name,
      bio: user.bio,
      role: user.Role ? user.Role.name : 'user'
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile: ' + error.message });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  try {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      // Clear the session cookie
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Cart endpoints
router.get('/cart', ensureAuthenticated, async (req, res) => {
  try {
    // For now, return empty cart - cart is managed client-side with localStorage
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ items: [], total: 0 });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

router.post('/cart/add', ensureAuthenticated, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    
    // Validate product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ 
      message: 'Product added to cart',
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image
      }
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

router.delete('/cart/remove/:productId', ensureAuthenticated, async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    
    res.json({ message: 'Product removed from cart' });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

router.put('/cart/update', ensureAuthenticated, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: 'Product ID and quantity are required' });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }
    
    res.json({ message: 'Cart updated successfully' });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Product CRUD endpoints
// GET all products (excluding soft deleted) - Public endpoint for non-authenticated users
router.get('/public/products', async (req, res) => {
  try {
    const { ProductImage, MotorcycleCategory, MotorcyclePartsCategory } = require('../models');
    const products = await Product.findAll({
      where: {
        deleted_at: null
      },
      include: [
        { model: ProductImage, as: 'images' },
        { model: MotorcycleCategory, as: 'motorcycleCategory' },
        { model: MotorcyclePartsCategory, as: 'motorcyclePartsCategory' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET all products (excluding soft deleted) - Public endpoint for users with pagination
router.get('/products', ensureAuthenticated, async (req, res) => {
  try {
    const { ProductImage, MotorcycleCategory, MotorcyclePartsCategory } = require('../models');
    const { page = 1, limit = 10, category, search, bulk_uploaded } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { deleted_at: null };
    
    // Add category filter if provided
    if (category && category !== 'all') {
      if (category === 'motorcycle') {
        whereClause.category = 'Motorcycle';
      } else if (category === 'parts') {
        whereClause.category = 'Motorcycle Parts';
      }
    }
    
    // Add search filter if provided
    if (search) {
      const { Op } = require('sequelize');
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Add bulk uploaded filter if provided
    if (bulk_uploaded === 'true') {
      // For now, we'll identify bulk uploaded products by checking if they have a specific pattern
      // or we can add a metadata field to track bulk uploads
      const { Op } = require('sequelize');
      whereClause[Op.or] = [
        { name: { [Op.like]: '%BULK%' } },
        { description: { [Op.like]: '%BULK%' } }
      ];
    }
    
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        { model: ProductImage, as: 'images' },
        { model: MotorcycleCategory, as: 'motorcycleCategory' },
        { model: MotorcyclePartsCategory, as: 'motorcyclePartsCategory' }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });
    
    res.json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET all products (excluding soft deleted) - Admin only endpoint
router.get('/admin/products', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { ProductImage, MotorcycleCategory, MotorcyclePartsCategory } = require('../models');
    const products = await Product.findAll({
      where: {
        deleted_at: null
      },
      include: [
        { model: ProductImage, as: 'images' },
        { model: MotorcycleCategory, as: 'motorcycleCategory' },
        { model: MotorcyclePartsCategory, as: 'motorcyclePartsCategory' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Download bulk upload template
router.get('/products/bulk-template', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    // Create template data
    const templateData = [
      {
        'Product Name*': 'Sample Product',
        'Description*': 'This is a sample product description',
        'Price*': 99.99,
        'Category': 'Motorcycle Parts',
        'Brand': 'Sample Brand',
        'Condition': 'New'
      },
      {
        'Product Name*': 'Another Product',
        'Description*': 'Another sample product description',
        'Price*': 149.99,
        'Category': 'Accessories',
        'Brand': 'Another Brand',
        'Condition': 'Used'
      }
    ];
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Product Name
      { wch: 40 }, // Description
      { wch: 12 }, // Price
      { wch: 20 }, // Category
      { wch: 20 }, // Brand
      { wch: 15 }  // Condition
    ];
    worksheet['!cols'] = columnWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products Template');
    
    // Create instructions sheet
    const instructions = [
      { 'Field': 'Product Name*', 'Required': 'Yes', 'Type': 'Text', 'Description': 'Name of the product' },
      { 'Field': 'Description*', 'Required': 'Yes', 'Type': 'Text', 'Description': 'Detailed description of the product' },
      { 'Field': 'Price*', 'Required': 'Yes', 'Type': 'Number', 'Description': 'Product price (e.g., 99.99)' },
      { 'Field': 'Category', 'Required': 'No', 'Type': 'Text', 'Description': 'Product category (e.g., Motorcycle Parts, Accessories)' },
      { 'Field': 'Brand', 'Required': 'No', 'Type': 'Text', 'Description': 'Product brand name' },
      { 'Field': 'Condition', 'Required': 'No', 'Type': 'Text', 'Description': 'Product condition (New, Used)' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    instructionsSheet['!cols'] = [
      { wch: 20 }, // Field
      { wch: 10 }, // Required
      { wch: 15 }, // Type
      { wch: 50 }  // Description
    ];
    
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="product-bulk-upload-template.xlsx"');
    res.setHeader('Content-Length', buffer.length);
    
    // Send the file
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Product statistics endpoint
router.get('/products/stats', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    console.log('🔍 Product stats endpoint called');
    console.log('User:', req.user);
    console.log('Session:', req.session);
    
    // Get total products count (excluding soft deleted)
    const totalProducts = await Product.count({
      where: {
        deleted_at: null
      }
    });
    console.log('Total products:', totalProducts);

    // Calculate total revenue from all products
    const products = await Product.findAll({
      where: {
        deleted_at: null
      },
      attributes: ['price']
    });
    console.log('Products found:', products.length);

    const totalRevenue = products.reduce((sum, product) => {
      return sum + parseFloat(product.price || 0);
    }, 0);
    console.log('Total revenue:', totalRevenue);

    // Get unique categories count
    const categories = await Product.findAll({
      where: {
        deleted_at: null
      },
      attributes: ['category'],
      group: ['category']
    });
    console.log('Categories found:', categories.length);

    const response = {
      products: totalProducts,
      revenue: totalRevenue,
      categories: categories.length
    };
    
    console.log('📊 Sending product stats response:', response);
    console.log('✅ Response sent successfully');
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching product stats:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch product statistics' });
  }
});

// GET single product (excluding soft deleted)
router.get('/products/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const { ProductImage } = require('../models');
    const product = await Product.findOne({
      where: {
        id: productId,
        deleted_at: null
      },
      include: [{ model: ProductImage, as: 'images' }]
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST create product with multiple images
router.post('/products', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log('=== PRODUCT CREATION REQUEST ===');
  console.log('User:', req.user);
  console.log('Session:', req.session);
  console.log('Headers:', req.headers);
  
  uploadMultiple.array('images', 10)(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ error: err.message });
    }
    
    try {
      const { name, description, price, category_id, parts_category_id, brand, condition } = req.body;
      
      console.log('Product creation request:', { name, description, price, category_id, parts_category_id, brand, condition });
      console.log('Uploaded files:', req.files ? req.files.length : 0);
      
      // Validate required fields
      if (!name || !description || !price) {
        console.log('Validation failed - missing required fields');
        return res.status(400).json({ error: 'Name, description, and price are required' });
      }
      
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        console.log('Validation failed - invalid price:', price);
        return res.status(400).json({ error: 'Invalid price' });
      }
      
      console.log('Creating product with data:', {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        category_id: category_id ? parseInt(category_id) : null,
        parts_category_id: parts_category_id ? parseInt(parts_category_id) : null,
        brand: brand ? brand.trim() : null,
        condition: condition || 'New'
      });
      
      // Determine the category based on what's selected
      let category = null;
      if (parts_category_id) {
        category = 'Motorcycle Parts';
      } else if (category_id) {
        category = 'Motorcycle';
      }
      
      // Create product
      const product = await Product.create({
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        image: null, // We'll handle images separately
        category: category,
        category_id: category_id ? parseInt(category_id) : null,
        parts_category_id: parts_category_id ? parseInt(parts_category_id) : null,
        brand: brand ? brand.trim() : null,
        condition: condition || 'New'
      });
      
      console.log('Product created successfully:', product.id);
      
      // Handle multiple images
      const { ProductImage } = require('../models');
      const images = [];
      
      if (req.files && req.files.length > 0) {
        console.log('Processing images...');
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const imageUrl = `/uploads/${file.filename}`;
          
          console.log('Creating image record:', { product_id: product.id, image_url: imageUrl });
          
          const productImage = await ProductImage.create({
            product_id: product.id,
            image_url: imageUrl,
            image_name: file.originalname,
            is_primary: i === 0, // First image is primary
            sort_order: i
          });
          
          images.push(productImage);
        }
        
        // Update product with primary image
        if (images.length > 0) {
          await product.update({ image: images[0].image_url });
          console.log('Updated product with primary image');
        }
      }
      
      // Fetch product with images
      const productWithImages = await Product.findByPk(product.id, {
        include: [{ model: ProductImage, as: 'images' }]
      });
      
      console.log('Product creation successful - returning response');
      res.status(201).json({ 
        message: 'Product created successfully', 
        product: productWithImages 
      });
    } catch (error) {
      console.error('Error creating product:', error);
      console.error('Error stack:', error.stack);
      
      // Provide more specific error messages
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message).join(', ');
        console.log('Validation error:', validationErrors);
        return res.status(400).json({ error: `Validation error: ${validationErrors}` });
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        console.log('Unique constraint error');
        return res.status(400).json({ error: 'Product with this name already exists' });
      }
      
      if (error.name === 'SequelizeConnectionError') {
        console.log('Database connection error');
        return res.status(500).json({ error: 'Database connection error. Please try again.' });
      }
      
      console.log('Generic error - returning 500');
      res.status(500).json({ error: 'Failed to create product: ' + error.message });
    }
  });
});

// Test endpoint to debug form data
router.put('/products/:id/test', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log('🧪 Test endpoint hit');
  console.log('🧪 Headers:', req.headers);
  console.log('🧪 Body:', req.body);
  console.log('🧪 Files:', req.files);
  res.json({ message: 'Test endpoint working', data: req.body });
});

// Endpoint to show all products in database
router.get('/products/all', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const [products] = await sequelize.query('SELECT id, name, price, brand FROM products ORDER BY id');
    console.log('🔍 All products in database:', products);
    res.json({ products: products });
  } catch (error) {
    console.error('❌ Error getting all products:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// Test endpoint to check if product exists
router.get('/products/:id/check', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    console.log('🔍 Checking if product exists:', productId);
    
    // Try different methods to find the product
    let product = await Product.findByPk(productId);
    console.log('🔍 findByPk result:', product ? 'Found' : 'Not found');
    
    if (!product) {
      product = await Product.findOne({
        where: { id: productId }
      });
      console.log('🔍 findOne result:', product ? 'Found' : 'Not found');
    }
    
    if (!product) {
      product = await Product.findOne({
        where: { 
          id: productId,
          deleted_at: null
        }
      });
      console.log('🔍 findOne with deleted_at check result:', product ? 'Found' : 'Not found');
    }
    
    res.json({
      productId,
      exists: !!product,
      product: product ? {
        id: product.id,
        name: product.name,
        deleted_at: product.deleted_at
      } : null
    });
  } catch (error) {
    console.error('❌ Error checking product:', error);
    res.status(500).json({ error: 'Failed to check product' });
  }
});

// Simple direct update endpoint that bypasses Sequelize issues
router.put('/products/:id/simple', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    console.log('🔍 Simple update for product ID:', productId);
    console.log('🔍 Request body:', req.body);
    
    const { name, description, price, category_id, parts_category_id, brand, condition } = req.body;
    
    // First check if product exists with raw SQL
    const [checkResult] = await sequelize.query(
      'SELECT * FROM products WHERE id = ?',
      {
        replacements: [productId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    console.log('🔍 Product check result:', checkResult);
    
    if (!checkResult || checkResult.length === 0) {
      console.log('❌ Product not found in database');
      return res.status(404).json({ error: 'Product not found in database' });
    }
    
    console.log('✅ Product found, proceeding with update');
    
    // Use raw SQL to update the product - only update columns that exist
    const [updateResult] = await sequelize.query(
      'UPDATE products SET name = ?, description = ?, price = ?, brand = ?, `condition` = ? WHERE id = ?',
      {
        replacements: [
          name,
          description,
          parseFloat(price),
          brand,
          condition,
          productId
        ],
        type: sequelize.QueryTypes.UPDATE
      }
    );
    
    console.log('🔍 Update result:', updateResult);
    
    if (updateResult && updateResult.length > 0) {
      res.json({ 
        message: 'Product updated successfully',
        product: updateResult[0]
      });
    } else {
      res.status(500).json({ error: 'Update failed - no rows affected' });
    }
  } catch (error) {
    console.error('❌ Simple update error:', error);
    res.status(500).json({ error: 'Failed to update product: ' + error.message });
  }
});

// Super simple update endpoint - just the basics
router.put('/products/:id/basic', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    console.log('🔍 Basic update for product ID:', productId);
    console.log('🔍 Request body:', req.body);
    
    // First, let's see ALL products in the database
    const [allProducts] = await sequelize.query('SELECT id, name FROM products ORDER BY id');
    console.log('🔍 ALL PRODUCTS IN DATABASE:', allProducts);
    
    // Check if this specific product exists using Sequelize (same as GET endpoint)
    const { ProductImage } = require('../models');
    const product = await Product.findOne({
      where: {
        id: productId,
        deleted_at: null
      },
      include: [{ model: ProductImage, as: 'images' }]
    });
    
    console.log('🔍 Checking for product ID:', productId);
    console.log('🔍 Product found:', product ? 'Yes' : 'No');
    
    if (!product) {
      console.log('❌ Product not found in database');
      return res.status(404).json({ 
        error: 'Product not found',
        searchedId: productId,
        allProducts: allProducts
      });
    }
    
    console.log('✅ Product found:', product.name);
    
    const { name, description, price, brand, condition } = req.body;
    
    // Update using Sequelize (more reliable than raw SQL)
    await product.update({
      name: name || product.name,
      description: description || product.description,
      price: price ? parseFloat(price) : product.price,
      brand: brand !== undefined ? brand : product.brand,
      condition: condition || product.condition || 'New'
    });
    
    console.log('✅ Product updated successfully');
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('❌ Basic update error:', error);
    res.status(500).json({ error: 'Failed to update product: ' + error.message });
  }
});

// Alternative PUT endpoint for JSON-only updates (no files)
router.put('/products/:id/json', ensureAuthenticated, ensureAdmin, async (req, res) => {
  console.log('🔍 JSON-only PUT request received for product:', req.params.id);
  console.log('🔍 Request body:', req.body);
  
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      console.error('❌ Invalid product ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    console.log('🔍 Looking for product with ID:', productId);
    const { ProductImage } = require('../models');
    
    const product = await Product.findOne({
      where: {
        id: productId,
        deleted_at: null
      },
      include: [{ model: ProductImage, as: 'images' }]
    });
    
    if (!product) {
      console.error('❌ Product not found with ID:', productId);
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log('✅ Product found:', product.name);
    
    const { name, description, price, category_id, parts_category_id, brand, condition } = req.body;
    
    console.log('🔍 Product update request:', {
      productId,
      name,
      description,
      price,
      category_id,
      parts_category_id,
      brand,
      condition
    });
    
    // Determine the category based on what's selected
    let category = product.category;
    if (parts_category_id !== undefined && parts_category_id) {
      category = 'Motorcycle Parts';
    } else if (category_id !== undefined && category_id) {
      category = 'Motorcycle';
    }
    
    const updateData = {
      name: name || product.name,
      description: description || product.description,
      price: price ? parseFloat(price) : product.price,
      category: category,
      category_id: category_id !== undefined ? parseInt(category_id) : product.category_id,
      parts_category_id: parts_category_id !== undefined ? parseInt(parts_category_id) : product.parts_category_id,
      brand: brand !== undefined ? brand : product.brand,
      condition: condition || product.condition || 'New'
    };
    
    if (price && (isNaN(updateData.price) || updateData.price < 0)) {
      return res.status(400).json({ error: 'Invalid price' });
    }
    
    console.log('🔍 Updating product with data:', updateData);
    
    await product.update(updateData);
    console.log('✅ Product updated successfully');
    
    // Fetch updated product with images
    const updatedProduct = await Product.findByPk(productId, {
      include: [{ model: ProductImage, as: 'images' }]
    });
    
    console.log('✅ Sending success response');
    res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('❌ Error updating product:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update product: ' + error.message });
  }
});

// PUT update product with multiple images (GENERAL ROUTE - must come after specific routes)
router.put('/products/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log('🔍 PUT request received for product:', req.params.id);
  console.log('🔍 Request body:', req.body);
  console.log('🔍 Content-Type:', req.headers['content-type']);
  
  // Use multer for file uploads
  uploadMultiple.array('images', 10)(req, res, async (err) => {
    if (err) {
      console.error('❌ File upload error:', err);
      return res.status(400).json({ error: err.message });
    }
    
    try {
      const productId = parseInt(req.params.id);
      console.log('🔍 Processing update for product ID:', productId);
      
      // Use direct SQL to update the product
      const { name, description, price, category_id, parts_category_id, brand, condition } = req.body;
      
      console.log('🔍 Update data:', { name, description, price, category_id, parts_category_id, brand, condition });
      
      // Validate and parse price
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Invalid price value' });
      }
      
      // Note: category_id and parts_category_id columns don't exist in the current database schema
      // They would need to be added via migration if needed
      
      // Direct SQL update - only update columns that exist in the table
      const [updateResult] = await sequelize.query(
        'UPDATE products SET name = ?, description = ?, price = ?, brand = ?, `condition` = ? WHERE id = ?',
        {
          replacements: [
            name,
            description,
            parsedPrice,
            brand,
            condition,
            productId
          ],
          type: sequelize.QueryTypes.UPDATE
        }
      );
      
      console.log('🔍 Update result:', updateResult);
      console.log('🔍 Update result type:', typeof updateResult);
      console.log('🔍 Update result keys:', updateResult ? Object.keys(updateResult) : 'undefined');
      
      // For MySQL/MariaDB, UPDATE queries return undefined when successful
      // We need to check if the product exists first, then assume update succeeded
      
      // Check if product exists
      const checkResult = await sequelize.query(
        'SELECT id FROM products WHERE id = ?',
        {
          replacements: [productId],
          type: sequelize.QueryTypes.SELECT
        }
      );
      
      console.log('🔍 Check result:', checkResult);
      console.log('🔍 Check result length:', checkResult ? checkResult.length : 'undefined');
      
      if (checkResult && checkResult.length > 0) {
        // Product exists, update was successful
        // Handle file uploads if any
        if (req.files && req.files.length > 0) {
          console.log('🔍 Processing file uploads');
          const { ProductImage } = require('../models');
          
          // Delete existing images
          await ProductImage.destroy({ where: { product_id: productId } });
          
          // Add new images
          for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const imageUrl = `/uploads/${file.filename}`;
            
            await ProductImage.create({
              product_id: productId,
              image_url: imageUrl,
              image_name: file.originalname,
              is_primary: i === 0,
              sort_order: i
            });
          }
          
          // Update product with primary image
          await sequelize.query(
            'UPDATE products SET image = ? WHERE id = ?',
            {
              replacements: [`/uploads/${req.files[0].filename}`, productId],
              type: sequelize.QueryTypes.UPDATE
            }
          );
        }
        
        res.json({ message: 'Product updated successfully' });
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
          } catch (error) {
        console.error('❌ Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product: ' + error.message });
      }
    });
  });

// SOFT DELETE product
router.delete('/products/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const product = await Product.findOne({
      where: {
        id: productId,
        deleted_at: null
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Soft delete by setting deleted_at timestamp
    await product.update({ deleted_at: new Date() });
    
    res.json({ message: 'Product soft deleted successfully' });
  } catch (error) {
    console.error('Error soft deleting product:', error);
    res.status(500).json({ error: 'Failed to soft delete product' });
  }
});

// RESTORE soft deleted product
router.post('/products/:id/restore', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const product = await Product.findOne({
      where: {
        id: productId,
        deleted_at: { [require('sequelize').Op.ne]: null }
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Soft deleted product not found' });
    }
    
    // Restore by setting deleted_at to null
    await product.update({ deleted_at: null });
    
    res.json({ message: 'Product restored successfully', product });
  } catch (error) {
    console.error('Error restoring product:', error);
    res.status(500).json({ error: 'Failed to restore product' });
  }
});

// GET all products including soft deleted (for admin)
router.get('/products/all', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({ error: 'Failed to fetch all products' });
  }
});

// Bulk upload products from Excel (multiple files)
router.post('/products/bulk-upload', ensureAuthenticated, ensureAdmin, uploadMultiple.array('excel_files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No Excel files uploaded' });
    }
    
    const { Product, ProductImage } = require('../models');
    
    let totalProducts = 0;
    let successfulProducts = 0;
    let failedProducts = 0;
    const errors = [];
    
    console.log('Processing bulk upload with', req.files.length, 'files');
    
    for (const file of req.files) {
      try {
        console.log('Processing file:', file.originalname);
        
        // Read the Excel file
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip header row and process data
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row.length === 0) continue; // Skip empty rows
          
          totalProducts++;
          
          try {
            // Map columns to product fields
            const productData = {
              name: row[0] || '',
              description: row[1] || '',
              price: parseFloat(row[2]) || 0,
              motorcycleCategory: row[3] || '',
              partsCategory: row[4] || '',
              brand: row[5] || null,
              condition: row[6] || 'New'
            };
            
            // Validate required fields
            if (!productData.name || !productData.description || productData.price <= 0) {
              failedProducts++;
              errors.push(`Row ${i + 1}: Missing required fields (name, description, or price)`);
              continue;
            }
            
            // Handle motorcycle category
            let category_id = null;
            let category = null;
            
            if (productData.motorcycleCategory && productData.motorcycleCategory.trim()) {
              const { MotorcycleCategory } = require('../models');
              const motorcycleCategory = await MotorcycleCategory.findOne({
                where: { name: productData.motorcycleCategory.trim() }
              });
              if (motorcycleCategory) {
                category_id = motorcycleCategory.id;
                category = 'Motorcycle';
              }
            }
            
            // Handle parts category
            let parts_category_id = null;
            
            if (productData.partsCategory && productData.partsCategory.trim()) {
              const { MotorcyclePartsCategory } = require('../models');
              const partsCategory = await MotorcyclePartsCategory.findOne({
                where: { name: productData.partsCategory.trim() }
              });
              if (partsCategory) {
                parts_category_id = partsCategory.id;
                category = 'Motorcycle Parts';
              }
            }
            
            // Create product
            const product = await Product.create({
              name: productData.name.trim(),
              description: productData.description.trim(),
              price: productData.price,
              category,
              category_id,
              parts_category_id,
              brand: productData.brand ? productData.brand.trim() : null,
              condition: productData.condition || 'New'
            });
            
            successfulProducts++;
            console.log('Created product:', product.name);
            
          } catch (productError) {
            failedProducts++;
            errors.push(`Row ${i + 1}: ${productError.message}`);
            console.error('Error creating product from row', i + 1, ':', productError);
          }
        }
        
      } catch (fileError) {
        console.error('Error processing file:', file.originalname, fileError);
        errors.push(`File ${file.originalname}: ${fileError.message}`);
      }
    }
    
    // Clean up uploaded files
    for (const file of req.files) {
      try {
        const fs = require('fs');
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', file.path, cleanupError);
      }
    }
    
    const result = {
      message: `Bulk upload completed. ${successfulProducts} products created successfully.`,
      total_files: req.files.length,
      total_products: totalProducts,
      successful_products: successfulProducts,
      failed_products: failedProducts,
      errors: errors.length > 0 ? errors.slice(0, 10) : [] // Limit error messages
    };
    
    if (failedProducts > 0) {
      result.message += ` ${failedProducts} products failed to import.`;
    }
    
    console.log('Bulk upload result:', result);
    res.json(result);
    
  } catch (error) {
    console.error('Error in bulk upload:', error);
    res.status(500).json({ error: 'Failed to process bulk upload: ' + error.message });
  }
});

// Dashboard statistics endpoints
router.get('/dashboard/stats', ensureAuthenticated, async (req, res) => {
  try {
    // Get total products count (excluding soft deleted)
    const totalProducts = await Product.count({
      where: {
        deleted_at: null
      }
    });

    // Calculate total revenue from all products
    const products = await Product.findAll({
      where: {
        deleted_at: null
      },
      attributes: ['price']
    });

    const totalRevenue = products.reduce((sum, product) => {
      return sum + parseFloat(product.price || 0);
    }, 0);

    // Get total customers (users count)
    const totalCustomers = await User.count();

    // Get active users (users who have logged in recently)
    const activeUsers = await User.count({
      where: {
        is_active: true
      }
    });

    res.json({
      products: totalProducts,
      revenue: totalRevenue.toFixed(2),
      customers: totalCustomers,
      activeUsers: activeUsers
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Login history endpoint with pagination and filtering
router.get('/login-history', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { LoginHistory, User } = require('../models');
    const { Op } = require('sequelize');
    
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Build where clause for filtering
    const whereClause = {};
    
    if (req.query.email) {
      whereClause.email = { [Op.like]: `%${req.query.email}%` };
    }
    
    if (req.query.status) {
      whereClause.status = req.query.status;
    }
    
    if (req.query.dateFrom || req.query.dateTo) {
      whereClause.login_time = {};
      if (req.query.dateFrom) {
        whereClause.login_time[Op.gte] = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        whereClause.login_time[Op.lte] = new Date(req.query.dateTo + ' 23:59:59');
      }
    }
    
    // Get login history with pagination
    const { count, rows: loginHistory } = await LoginHistory.findAndCountAll({
      where: whereClause,
      order: [['login_time', 'DESC']],
      limit: limit,
      offset: offset,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'full_name', 'email', 'dealership_name']
        }
      ]
    });
    
    // Calculate statistics
    const stats = await Promise.all([
      LoginHistory.count(),
      LoginHistory.count({ where: { status: 'success' } }),
      LoginHistory.count({ where: { status: 'failed' } }),
      LoginHistory.count({
        where: {
          login_time: {
            [Op.gte]: new Date().setHours(0, 0, 0, 0)
          }
        }
      })
    ]);
    
    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      totalItems: count,
      itemsPerPage: limit
    };
    
    const statsData = {
      total: stats[0],
      successful: stats[1],
      failed: stats[2],
      today: stats[3]
    };
    
    res.json({
      loginHistory: loginHistory,
      pagination: pagination,
      stats: statsData
    });
    
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

// Export login history to CSV
router.get('/login-history/export', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { LoginHistory, User } = require('../models');
    const { Op } = require('sequelize');
    
    // Build where clause for filtering
    const whereClause = {};
    
    if (req.query.email) {
      whereClause.email = { [Op.like]: `%${req.query.email}%` };
    }
    
    if (req.query.status) {
      whereClause.status = req.query.status;
    }
    
    if (req.query.dateFrom || req.query.dateTo) {
      whereClause.login_time = {};
      if (req.query.dateFrom) {
        whereClause.login_time[Op.gte] = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        whereClause.login_time[Op.lte] = new Date(req.query.dateTo + ' 23:59:59');
      }
    }
    
    // Get all login history for export
    const loginHistory = await LoginHistory.findAll({
      where: whereClause,
      order: [['login_time', 'DESC']],
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'full_name', 'email', 'dealership_name']
        }
      ]
    });
    
    // Generate CSV content
    const csvHeader = 'ID,User Name,Email,IP Address,Status,Failure Reason,Login Time,User Agent\n';
    const csvRows = loginHistory.map(login => {
      const userName = login.User ? login.User.full_name : 'Unknown User';
      const dealershipName = login.User ? login.User.dealership_name : 'N/A';
      const failureReason = login.failure_reason || '';
      const userAgent = (login.user_agent || '').replace(/"/g, '""'); // Escape quotes
      
      return `${login.id},"${userName}","${login.email}","${login.ip_address}","${login.status}","${failureReason}","${login.login_time}","${userAgent}"`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="login-history-${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error exporting login history:', error);
    res.status(500).json({ error: 'Failed to export login history' });
  }
});

// Mount notification routes
router.use('/notifications', notificationRoutes);

// Charts data endpoints for 3D visualizations
router.get('/charts/sales-data', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching sales data for charts...');
    
    // Get transactions grouped by month
    const transactions = await Transaction.findAll({
      include: [
        { model: Product, attributes: ['name', 'category'] },
        { model: User, attributes: ['full_name', 'dealership_name'] }
      ],
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('Transaction.createdAt'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('Transaction.total_amount')), 'total_amount']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('Transaction.createdAt'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('Transaction.createdAt'), '%Y-%m'), 'ASC']],
      raw: true
    });

    // Get location-based data (using dealership names as locations)
    let locationData = [];
    try {
      locationData = await Transaction.findAll({
        include: [
          { model: User, attributes: ['dealership_name'] }
        ],
        attributes: [
          [sequelize.col('User.dealership_name'), 'location'],
          [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('Transaction.total_amount')), 'total_amount']
        ],
        group: [sequelize.col('User.dealership_name')],
        order: [[sequelize.fn('SUM', sequelize.col('Transaction.total_amount')), 'DESC']],
        limit: 5,
        raw: true
      });
    } catch (error) {
      console.log('⚠️ No location data available:', error.message);
    }

    const response = {
      transactions: transactions,
      locations: locationData,
      totalSales: transactions.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0),
      totalTransactions: transactions.reduce((sum, t) => sum + parseInt(t.count || 0), 0)
    };

    console.log('✅ Sales data fetched successfully');
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching sales data:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

router.get('/charts/transaction-stats', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching transaction statistics...');
    
    // Get transaction status distribution
    const statusStats = await Transaction.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('total_amount')), 'avg_amount']
      ],
      group: ['status'],
      raw: true
    });

    // Get recent transactions with details
    let recentTransactions = [];
    try {
      recentTransactions = await Transaction.findAll({
        include: [
          { model: Product, attributes: ['name', 'category'] },
          { model: User, attributes: ['full_name', 'dealership_name'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: 10,
        raw: true,
        nest: true
      });
    } catch (error) {
      console.log('⚠️ No recent transactions available:', error.message);
    }

    const response = {
      statusDistribution: statusStats,
      recentTransactions: recentTransactions,
      totalTransactions: await Transaction.count(),
      totalRevenue: await Transaction.sum('total_amount')
    };

    console.log('✅ Transaction stats fetched successfully');
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching transaction stats:', error);
    res.status(500).json({ error: 'Failed to fetch transaction statistics' });
  }
});

router.get('/charts/user-analytics', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching user analytics...');
    
    // Get user registration by month
    const userRegistrations = await User.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'ASC']],
      raw: true
    });

    // Get user role distribution (simplified without Role model)
    const roleDistribution = await User.findAll({
      attributes: [
        'role_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['role_id'],
      raw: true
    });

    const response = {
      registrations: userRegistrations,
      roleDistribution: roleDistribution,
      totalUsers: await User.count(),
      activeUsers: await User.count({ where: { is_active: true } })
    };

    console.log('✅ User analytics fetched successfully');
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching user analytics:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

router.get('/charts/product-categories', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching product category data...');
    
    // Get product categories with counts and average prices
    const categoryStats = await Product.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('price')), 'avg_price'],
        [sequelize.fn('SUM', sequelize.col('price')), 'total_value']
      ],
      where: { deleted_at: null },
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    });

    // Get top products by category
    const topProducts = await Product.findAll({
      attributes: ['name', 'category', 'price'],
      where: { deleted_at: null },
      order: [['price', 'DESC']],
      limit: 10,
      raw: true
    });

    const response = {
      categories: categoryStats,
      topProducts: topProducts,
      totalProducts: await Product.count({ where: { deleted_at: null } }),
      totalValue: await Product.sum('price', { where: { deleted_at: null } })
    };

    console.log('✅ Product category data fetched successfully');
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching product category data:', error);
    res.status(500).json({ error: 'Failed to fetch product category data' });
  }
});

module.exports = router;
