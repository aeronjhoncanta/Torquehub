const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { FileUpload, User, Product, Transaction, Service } = require('../models');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// Test endpoint to check if route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Uploads route is working', timestamp: new Date().toISOString() });
});

// Configure multer for multiple file uploads
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Accept images, documents, and other common file types
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Bulk Excel upload endpoint
router.post('/bulk-excel', ensureAuthenticated, ensureAdmin, upload.single('excel_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    const importType = req.body.import_type || 'products'; // products, users, transactions
    const filePath = req.file.path;
    
    console.log(`🔍 Processing Excel file: ${req.file.originalname}`);
    console.log(`📊 Import type: ${importType}`);

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 2) {
      return res.status(400).json({ error: 'Excel file must have at least a header row and one data row' });
    }

    const headers = data[0];
    const rows = data.slice(1);
    
    console.log(`📋 Headers: ${headers.join(', ')}`);
    console.log(`📊 Processing ${rows.length} rows`);

    let results = {
      total: rows.length,
      success: 0,
      errors: 0,
      details: []
    };

    // Process based on import type
    switch (importType) {
      case 'services':
        results = await processServicesImport(headers, rows, req.user.id);
        break;
      case 'products':
        results = await processProductImport(headers, rows, req.user.id);
        break;
      case 'users':
        results = await processUserImport(headers, rows, req.user.id);
        break;
      case 'transactions':
        results = await processTransactionImport(headers, rows, req.user.id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid import type. Use: services, products, users, or transactions' });
    }

    // Save file upload record
    await FileUpload.create({
      user_id: req.user.id,
      original_name: req.file.originalname,
      file_name: req.file.filename,
      file_path: `/uploads/${req.file.filename}`,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      upload_type: `bulk_${importType}_import`
    });

    console.log(`✅ Bulk import completed: ${results.success} successful, ${results.errors} errors`);

    res.json({
      message: `Bulk import completed: ${results.success} successful, ${results.errors} errors`,
      results: results
    });

  } catch (error) {
    console.error('❌ Bulk Excel import error:', error);
    res.status(500).json({ error: 'Failed to process Excel file: ' + error.message });
  }
});

// Process services import
async function processServicesImport(headers, rows, userId) {
  const results = { total: rows.length, success: 0, errors: 0, details: [] };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Map Excel columns to service fields
      const serviceData = {
        name: row[headers.indexOf('name')] || row[headers.indexOf('Name')] || row[headers.indexOf('NAME')] || '',
        description: row[headers.indexOf('description')] || row[headers.indexOf('Description')] || '',
        price: parseFloat(row[headers.indexOf('price')] || row[headers.indexOf('Price')] || 0),
        category: row[headers.indexOf('category')] || row[headers.indexOf('Category')] || 'General',
        duration: parseFloat(row[headers.indexOf('duration')] || row[headers.indexOf('Duration')] || 1),
        status: row[headers.indexOf('status')] || row[headers.indexOf('Status')] || 'Active',
        created_by: userId
      };

      if (!serviceData.name || !serviceData.description || !serviceData.price) {
        throw new Error('Service name, description, and price are required');
      }

      await Service.create(serviceData);
      results.success++;
      results.details.push({ row: i + 2, status: 'success', message: `Service "${serviceData.name}" imported` });
      
    } catch (error) {
      results.errors++;
      results.details.push({ row: i + 2, status: 'error', message: error.message });
    }
  }
  
  return results;
}

// Process product import
async function processProductImport(headers, rows, userId) {
  const results = { total: rows.length, success: 0, errors: 0, details: [] };
  
  // Get category mappings
  const { MotorcycleCategory, MotorcyclePartsCategory } = require('../models');
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Map Excel columns to product fields
      const productData = {
        name: row[headers.indexOf('name')] || row[headers.indexOf('Name')] || row[headers.indexOf('NAME')] || '',
        description: row[headers.indexOf('description')] || row[headers.indexOf('Description')] || '',
        price: parseFloat(row[headers.indexOf('price')] || row[headers.indexOf('Price')] || 0),
        brand: row[headers.indexOf('brand')] || row[headers.indexOf('Brand')] || null,
        condition: row[headers.indexOf('condition')] || row[headers.indexOf('Condition')] || 'New',
        stock_quantity: parseInt(row[headers.indexOf('stock_quantity')] || row[headers.indexOf('Stock')] || row[headers.indexOf('Stock Quantity')] || 0),
        image: row[headers.indexOf('image')] || row[headers.indexOf('Image')] || null,
        created_by: userId
      };

      if (!productData.name) {
        throw new Error('Product name is required');
      }

      // Handle motorcycle category
      const motorcycleCategoryName = row[headers.indexOf('motorcycle category')] || row[headers.indexOf('Motorcycle Category')] || '';
      let category_id = null;
      let category = null;
      
      if (motorcycleCategoryName && motorcycleCategoryName.trim()) {
        const motorcycleCategory = await MotorcycleCategory.findOne({
          where: { name: motorcycleCategoryName.trim() }
        });
        if (motorcycleCategory) {
          category_id = motorcycleCategory.id;
          category = 'Motorcycle';
        }
      }

      // Handle parts category
      const partsCategoryName = row[headers.indexOf('parts category')] || row[headers.indexOf('Parts Category')] || '';
      let parts_category_id = null;
      
      if (partsCategoryName && partsCategoryName.trim()) {
        const partsCategory = await MotorcyclePartsCategory.findOne({
          where: { name: partsCategoryName.trim() }
        });
        if (partsCategory) {
          parts_category_id = partsCategory.id;
          category = 'Motorcycle Parts';
        }
      }

      // Create product with category information
      const product = await Product.create({
        ...productData,
        category,
        category_id,
        parts_category_id
      });

      results.success++;
      results.details.push({ row: i + 2, status: 'success', message: `Product "${productData.name}" imported` });
      
    } catch (error) {
      results.errors++;
      results.details.push({ row: i + 2, status: 'error', message: error.message });
    }
  }
  
  return results;
}

