const { DataTypes } = require('sequelize');
const sequelize = require('./index').sequelize;

const MotorcycleCategory = sequelize.define('MotorcycleCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'fas fa-motorcycle'
  },
  color: {
    type: DataTypes.STRING(7),
    allowNull: true,
    defaultValue: '#B399D4'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'motorcycle_categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = MotorcycleCategory; 