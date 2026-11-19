const mysql = require('mysql2/promise');
require('dotenv').config();

async function runPartsCategoriesMigration() {
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

        // Create motorcycle_parts_categories table
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS \`motorcycle_parts_categories\` (
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
        console.log('✓ motorcycle_parts_categories table created');

        // Insert default parts categories
        const insertCategoriesSQL = `
            INSERT IGNORE INTO \`motorcycle_parts_categories\` (\`name\`, \`description\`, \`icon\`, \`color\`, \`sort_order\`) VALUES
            ('Engine Parts', 'Engine components and accessories', 'fas fa-cog', '#FF6B6B', 1),
            ('Brake System', 'Brake pads, rotors, and brake components', 'fas fa-stop-circle', '#4ECDC4', 2),
            ('Suspension', 'Shocks, springs, and suspension components', 'fas fa-compress-alt', '#45B7D1', 3),
            ('Electrical', 'Batteries, lights, and electrical components', 'fas fa-bolt', '#96CEB4', 4),
            ('Exhaust System', 'Mufflers, headers, and exhaust components', 'fas fa-wind', '#FFEAA7', 5),
            ('Tires & Wheels', 'Tires, rims, and wheel components', 'fas fa-circle', '#DDA0DD', 6),
            ('Body & Fairings', 'Body panels, fairings, and cosmetic parts', 'fas fa-shield-alt', '#98D8C8', 7),
            ('Accessories', 'Aftermarket accessories and add-ons', 'fas fa-star', '#F7DC6F', 8),
            ('Oil & Fluids', 'Engine oil, brake fluid, and lubricants', 'fas fa-tint', '#BB8FCE', 9),
            ('Tools & Maintenance', 'Tools and maintenance equipment', 'fas fa-wrench', '#85C1E9', 10),
            ('Safety Gear', 'Helmets, jackets, and safety equipment', 'fas fa-hard-hat', '#F8C471', 11),
            ('Performance Parts', 'High-performance upgrades and modifications', 'fas fa-tachometer-alt', '#A9CCE3', 12);
        `;

        await connection.execute(insertCategoriesSQL);
        console.log('✓ Default parts categories inserted');

        // Add parts_category_id column to products table if it doesn't exist
        const addColumnSQL = `
            ALTER TABLE \`products\` 
            ADD COLUMN IF NOT EXISTS \`parts_category_id\` int(11) DEFAULT NULL AFTER \`category_id\`;
        `;

        await connection.execute(addColumnSQL);
        console.log('✓ parts_category_id column added to products table');

        // Add foreign key constraint if it doesn't exist
        try {
            const addForeignKeySQL = `
                ALTER TABLE \`products\` 
                ADD CONSTRAINT \`fk_products_parts_category\` 
                FOREIGN KEY (\`parts_category_id\`) REFERENCES \`motorcycle_parts_categories\`(\`id\`) 
                ON DELETE SET NULL ON UPDATE CASCADE;
            `;
            await connection.execute(addForeignKeySQL);
            console.log('✓ Foreign key constraint added for parts categories');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_CANT_CREATE_TABLE') {
                console.log('✓ Foreign key constraint already exists or table structure issue (continuing...)');
            } else {
                console.log('Foreign key constraint error (continuing anyway):', error.message);
            }
        }

        // Update existing parts products to use proper categories
        const updateProductsSQL = `
            UPDATE \`products\` SET \`parts_category_id\` = 1 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%engine%';
            UPDATE \`products\` SET \`parts_category_id\` = 2 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%brake%';
            UPDATE \`products\` SET \`parts_category_id\` = 3 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%suspension%';
            UPDATE \`products\` SET \`parts_category_id\` = 4 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%electrical%';
            UPDATE \`products\` SET \`parts_category_id\` = 5 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%exhaust%';
            UPDATE \`products\` SET \`parts_category_id\` = 6 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%tire%';
            UPDATE \`products\` SET \`parts_category_id\` = 7 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%body%';
            UPDATE \`products\` SET \`parts_category_id\` = 8 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%accessory%';
            UPDATE \`products\` SET \`parts_category_id\` = 9 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%oil%';
            UPDATE \`products\` SET \`parts_category_id\` = 10 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%tool%';
            UPDATE \`products\` SET \`parts_category_id\` = 11 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%safety%';
            UPDATE \`products\` SET \`parts_category_id\` = 12 WHERE \`category\` = 'Motorcycle Parts' AND \`name\` LIKE '%performance%';
            UPDATE \`products\` SET \`parts_category_id\` = 8 WHERE \`category\` = 'Motorcycle Parts' AND \`parts_category_id\` IS NULL;
        `;

        const updateQueries = updateProductsSQL.split(';').filter(query => query.trim());
        for (const query of updateQueries) {
            if (query.trim()) {
                await connection.execute(query);
            }
        }
        console.log('✓ Existing parts products updated with categories');

        console.log('\n🎉 Parts Categories Migration Completed Successfully!');
        console.log('\nYou can now:');
        console.log('1. Start your application with: npm start');
        console.log('2. Access parts categories at: /api/parts-categories');
        console.log('3. See parts categories in the dashboard');
        console.log('4. Filter parts by specific categories');

    } catch (error) {
        console.error('❌ Parts categories migration failed:', error.message);
        console.error('Error details:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
}

// Run the migration
runPartsCategoriesMigration(); 