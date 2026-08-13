<?php

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

function setMailerFailureMessage($message) {
    $GLOBALS['mailerFailureMessage'] = $message;
}

function getMailerFailureMessage() {
    return $GLOBALS['mailerFailureMessage']
        ?? 'We could not send the verification email. Please try again later.';
}

function sendVerificationEmail($recipientEmail, $otp) {
    setMailerFailureMessage('We could not send the verification email. Please try again later.');

    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        error_log('SMTP mailer is unavailable: run composer install.');
        setMailerFailureMessage('Email support is not installed. Please contact the administrator.');
        return false;
    }

    require_once $autoload;
    $config = require __DIR__ . '/mail_config.php';

    foreach (['host', 'username', 'password', 'from_email'] as $requiredSetting) {
        if (empty($config[$requiredSetting])) {
            error_log('SMTP mailer is not configured: missing ' . $requiredSetting . '.');
            setMailerFailureMessage('Email delivery is not configured. Please contact the administrator.');
            return false;
        }
    }

    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $config['host'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['username'];
        $mail->Password = $config['password'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = (int) $config['port'];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->setFrom($config['from_email'], $config['from_name']);
        $mail->addAddress($recipientEmail);
        $mail->isHTML(true);
        $mail->Subject = 'Your Nepal Travel verification code';
        $mail->Body = '<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">'
            . htmlspecialchars($otp, ENT_QUOTES, 'UTF-8')
            . '</p><p>This code expires in 10 minutes. Do not share it with anyone.</p>';
        $mail->AltBody = "Your verification code is: {$otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.";
        $mail->send();
        return true;
    } catch (Exception $exception) {
        error_log('Unable to send verification email: ' . $exception->getMessage());
        setMailerFailureMessage('The email server could not send the verification email. Please try again later.');
        return false;
    }
}
