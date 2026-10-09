# PORTIA OS

Интерактивная база вымышленных вирусов в виде рабочего стола научной станции.

Пошаговая инструкция по изменению и проверке сайта находится в [EDITING_GUIDE.md](EDITING_GUIDE.md).

## Как работает опубликованный сайт

- Посетители открывают сайт без регистрации и видят актуальную базу.
- Данные хранятся в Supabase и обновляются на сайте без изменения кода.
- Вход в редактор защищён аккаунтом владельца.
- После сохранения новые вирусы, информация, сводки, рекомендации и советы помощника появляются у всех посетителей.

## Первичная настройка Supabase

1. Создайте проект в Supabase.
2. Откройте **SQL Editor** и выполните файл `supabase/portia_setup.sql`.
3. Откройте **Authentication → Users** и создайте пользователя с адресом владельца и надёжным паролем.
4. В **Project Settings → API** скопируйте URL проекта и Publishable key.

## Переменные окружения

Добавьте локально в `.env.local`, а затем в настройках проекта Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
PORTIA_OWNER_EMAIL=your-email@example.com
```

Publishable key разрешено использовать в браузере. Service Role key этому сайту не нужен и не должен добавляться в публичные переменные.

## Развёртывание в Vercel без GitHub

Требуется Node.js 22.13 или новее.

```powershell
npm ci
npm run build
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npx vercel env add PORTIA_OWNER_EMAIL
npx vercel deploy
npx vercel deploy --prod
```

GitHub для этого способа не требуется. После следующих изменений достаточно снова выполнить `npx vercel deploy --prod`.

## Как менять содержимое без кода

1. Откройте опубликованный сайт.
2. Запустите **Настройки**.
3. Нажмите **Войти как владелец** и введите пароль Supabase.
4. Вернитесь в **Настройки** и нажмите **Открыть редактор**.
5. Измените нужный раздел и нажмите **Сохранить всё**.

Настройки фона, цвета и размера ярлыков сохраняются отдельно на каждом устройстве.
