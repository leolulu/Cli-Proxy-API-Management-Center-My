import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { listBackupHistorySilently } from '../backupHistory';
import {
  buildConnectionScope,
  clearRestoreRecommendationPending,
  ensureRestoreRecommendationPending,
  hasRestoreRecommendationAutoPrompted,
  isRestoreRecommendationPending,
} from '../restoreRecommendation';
import { useWebdavStore } from '../store/useWebdavStore';
import { RestoreRecommendationModal } from './RestoreRecommendationModal';

export function ShellRestoreReminder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const connection = useWebdavStore((state) => state.connection);

  const [open, setOpen] = useState(false);

  const connectionScope = buildConnectionScope(
    connection.serverUrl,
    connection.basePath,
    connection.username,
  );
  const isBackupRoute = location.pathname.startsWith('/backup');

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSkip = useCallback(() => {
    clearRestoreRecommendationPending(connectionScope);
    setOpen(false);
  }, [connectionScope]);

  const handleGoToRestore = useCallback(() => {
    setOpen(false);
    navigate('/backup');
  }, [navigate]);

  useEffect(() => {
    if (!isBackupRoute) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOpen(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isBackupRoute]);

  useEffect(() => {
    if (!connection.serverUrl || isBackupRoute) {
      return;
    }

    if (!ensureRestoreRecommendationPending(connectionScope)) {
      return;
    }

    if (hasRestoreRecommendationAutoPrompted(connectionScope)) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const requestScope = connectionScope;
          const files = await listBackupHistorySilently(connection);

          if (cancelled) {
            return;
          }

          const currentConnection = useWebdavStore.getState().connection;
          const currentScope = buildConnectionScope(
            currentConnection.serverUrl,
            currentConnection.basePath,
            currentConnection.username,
          );

          if (currentScope !== requestScope || !isRestoreRecommendationPending(requestScope)) {
            return;
          }

          if (files.length === 0) {
            return;
          }

          setOpen(true);
        } catch {
          // 静默探测失败，不打断主流程
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connection, connectionScope, isBackupRoute]);

  return (
    <RestoreRecommendationModal
      open={open && !isBackupRoute}
      file={null}
      message={t('backup.restore_shell_message')}
      confirmText={t('backup.restore_open_backup')}
      onClose={handleClose}
      onSkip={handleSkip}
      onConfirm={handleGoToRestore}
    />
  );
}
