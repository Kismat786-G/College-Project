<?php
session_start();
require_once 'db.php';
require_once 'otp.php';

header('Content-Type: application/json');

function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Invalid request.'], 405);
}

$action = trim($_POST['action'] ?? 'verify');

function currentOtpEmail() {
    $email = normalizeOtpEmail($_SESSION['otp_email'] ?? ($_SESSION['pending_registration']['email'] ?? ''));
    return $email ?: '';
}

// ── Resend OTP ──────────────────────────────────────────────────────────────
if ($action === 'resend') {
    $email = currentOtpEmail();
    if ($email === '') {
        respond(['success' => false, 'message' => 'Session expired. Please register again.'], 400);
    }

    $otp     = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $otpHash = password_hash($otp, PASSWORD_DEFAULT);
    $expires = date('Y-m-d H:i:s', time() + 600);

    $delOtpStmt = $conn->prepare('DELETE FROM otp_verifications WHERE email = ?');
    $delOtpStmt->bind_param('s', $email);
    $delOtpStmt->execute();
    $otpStmt = $conn->prepare('INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES (?, ?, ?)');
    $otpStmt->bind_param('sss', $email, $otpHash, $expires);
    $otpStmt->execute();

    $fullName = $_SESSION['pending_registration']['full_name'] ?? 'Traveler';
    $body = "Hello {$fullName},\n\nYour new verification code is:\n\n  $otp\n\nExpires in 10 minutes.\n\n— Nepal Discovery Team";
    if (!sendVerificationEmail($email, $otp)) {
        $delOtpStmt = $conn->prepare('DELETE FROM otp_verifications WHERE email = ?');
        $delOtpStmt->bind_param('s', $email);
        $delOtpStmt->execute();
        respond(['success' => false, 'message' => getMailerFailureMessage()], 500);
    }

    $_SESSION['otp_email'] = $email;
    respond(['success' => true, 'message' => 'New OTP sent.']);
}

// ── Verify OTP ──────────────────────────────────────────────────────────────
$email   = currentOtpEmail();
$entered = trim($_POST['otp'] ?? '');

if ($email === '') {
    respond(['success' => false, 'message' => 'Session expired. Please register again.'], 400);
}

if (strlen($entered) !== 6 || !ctype_digit($entered)) {
    respond(['success' => false, 'message' => 'Please enter a valid 6-digit code.'], 400);
}

// Fetch latest unused, unexpired OTP for this user
$otpStmt = $conn->prepare('
    SELECT id, otp_code, expires_at, attempts, max_attempts, verified_at FROM otp_verifications
    WHERE email = ? AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
');
$otpStmt->bind_param('s', $email);
$otpStmt->execute();
$otpRow = $otpStmt->get_result()->fetch_assoc();

if (!$otpRow) {
    respond(['success' => false, 'message' => 'OTP has expired. Please request a new one.'], 400);
}

$attempts = (int) ($otpRow['attempts'] ?? 0);
$maxAttempts = (int) ($otpRow['max_attempts'] ?? 5);

if ($attempts >= $maxAttempts) {
    respond(['success' => false, 'message' => 'Maximum attempts exceeded. Please request a new OTP.'], 400);
}

if (!otpMatches($otpRow['otp_code'], $entered)) {
    $attempts++;
    $updateAttempts = $conn->prepare('UPDATE otp_verifications SET attempts = ? WHERE id = ?');
    $updateAttempts->bind_param('ii', $attempts, $otpRow['id']);
    $updateAttempts->execute();

    respond(['success' => false, 'message' => 'Incorrect OTP. Attempts remaining: ' . max(0, $maxAttempts - $attempts)], 400);
}

// Mark user as verified
$pending = $_SESSION['pending_registration'] ?? null;

if ($pending && isset($pending['email']) && $pending['email'] === $email) {
    $emailCheck = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $emailCheck->bind_param('s', $email);
    $emailCheck->execute();
    if ($emailCheck->get_result()->num_rows > 0) {
        unset($_SESSION['pending_registration']);
        respond(['success' => false, 'message' => 'This email is already registered. Please log in instead.'], 409);
    }

    $username = strtolower(str_replace(' ', '_', $pending['full_name']));
    if ($username === '') {
        $username = 'user';
    }

    $baseUsername = $username;
    $counter = 1;

    while (true) {
        $checkStmt = $conn->prepare('SELECT id FROM users WHERE username = ?');
        $checkStmt->bind_param('s', $username);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();

        if ($checkResult->num_rows === 0) {
            break;
        }

        $username = $baseUsername . $counter;
        $counter++;
    }

    $hashedPassword = password_hash($pending['password'], PASSWORD_DEFAULT);
    $stmt = $conn->prepare('
        INSERT INTO users (username, full_name, email, password, role, is_verified)
        VALUES (?, ?, ?, ?, "user", 1)
    ');
    $stmt->bind_param('ssss', $username, $pending['full_name'], $email, $hashedPassword);

    if (!$stmt->execute()) {
        respond(['success' => false, 'message' => 'Unable to create account. Please try again.'], 500);
    }

    unset($_SESSION['pending_registration']);
} else {
    $verifyStmt = $conn->prepare('UPDATE users SET is_verified = 1 WHERE email = ?');
    $verifyStmt->bind_param('s', $email);
    $verifyStmt->execute();
}

// Fetch user details to log in
$userStmt = $conn->prepare('SELECT id, full_name, role FROM users WHERE email = ?');
$userStmt->bind_param('s', $email);
$userStmt->execute();
$user = $userStmt->get_result()->fetch_assoc();

if (!$user) {
    respond(['success' => false, 'message' => 'Unable to find the verified account. Please log in or register again.'], 500);
}

// Create session
session_regenerate_id(true);
$_SESSION['id']   = $user['id'];
$_SESSION['name'] = $user['full_name'];
$_SESSION['role'] = $user['role'];
$_SESSION['email'] = $email;
unset($_SESSION['otp_email'], $_SESSION['otp_dev']);

// Store session token in DB
$sessionToken = bin2hex(random_bytes(32));
$cleanStmt = $conn->prepare('DELETE FROM user_sessions WHERE user_id = ?');
$cleanStmt->bind_param('i', $user['id']);
$cleanStmt->execute();

$insStmt = $conn->prepare('INSERT INTO user_sessions (user_id, session_token) VALUES (?, ?)');
$insStmt->bind_param('is', $user['id'], $sessionToken);
$insStmt->execute();
$_SESSION['session_token'] = $sessionToken;

// Set cookies for JS
setcookie('userRole',  $user['role'],      time() + 3600, '/');
setcookie('userName',  $user['full_name'], time() + 3600, '/');
setcookie('isAdmin',   $user['role'] === 'admin' ? 'true' : 'false', time() + 3600, '/');
setcookie('userId',    (string)$user['id'], time() + 3600, '/');

$redirect = $user['role'] === 'admin' ? '../public/HTML/admin.html' : '../public/HTML/index.html';
respond(['success' => true, 'message' => 'Email verified! Logging you in...', 'redirect' => $redirect]);
?>
