# Запуск PrintFlow на Ubuntu Server

Це основна інструкція встановлення. Виконуйте кроки по черзі від звичайного користувача Ubuntu з правом `sudo`. Команди в блоках призначені для термінала Ubuntu, якщо прямо не зазначено інше. `sudo` може запитати пароль користувача Ubuntu; під час введення символи не показуються.

Сайт працює без принтера: він приймає PDF, зберігає їх і показує історію. CUPS та фізичний друк ще не з'єднані з вебзастосунком.

**Межі перевірки, 18.11.2026.** Код перевірено на macOS і на наявній Ubuntu Server 26.10 у тимчасовому каталозі. Встановлення чистої Ubuntu 24.04, команди `apt`, налаштування SSH-ключа GitHub, початкове створення служби, UFW, зміна мережі VM та підключення принтера в цьому сеансі **не перевірені виконанням**. Нижче ці групи також позначені. Фактичні результати — у [report/TEST_RESULTS.md](report/TEST_RESULTS.md).

## КРОК 1. Підготовка Ubuntu Server

Для нового сервера використовуйте **Ubuntu Server 24.04 LTS**: це версія з тривалою підтримкою, стандартні оновлення безпеки якої передбачені до травня 2029 року. [Відомості Ubuntu](https://documentation.ubuntu.com/release-notes/24.04/). Наявний сервер проєкту працює на 26.10; для демонстрації його перевстановлення не потрібне.

Завантажте ISO з [офіційного сайту Ubuntu](https://ubuntu.com/download/server). Для звичайного ПК обирайте amd64, для VM на Mac з Apple Silicon — arm64. Установіть систему на окремий комп'ютер або нову VM. Не обирайте диск із потрібними вам даними.

В інсталяторі підключіть Ethernet або мережевий адаптер VM; для початку залиште автоматичне отримання адреси (DHCP). Створіть користувача, наприклад `artem`, і власний пароль. Увімкніть OpenSSH Server, якщо хочете працювати з іншого комп'ютера. Додаткові серверні застосунки не потрібні. Після встановлення від'єднайте ISO та перезавантажте систему.

Для VM одразу оберіть **Bridged Network / Мережевий міст** до адаптера з домашньою мережею. Тоді Ubuntu, телефон і ноутбук зможуть бути в одній локальній мережі. Докладніше — крок 7.

*Встановлення ОС та зміна параметрів VM у цьому сеансі не перевірені.*

## КРОК 2. Перші налаштування Ubuntu

Увійдіть у консолі під створеним користувачем. Перевірте систему, адресу та доступ до інтернету:

```bash
whoami
cat /etc/os-release
hostname -I
ip route
getent hosts ubuntu.com
ping -c 3 1.1.1.1
```

Команда `hostname -I` показує адреси сервера. Якщо `ping` заблокований мережею, це ще не означає відсутності інтернету: перевірте також результат оновлення пакетів.

Оновіть пакети:

```bash
sudo apt update
sudo apt upgrade -y
```

Якщо Ubuntu повідомляє про потребу перезавантаження:

```bash
sudo reboot
```

Після перезавантаження увійдіть знову. У консолі VM також можна пройти всю інструкцію без SSH.

*Оновлення пакетів та перезавантаження в цьому сеансі не виконувалися.*

## КРОК 3. Встановлення потрібних програм

Git завантажує код. Node.js виконує сервер, а npm встановлює JavaScript-залежності. Python потрібний лише для безпечного запису хешу пароля. `curl` перевіряє HTTP, `ufw` задає правила доступу, `usbutils` допоможе побачити USB-принтер. CUPS установимо окремо у кроці 9.

```bash
sudo apt install -y git curl ca-certificates python3 openssh-server ufw usbutils nano
sudo systemctl enable --now ssh
```

У стандартному сховищі Ubuntu 24.04 може бути занадто старий Node.js. Для цього проєкту встановіть Node.js 24 через сховище NodeSource. Спочатку завантажте його налаштування, перегляньте файл, потім запустіть:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/printflow-nodesource.sh
less /tmp/printflow-nodesource.sh
sudo bash /tmp/printflow-nodesource.sh
sudo apt install -y nodejs
node --version
npm --version
command -v node
/usr/bin/node --version
```

Із `less` виходять клавішею `q`. Очікується версія `v24...` і Node.js за шляхом `/usr/bin/node`, який використовує служба проєкту. npm входить до пакета NodeSource, окремий пакет Ubuntu `npm` тут не встановлюйте. [Документація NodeSource](https://github.com/nodesource/distributions/blob/master/DEV_README.md).

*Команди встановлення системних пакетів і NodeSource не виконувалися на чистій Ubuntu в цьому сеансі.*

## КРОК 4. Підключення до GitHub і завантаження коду

Git зберігає версії проєкту. `git clone` створює його локальну копію. Репозиторій: [LemonArt13/linux-print-server](https://github.com/LemonArt13/linux-print-server). Посилання можна знайти на GitHub кнопкою **Code**.

Репозиторій проєкту приватний, тому використаємо окремий SSH-ключ для читання. На Ubuntu створіть ключ. Якщо файл із такою назвою вже існує, не перезаписуйте його: використайте наявний ключ, зареєстрований для цього репозиторію.

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/printflow_github -C printflow-server
cat ~/.ssh/printflow_github.pub
```

Під час створення можна задати пароль ключа; тоді Git запитуватиме його під час звернення. Скопіюйте **лише публічний** ключ із файла `.pub`. Власник репозиторію додає його на GitHub: **Settings → Deploy keys → Add deploy key**, без прапорця **Allow write access**. Викладачу потрібна допомога власника репозиторію або доступ до нього. Приватний ключ залишається на Ubuntu; паролі й токени до інструкції не записуються. [Deploy keys у GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

Перевірте підключення:

```bash
ssh -i ~/.ssh/printflow_github -o IdentitiesOnly=yes -T git@github.com
```

При першому з'єднанні звірте показаний відбиток ключа сервера з [офіційними відбитками GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints), після цього введіть `yes`. Повідомлення про успішну автентифікацію та відсутність shell access є нормальним; команда GitHub може завершитися кодом 1.

Створіть каталог. Власником буде ваш поточний користувач:

```bash
sudo install -d -o "$(id -un)" -g "$(id -gn)" -m 0755 /opt/printflow
GIT_SSH_COMMAND="ssh -i $HOME/.ssh/printflow_github -o IdentitiesOnly=yes" git clone git@github.com:LemonArt13/linux-print-server.git /opt/printflow/repo
cd /opt/printflow/repo
git config core.sshCommand "ssh -i $HOME/.ssh/printflow_github -o IdentitiesOnly=yes"
ls
```

Мають бути каталоги `client`, `server`, `deploy` і файли `package.json`, `deploy.sh`. Не запускайте `git clone` вдруге в той самий каталог. Для наявної копії перейдіть у неї командою `cd /opt/printflow/repo`; оновлення описане у кроці 10.

*Створення нового ключа, його додавання до GitHub і перше клонування в цьому сеансі не виконувалися.*

## КРОК 5. Налаштування проєкту

Установіть залежності точно за lock-файлами. Не копіюйте `node_modules` із Windows або Mac:

```bash
cd /opt/printflow/repo
npm ci
npm run install:all
```

Команди npm запускайте без `sudo`. Підготуйте конфігурацію **лише під час першого налаштування**:

```bash
cp server/.env.example server/.env
chmod 600 server/.env
python3 scripts/set-admin-password.py server/.env
nano server/.env
```

Скрипт двічі запитає новий пароль адміністратора. Він зберігає хеш scrypt, сам пароль у файл не записується. У редакторі змініть `HOST=127.0.0.1` на `HOST=0.0.0.0`. Залиште `PORT=4000` і `SESSION_TTL_SECONDS=3600`. Рядок `ADMIN_PASSWORD_HASH` уже заповнений скриптом — не замінюйте його паролем. Збереження в `nano`: Ctrl+O, Enter, вихід: Ctrl+X. `.env` виключено з Git.

Для ручної перевірки поки залиште `DATA_DIR` та `UPLOAD_DIR` закоментованими. Дані потраплятимуть до `server/data` та `server/uploads`. Під час переходу до служби використаємо окремі каталоги `/var/lib/printflow`.

Зберіть клієнт і сервер:

```bash
npm run typecheck
npm run build
```

Після успішної збірки з'являться `client/dist/index.html` і `server/dist/index.js`. Попередження Vite про пакет понад 500 кБ не зупиняє збірку. Файл `.env` потрібний серверу, налаштування IP у коді React змінювати не треба.

## КРОК 6. Перший запуск сайту вручну

Із кореня проєкту запустіть:

```bash
cd /opt/printflow/repo
npm start
```

Очікуване повідомлення: `PrintFlow HTTP server started`. Поки термінал зайнятий цим процесом, залиште його відкритим. В іншій консолі Ubuntu або SSH-сеансі виконайте:

```bash
curl -fsS http://127.0.0.1:4000/api/health
```

Очікується JSON із `"status":"ready"` і `"printingEnabled":false`. Це означає, що вебсервер працює; принтер для цієї перевірки не потрібний. Express сам надає зібрані сторінки та API на порту 4000. Окремо запускати Vite на Ubuntu не треба.

Для зупинки ручного запуску натисніть Ctrl+C у першому терміналі. До перевірки з іншого пристрою у кроці 7 залиште сервер запущеним.

## КРОК 7. Доступ із телефона або ноутбука

На Ubuntu перевірте адресу та порт:

```bash
ip -br -4 address
ip route
ss -ltn 'sport = :4000'
```

Для доступу через мережу в `.env` має бути `HOST=0.0.0.0`. Після зміни перезапустіть ручний процес. У `ss` має бути `0.0.0.0:4000`. Адресу `0.0.0.0` у браузер не вводять: це налаштування прослуховування.

Телефон і сервер повинні бути в одній мережі. Відкрийте в браузері адресу виду `http://IP_СЕРВЕРА:4000`. Наприклад, для наявної тестової VM це `http://10.211.55.10:4000`, а адмінпанель — `http://10.211.55.10:4000/admin`. Після зміни мережі адреса буде іншою. `localhost` на телефоні означає сам телефон.

У Parallels вимкніть VM штатним завершенням Ubuntu та оберіть **Hardware → Network → Bridged Network → ваш Wi-Fi/Ethernet**. У VirtualBox аналогічне налаштування називається **Bridged Adapter**. Потім запустіть VM і знову перевірте IP. Shared Network / NAT зазвичай дозволяє доступ із комп'ютера-власника VM, але не дає телефону прямого доступу до адреси VM. Гостьова Wi-Fi-мережа та ізоляція клієнтів на роутері теж можуть блокувати з'єднання.

Перевірте мережевий фільтр Ubuntu:

```bash
sudo ufw status
```

Якщо він активний, дозвольте порт лише зі своєї LAN. Команда нижче запитає справжню адресу підмережі, наприклад `192.168.1.0/24`; її можна побачити на початку рядка вашого мережевого адаптера в `ip -4 route show scope link`. Запис `/24` указує розмір цієї підмережі. Не копіюйте приклад, якщо у вас інша мережа:

```bash
ip -4 route show scope link
read -r -p 'Ваша довірена LAN-підмережа у форматі CIDR: ' PRINTFLOW_LAN
sudo ufw allow from "$PRINTFLOW_LAN" to any port 4000 proto tcp
sudo ufw status
```

Для доступу сайту не потрібно вмикати UFW, якщо він неактивний. Перед його окремим увімкненням налаштуйте також доступ SSH, інакше можна втратити віддалене з'єднання. Порти на інтернет-роутері не перенаправляйте. Поточний HTTP-сайт використовуйте в довіреній локальній мережі.

*Доступ із фізичного телефона, нові правила UFW та перехід VM у Bridged у цьому сеансі не перевірені.*

## КРОК 8. Налаштування системної служби

systemd запускає сайт без відкритого термінала та після завантаження Ubuntu. Спочатку зупиніть ручний процес Ctrl+C, щоб звільнити порт 4000.

Створіть окремого користувача служби й каталоги. Він не матиме інтерактивного входу:

```bash
cd /opt/printflow/repo
id printflow >/dev/null 2>&1 || sudo useradd --system --home-dir /var/lib/printflow --shell /usr/sbin/nologin printflow
sudo install -d -o printflow -g printflow -m 0700 /var/lib/printflow /var/lib/printflow/data /var/lib/printflow/uploads
mkdir -p /opt/printflow/releases
```

Створіть конфігурацію служби за прикладом і встановіть пароль. Ці дві перші команди — лише для нового сервера, де `/etc/printflow.env` ще немає:

```bash
sudo install -o root -g root -m 0600 server/.env.example /etc/printflow.env
sudo python3 scripts/set-admin-password.py /etc/printflow.env
sudo nano /etc/printflow.env
```

У файлі служби середовища встановіть:

```dotenv
HOST=0.0.0.0
PORT=4000
SESSION_TTL_SECONDS=3600
DATA_DIR=/var/lib/printflow/data
UPLOAD_DIR=/var/lib/printflow/uploads
```

Збережіть також рядок `ADMIN_PASSWORD_HASH`, створений скриптом. Не видаляйте його під час редагування. Конфігурація служби має інші каталоги даних, тому пробні документи з кроку 6 автоматично не переносяться. Після запуску служби повторіть перевірку з новим тестовим PDF.

У репозиторії вже є готовий unit — файл із параметрами служби. Перегляньте та встановіть його:

```bash
cat deploy/printflow.service
sudo install -m 0644 deploy/printflow.service /etc/systemd/system/printflow.service
```

Його вміст має бути таким:

```ini
[Unit]
Description=PrintFlow LAN document application
After=network.target

[Service]
Type=simple
User=printflow
Group=printflow
WorkingDirectory=/opt/printflow/current/server
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=4000
Environment=DATA_DIR=/var/lib/printflow/data
Environment=UPLOAD_DIR=/var/lib/printflow/uploads
EnvironmentFile=/etc/printflow.env
ExecStart=/usr/bin/node /opt/printflow/current/server/dist/index.js
Restart=on-failure
RestartSec=3
TimeoutStopSec=15
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/printflow

[Install]
WantedBy=multi-user.target
```

Активна версія зберігатиметься за посиланням `current`. Його створить `deploy.sh`: скрипт отримує зміни, збирає окрему версію та перезапускає службу. Якщо перевірка після запуску не вдалася, він повертає попередню версію, коли вона є. Для першого запуску потрібна чиста копія Git; локальний `.env` і тестові дані ігноруються Git і не потраплять до версії.

```bash
sudo systemctl daemon-reload
sudo systemctl enable printflow.service
bash /opt/printflow/repo/deploy.sh
sudo systemctl start printflow.service
systemctl status printflow.service --no-pager
curl -fsS http://127.0.0.1:4000/api/health
```

Скрипт може запитати пароль `sudo` для перезапуску служби. Очікується `active (running)`, відповідь `ready` і повідомлення `Healthy release: ...`. Додаткові права `sudo` без пароля не потрібні.

Основні команди керування:

```bash
sudo systemctl restart printflow.service
systemctl is-enabled printflow.service
systemctl is-active printflow.service
journalctl -u printflow.service -n 80 --no-pager
journalctl -u printflow.service -f
```

Якщо ваш користувач не бачить журнал, додайте `sudo` перед `journalctl`. З перегляду потоку виходять Ctrl+C. Після зміни `.env` потрібен restart; після зміни unit — спочатку `sudo systemctl daemon-reload`, потім restart.

`enable` вмикає автоматичний запуск після перезавантаження Ubuntu. Він не запускає саму VM: її потрібно увімкнути окремо. Для ручної перевірки автозапуску збережіть роботу, виконайте `sudo reboot`, увійдіть знову та перевірте `systemctl is-active printflow.service`.

*Початкове встановлення служби, запуск deploy та повне перезавантаження в цьому сеансі не виконувалися. Існуюча служба перевірена без зміни її налаштувань.*

## КРОК 9. Налаштування CUPS

Цей крок готує службу друку. Для відкриття сайту він необов'язковий.

```bash
sudo apt install -y cups cups-client
sudo systemctl enable --now cups.service
systemctl is-active cups.service
lpstat -r
lpstat -p -d
sudo lpinfo -v
```

Без принтера повідомлення про відсутність принтерів або типової черги є очікуваним. Вебсайт при цьому має працювати.

Для USB-принтера підключіть кабель і перевірте:

```bash
lsusb
sudo lpinfo -v
```

У VM передайте USB-пристрій саме Ubuntu через меню USB/Devices програми віртуалізації. Якщо принтер залишився підключеним до macOS або Windows, Ubuntu його не побачить. Увімкніть принтер і перевірте кабель.

Налаштування черги залежить від моделі. Знайдіть точний URI пристрою у `lpinfo -v` та підтримуваний драйвер:

```bash
lpinfo -m
```

Якщо для вашої моделі є потрібний драйвер, створіть чергу. Наступні команди інтерактивно запитають фактичні значення з виводу попередніх команд — вони не визначають їх автоматично:

```bash
read -r -p 'Назва черги латиницею без пробілів: ' PRINTFLOW_QUEUE
read -r -p 'URI пристрою з lpinfo -v: ' PRINTFLOW_PRINTER_URI
read -r -p 'Ідентифікатор драйвера з першого стовпця lpinfo -m: ' PRINTFLOW_DRIVER
sudo lpadmin -p "$PRINTFLOW_QUEUE" -E -v "$PRINTFLOW_PRINTER_URI" -m "$PRINTFLOW_DRIVER"
sudo lpadmin -d "$PRINTFLOW_QUEUE"
lpstat -p -d
```

`-m everywhere` підходить для сумісних IPP-принтерів; для довільного USB-принтера його не підставляйте. Якщо потрібного драйвера немає, спочатку перевірте підтримку конкретної моделі в Ubuntu та інструкцію виробника. Без моделі принтера правильну команду встановлення драйвера визначити не можна. [Команди адміністрування CUPS](https://openprinting.github.io/cups/doc/admin.html).

Тільки коли черга налаштована й ви готові до справжнього друку, можна окремо перевірити CUPS тестовим PDF:

```bash
read -r -p 'Повний шлях до вашого тестового PDF: ' PRINTFLOW_TEST_PDF
lp -d "$PRINTFLOW_QUEUE" "$PRINTFLOW_TEST_PDF"
lpstat -W not-completed -o
```

Ця команда друкує безпосередньо через CUPS, поза вебсайтом. Не відкривайте порт 631 чи віддалене адміністрування CUPS для запуску PrintFlow.

У коді вже є приймання PDF, журнал, стан `awaiting_setup` та функція `finishPrintJob` для майбутньої фіксації кінцевого результату й видалення PDF. **Немає** передавання PDF до CUPS, прив'язки ідентифікатора завдання CUPS до документа та опитування станів принтера. Сама установка CUPS цього не додає. `/api/health` поки завжди повертає `printingEnabled: false`.

*Підключення USB, створення черги, драйвер та фізичний друк у цьому сеансі не перевірені.*

## КРОК 10. Оновлення проєкту з GitHub

Зміни спочатку мають бути опубліковані власником репозиторію. На Ubuntu перевірте локальні зміни:

```bash
cd /opt/printflow/repo
git status --short
git pull --ff-only
bash /opt/printflow/repo/deploy.sh
```

`git pull --ff-only` отримує нову версію без автоматичного злиття. Якщо є конфлікт або власні зміни, зупиніться й збережіть їх; не використовуйте `git reset --hard` або `git clean` для стирання проблеми.

`deploy.sh` теж виконує `git pull --ff-only`, тому під час звичайного оновлення достатньо самого скрипту. Він встановлює клієнтські й серверні залежності через `npm ci`, виконує збірку, залишає лише робочі серверні залежності в release та перезапускає службу. Вручну повторювати ці дії після нього не потрібно.

Перевірте результат:

```bash
systemctl status printflow.service --no-pager
readlink /opt/printflow/current
curl -fsS http://127.0.0.1:4000/api/health
```

Документи й журнал залишаються у `/var/lib/printflow`, конфігурація — у `/etc/printflow.env`. Старі версії в `releases` автоматично не видаляються. Перед їх ручним прибиранням переконайтеся, що залишили поточну й попередню справну версії.

## КРОК 11. Перевірка роботи

Перевірте службу, HTTP і CUPS:

```bash
systemctl is-active printflow.service
systemctl is-enabled printflow.service
curl -fsS http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:4000/
curl -I http://127.0.0.1:4000/admin
systemctl is-active cups.service
lpstat -r
lpstat -p -d
```

Далі в браузері іншого пристрою:

1. Відкрийте `http://IP_СЕРВЕРА:4000`; має бути «Сервер доступний».
2. Виберіть власний тестовий PDF до 10 МБ та натисніть «Завантажити». Дозволено до 10 файлів за один запит.
3. Переконайтеся, що з'явився запис «Очікує налаштування друку». Це приймання документа, фізичний друк ще не виконується.
4. Перейдіть на `/admin`, введіть пароль, заданий для `/etc/printflow.env`. Має відкритися адмінпанель із завантаженим документом.
5. Перевірте TXT-експорт. Перемикач очищення дозволяє обрати 7, 30 або 90 днів; автоматичне очищення зберігає записи незавершених документів. Типово воно вимкнене.
6. Натисніть «Вийти»: доступ до історії має знову вимагати входу. Після перезапуску служби також потрібен повторний вхід.

«Очистити історію» видаляє весь журнал після підтвердження, але PDF в очікуванні залишаються на сервері. Перевіряйте це лише на тестових даних. Автоматичне очищення історії спрацьовує при запуску сервера, збереженні налаштувань і раз на добу. Воно не є політикою видалення PDF в очікуванні.

Місце на диску та розмір робочих даних:

```bash
df -h
sudo du -sh /var/lib/printflow
```

Для резервної копії зупиніть службу, скопіюйте `/var/lib/printflow` та `/etc/printflow.env` у приватне захищене місце, потім знову запустіть службу. Ці файли містять документи й конфігурацію доступу; до Git їх не додають. Відновлення копії потрібно перевіряти окремо.

Перевірки коду із кореня проєкту:

```bash
cd /opt/printflow/repo
npm run typecheck
npm run build
npm test
```

Тести використовують тимчасові каталоги й не очищають робочі дані служби. Для них потрібні залежності з кроку 5.

## КРОК 12. Найпоширеніші проблеми

| Проблема | Що зробити |
|---|---|
| Сайт не відкривається навіть на Ubuntu | Виконайте `curl -fsS http://127.0.0.1:4000/api/health`, перевірте `systemctl status printflow.service --no-pager` і журнал. |
| Служба не запускається | `sudo journalctl -u printflow.service -n 80 --no-pager`. Перевірте `/usr/bin/node`, `readlink /opt/printflow/current` та наявність `server/dist/index.js` у поточній версії. |
| `EADDRINUSE` | Порт 4000 зайнятий; зупиніть ручний `npm start` через Ctrl+C перед запуском служби. Перевірте `ss -ltnp 'sport = :4000'`. |
| На Ubuntu працює, з телефона — ні | Уточніть поточну IP, `HOST=0.0.0.0`, Bridged, спільну Wi-Fi-мережу та UFW. Вимкніть гостьову ізоляцію клієнтів або оберіть звичайну довірену мережу. |
| IP змінилася | `hostname -I`; відкрийте нову адресу. За потреби зарезервуйте її для VM у DHCP роутера. |
| Не встановлюються залежності | Перевірте інтернет, `node -v`, `npm -v`, `df -h`. Повторіть `npm ci` в потрібній папці. Не видаляйте lock-файли. Для несумісної версії поверніться до кроку 3. |
| GitHub: `Permission denied (publickey)` | Перевірте ключ `~/.ssh/printflow_github`, Deploy key для потрібного репозиторію й `git config --get core.sshCommand`. |
| `deploy.sh` повідомляє про локальні зміни | `git diff` і `git status --short`. Збережіть потрібні правки та узгодьте оновлення; скрипт спеціально відмовляється їх перезаписувати. |
| Вхід адміністратора повертає 503 | Задайте пароль через `sudo python3 scripts/set-admin-password.py /etc/printflow.env`, потім `sudo systemctl restart printflow.service`. |
| Невірний пароль або завершена сесія | Для служби пароль береться з `/etc/printflow.env`, для ручного запуску — із `server/.env`. Після restart увійдіть знову. Після 10 невдалих спроб зачекайте 15 хвилин. |
| Завантаження відхилено | Потрібен PDF із сигнатурою `%PDF-`, до 10 МБ, до 10 файлів. DOCX спочатку експортуйте в PDF. |
| Завантаження повертає 500 | Перевірте журнал, вільний диск і власника `/var/lib/printflow`; запис має бути доступний користувачу `printflow`. |
| CUPS не бачить принтер | `lsusb`, `sudo lpinfo -v`, кабель, живлення, передавання USB у VM, підтримка моделі. |
| PDF прийнято, але він не друкується | Це поточна поведінка: інтеграція вебсайту з CUPS ще не реалізована. Установлення драйвера саме по собі не змінює її. |

Після кожного виправлення перевірте `/api/health` та сторінку з іншого пристрою. Результатів, яких не перевіряли на вашому обладнанні, не оголошуйте підтвердженими.
