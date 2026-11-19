const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const { Service, ServiceImage } = require('../models');

// Configure multer for file uploads
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

// GET all services
router.get('/', async (req, res) => {
  try {
    const services = await Service.findAll({
      include: [{ model: ServiceImage, as: 'images' }],
      order: [['created_at', 'DESC']]
    });
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET service statistics
router.get('/stats', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching service statistics...');
    
    // Get total services count
    const totalServices = await Service.count();
    console.log('Total services:', totalServices);

    // Get active services count
    const activeServices = await Service.count({
      where: { status: 'Active' }
    });
    console.log('Active services:', activeServices);

    // Calculate total revenue from all services
    const services = await Service.findAll({
      attributes: ['price']
    });
    console.log('Services found:', services.length);

    const totalRevenue = services.reduce((sum, service) => {
      return sum + parseFloat(service.price || 0);
    }, 0);
    console.log('Total revenue:', totalRevenue);

    // Get unique categories count
    const categories = await Service.findAll({
      attributes: ['category'],
      group: ['category']
    });
    console.log('Categories found:', categories.length);

    const response = {
      services: totalServices,
      activeServices: activeServices,
      revenue: totalRevenue,
      categories: categories.length
    };
    
    console.log('📊 Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching service stats:', error);
    res.status(500).json({ error: 'Failed to fetch service statistics' });
  }
});

// GET single service
router.get('/:id', async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }
    
    const service = await Service.findByPk(serviceId, {
      include: [{ model: ServiceImage, as: 'images' }]
    });
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// POST create service with multiple images
router.post('/', ensureAuthenticated, ensureAdmin, (req, res) => {
  uploadMultiple.array('images', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    try {
      const { name, description, price, category, duration, status } = req.body;
      
      // Validate required fields
      if (!name || !description || !price) {
        return res.status(400).json({ error: 'Name, description, and price are required' });
      }
      
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'Invalid price' });
      }
      
             // Create service
       const service = await Service.create({
         name,
         description,
         price: priceNum,
         category: category || null,
         duration: duration || null,
         status: status || 'Active'
       });
      
      // Handle multiple images
      const images = [];
      
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const imageUrl = `/uploads/${file.filename}`;
          
          const serviceImage = await ServiceImage.create({
            service_id: service.id,
            image_url: imageUrl,
            image_name: file.originalname,
            is_primary: i === 0, // First image is primary
            sort_order: i
          });
          
          images.push(serviceImage);
        }
      }
      
      // Fetch service with images
      const serviceWithImages = await Service.findByPk(service.id, {
        include: [{ model: ServiceImage, as: 'images' }]
      });
      
      res.status(201).json({ 
        message: 'Service created successfully', 
        service: serviceWithImages 
      });
    } catch (error) {
      console.error('Error creating service:', error);
      res.status(500).json({ error: 'Failed to create service' });
    }
  });
});

// PUT update service with multiple images
router.put('/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  uploadMultiple.array('images', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    try {
      const serviceId = parseInt(req.params.id);
      if (isNaN(serviceId)) {
        return res.status(400).json({ error: 'Invalid service ID' });
      }
      
      const service = await Service.findByPk(serviceId, {
        include: [{ model: ServiceImage, as: 'images' }]
      });
      
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const { name, description, price, category, duration, status } = req.body;
             const updateData = {
         name: name || service.name,
         description: description || service.description,
         price: price ? parseFloat(price) : service.price,
         category: category !== undefined ? category : service.category,
         duration: duration !== undefined ? duration : service.duration,
         status: status || service.status || 'Active'
       };
      
      if (price && (isNaN(updateData.price) || updateData.price < 0)) {
        return res.status(400).json({ error: 'Invalid price' });
      }
      
      // Handle new images if uploaded
      if (req.files && req.files.length > 0) {
        // Delete existing images
        await ServiceImage.destroy({ where: { service_id: serviceId } });
        
        // Add new images
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const imageUrl = `/uploads/${file.filename}`;
          
          await ServiceImage.create({
            service_id: serviceId,
            image_url: imageUrl,
            image_name: file.originalname,
            is_primary: i === 0,
            sort_order: i
          });
        }
      }
      
      await service.update(updateData);
      
      // Fetch updated service with images
      const updatedService = await Service.findByPk(serviceId, {
        include: [{ model: ServiceImage, as: 'images' }]
      });
      
      res.json({ message: 'Service updated successfully', service: updatedService });
    } catch (error) {
      console.error('Error updating service:', error);
      res.status(500).json({ error: 'Failed to update service' });
    }
  });
});

