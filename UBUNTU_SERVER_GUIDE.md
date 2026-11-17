# Ubuntu Server: налаштування, запуск і демонстрація PrintFlow

Інструкція для наявної VM **Ubuntu Linux** у Parallels Desktop. Проєкт: «Розробка веборієнтованої системи керування друком документів на базі Linux-сервера». Поточний етап — приймання PDF та демонстрація сайту; фізичний друк не реалізований.

## 1. Адреси й каталоги

| Що | Значення |
|---|---|
| Ubuntu | Ubuntu 26.10, ARM64 |
| Користувач SSH/розгортання | `artem` |
| Мережа Parallels | Shared Network |
| IP Ubuntu | `10.211.55.10` — може змінитися після зміни мережі/DHCP |
| Сайт із Mac | `http://10.211.55.10:4000` |
| Адміністративна сторінка | `http://10.211.55.10:4000/admin` |
| API стану | `http://10.211.55.10:4000/api/health` |
| Репозиторій | приватний `LemonArt13/linux-print-server` |
| Копія Git на Ubuntu | `/opt/printflow/repo` |
| Активна збірка | `/opt/printflow/current` — symlink на release |
| Збірки | `/opt/printflow/releases/` |
| Служба | `printflow.service` |
| Користувач служби | `printflow`, без інтерактивного входу |
| Конфігурація | `/etc/printflow.env`, root, права 0600 |
| Журнал документів | `/var/lib/printflow/data/print-history.txt` |
| PDF | `/var/lib/printflow/uploads/` |

## 2. Щоденний запуск перед демонстрацією

1. У Parallels запустіть існуючу VM **Ubuntu Linux**. Не створюйте нову VM.
2. У терміналі Mac підключіться:

```bash
ssh -i ~/.ssh/knu_printflow artem@10.211.55.10
```

3. На Ubuntu перевірте службу:

```bash
systemctl status printflow.service --no-pager
curl -fsS http://127.0.0.1:4000/api/health
hostname -I
```

4. У браузері Mac відкрийте `http://10.211.55.10:4000`.

Служба має автозапуск після завантаження **Ubuntu**. Для цього VM повинна працювати: автозапуск служби не запускає Parallels та саму VM, не заважає macOS засинати. У production окремий Vite запускати не потрібно: Express віддає зібраний frontend і `/api` на одному порту 4000.

Якщо служба не працює:

```bash
sudo systemctl restart printflow.service
systemctl status printflow.service --no-pager
journalctl -u printflow.service -n 60 --no-pager
```

Для `artem` налаштовано право sudo без пароля **тільки** на restart/stop цієї служби. Інші адміністративні дії можуть запитати пароль Ubuntu.

## 3. Перевірка мережі

На Mac:

```bash
prlctl list -a
prlctl list 'Ubuntu Linux' -i
nc -z -G 3 10.211.55.10 22
curl --fail --max-time 5 http://10.211.55.10:4000/api/health
open http://10.211.55.10:4000
```

На Ubuntu:

```bash
ip -br a
ip route
ss -ltn | rg ':4000'  # якщо rg встановлено
# Стандартний варіант без rg:
ss -ltn 'sport = :4000'
sudo ufw status
```

`HOST=0.0.0.0` означає прослуховування IPv4-інтерфейсів Ubuntu. На поточному етапі порт не перенаправляється з публічного інтернету.

**Телефон:** у Shared Network адреса `10.211.55.10` належить приватній підмережі Mac–VM. Телефон у домашньому Wi-Fi зазвичай не має прямого маршруту до неї. Для демонстрації з телефона можна погоджено змінити Parallels → Hardware → Network → Bridged Network → потрібний Wi-Fi/Ethernet. Після цього повторно виконайте `ip -br a`, підключіться до **нової** адреси та перевірте firewall. Якщо UFW активний, дозвольте 4000/tcp тільки зі справжньої довіреної LAN-підмережі. Не копіюйте адресу підмережі навмання. Не відкривайте порт на роутері в інтернет.

## 4. Як оновити проєкт

Спочатку зміни перевіряються на Mac і публікуються в існуючий GitHub-репозиторій після перегляду:

