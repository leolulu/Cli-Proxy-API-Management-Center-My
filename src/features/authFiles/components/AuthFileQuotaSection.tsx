import type { ReactNode } from 'react';
import { QuotaProgressBar } from '@/features/authFiles/components/QuotaProgressBar';
import { useAuthFileQuota } from '@/features/authFiles/hooks/useAuthFileQuota';
import type { QuotaProviderType } from '@/features/authFiles/constants';
import styles from '@/pages/AuthFilesPage.module.scss';
import type { AuthFileItem } from '@/types';

export type AuthFileQuotaSectionProps = {
  file: AuthFileItem;
  quotaType: QuotaProviderType;
  disableControls: boolean;
};

export function AuthFileQuotaSection(props: AuthFileQuotaSectionProps) {
  const { file, quotaType, disableControls } = props;
  const { quota, quotaStatus, canRefreshQuota, refreshQuotaForFile, config, quotaErrorMessage, t } =
    useAuthFileQuota(file, quotaType, disableControls);

  if (!config) return null;

  return (
    <div className={styles.quotaSection}>
      {quotaStatus === 'loading' ? (
        <div className={styles.quotaMessage}>{t(`${config.i18nPrefix}.loading`)}</div>
      ) : quotaStatus === 'idle' ? (
        <button
          type="button"
          className={`${styles.quotaMessage} ${styles.quotaMessageAction}`}
          onClick={() => void refreshQuotaForFile()}
          disabled={!canRefreshQuota}
        >
          {t(`${config.i18nPrefix}.idle`)}
        </button>
      ) : quotaStatus === 'error' ? (
        <div className={styles.quotaError}>
          {t(`${config.i18nPrefix}.load_failed`, {
            message: quotaErrorMessage,
          })}
        </div>
      ) : quota ? (
        (config.renderQuotaItems(quota, t, { styles, QuotaProgressBar }) as ReactNode)
      ) : (
        <div className={styles.quotaMessage}>{t(`${config.i18nPrefix}.idle`)}</div>
      )}
    </div>
  );
}
