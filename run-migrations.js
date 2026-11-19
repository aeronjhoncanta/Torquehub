const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrations() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '', // Add your MySQL password here if needed
            database: 'torquehubmotor'
        });

        console.log('Connected to database successfully');

        // Create motorcycle_categories table
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS \`motorcycle_categories\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`name\` varchar(255) NOT NULL,
                \`description\` text DEFAULT NULL,
                \`icon\` varchar(255) DEFAULT NULL,
                \`color\` varchar(7) DEFAULT '#B399D4',
                \`sort_order\` int(11) DEFAULT 0,
                \`is_active\` tinyint(1) DEFAULT 1,
                \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
                \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`name\` (\`name\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `;

        await connection.execute(createTableSQL);
        console.log('✓ motorcycle_categories table created');

        // Insert default categories
        const insertCategoriesSQL = `
            INSERT IGNORE INTO \`motorcycle_categories\` (\`name\`, \`description\`, \`icon\`, \`color\`, \`sort_order\`) VALUES
            ('Sport Bikes', 'High-performance motorcycles designed for speed and agility', 'fas fa-motorcycle', '#FF6B6B', 1),
            ('Cruisers', 'Comfortable touring motorcycles with relaxed riding position', 'fas fa-road', '#4ECDC4', 2),
            ('Touring Bikes', 'Long-distance touring motorcycles with luggage capacity', 'fas fa-route', '#45B7D1', 3),
            ('Dual Sport', 'Versatile motorcycles for both on-road and off-road use', 'fas fa-mountain', '#96CEB4', 4),
            ('Adventure Bikes', 'Off-road capable motorcycles for adventure touring', 'fas fa-compass', '#FFEAA7', 5),
            ('Naked Bikes', 'Street motorcycles without fairings for urban riding', 'fas fa-bolt', '#DDA0DD', 6),
            ('Scooters', 'Small, economical motorcycles for urban commuting', 'fas fa-scooter', '#98D8C8', 7),
            ('Classic Bikes', 'Vintage and retro-style motorcycles', 'fas fa-clock', '#F7DC6F', 8),
            ('Electric Bikes', 'Electric-powered motorcycles and scooters', 'fas fa-bolt', '#BB8FCE', 9),
            ('Custom Bikes', 'Custom-built and modified motorcycles', 'fas fa-tools', '#85C1E9', 10),
            ('Dirt Bikes', 'Off-road motorcycles for trail and motocross', 'fas fa-mountain', '#F8C471', 11),
            ('Trike Bikes', 'Three-wheeled motorcycles for stability', 'fas fa-car', '#A9CCE3', 12);
        `;

        await connection.execute(insertCategoriesSQL);
        console.log('✓ Default categories inserted');

        // Add category_id column to products table if it doesn't exist
        const addColumnSQL = `
            ALTER TABLE \`products\` 
            ADD COLUMN IF NOT EXISTS \`category_id\` int(11) DEFAULT NULL AFTER \`category\`;
        `;

        await connection.execute(addColumnSQL);
        console.log('✓ category_id column added to products table');

        // Add foreign key constraint if it doesn't exist
        try {
            const addForeignKeySQL = `
                ALTER TABLE \`products\` 
                ADD CONSTRAINT \`fk_products_category\` 
                FOREIGN KEY (\`category_id\`) REFERENCES \`motorcycle_categories\`(\`id\`) 
                ON DELETE SET NULL ON UPDATE CASCADE;
            `;
            await connection.execute(addForeignKeySQL);
            console.log('✓ Foreign key constraint added');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('✓ Foreign key constraint already exists');
            } else {
                throw error;
            }
        }

        // Update existing products to use proper categories
        const updateProductsSQL = `
            UPDATE \`products\` SET \`category_id\` = 1 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%sport%';
            UPDATE \`products\` SET \`category_id\` = 2 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%cruiser%';
            UPDATE \`products\` SET \`category_id\` = 3 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%touring%';
            UPDATE \`products\` SET \`category_id\` = 4 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%dual%';
            UPDATE \`products\` SET \`category_id\` = 5 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%adventure%';
            UPDATE \`products\` SET \`category_id\` = 6 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%naked%';
            UPDATE \`products\` SET \`category_id\` = 7 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%scooter%';
            UPDATE \`products\` SET \`category_id\` = 8 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%classic%';
            UPDATE \`products\` SET \`category_id\` = 9 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%electric%';
            UPDATE \`products\` SET \`category_id\` = 10 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%custom%';
            UPDATE \`products\` SET \`category_id\` = 11 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%dirt%';
            UPDATE \`products\` SET \`category_id\` = 12 WHERE \`category\` = 'Motorcycle' AND \`name\` LIKE '%trike%';
            UPDATE \`products\` SET \`category_id\` = 1 WHERE \`category\` = 'Motorcycle' AND \`category_id\` IS NULL;
        `;

        const updateQueries = updateProductsSQL.split(';').filter(query => query.trim());
        for (const query of updateQueries) {
            if (query.trim()) {
                await connection.execute(query);
            }
        }
        console.log('✓ Existing products updated with categories');

        console.log('\n🎉 All migrations completed successfully!');
        console.log('\nYou can now:');
        console.log('1. Start your application with: npm start');
        console.log('2. Access category management at: /category-management');
        console.log('3. Add/edit products with proper motorcycle categories');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Error details:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
}

// Run the migrations
runMigrations(); 