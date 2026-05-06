import { readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_DIR } from '@/server/config/paths';
import { ensureConfigDir } from '@/server/config/json-store';
import type { CredentialFile } from '@/shared/types';

type ZipEntry = {
  name: string;
  data: Buffer;
  mtime: Date;
};

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const checksum = crc32(entry.data);
    const { dosDate, dosTime } = dosDateTime(entry.mtime);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

async function readCredentialFile(name: string): Promise<CredentialFile | null> {
  const fullPath = path.join(CONFIG_DIR, name);
  const details = await stat(fullPath).catch(() => null);
  if (!details || !details.isFile()) return null;
  const content = await readFile(fullPath, 'utf8').catch(() => '');
  return {
    name,
    path: `config/${name}`,
    added: details.birthtime.toISOString(),
    updated: details.mtime.toISOString(),
    content
  };
}

export async function listCredentialFiles(): Promise<CredentialFile[]> {
  await ensureConfigDir();
  const names = await readdir(CONFIG_DIR).catch(() => []);
  const files = await Promise.all(names.map((name) => readCredentialFile(name)));
  return files
    .filter((file): file is CredentialFile => Boolean(file))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function collectConfigEntries(dir: string, prefix = 'config'): Promise<ZipEntry[]> {
  await ensureConfigDir();
  const rows = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const entries: ZipEntry[] = [];
  for (const row of rows) {
    const fullPath = path.join(dir, row.name);
    const zipName = `${prefix}/${row.name}`;
    if (row.isDirectory()) {
      entries.push(...await collectConfigEntries(fullPath, zipName));
      continue;
    }
    if (!row.isFile()) continue;
    const details = await stat(fullPath);
    entries.push({
      name: zipName,
      data: await readFile(fullPath),
      mtime: details.mtime
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function buildConfigFolderZip() {
  const entries = await collectConfigEntries(CONFIG_DIR);
  return createZip(entries);
}

export async function deleteCredentialFile(name: string) {
  const sanitized = path.basename(name);
  if (!sanitized) throw new Error('File name is required.');
  const fullPath = path.join(CONFIG_DIR, sanitized);
  await rm(fullPath, { force: true });
  return listCredentialFiles();
}
