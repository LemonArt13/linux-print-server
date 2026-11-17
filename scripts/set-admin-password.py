#!/usr/bin/env python3
"""Set an scrypt password hash without placing the password in command history."""
import getpass
import hashlib
import os
from pathlib import Path
import secrets
import sys

target = Path(sys.argv[1] if len(sys.argv) > 1 else 'server/.env')
password = getpass.getpass('Новий пароль адміністратора: ')
if not password:
    raise SystemExit('Пароль не може бути порожнім.')
if password != getpass.getpass('Повторіть пароль: '):
    raise SystemExit('Паролі не збігаються.')
salt = secrets.token_hex(16)
digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
lines = target.read_text().splitlines() if target.exists() else []
lines = [line for line in lines if not line.startswith('ADMIN_PASSWORD_HASH=')]
lines.append(f'ADMIN_PASSWORD_HASH=scrypt:{salt}:{digest}')
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as stream:
    stream.write('\n'.join(lines) + '\n')
os.chmod(target, 0o600)
print(f'Хеш збережено: {target}. Перезапустіть службу, щоб застосувати зміни.')
