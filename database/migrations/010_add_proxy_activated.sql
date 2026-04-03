-- Добавляем поле для отслеживания первой активации MTProxy
-- Нужно для одноразового уведомления админа при первом нажатии кнопки прокси

ALTER TABLE clients ADD COLUMN proxy_activated_at DATETIME DEFAULT NULL;
