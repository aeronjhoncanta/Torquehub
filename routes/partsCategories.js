const express = require('express');
const router = express.Router();
const MotorcyclePartsCategory = require('../models/motorcyclePartsCategory');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// Get all parts categories
router.get('/', async (req, res) => {
    try {
        const categories = await MotorcyclePartsCategory.findAll({
            where: { is_active: true },
            order: [['sort_order', 'ASC'], ['name', 'ASC']]
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching parts categories:', error);
        res.status(500).json({ error: 'Failed to fetch parts categories' });
    }
});

// Get all parts categories (admin - including inactive)
router.get('/admin', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const categories = await MotorcyclePartsCategory.findAll({
            order: [['sort_order', 'ASC'], ['name', 'ASC']]
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching parts categories:', error);
        res.status(500).json({ error: 'Failed to fetch parts categories' });
    }
});

// Get parts category by ID
router.get('/:id', async (req, res) => {
    try {
        const category = await MotorcyclePartsCategory.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Parts category not found' });
        }
        res.json(category);
    } catch (error) {
        console.error('Error fetching parts category:', error);
        res.status(500).json({ error: 'Failed to fetch parts category' });
    }
});

// Create new parts category (admin only)
router.post('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { name, description, icon, color, sort_order } = req.body;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        // Check if category name already exists
        const existingCategory = await MotorcyclePartsCategory.findOne({ where: { name } });
        if (existingCategory) {
            return res.status(400).json({ error: 'Category name already exists' });
        }

        const category = await MotorcyclePartsCategory.create({
            name,
            description,
            icon: icon || 'fas fa-cog',
            color: color || '#B399D4',
            sort_order: sort_order || 0
        });

        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating parts category:', error);
        res.status(500).json({ error: 'Failed to create parts category' });
    }
});

// Update parts category (admin only)
router.put('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { name, description, icon, color, sort_order, is_active } = req.body;
        
        const category = await MotorcyclePartsCategory.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Parts category not found' });
        }

        // Check if new name conflicts with existing category
        if (name && name !== category.name) {
            const existingCategory = await MotorcyclePartsCategory.findOne({ where: { name } });
            if (existingCategory) {
                return res.status(400).json({ error: 'Category name already exists' });
            }
        }

        await category.update({
            name: name || category.name,
            description: description !== undefined ? description : category.description,
            icon: icon || category.icon,
            color: color || category.color,
            sort_order: sort_order !== undefined ? sort_order : category.sort_order,
            is_active: is_active !== undefined ? is_active : category.is_active
        });

        res.json(category);
    } catch (error) {
        console.error('Error updating parts category:', error);
        res.status(500).json({ error: 'Failed to update parts category' });
    }
});

// Delete parts category (admin only)
router.delete('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const category = await MotorcyclePartsCategory.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Parts category not found' });
        }

        // Check if category has associated products
        const Product = require('../models/product');
        const productCount = await Product.count({ where: { parts_category_id: req.params.id } });
        
        if (productCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with associated products',
                productCount 
            });
        }

        await category.destroy();
        res.json({ message: 'Parts category deleted successfully' });
    } catch (error) {
        console.error('Error deleting parts category:', error);
        res.status(500).json({ error: 'Failed to delete parts category' });
    }
});

// Get parts categories with product count
router.get('/stats/with-counts', async (req, res) => {
    try {
        const Product = require('../models/product');
        const { sequelize } = require('../models/index');
        const categories = await MotorcyclePartsCategory.findAll({
            where: { is_active: true },
            order: [['sort_order', 'ASC'], ['name', 'ASC']],
            include: [{
                model: Product,
                as: 'partsProducts',
                attributes: []
            }],
            attributes: {
                include: [
                    [sequelize.fn('COUNT', sequelize.col('partsProducts.id')), 'product_count']
                ]
            },
            group: ['MotorcyclePartsCategory.id']
        });

        res.json(categories);
    } catch (error) {
        console.error('Error fetching parts categories with counts:', error);
        res.status(500).json({ error: 'Failed to fetch parts categories with counts' });
    }
});

module.exports = router; 