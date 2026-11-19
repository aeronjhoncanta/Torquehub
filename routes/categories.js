const express = require('express');
const router = express.Router();
const MotorcycleCategory = require('../models/motorcycleCategory');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// Get all categories
router.get('/', async (req, res) => {
    try {
        const categories = await MotorcycleCategory.findAll({
            where: { is_active: true },
            order: [['sort_order', 'ASC'], ['name', 'ASC']]
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get all categories (admin - including inactive)
router.get('/admin', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const categories = await MotorcycleCategory.findAll({
            order: [['sort_order', 'ASC'], ['name', 'ASC']]
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get category by ID
router.get('/:id', async (req, res) => {
    try {
        const category = await MotorcycleCategory.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Create new category (admin only)
router.post('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { name, description, icon, color, sort_order } = req.body;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        // Check if category name already exists
        const existingCategory = await MotorcycleCategory.findOne({ where: { name } });
        if (existingCategory) {
            return res.status(400).json({ error: 'Category name already exists' });
        }

        const category = await MotorcycleCategory.create({
            name,
            description,
            icon: icon || 'fas fa-motorcycle',
            color: color || '#B399D4',
            sort_order: sort_order || 0
        });

        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category (admin only)
router.put('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { name, description, icon, color, sort_order, is_active } = req.body;
        
        const category = await MotorcycleCategory.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Check if new name conflicts with existing category
        if (name && name !== category.name) {
            const existingCategory = await MotorcycleCategory.findOne({ where: { name } });
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
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category (admin only)
router.delete('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const category = await MotorcycleCategory.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Check if category has associated products
        const Product = require('../models/product');
        const productCount = await Product.count({ where: { category_id: req.params.id } });
        
        if (productCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with associated products',
                productCount 
            });
        }

        await category.destroy();
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Get categories with product count
router.get('/stats/with-counts', async (req, res) => {
    try {
        const Product = require('../models/product');
        const { sequelize } = require('../models/index');
        const categories = await MotorcycleCategory.findAll({
            where: { is_active: true },
            order: [['sort_order', 'ASC'], ['name', 'ASC']],
            include: [{
                model: Product,
                as: 'products',
                attributes: []
            }],
            attributes: {
                include: [
                    [sequelize.fn('COUNT', sequelize.col('products.id')), 'product_count']
                ]
            },
            group: ['MotorcycleCategory.id']
        });

        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories with counts:', error);
        res.status(500).json({ error: 'Failed to fetch categories with counts' });
    }
});

module.exports = router; 