/**
 * Middleware аутентификации по API ключу
 * Проверяет заголовок Authorization: Bearer <key>
 *
 * ВАЖНО: API_KEY читается внутри функции (не на уровне модуля),
 * потому что ES module imports поднимаются (hoisting) раньше dotenv.config(),
 * из-за чего process.env.API_KEY был бы undefined при чтении на уровне модуля.
 */

// --- Middleware проверки API ключа ---
export function requireApiKey(req, res, next) {
  // Читаем ключ при каждом запросе, чтобы гарантировать актуальное значение
  const API_KEY = process.env.API_KEY;

  // Пропускаем health check без аутентификации
  if (req.path === '/health' || req.path === '/api/v1') {
    return next();
  }

  if (!API_KEY) {
    console.warn('[Auth] API_KEY не задан в .env — аутентификация отключена');
    return next();
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'API key required' });
  }

  const key = authHeader.slice(7); // убираем "Bearer "

  if (key !== API_KEY) {
    return res.status(403).json({ error: 'Forbidden', message: 'Invalid API key' });
  }

  next();
}
// --- Конец middleware аутентификации ---
