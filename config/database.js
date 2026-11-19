const path = require('path');

module.exports = {
  development: {
    dialect: 'mysql',
    host: 'localhost',
    username: 'root',
    password: '', // default XAMPP MySQL password is empty
    database: 'torquehubmotor',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    dialect: 'mysql',
    host: 'localhost',
    username: 'root',
    password: '',
    database: 'torquehubmotor_test',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'torquehubmotor',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
}; 