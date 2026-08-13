<?php
session_start();
require 'db.php';
header('Content-Type: application/json');

function user_response($data, $status = 200) { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function user_login_required() { if (!isset($_SESSION['id'])) user_response(['success' => false, 'message' => 'Please login first.'], 401); }

$action = $_POST['action'] ?? $_GET['action'] ?? 'me';
user_login_required();
$userId = (int) $_SESSION['id'];

if ($action === 'me') {
    $stmt = $conn->prepare('SELECT id, username, full_name, email, role, avatar, created_at FROM users WHERE id = ?');
    $stmt->bind_param('i', $userId); $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    if (!$user) user_response(['success' => false, 'message' => 'User not found.'], 404);

    $stmt = $conn->prepare('SELECT id, name, cover_image, status, submitted_at, approved_at, rejected_at FROM places WHERE submitted_by = ? ORDER BY submitted_at DESC');
    $stmt->bind_param('i', $userId); $stmt->execute();
    $submissions = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    user_response(['success' => true, 'user' => $user, 'submissions' => $submissions]);
}

if ($action === 'update_avatar') {
    $avatar = trim((string) ($_POST['avatar'] ?? ''));
    if (!preg_match('#^uploads/[A-Za-z0-9._-]+$#', $avatar) || !is_file(dirname(__DIR__) . '/public/' . $avatar)) {
        user_response(['success' => false, 'message' => 'Invalid profile image.'], 400);
    }
    $stmt = $conn->prepare('UPDATE users SET avatar = ? WHERE id = ?');
    $stmt->bind_param('si', $avatar, $userId);
    if (!$stmt->execute()) user_response(['success' => false, 'message' => 'Unable to save profile image.'], 500);
    user_response(['success' => true, 'avatar' => $avatar]);
}
user_response(['success' => false, 'message' => 'Invalid action.'], 400);
