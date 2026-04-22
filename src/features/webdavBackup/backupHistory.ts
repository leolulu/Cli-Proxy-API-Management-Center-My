import { webdavClient } from './client/webdavClient';
import type { WebdavConnectionConfig, WebdavFileInfo } from './types';
import { isBackupFile } from './utils';

export async function listBackupHistorySilently(
  connection: WebdavConnectionConfig,
): Promise<WebdavFileInfo[]> {
  if (!connection.serverUrl) {
    return [];
  }

  const files = await webdavClient.listDirectory(connection);
  return files
    .filter((file) => isBackupFile(file.displayName))
    .sort((a, b) => {
      const da = new Date(a.lastModified).getTime() || 0;
      const db = new Date(b.lastModified).getTime() || 0;
      return db - da;
    });
}
