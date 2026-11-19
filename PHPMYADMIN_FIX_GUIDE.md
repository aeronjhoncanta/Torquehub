# Fix phpMyAdmin Connection Issue

## Problem Analysis
From your MySQL error log, I can see that MariaDB is starting successfully but only binding to IPv6 (`Server socket created on IP: '::'`). The issue is that phpMyAdmin is trying to connect via IPv4 localhost, but MySQL is only listening on IPv6.

## Solution Steps

### Step 1: Stop XAMPP Services
1. Open XAMPP Control Panel
2. Stop Apache and MySQL services
3. Wait for both services to fully stop

### Step 2: Fix MySQL Configuration
1. **Run the Fix Script**
   - Double-click `fix_xampp_mysql.bat` in your project folder
   - This will update your MySQL configuration to bind to IPv4

2. **Manual Alternative**
   - Navigate to `C:\xamppaeronrichard\mysql\bin\`
   - Backup the existing `my.ini` file
   - Replace it with the configuration from the batch script

### Step 3: Fix MySQL User Permissions

1. **Access MySQL Command Line**
   - Open Command Prompt as Administrator
   - Navigate to: `C:\xamppaeronrichard\mysql\bin\`
   - Run: `mysql -u root -p` (press Enter if no password)

2. **Run the SQL Script**
   ```sql
   -- Copy and paste the contents of fix_mysql_permissions.sql
   -- Or run: source C:\path\to\your\project\fix_mysql_permissions.sql
   ```

### Step 4: Restart Services

1. **Start MySQL**
   - In XAMPP Control Panel, start MySQL service
   - Wait for it to fully start (green status)
   - Check the logs to see: `Server socket created on IP: '127.0.0.1'`

2. **Start Apache**
   - Start Apache service in XAMPP Control Panel

### Step 5: Test phpMyAdmin

1. **Access phpMyAdmin**
   - Open browser and go to: `http://localhost/phpmyadmin/`
   - Login with:
     - Username: `root`
     - Password: (leave empty)

2. **Create Database**
   - If successful, create your database: `torquehubmotor`

### Step 6: Update Your Application

1. **Test Database Connection**
   - Run your Node.js application
   - Check if it connects to the database

2. **Verify Configuration**
   - Your `config/database.js` should work with:
     - Host: `localhost` or `127.0.0.1`
     - Username: `root`
     - Password: (empty)
     - Database: `torquehubmotor`

## Key Changes Made

### MySQL Configuration (`my.ini`)
- Added `bind-address=127.0.0.1` to force IPv4 binding
- Added `skip-name-resolve=OFF` to allow hostname resolution
- This ensures MySQL listens on both IPv4 and IPv6

### User Permissions
- Recreated root users for all localhost variants:
  - `root@localhost`
  - `root@127.0.0.1`
  - `root@::1`
- Granted full privileges to all root users
- Created phpMyAdmin user (`pma@localhost`)

## Troubleshooting

### If Still Having Issues:

1. **Check MySQL Binding**
   ```cmd
   netstat -an | findstr 3306
   ```
   Should show:
   ```
   TCP    127.0.0.1:3306    0.0.0.0:0    LISTENING
   TCP    [::1]:3306        [::]:0        LISTENING
   ```

2. **Check XAMPP Logs**
   - Look in `C:\xamppaeronrichard\mysql\data\mysql_error.log`
   - Should see: `Server socket created on IP: '127.0.0.1'`

3. **Alternative Connection Methods**
   - Try `http://127.0.0.1/phpmyadmin/` instead of `localhost`
   - Update your `config/database.js` to use `127.0.0.1` instead of `localhost`

4. **Reset MySQL Root Password**
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY '';
   ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '';
   ALTER USER 'root'@'::1' IDENTIFIED BY '';
   FLUSH PRIVILEGES;
   ```

### Common Issues:

- **Port 3306 in use**: Stop other MySQL services
- **Permission denied**: Run XAMPP as Administrator
- **Socket error**: Check if MySQL is running properly
- **IPv6 only binding**: The fix script addresses this specifically

## Verification

After fixing, you should see in the MySQL log:
```
Server socket created on IP: '127.0.0.1'
```

And be able to:
1. Access phpMyAdmin at `http://localhost/phpmyadmin/`
2. Connect to MySQL with root user (no password)
3. Create and manage databases
4. Run your Node.js application successfully

## Files Created/Modified:

- `fix_mysql_permissions.sql` - SQL script to fix user permissions
- `fix_xampp_mysql.bat` - Batch script to fix XAMPP configuration
- `my.cnf` - Updated MySQL configuration
- `PHPMYADMIN_FIX_GUIDE.md` - This guide 