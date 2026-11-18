# PrintFlow — локальна система приймання документів

Вебсайт приймає PDF через локальну мережу, зберігає документи та надає адміністратору історію, TXT-експорт і налаштування очищення. Інтеграція з CUPS ще не завершена: фізичний друк не виконується, принтер для запуску сайту не потрібний.

Для швидкого тестування потрібні Node.js 24 і Python 3. Команди з кореня завантаженого проєкту:

```bash
npm ci
npm run install:all
cp server/.env.example server/.env
python3 scripts/set-admin-password.py server/.env
npm run build
npm start
```

Відкрийте http://127.0.0.1:4000 та http://127.0.0.1:4000/admin. Копіюйте `.env.example` лише під час першого налаштування. Зупинка — Ctrl+C.

Повна інструкція від встановлення Ubuntu до доступу з телефона: **[UBUNTU_SERVER_GUIDE.md](UBUNTU_SERVER_GUIDE.md)**.

Код інтерфейсу — `client/src`, сервер — `server/src`, служба — `deploy/printflow.service`, оновлення — `deploy.sh`.