// Process user import
async function processUserImport(headers, rows, userId) {
  const results = { total: rows.length, success: 0, errors: 0, details: [] };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Map Excel columns to user fields
      const userData = {
        full_name: row[headers.indexOf('full_name')] || row[headers.indexOf('Full Name')] || row[headers.indexOf('Name')] || '',
        email: row[headers.indexOf('email')] || row[headers.indexOf('Email')] || '',
        dealership_name: row[headers.indexOf('dealership_name')] || row[headers.indexOf('Dealership Name')] || row[headers.indexOf('Company')] || '',
        password_hash: row[headers.indexOf('password_hash')] || row[headers.indexOf('Password')] || 'default123',
        role_id: parseInt(row[headers.indexOf('role_id')] || row[headers.indexOf('Role ID')] || 1),
        is_active: row[headers.indexOf('is_active')] || row[headers.indexOf('Is Active')] || true
      };

      if (!userData.full_name || !userData.email) {
        throw new Error('Full name and email are required');
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: userData.email } });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      await User.create(userData);
      results.success++;
      results.details.push({ row: i + 2, status: 'success', message: `User "${userData.full_name}" imported` });
      
    } catch (error) {
      results.errors++;
      results.details.push({ row: i + 2, status: 'error', message: error.message });
    }
  }
  
  return results;
}

// Process transaction import
async function processTransactionImport(headers, rows, userId) {
  const results = { total: rows.length, success: 0, errors: 0, details: [] };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Map Excel columns to transaction fields
      const transactionData = {
        user_id: parseInt(row[headers.indexOf('user_id')] || row[headers.indexOf('User ID')] || 0),
        product_id: parseInt(row[headers.indexOf('product_id')] || row[headers.indexOf('Product ID')] || 0),
        quantity: parseInt(row[headers.indexOf('quantity')] || row[headers.indexOf('Quantity')] || 1),
        total_amount: parseFloat(row[headers.indexOf('total_amount')] || row[headers.indexOf('Total Amount')] || 0),
        status: row[headers.indexOf('status')] || row[headers.indexOf('Status')] || 'pending',
        payment_method: row[headers.indexOf('payment_method')] || row[headers.indexOf('Payment Method')] || 'cash',
        shipping_address: row[headers.indexOf('shipping_address')] || row[headers.indexOf('Shipping Address')] || '',
        notes: row[headers.indexOf('notes')] || row[headers.indexOf('Notes')] || ''
      };

      if (!transactionData.user_id || !transactionData.product_id) {
        throw new Error('User ID and Product ID are required');
      }

      // Verify user and product exist
      const user = await User.findByPk(transactionData.user_id);
      const product = await Product.findByPk(transactionData.product_id);
      
      if (!user) {
        throw new Error(`User with ID ${transactionData.user_id} not found`);
      }
      if (!product) {
        throw new Error(`Product with ID ${transactionData.product_id} not found`);
      }

      await Transaction.create(transactionData);
      results.success++;
      results.details.push({ row: i + 2, status: 'success', message: `Transaction imported for user ${user.full_name}` });
      
    } catch (error) {
      results.errors++;
      results.details.push({ row: i + 2, status: 'error', message: error.message });
    }
  }
  
  return results;
}

