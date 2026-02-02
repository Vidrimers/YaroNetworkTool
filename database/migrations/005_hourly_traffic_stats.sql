-- Миграция: Переход на почасовую статистику трафика
-- Дата: 2026-02-02

-- Удаляем старую таблицу с ограничением UNIQUE(client_uuid, date)
DROP TABLE IF EXISTS traffic_logs;

-- Создаем новую таблицу для почасовой статистики
CREATE TABLE traffic_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_uuid TEXT NOT NULL,
    bytes_uploaded INTEGER NOT NULL DEFAULT 0,
    bytes_downloaded INTEGER NOT NULL DEFAULT 0,
    bytes_total INTEGER NOT NULL DEFAULT 0,
    connections_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_uuid) REFERENCES clients(uuid) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX idx_traffic_logs_client_uuid ON traffic_logs(client_uuid);
CREATE INDEX idx_traffic_logs_created_at ON traffic_logs(created_at);
CREATE INDEX idx_traffic_logs_client_date ON traffic_logs(client_uuid, created_at);