// DELETE service
router.delete('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }
    
    const service = await Service.findByPk(serviceId);
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Delete associated images first
    await ServiceImage.destroy({ where: { service_id: serviceId } });
    
    // Delete the service
    await service.destroy();
    
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// Bulk upload services from Excel (multiple files)
router.post('/bulk-upload', ensureAuthenticated, ensureAdmin, uploadMultiple.array('excel_files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No Excel files uploaded' });
    }
    
    console.log(`🔍 Processing ${req.files.length} Excel files for services bulk upload`);
    
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    const results = [];
    
    for (const file of req.files) {
      try {
        console.log(`📊 Processing file: ${file.originalname}`);
        
        // Read Excel file
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length < 2) {
          results.push({
            file: file.originalname,
            status: 'error',
            message: 'Excel file must have at least a header row and one data row'
          });
          totalErrors++;
          continue;
        }
        
        const headers = data[0];
        const rows = data.slice(1);
        
        console.log(`📋 Headers: ${headers.join(', ')}`);
        console.log(`📊 Processing ${rows.length} rows from ${file.originalname}`);
        
        let fileSuccess = 0;
        let fileErrors = 0;
        
        for (const row of rows) {
          try {
            // Map Excel columns to service fields
            const serviceData = {
              name: row[headers.indexOf('Name')] || row[0],
              description: row[headers.indexOf('Description')] || row[1],
              price: parseFloat(row[headers.indexOf('Price')] || row[2]) || 0,
              category: row[headers.indexOf('Category')] || row[3] || 'Maintenance',
              duration: parseFloat(row[headers.indexOf('Duration')] || row[4]) || 1,
              status: row[headers.indexOf('Status')] || row[5] || 'Active'
            };
            
            // Validate required fields
            if (!serviceData.name || !serviceData.description || serviceData.price <= 0) {
              console.log(`❌ Invalid service data: ${JSON.stringify(serviceData)}`);
              fileErrors++;
              continue;
            }
            
            // Create service
            const service = await Service.create(serviceData);
            console.log(`✅ Service created: ${service.name} (ID: ${service.id})`);
            fileSuccess++;
            
          } catch (rowError) {
            console.error(`❌ Error processing row:`, rowError);
            fileErrors++;
          }
        }
        
        totalProcessed += rows.length;
        totalSuccess += fileSuccess;
        totalErrors += fileErrors;
        
        results.push({
          file: file.originalname,
          status: 'success',
          processed: rows.length,
          success: fileSuccess,
          errors: fileErrors
        });
        
        console.log(`✅ File ${file.originalname} processed: ${fileSuccess} success, ${fileErrors} errors`);
        
      } catch (fileError) {
        console.error(`❌ Error processing file ${file.originalname}:`, fileError);
        results.push({
          file: file.originalname,
          status: 'error',
          message: fileError.message
        });
        totalErrors++;
      }
    }
    
    console.log(`📊 Bulk upload complete: ${totalSuccess} services created, ${totalErrors} errors`);
    
    res.json({ 
      message: `Bulk upload completed successfully`,
      total_files: req.files.length,
      total_processed: totalProcessed,
      total_success: totalSuccess,
      total_errors: totalErrors,
      results: results,
      note: `${totalSuccess} services were successfully added to the database`
    });
    
  } catch (error) {
    console.error('❌ Error in bulk upload:', error);
    res.status(500).json({ error: 'Failed to process bulk upload' });
  }
});

module.exports = router; 