<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once 'db.php';
require_once 'mailer.php';

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    header('Content-Type: application/json');
}

function normalizeOtpEmail($email) {
    $validEmail = filter_var(trim((string) $email), FILTER_VALIDATE_EMAIL);
    return $validEmail ? strtolower($validEmail) : false;
}

function otpMatches($storedOtp, $enteredOtp) {
    $info = password_get_info($storedOtp);
    if (!empty($info['algo'])) {
        return password_verify($enteredOtp, $storedOtp);
    }

    return hash_equals((string) $storedOtp, (string) $enteredOtp);
}

// Generate and send OTP
function sendOTP($email, $conn) {
    $email = normalizeOtpEmail($email);
    if (!$email) {
        return [
            'success' => false,
            'message' => 'Please enter a valid email address'
        ];
    }

    // Check if email already exists in users table
    $emailCheck = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $emailCheck->bind_param('s', $email);
    $emailCheck->execute();
    $emailResult = $emailCheck->get_result();
    
    if ($emailResult->num_rows > 0) {
        return [
            'success' => false,
            'message' => 'Email is already registered. Please log in.'
        ];
    }
    
    // Generate 6-digit OTP
    $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $otpHash = password_hash($otp, PASSWORD_DEFAULT);
    
    // Clear any existing OTP for this email
    $deleteOld = $conn->prepare("DELETE FROM otp_verifications WHERE email = ?");
    $deleteOld->bind_param('s', $email);
    $deleteOld->execute();
    
    // Insert new OTP with 10-minute expiry
    $expiryTime = date('Y-m-d H:i:s', time() + 600);
    $insertOTP = $conn->prepare("INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES (?, ?, ?)");
    $insertOTP->bind_param('sss', $email, $otpHash, $expiryTime);
    
    if (!$insertOTP->execute()) {
        return [
            'success' => false,
            'message' => 'Failed to generate OTP'
        ];
    }
    
    if (!sendVerificationEmail($email, $otp)) {
        $deleteFailedOtp = $conn->prepare('DELETE FROM otp_verifications WHERE email = ?');
        $deleteFailedOtp->bind_param('s', $email);
        $deleteFailedOtp->execute();
        return ['success' => false, 'message' => getMailerFailureMessage()];
    }

    $_SESSION['otp_email'] = $email;
    return ['success' => true, 'message' => 'OTP sent to your email'];
}

// Verify OTP
function verifyOTP($email, $otp, $conn) {
    $email = normalizeOtpEmail($email);
    if (!$email || !preg_match('/^\d{6}$/', $otp)) {
        return [
            'success' => false,
            'message' => 'Invalid email or OTP'
        ];
    }

    $stmt = $conn->prepare("
        SELECT id, otp_code, attempts, max_attempts, expires_at, verified_at 
        FROM otp_verifications 
        WHERE email = ?
    ");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        return [
            'success' => false,
            'message' => 'No OTP request found for this email'
        ];
    }
    
    $row = $result->fetch_assoc();
    
    // Check if already verified
    if ($row['verified_at'] !== null) {
        return [
            'success' => false,
            'message' => 'Email already verified'
        ];
    }
    
    // Check expiry
    if (strtotime($row['expires_at']) < time()) {
        return [
            'success' => false,
            'message' => 'OTP has expired. Please request a new one.'
        ];
    }
    
    // Check attempts
    if ($row['attempts'] >= $row['max_attempts']) {
        return [
            'success' => false,
            'message' => 'Maximum attempts exceeded. Please request a new OTP.'
        ];
    }
    
    // Verify OTP
    if (!otpMatches($row['otp_code'], $otp)) {
        $newAttempts = $row['attempts'] + 1;
        $updateAttempts = $conn->prepare("UPDATE otp_verifications SET attempts = ? WHERE email = ?");
        $updateAttempts->bind_param('is', $newAttempts, $email);
        $updateAttempts->execute();
        
        return [
            'success' => false,
            'message' => 'Invalid OTP. Attempts remaining: ' . ($row['max_attempts'] - $newAttempts)
        ];
    }
    
    // Mark as verified
    $verifyTime = date('Y-m-d H:i:s');
    $markVerified = $conn->prepare("UPDATE otp_verifications SET verified_at = ? WHERE email = ?");
    $markVerified->bind_param('ss', $verifyTime, $email);
    $markVerified->execute();
    
    return [
        'success' => true,
        'message' => 'Email verified successfully'
    ];
}

// Route requests only when this file is called directly, not when it is included by register.php.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__ && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? $_GET['action'] ?? null;
    
    if ($action === 'send_otp') {
        $email = normalizeOtpEmail($_POST['email'] ?? '');
        
        if (!$email) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid email address']);
            exit;
        }
        
        $response = sendOTP($email, $conn);
        echo json_encode($response);
    } 
    elseif ($action === 'verify_otp') {
        $email = normalizeOtpEmail($_POST['email'] ?? '');
        $otp = trim($_POST['otp'] ?? '');
        
        if (!$email || !$otp || strlen($otp) !== 6) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid email or OTP']);
            exit;
        }
        
        $response = verifyOTP($email, $otp, $conn);
        echo json_encode($response);
    }
    else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} elseif (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