// Template download endpoints
router.get('/templates/:type', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    console.log(`📥 Generating ${type} template...`);

    let headers = [];
    let sampleData = [];

    switch (type) {
      case 'services':
        headers = ['Name', 'Description', 'Price', 'Category', 'Duration', 'Status'];
        sampleData = [
          ['Oil Change Service', 'Complete oil change with premium oil', '99.99', 'Maintenance', '2', 'Active'],
          ['Brake Inspection', 'Comprehensive brake system check', '149.99', 'Repair', '1.5', 'Active'],
          ['Tire Rotation', 'Tire rotation and balance service', '79.99', 'Maintenance', '1', 'Active']
        ];
        break;
      case 'products':
        headers = ['Name', 'Description', 'Price', 'Motorcycle Category', 'Parts Category', 'Brand', 'Condition', 'Stock', 'Status'];
        sampleData = [
          ['Yamaha R1', 'High-performance sport motorcycle', '15999.99', 'Sport Bikes', '', 'Yamaha', 'New', '5', 'Active'],
          ['Brake Pads Set', 'Ceramic brake pads for all vehicles', '89.99', '', 'Brake System', 'Premium Parts', 'New', '25', 'Active'],
          ['Harley Davidson', 'Classic cruiser motorcycle', '22500.00', 'Cruisers', '', 'Harley Davidson', 'New', '3', 'Active'],
          ['Engine Oil Filter', 'High-quality oil filter replacement', '29.99', '', 'Engine Parts', 'MotorTech', 'New', '100', 'Active']
        ];
        break;
      case 'users':
        headers = ['Full Name', 'Email', 'Phone', 'Dealership Name', 'Role', 'Status'];
        sampleData = [
          ['John Doe', 'john@example.com', '+1234567890', 'ABC Motors', 'user', 'active'],
          ['Jane Smith', 'jane@example.com', '+0987654321', 'XYZ Auto', 'admin', 'active'],
          ['Mike Johnson', 'mike@example.com', '+1122334455', 'City Cars', 'user', 'active']
        ];
        break;
      case 'transactions':
        headers = ['User ID', 'Product ID', 'Service ID', 'Quantity', 'Total Amount', 'Status'];
        sampleData = [
          ['1', '1', '1', '1', '99.99', 'completed'],
          ['2', '2', '2', '1', '149.99', 'pending'],
          ['3', '3', '3', '2', '159.98', 'completed']
        ];
        break;
      default:
        return res.status(400).json({ error: 'Invalid template type' });
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

    // Set column widths
    const colWidths = headers.map(() => ({ width: 20 }));
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, `${type.charAt(0).toUpperCase() + type.slice(1)} Template`);

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-template.xlsx"`);
    res.setHeader('Content-Length', buffer.length);

    console.log(`✅ ${type} template generated successfully`);
    res.send(buffer);
  } catch (error) {
    console.error(`❌ Error generating ${req.params.type} template:`, error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// POST upload multiple files
router.post('/', ensureAuthenticated, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadType = req.body.upload_type || 'general';
    const uploadedFiles = [];

    for (const file of req.files) {
      const fileUpload = await FileUpload.create({
        user_id: req.user.id,
        original_name: file.originalname,
        file_name: file.filename,
        file_path: `/uploads/${file.filename}`,
        file_size: file.size,
        mime_type: file.mimetype,
        upload_type: uploadType
      });

      uploadedFiles.push({
        id: fileUpload.id,
        original_name: fileUpload.original_name,
        file_name: fileUpload.file_name,
        file_path: fileUpload.file_path,
        file_size: fileUpload.file_size,
        mime_type: fileUpload.mime_type,
        upload_type: fileUpload.upload_type,
        created_at: fileUpload.createdAt
      });
    }

    res.status(201).json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// GET user's uploaded files
router.get('/my-files', ensureAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 10, upload_type } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { user_id: req.user.id };
    if (upload_type) {
      whereClause.upload_type = upload_type;
    }

    const files = await FileUpload.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      files: files.rows,
      total: files.count,
      current_page: parseInt(page),
      total_pages: Math.ceil(files.count / limit)
    });
  } catch (error) {
    console.error('Error fetching user files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// GET all uploaded files (admin only)
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, upload_type, user_id } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (upload_type) {
      whereClause.upload_type = upload_type;
    }
    if (user_id) {
      whereClause.user_id = user_id;
    }

    const files = await FileUpload.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'full_name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      files: files.rows,
      total: files.count,
      current_page: parseInt(page),
      total_pages: Math.ceil(files.count / limit)
    });
  } catch (error) {
    console.error('Error fetching all files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// GET single file
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const file = await FileUpload.findOne({
      where: { id: fileId },
      include: [
        {
          model: User,
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user is admin or owns the file
    if (req.user.role !== 'Admin' && file.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// DELETE file
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const file = await FileUpload.findByPk(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user is admin or owns the file
    if (req.user.role !== 'Admin' && file.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete physical file
    const fs = require('fs');
    const filePath = path.join(__dirname, '../public', file.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete database record
    await file.destroy();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET file statistics (admin only)
router.get('/stats/overview', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const totalFiles = await FileUpload.count();
    const totalSize = await FileUpload.sum('file_size');
    
    const fileTypes = await FileUpload.findAll({
      attributes: [
        'mime_type',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['mime_type'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']]
    });

    res.json({
      total_files: totalFiles,
      total_size: totalSize || 0,
      file_types: fileTypes
    });
  } catch (error) {
    console.error('Error fetching file stats:', error);
    res.status(500).json({ error: 'Failed to fetch file statistics' });
  }
});

module.exports = router; 