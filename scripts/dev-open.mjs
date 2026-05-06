import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import path from 'node:path';

const host = 'localhost';
const port = '9001';
const url = `http://${host}:${port}`;
const nextBin = path.join(process.cwd(), 'node_modules', '.bin', platform() === 'win32' ? 'next.cmd' : 'next');

const server = spawn(nextBin, ['dev', '-H', host, '-p', port], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env
});

let opened = false;
const openBrowser = () => {
  if (opened) return;
  opened = true;
  const opener =
    platform() === 'darwin'
      ? ['open', [url]]
      : platform() === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  const child = spawn(opener[0], opener[1], { stdio: 'ignore', detached: true });
  child.on('error', () => null);
  child.unref();
};

setTimeout(openBrowser, 1800);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.kill(signal);
  });
}

server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
