const { DataTypes } = require('sequelize');
const sequelize = require('./index').sequelize;

const Product = sequelize.define('Product', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'motorcycle_categories',
      key: 'id'
    }
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true
  },
  condition: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'New'
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  }
}, {
  timestamps: true,
  paranoid: true // This enables soft deletes automatically
});

// Define associations
const MotorcycleCategory = require('./motorcycleCategory');

Product.belongsTo(MotorcycleCategory, {
  foreignKey: 'category_id',
  as: 'motorcycleCategory'
});

MotorcycleCategory.hasMany(Product, {
  foreignKey: 'category_id',
  as: 'products'
});

module.exports = Product; 