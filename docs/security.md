# Безпека

## Автентифікація

- Паролі хешуються Argon2id.
- Сесія передається secure HttpOnly cookie; JavaScript не має доступу до JWT.
- Production cookie обмежена доменом `.wtmelon.store`, `SameSite=Lax`, `Secure=true`.
- Login має rate limiting і однакову помилку для невідомого користувача та неправильного пароля.

## Авторизація

Кожен endpoint перевіряє permission, а не лише приховує кнопку у frontend. OWNER може делегувати дозволи користувачам через ролі, але системну роль OWNER не можна випадково видалити або позбавити критичних дозволів.

## Секрети

- `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY`, VAPID private key, database credentials і deployment credentials живуть тільки в environment.
- Telegram token шифрується AES-256-GCM; ключ не зберігається в БД.
- Значення секретів не повертаються через API після збереження.
- Логи й audit payload очищуються від паролів, токенів і cookies.
- Push endpoint та ключі браузерної підписки доступні тільки авторизованому користувачу й видаляються після відповіді push-сервісу `404/410`.

## Аудит

Фіксуються actor, дія, тип і ID сутності, timestamp, безпечний diff/metadata та IP. Аудит не видаляється через звичайний UI.
