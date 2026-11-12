import nodemailer from 'nodemailer';

export const mailMode = process.env.MAIL_MODE || 'off';
const adminRecipient = 'admin@alternativa-kzn.ru';

if (!['off', 'test', 'admin'].includes(mailMode)) {
  throw new Error('MAIL_MODE должен быть off, test или admin');
}

let transporter;
let recipient;
if (mailMode !== 'off') {
  recipient = mailMode === 'test' ? process.env.MAIL_TEST_TO : adminRecipient;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  const port = Number(SMTP_PORT);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(recipient || '') || !SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 || !SMTP_USER || !SMTP_PASS || !emailPattern.test(MAIL_FROM || '')) {
    throw new Error('Для почты задайте MAIL_TEST_TO (в тестовом режиме), SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS и MAIL_FROM');
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
}

export async function sendRequestEmail(request) {
  if (!transporter) return false;
  const lines = [
    `Новая тестовая заявка № ${request.id.slice(0, 8).toUpperCase()}`,
    `Вид ремонта: ${request.repairType} (${request.bonusPercent}%)`,
    `Город: ${request.city}`,
    `Страховая компания: ${request.insurer || 'Не требуется'}`,
    `Клиент: ${request.clientName}`,
    `Телефон: ${request.clientPhone}`,
    `Автомобиль: ${request.vehicleMake} ${request.vehicleModel}${request.vehicleYear ? `, ${request.vehicleYear}` : ''}`,
    `Госномер: ${request.vehiclePlate}`,
    `Повреждения: ${request.damageDescription}`,
    `Агент: ${request.agentName}`,
    `Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
    '',
    'Письмо создано локальным тестовым прототипом Agenta. Данные заявки вымышленные.'
  ];
  const result = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: recipient,
    subject: `[Прототип Agenta] ${request.repairType} · заявка № ${request.id.slice(0, 8).toUpperCase()}`,
    text: lines.join('\n')
  });
  if (!result.accepted?.some(address => address.toLowerCase() === recipient.toLowerCase())) {
    throw new Error('Почтовый сервер не принял получателя');
  }
  return true;
}