```bash
npm run build
npm run typecheck
npm test
git status
# Перевірити diff і склад коміту, не додавати .env/дані/секрети.
```

На Ubuntu:

```bash
bash /opt/printflow/repo/deploy.sh
```

Скрипт бере блокування від паралельного запуску, перевіряє чистоту checkout, робить `git pull --ff-only`, створює новий release, встановлює Linux-залежності через `npm ci`, збирає клієнт і сервер, перемикає `current`, перезапускає systemd і перевіряє `/api/health`. До успішного збирання попередній release працює. За невдалої health-перевірки скрипт повертає попередній release та перезапускає його. Коротка перерва під час restart можлива; це не схема безперервного оновлення.

Секрети та робочі дані зберігаються поза Git checkout. Не копіюйте `node_modules` із Mac. Не виконуйте `git reset --hard`, `git clean` або видалення каталогів даних для виправлення deploy без розуміння наслідків.

## 5. Вхід адміністратора

Під час першої підготовки створено випадковий пароль. Він записаний у `/home/artem/.config/printflow/initial-password` з правами 0600. Це приватний файл: переглядайте лише локально, не додавайте його до Git, скриншотів або звіту.

Щоб установити свій пароль, на Ubuntu з термінала:

```bash
cd /opt/printflow/repo
sudo python3 scripts/set-admin-password.py /etc/printflow.env
sudo systemctl restart printflow.service
```

Введення пароля приховане. Для пробного проєкту дозволений будь-який непорожній пароль, без мінімальної довжини. Новий пароль застосовується після restart. Сесії адміністратора тоді завершуються; типовий строк сесії — година. Після зміни випадковий початковий пароль уже не є чинним, хоча приватний файл може залишатися.

## 6. Налаштування з нуля на цій Ubuntu

Цей розділ — для повторення процедури, а не команда перевстановлення наявного сервера.

### 6.1. SSH

На Ubuntu, якщо SSH ще не встановлено:

```bash
sudo apt update
sudo apt install openssh-server
sudo systemctl enable --now ssh
```

