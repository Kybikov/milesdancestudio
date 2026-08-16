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
- Persistent volume використовується тільки для PostgreSQL.
- Environment задається в Coolify; `.env` не комітиться.
- HTTPS і автоматичне оновлення сертифікатів забезпечує proxy Coolify.

Перед production запуском створюються OWNER і ADMIN з випадковими паролями. Паролі передаються замовнику окремо й мають бути змінені після першого входу.
