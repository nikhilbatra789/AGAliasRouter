import { appendFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { LOGS_DIR } from '@/server/config/paths';
import type { LogEvent } from '@/shared/types';

const LOG_RETENTION_DAYS = 7;

type StructuredLogLevel = LogEvent['lvl'];

function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function logPathForDay(date = new Date()) {
  return path.join(LOGS_DIR, `${dayStamp(date)}.log`);
}

function maskSecrets(value: string) {
  return value
    .replace(/(sk-[a-zA-Z0-9-_]+)/g, '[redacted]')
    .replace(/("x-api-key"\s*:\s*")[^"]+(")/gi, '$1[redacted]$2')
    .replace(/("authorization"\s*:\s*"Bearer\s+)[^"]+(")/gi, '$1[redacted]$2');
}

export function formatLogLine(event: LogEvent) {
  return `${event.t}  ${event.lvl.padEnd(5)}  ${maskSecrets(event.msg)}`;
}

export async function ensureLogsDir() {
  await mkdir(LOGS_DIR, { recursive: true });
}

export async function appendLog(level: StructuredLogLevel, message: string) {
  await ensureLogsDir();
  const now = new Date();
  const event: LogEvent = {
    t: now.toISOString(),
    lvl: level,
    msg: maskSecrets(message)
  };
  await appendFile(logPathForDay(now), `${formatLogLine(event)}\n`, 'utf8');
}

export async function readTodayLogs(): Promise<LogEvent[]> {
  await ensureLogsDir();
  const file = logPathForDay();
  const text = await readFile(file, 'utf8').catch(() => '');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\S+)\s+(INFO|WARN|ERROR)\s+(.*)$/.exec(line);
      if (!match) return null;
      return {
        t: match[1],
        lvl: match[2] as StructuredLogLevel,
        msg: match[3]
      } satisfies LogEvent;
    })
    .filter((event): event is LogEvent => Boolean(event))
    .reverse();
}

export async function pruneOldLogs() {
  await ensureLogsDir();
  const files = await readdir(LOGS_DIR).catch(() => []);
  const now = Date.now();
  await Promise.all(
    files
      .filter((file) => file.endsWith('.log'))
      .map(async (file) => {
        const fullPath = path.join(LOGS_DIR, file);
        const fileStat = await stat(fullPath).catch(() => null);
        if (!fileStat) return;
        const ageDays = (now - fileStat.mtimeMs) / (24 * 60 * 60 * 1000);
        if (ageDays > LOG_RETENTION_DAYS) {
          await rm(fullPath, { force: true });
        }
      })
  );
}

