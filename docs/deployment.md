# Розгортання

## Локально

1. Скопіювати `.env.example` у `.env`.
2. Згенерувати сильні значення секретів.
3. Запустити `docker compose up --build`.
4. Перевірити `http://localhost:3000` і `http://localhost:4000/health`.

## Coolify

- Окремий проєкт: `Miles Dance Studio`.
- Один Docker Compose stack із frontend, API та PostgreSQL.
- Frontend domain: `admin-miles.wtmelon.store`.
- API domain: `api-miles.wtmelon.store`.
- PostgreSQL не публікується назовні.
- Production використовує лише внутрішні `expose` порти; локальні bindings з `docker-compose.override.yml` не входять у Coolify deployment.
- Persistent volume використовується тільки для PostgreSQL.
- Environment задається в Coolify; `.env` не комітиться.
- `VAPID_PUBLIC_KEY` і `VAPID_PRIVATE_KEY` генеруються один раз для production та задаються лише в Coolify.
- HTTPS і автоматичне оновлення сертифікатів забезпечує proxy Coolify.

Перед production запуском створюються OWNER і ADMIN із сильними паролями, які передаються замовнику окремо. Перший вхід не блокується обов'язковою зміною пароля; змінити пароль можна будь-коли в профілі.

Після деплою перевіряються `/health`, `/ready`, вхід, mobile/desktop календар, Kanban, профіль, сповіщення та активність. Push вмикається користувачем у центрі сповіщень, оскільки браузер вимагає явної згоди.
