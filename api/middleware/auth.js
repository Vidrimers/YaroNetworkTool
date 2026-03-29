/**
 * Middleware аутентификации по API ключу
 * Проверяет заголовок Authorization: Bearer <key>
 */

const API_KEY = process.env.API_KEY;

// --- Middleware проверки API ключа ---
export function requireApiKey(req, res, next) {
  // Пропускаем health check без аутентификации
  if (req.path === '/health' || req.path === '/api/v1') {
    return next();
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'API key required' });
  }

  const key = authHeader.slice(7); // убираем "Bearer "

  if (!API_KEY) {
    console.warn('[Auth] API_KEY не задан в .env — аутентификация отключена');
    return next();
  }

  if (key !== API_KEY) {
    return res.status(403).json({ error: 'Forbidden', message: 'Invalid API key' });
  }

  next();
}
// --- Конец middleware аутентификации ---
