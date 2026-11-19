require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const db = require('./models');
const webRoutes = require('./routes/web');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/uploads');
const session = require('express-session');

const app = express();
const rootPath = path.resolve(__dirname);

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(rootPath, 'public')));
app.use(session({
  secret: 'your_secret_key', // change this to a strong secret in production
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Database connection and initialization
const initializeDatabase = async () => {
  try {
    await db.sequelize.sync();
    console.log('Database synced successfully');
    
    // Create default roles if they don't exist
    await db.Role.findOrCreate({
      where: { id: 1 },
      defaults: { name: 'User' }
    });
    
    await db.Role.findOrCreate({
      where: { id: 2 },
      defaults: { name: 'Admin' }
    });
    
    console.log('Default roles created/verified');
    
    // Create MyADMIN account if it doesn't exist
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('MyADMIN123!', 10);
    
    await db.User.findOrCreate({
      where: { email: 'admin@torquehub.com' },
      defaults: {
        full_name: 'MyADMIN',
        email: 'admin@torquehub.com',
        dealership_name: 'TorqueHub Admin',
        password_hash: adminPassword,
        verified: true,
        is_active: true,
        role_id: 2 // Admin role
      }
    });
    
    console.log('MyADMIN account created/verified');
  } catch (err) {
    console.error('Database initialization error:', err);
    // Don't exit the process, just log the error
  }
};

// Initialize database
initializeDatabase();

// Routes - mount web routes first to avoid conflicts
app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(rootPath, 'views', '404.html'));
});

// Error handler - must be last
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
    
  res.status(500).sendFile(path.join(rootPath, 'views', '500.html'));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});