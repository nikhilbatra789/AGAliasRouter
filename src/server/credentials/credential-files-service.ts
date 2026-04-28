import { readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_DIR } from '@/server/config/paths';
import { ensureConfigDir } from '@/server/config/json-store';
import type { CredentialFile } from '@/shared/types';

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

export async function deleteCredentialFile(name: string) {
  const sanitized = path.basename(name);
  if (!sanitized) throw new Error('File name is required.');
  const fullPath = path.join(CONFIG_DIR, sanitized);
  await rm(fullPath, { force: true });
  return listCredentialFiles();
}