На Mac створюється окремий ключ, якщо його ще немає:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/knu_printflow -C knu-printflow-mac
cat ~/.ssh/knu_printflow.pub
```

У `~/.ssh/authorized_keys` Ubuntu додається **публічний** ключ. Права: каталог 0700, файл 0600. Приватний ключ залишається на Mac. Під час першого SSH-входу звіряється fingerprint хоста, а не вимикається перевірка.

### 6.2. Системні пакети й служба

Із кореня проєкту на Mac:

```bash
scp -i ~/.ssh/knu_printflow deploy/bootstrap-ubuntu.sh deploy/printflow.service artem@10.211.55.10:/home/artem/
```

На Ubuntu після перегляду скрипту:

```bash
sudo bash /home/artem/bootstrap-ubuntu.sh artem
```

Скрипт встановлює Git, Node.js, npm, curl, Python і CUPS, створює користувача `printflow`, каталоги й systemd unit. Існуючий `/etc/printflow.env` не перезаписує. Під час цієї підготовки apt Ubuntu 26.10 пропонує Node.js 24. На іншому релізі спершу перевірте `apt-cache policy nodejs` і сумісність; скрипт не є універсальним інсталятором для всіх Ubuntu.

### 6.3. Приватний GitHub

На Ubuntu створено окремий ключ `~/.ssh/printflow_github`. Його публічна частина зареєстрована у GitHub → Repository Settings → Deploy keys із **вимкненим Allow write access**. Особистий GitHub-токен на сервер не передається.

SSH-конфігурація: `/home/artem/.ssh/printflow_config`, alias `printflow-github`. Окремий `printflow_known_hosts` містить ключі github.com, отримані з офіційного GitHub Meta API через HTTPS. При зміні ключів перевірте офіційні fingerprints; не встановлюйте `StrictHostKeyChecking=no`.

Перше клонування (якщо `/opt/printflow/repo` ще не існує):

```bash
GIT_SSH_COMMAND='ssh -F /home/artem/.ssh/printflow_config' git clone git@printflow-github:LemonArt13/linux-print-server.git /opt/printflow/repo
git -C /opt/printflow/repo config core.sshCommand 'ssh -F /home/artem/.ssh/printflow_config'
bash /opt/printflow/repo/deploy.sh
```

## 7. Керування службою та діагностика

```bash
systemctl is-active printflow.service
systemctl is-enabled printflow.service
systemctl show printflow.service -p User -p MainPID -p ExecStart
journalctl -u printflow.service -n 100 --no-pager
journalctl -u printflow.service -f
sudo systemctl stop printflow.service
sudo systemctl restart printflow.service
```

Вихід із `journalctl -f`: Ctrl+C. Закриття SSH не зупиняє системну службу. Після зміни unit потрібен `sudo systemctl daemon-reload`, а потім restart. Після зміни тільки `.env` достатньо restart.

| Симптом | Що перевірити |
|---|---|
| `Permission denied (publickey)` | Ім’я `artem`, ключ `-i`, authorized_keys і права |
| `Connection refused` на 22 | VM працює, правильна IP, `systemctl status ssh` |
| 4000 недоступний | `systemctl status printflow`, `ss`, UFW і режим Parallels |
| HTML відкривається, API не працює | `/api/health`, відповідність активної збірки, журнали |
| `/admin` повертає 503 при вході | Наявність ADMIN_PASSWORD_HASH у `/etc/printflow.env`, restart |
| Deploy не має доступу GitHub | read-only deploy key, `printflow_config`, перевірка known_hosts |
| Deploy відхиляє локальні зміни | `git -C /opt/printflow/repo diff`; зберегти зміни, не стирати дані |
| Upload повертає 500 | Місце на диску та права `/var/lib/printflow`; журнали служби |
| Втрата сесії після restart | Очікувана поведінка: увійти повторно |

## 8. PDF і журнали

Завантажені документи та журнал не зберігаються у Git. Після кінцевого статусу друку (`completed`, `error`, `cancelled`) PDF видаляється, а запис журналу залишається. Невдалі видалення повторюються щохвилини та після перезапуску сервера. Фізичний друк ще не підключений: майбутній обробник має викликати `finishPrintJob` після підтвердження кінцевого стану. PDF у статусі `awaiting_setup` та інші документи в очікуванні зберігаються. Адміністративна кнопка очищення журналу не видаляє ці PDF. Перед демонстрацією контролюйте `df -h` і розмір `/var/lib/printflow` через sudo. Не очищайте каталог PDF без перегляду та резервної копії. Автоматичне очищення записів за типовим налаштуванням вимкнене.

Для резервної копії слід узгоджено зупинити службу, скопіювати `/var/lib/printflow` і `/etc/printflow.env` у приватне захищене місце, запустити службу та перевірити health. Секрети й PDF не включаються у публічні архіви. Відновлення копії потрібно окремо перевіряти; сама наявність архіву не доводить його придатність.

## 9. CUPS

```bash
systemctl is-active cups.service
systemctl is-enabled cups.service
lpstat -p -d
```

На цьому етапі встановлюється лише базова служба. Принтер, драйвер, черга й передавання завдань із вебзастосунку не налаштовані. Повідомлення `no printers` є очікуваним. Не вмикайте віддалене адміністрування CUPS і не відкривайте 631 у мережу для цього передзахисту.

## 10. Порядок показу на передзахисті

1. Показати структуру `client`/`server` і назвати технології.
2. Показати запущену VM Ubuntu Linux у Parallels.
3. Виконати `ip -br a` й пояснити адресу сервера.
4. Показати `git -C /opt/printflow/repo log -1 --oneline` — код отримано з GitHub.
5. Показати `systemctl status printflow.service --no-pager`.
6. На Mac відкрити `http://10.211.55.10:4000` і `/admin`.
7. Пояснити: сайт працює на Ubuntu, Mac є клієнтом; CUPS та фізичний принтер — наступний етап. Доступ із телефона оголошувати перевіреним лише після реального відкриття на ньому.

Звіт: `report/Передзахист_дипломної.docx` і PDF. Фактичні перевірки: `report/TEST_RESULTS.md`. Реквізити титульної сторінки та вимоги кафедри треба уточнити.
