import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationStore } from '@/stores';
import {
  buildConnectionScope,
  clearRestoreRecommendationPending,
  ensureRestoreRecommendationPending,
  hasRestoreRecommendationAutoPrompted,
  isRestoreRecommendationPending,
  markRestoreRecommendationAutoPrompted,
} from '../restoreRecommendation';
import { useWebdavStore } from '../store/useWebdavStore';
import { useBackupActions } from '../hooks/useBackupActions';
import { formatFileSize, pickLargestBackupCandidate } from '../utils';
import type { WebdavFileInfo, BackupScope } from '../types';
import { RestoreRecommendationModal } from './RestoreRecommendationModal';
import { RestoreModal } from './RestoreModal';

export function RestoreCard() {
  const { t } = useTranslation();
  const { showConfirmation } = useNotificationStore();
  const { loadHistory, restoreFromLocal, restore, downloadFile, deleteRemote } =
    useBackupActions();

  const isRestoring = useWebdavStore((s) => s.isRestoring);
  const isLoadingHistory = useWebdavStore((s) => s.isLoadingHistory);
  const serverUrl = useWebdavStore((s) => s.connection.serverUrl);
  const username = useWebdavStore((s) => s.connection.username);
  const basePath = useWebdavStore((s) => s.connection.basePath);
  const lastBackupTime = useWebdavStore((s) => s.lastBackupTime);

  const [files, setFiles] = useState<WebdavFileInfo[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [recommendedFile, setRecommendedFile] = useState<WebdavFileInfo | null>(null);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reopenRecommendationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reopenRecommendationOnRestoreCloseRef = useRef(false);
  const skipInitialLastBackupRefreshRef = useRef(lastBackupTime);

  const connectionScope = serverUrl
    ? buildConnectionScope(serverUrl, basePath, username)
    : '';
  const previousConnectionScopeRef = useRef(connectionScope);

  const clearPendingRecommendation = useCallback(() => {
    clearRestoreRecommendationPending(connectionScope);
  }, [connectionScope]);

  const openRecommendation = useCallback((candidate: WebdavFileInfo) => {
    setRecommendedFile(candidate);
    setIsRecommendationOpen(true);
  }, []);

  const scheduleRecommendationReopen = useCallback(() => {
    if (!recommendedFile || !isRestoreRecommendationPending(connectionScope)) {
      return;
    }

    if (reopenRecommendationTimerRef.current !== null) {
      window.clearTimeout(reopenRecommendationTimerRef.current);
    }

    reopenRecommendationTimerRef.current = window.setTimeout(() => {
      setRecommendedFile(recommendedFile);
      setIsRecommendationOpen(true);
      reopenRecommendationTimerRef.current = null;
    }, 360);
  }, [connectionScope, recommendedFile]);

  const refresh = useCallback(
    async ({ allowRecommendation = true }: { allowRecommendation?: boolean } = {}) => {
      if (!serverUrl) {
        setFiles([]);
        setRecommendedFile(null);
        setIsRecommendationOpen(false);
        return;
      }

      const requestScope = connectionScope;
      const result = await loadHistory();

      const currentConnection = useWebdavStore.getState().connection;
      const currentScope = buildConnectionScope(
        currentConnection.serverUrl,
        currentConnection.basePath,
        currentConnection.username,
      );

      if (currentScope !== requestScope) {
        return;
      }

      setFiles(result);

      if (
        !allowRecommendation ||
        hasRestoreRecommendationAutoPrompted(connectionScope) ||
        !ensureRestoreRecommendationPending(connectionScope)
      ) {
        return;
      }

      const candidate = pickLargestBackupCandidate(result);
      if (!candidate) {
        return;
      }

      markRestoreRecommendationAutoPrompted(connectionScope);
      openRecommendation(candidate);
    },
    [connectionScope, loadHistory, openRecommendation, serverUrl],
  );

  // 初始加载
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh({ allowRecommendation: true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  // 备份成功后自动刷新列表
  useEffect(() => {
    if (!lastBackupTime) {
      skipInitialLastBackupRefreshRef.current = null;
      return;
    }

    if (skipInitialLastBackupRefreshRef.current === lastBackupTime) {
      skipInitialLastBackupRefreshRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      void refresh({ allowRecommendation: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [lastBackupTime, refresh]);

  useEffect(() => {
    return () => {
      if (reopenRecommendationTimerRef.current !== null) {
        window.clearTimeout(reopenRecommendationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousConnectionScopeRef.current === connectionScope) {
      return;
    }

    previousConnectionScopeRef.current = connectionScope;

    const timer = window.setTimeout(() => {
      if (reopenRecommendationTimerRef.current !== null) {
        window.clearTimeout(reopenRecommendationTimerRef.current);
        reopenRecommendationTimerRef.current = null;
      }

      reopenRecommendationOnRestoreCloseRef.current = false;
      setRestoreTarget(null);
      setRestoreFile(null);
      setRecommendedFile(null);
      setIsRecommendationOpen(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [connectionScope]);

  const handleRestore = useCallback(
    async (scope: BackupScope) => {
      let restoreSucceeded = false;
      const shouldResumeRecommendation =
        reopenRecommendationOnRestoreCloseRef.current && restoreTarget !== null && restoreFile === null;

      if (restoreFile) {
        restoreSucceeded = await restoreFromLocal(restoreFile, scope);
        setRestoreFile(null);
      } else if (restoreTarget) {
        restoreSucceeded = await restore(restoreTarget, scope);
      }

      if (restoreSucceeded) {
        clearPendingRecommendation();
        setRecommendedFile(null);
        setIsRecommendationOpen(false);
      } else if (shouldResumeRecommendation) {
        scheduleRecommendationReopen();
      }

      reopenRecommendationOnRestoreCloseRef.current = false;
      setRestoreTarget(null);
    },
    [clearPendingRecommendation, restoreTarget, restoreFile, restore, restoreFromLocal, scheduleRecommendationReopen],
  );

  const handleRecommendationClose = useCallback(() => {
    setIsRecommendationOpen(false);
  }, []);

  const handleRecommendationSkip = useCallback(() => {
    clearPendingRecommendation();
    setIsRecommendationOpen(false);
    setRecommendedFile(null);
  }, [clearPendingRecommendation]);

  const handleRecommendationRestore = useCallback(() => {
    if (!recommendedFile) {
      return;
    }

    reopenRecommendationOnRestoreCloseRef.current = true;
    setIsRecommendationOpen(false);
    setRestoreTarget(recommendedFile.displayName);
  }, [recommendedFile]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
    }
    e.target.value = '';
  }, []);

  const handleDelete = useCallback(
    (filename: string) => {
      showConfirmation({
        title: t('backup.delete_confirm_title'),
        message: t('backup.delete_confirm_message', { name: filename }),
        confirmText: t('common.delete'),
        variant: 'danger',
        onConfirm: async () => {
          await deleteRemote(filename);
          await refresh({ allowRecommendation: true });
        },
      });
    },
    [showConfirmation, deleteRemote, refresh, t],
  );

  return (
    <>
      <Card
        title={t('backup.restore_card_title')}
        subtitle={t('backup.restore_card_subtitle')}
        extra={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refresh({ allowRecommendation: true })}
            disabled={!serverUrl}
          >
            {t('common.refresh')}
          </Button>
        }
      >
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 从本地文件恢复 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
                {t('backup.restore_from_local')}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {t('backup.restore_local_hint')}
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoring}
              loading={isRestoring && restoreFile !== null}
            >
              {t('backup.restore_local_btn')}
            </Button>
          </div>

          {/* 备份历史列表 */}
          {!serverUrl ? (
            <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center', padding: 16 }}>
              {t('backup.restore_no_connection')}
            </div>
          ) : isLoadingHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <LoadingSpinner />
            </div>
          ) : files.length === 0 ? (
            <EmptyState title={t('backup.no_backups')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map((file) => (
                <div
                  key={file.href}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{file.displayName}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--accent-alpha, rgba(59,130,246,0.1))',
                          color: 'var(--accent, #3b82f6)',
                          lineHeight: '18px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t('backup.source_cloud')}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      {file.lastModified ? new Date(file.lastModified).toLocaleString() : ''}
                      {file.contentLength > 0 ? ` · ${formatFileSize(file.contentLength)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRestoreTarget(file.displayName)}
                      disabled={isRestoring}
                    >
                      {t('backup.restore')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(file.displayName)}
                    >
                      {t('backup.download')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file.displayName)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <RestoreModal
        open={restoreTarget !== null || restoreFile !== null}
        onClose={() => {
          const shouldResumeRecommendation =
            reopenRecommendationOnRestoreCloseRef.current && restoreTarget !== null && restoreFile === null;

          setRestoreTarget(null);
          setRestoreFile(null);

          if (shouldResumeRecommendation) {
            scheduleRecommendationReopen();
          }

          reopenRecommendationOnRestoreCloseRef.current = false;
        }}
        onRestore={handleRestore}
        loading={isRestoring}
        filename={restoreFile?.name ?? restoreTarget ?? ''}
      />

      <RestoreRecommendationModal
        open={isRecommendationOpen}
        onClose={handleRecommendationClose}
        onSkip={handleRecommendationSkip}
        onConfirm={handleRecommendationRestore}
        file={recommendedFile}
        message={
          recommendedFile
            ? t('backup.restore_recommend_message', {
                name: recommendedFile.displayName,
                size: formatFileSize(recommendedFile.contentLength),
              })
            : ''
        }
        confirmText={t('backup.restore_recommend_action')}
      />
    </>
  );
}
