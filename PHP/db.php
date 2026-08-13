<?php
mysqli_report(MYSQLI_REPORT_OFF);

$host = 'localhost';
$user = 'root';
$password = '';
$database = 'college_project';

$conn = mysqli_connect($host, $user, $password);

if (!$conn) {
    die('Connection failed: ' . mysqli_connect_error());
}

mysqli_set_charset($conn, 'utf8');

$conn->query("CREATE DATABASE IF NOT EXISTS `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$conn->select_db($database);
$conn->set_charset('utf8mb4');

if (!function_exists('ensureColumnExists')) {
    function ensureColumnExists($conn, $tableName, $columnName, $columnDefinition) {
        $stmt = $conn->prepare(
            'SELECT COUNT(*) AS column_count
             FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
        );
        if (!$stmt) {
            return;
        }

        $stmt->bind_param('ss', $tableName, $columnName);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;

        if ((int) ($row['column_count'] ?? 0) === 0) {
            $conn->query("ALTER TABLE `$tableName` ADD COLUMN $columnDefinition");
        }
    }
}

if (!function_exists('ensureUniqueIndexExists')) {
    function ensureUniqueIndexExists($conn, $tableName, $indexName, $columnName) {
        $stmt = $conn->prepare(
            'SELECT COUNT(*) AS index_count
             FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?'
        );
        if (!$stmt) {
            return;
        }

        $stmt->bind_param('ss', $tableName, $indexName);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;

        if ((int) ($row['index_count'] ?? 0) > 0) {
            return;
        }

        $duplicates = $conn->query("
            SELECT `$columnName`, COUNT(*) AS row_count
            FROM `$tableName`
            GROUP BY `$columnName`
            HAVING row_count > 1
            LIMIT 1
        ");

        if ($duplicates && $duplicates->num_rows === 0) {
            $conn->query("ALTER TABLE `$tableName` ADD UNIQUE KEY `$indexName` (`$columnName`)");
        }
    }
}

$conn->query("
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(190) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
        is_verified TINYINT(1) DEFAULT 0,
        last_login DATETIME NULL,
        last_login_ip VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$conn->query("
    CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_token VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NULL DEFAULT NULL,
        CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_sessions_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

ensureColumnExists($conn, 'users', 'is_verified', 'is_verified TINYINT(1) DEFAULT 0 AFTER role');
ensureColumnExists($conn, 'users', 'last_login', 'last_login DATETIME NULL AFTER is_verified');
ensureColumnExists($conn, 'users', 'last_login_ip', 'last_login_ip VARCHAR(45) NULL AFTER last_login');
ensureColumnExists($conn, 'users', 'avatar', 'avatar VARCHAR(255) NULL AFTER created_at');
ensureUniqueIndexExists($conn, 'users', 'uniq_users_email', 'email');

$conn->query("
    CREATE TABLE IF NOT EXISTS places (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(190) NOT NULL,
        local_name VARCHAR(190) DEFAULT '',
        tagline VARCHAR(255) DEFAULT '',
        province VARCHAR(100) DEFAULT '',
        district VARCHAR(100) DEFAULT '',
        municipality VARCHAR(150) DEFAULT '',
        map_latitude DECIMAL(10,7) NULL,
        map_longitude DECIMAL(10,7) NULL,
        map_url TEXT,
        category VARCHAR(100) DEFAULT 'Other',
        short_desc TEXT,
        best_time VARCHAR(190) DEFAULT '',
        duration VARCHAR(190) DEFAULT '',
        things TEXT,
        tips TEXT,
        difficulty VARCHAR(80) DEFAULT 'Easy',
        budget DECIMAL(10,2) DEFAULT 0,
        transport DECIMAL(10,2) DEFAULT 0,
        stay DECIMAL(10,2) DEFAULT 0,
        food DECIMAL(10,2) DEFAULT 0,
        fee DECIMAL(10,2) DEFAULT 0,
        accom_desc TEXT,
        hotels VARCHAR(255) DEFAULT '',
        restaurants VARCHAR(255) DEFAULT '',
        homestay TINYINT(1) DEFAULT 0,
        parking TINYINT(1) DEFAULT 0,
        toilets TINYINT(1) DEFAULT 0,
        cover_image VARCHAR(255) DEFAULT '',
        start_point VARCHAR(190) DEFAULT '',
        route_desc TEXT,
        destination VARCHAR(190) DEFAULT '',
        submitted_by INT NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        approved_by INT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME NULL,
        rejected_at DATETIME NULL,
        INDEX idx_places_status (status),
        CONSTRAINT fk_places_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_places_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

ensureColumnExists($conn, 'places', 'map_latitude', 'map_latitude DECIMAL(10,7) NULL AFTER municipality');
ensureColumnExists($conn, 'places', 'map_longitude', 'map_longitude DECIMAL(10,7) NULL AFTER map_latitude');
ensureColumnExists($conn, 'places', 'map_url', 'map_url TEXT NULL AFTER map_longitude');

$conn->query("
    CREATE TABLE IF NOT EXISTS saved_places (
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, place_id),
        CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$conn->query("
    CREATE TABLE IF NOT EXISTS planned_trips (
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        planned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, place_id),
        CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$conn->query("
    CREATE TABLE IF NOT EXISTS trip_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        note_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$conn->query("
    CREATE TABLE IF NOT EXISTS place_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        place_id INT NOT NULL,
        user_id INT NOT NULL,
        rating TINYINT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_reviews_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
        CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
        UNIQUE KEY uniq_place_user (place_id, user_id),
        INDEX idx_reviews_place (place_id),
        INDEX idx_reviews_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$otpTableSql = "
    CREATE TABLE IF NOT EXISTS otp_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL UNIQUE,
        otp_code VARCHAR(6) NOT NULL,
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME NULL,
        INDEX idx_otp_email (email),
        INDEX idx_otp_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
";
$conn->query($otpTableSql);
$conn->query('ALTER TABLE otp_verifications MODIFY otp_code VARCHAR(255) NOT NULL');

$otpEmailColumn = $conn->query("SHOW COLUMNS FROM otp_verifications LIKE 'email'");
if ($otpEmailColumn && $otpEmailColumn->num_rows === 0) {
    $conn->query('DROP TABLE otp_verifications');
    $conn->query($otpTableSql);
}

$conn->query("
    CREATE TABLE IF NOT EXISTS place_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        place_id INT NOT NULL,
        image_path VARCHAR(255) NOT NULL,
        image_type ENUM('cover', 'gallery') DEFAULT 'gallery',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_images_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
        INDEX idx_images_place (place_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$conn->query("CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    actor_id INT NULL,
    type VARCHAR(100) NOT NULL,
    data JSON NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_notifications_user_read (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$adminEmail = 'admin@gmail.com';
$adminPasswordPlain = 'admin123';
$adminFullName = 'Administrator';
$adminCheck = $conn->prepare("SELECT id, full_name, email, password FROM users WHERE role = 'admin' LIMIT 1");
$adminCheck->execute();
$adminResult = $adminCheck->get_result();

if ($adminResult->num_rows === 0) {
    $adminPassword = password_hash($adminPasswordPlain, PASSWORD_DEFAULT);
    $adminStmt = $conn->prepare("INSERT IGNORE INTO users (username, full_name, email, password, role, is_verified) VALUES ('admin', ?, ?, ?, 'admin', 1)");
    $adminStmt->bind_param('sss', $adminFullName, $adminEmail, $adminPassword);
    $adminStmt->execute();
} else {
    $adminRow = $adminResult->fetch_assoc();
    $needsAdminRefresh = $adminRow['email'] !== $adminEmail
        || !password_verify($adminPasswordPlain, $adminRow['password'])
        || $adminRow['full_name'] !== $adminFullName;

    if ($needsAdminRefresh) {
        $adminPassword = password_hash($adminPasswordPlain, PASSWORD_DEFAULT);
        $adminUpdate = $conn->prepare("UPDATE users SET username = 'admin', full_name = ?, email = ?, password = ?, role = 'admin', is_verified = 1 WHERE id = ?");
        $adminUpdate->bind_param('sssi', $adminFullName, $adminEmail, $adminPassword, $adminRow['id']);
        $adminUpdate->execute();
    }
}
?>
