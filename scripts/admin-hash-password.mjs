import { emitKeypressEvents } from 'node:readline';
import { hashPassword } from '../src/server/admin/password.mjs';

async function hiddenPassword(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run interactively in a terminal (no pipes or password arguments).');
  process.stderr.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    function finish(error) {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write('\n');
      if (error) reject(error); else resolve(password);
    }
    function onKey(text, key) {
      if (key.ctrl && key.name === 'c') return finish(new Error('Cancelled.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') password = Array.from(password).slice(0, -1).join('');
      else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(text)) password += text;
    }
    process.stdin.on('keypress', onKey);
  });
}

try {
  if (process.argv.length !== 2) throw new Error('Do not pass passwords as arguments.');
  const password = await hiddenPassword('Password (hidden, minimum 12 characters): ');
  const confirmation = await hiddenPassword('Repeat password (hidden): ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  process.stdout.write(`${await hashPassword(password)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
