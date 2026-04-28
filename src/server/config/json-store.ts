import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_DIR } from './paths';

export class ConfigParseError extends Error {
  constructor(public readonly filePath: string, cause: unknown) {
    super(`Invalid JSON in ${path.relative(process.cwd(), filePath)}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'ConfigParseError';
  }
}

export async function ensureConfigDir() {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new ConfigParseError(filePath, error);
    }
    throw error;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T) {
  await ensureConfigDir();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const json = `${JSON.stringify(data, null, 2)}\n`;
  JSON.parse(json);
  await writeFile(tempPath, json, 'utf8');
  await rename(tempPath, filePath);
}
