import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { ReactNode } from 'react';
import type { WebdavFileInfo } from '../types';

interface RestoreRecommendationModalProps {
  open: boolean;
  file: WebdavFileInfo | null;
  message: ReactNode;
  confirmText: string;
  onClose: () => void;
  onSkip: () => void;
  onConfirm: () => void;
}

export function RestoreRecommendationModal({
  open,
  file,
  message,
  confirmText,
  onClose,
  onSkip,
  onConfirm,
}: RestoreRecommendationModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      title={t('backup.restore_recommend_title')}
      onClose={onClose}
      closeDisabled
      showCloseButton={false}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onSkip}>
            {t('backup.restore_skip_this_time')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, lineHeight: 1.7 }}>{message}</div>
        {file && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {file.lastModified ? new Date(file.lastModified).toLocaleString() : ''}
          </div>
        )}
      </div>
    </Modal>
  );
}
