import React, { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { COLORS } from '../constants';
import { Download, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';

// Helper to detect if running inside Tauri (desktop) environment
const isTauri = (): boolean => !!(window as any).__TAURI_INTERNALS__;

// Status states for the update flow
type UpdateStatus = 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date' | null;

/**
 * UpdateChecker — mounts once on app startup, silently checks GitHub Releases for a newer version.
 * If an update is found, it shows a modal with version info, release notes, and a download progress bar.
 * After download + signature verification, it offers to restart the app.
 */
const UpdateChecker: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [progress, setProgress] = useState(0);        // 0–100 download percentage
  const [contentLength, setContentLength] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);   // user chose "Later"

  useEffect(() => {
    // Only check for updates inside Tauri desktop builds
    if (!isTauri()) return;

    const checkForUpdate = async () => {
      try {
        setStatus('checking');
        const update = await check();

        if (update) {
          setNewVersion(update.version);
          setCurrentVersion(update.currentVersion);
          setReleaseNotes(update.body || '');
          setStatus('available');
        } else {
          // No update available — stay silent
          setStatus('up-to-date');
        }
      } catch (err) {
        console.error('Update check failed:', err);
        // Silently fail — don't bother the user if the check itself fails
        setStatus(null);
      }
    };

    // Delay the check by 3 seconds so it doesn't compete with app initialisation
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Download the update and track progress
  const handleDownload = async () => {
    try {
      setStatus('downloading');
      setProgress(0);
      setDownloaded(0);

      const update = await check();
      if (!update) {
        setStatus('error');
        setErrorMessage('Update no longer available. Please try again later.');
        return;
      }

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setContentLength(event.data.contentLength ?? 0);
            break;
          case 'Progress':
            setDownloaded((prev) => {
              const next = prev + (event.data.chunkLength ?? 0);
              if (contentLength > 0) {
                setProgress(Math.min(100, Math.round((next / contentLength) * 100)));
              }
              return next;
            });
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });

      setStatus('ready');
    } catch (err) {
      console.error('Update download failed:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Download failed. Please try again.');
    }
  };

  // Restart the app to apply the update
  const handleRestart = async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error('Relaunch failed:', err);
      setErrorMessage('Could not restart. Please close and reopen the app manually.');
    }
  };

  // Don't render anything if no update, dismissed, or still silently checking
  if (!status || status === 'up-to-date' || status === 'checking' || dismissed) {
    return null;
  }

  // Format bytes for display
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    // Full-screen overlay with backdrop blur
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Modal card */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '440px',
          width: '90%',
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Header with gradient */}
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.mediumGreen}, ${COLORS.sageGreen})`,
            padding: '24px',
            color: '#fff',
            position: 'relative',
          }}
        >
          {/* Dismiss button — only when update is available (not downloading/ready) */}
          {status === 'available' && (
            <button
              onClick={() => setDismissed(true)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                padding: '4px',
                cursor: 'pointer',
                color: '#fff',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {status === 'ready' ? (
              <CheckCircle size={32} />
            ) : status === 'error' ? (
              <AlertCircle size={32} />
            ) : status === 'downloading' ? (
              <Download size={32} style={{ animation: 'pulse 1.5s infinite' }} />
            ) : (
              <RefreshCw size={32} />
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {status === 'available' && 'Update Available'}
                {status === 'downloading' && 'Downloading Update...'}
                {status === 'ready' && 'Update Ready!'}
                {status === 'error' && 'Update Failed'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                {status === 'available' && `v${currentVersion} → v${newVersion}`}
                {status === 'downloading' && `v${newVersion}`}
                {status === 'ready' && 'Restart to apply the update'}
                {status === 'error' && 'Something went wrong'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Release notes */}
          {status === 'available' && releaseNotes && (
            <div
              style={{
                backgroundColor: '#f8faf8',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                maxHeight: '120px',
                overflowY: 'auto',
                fontSize: '13px',
                color: '#555',
                lineHeight: '1.5',
                border: '1px solid #e8ede8',
              }}
            >
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: COLORS.darkText }}>What's new:</p>
              {releaseNotes}
            </div>
          )}

          {/* Progress bar during download */}
          {status === 'downloading' && (
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: COLORS.mediumGreen,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#888',
                }}
              >
                <span>{progress}%</span>
                {contentLength > 0 && (
                  <span>{formatBytes(downloaded)} / {formatBytes(contentLength)}</span>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {status === 'error' && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#dc2626',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {status === 'available' && (
              <>
                <button
                  onClick={() => setDismissed(true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#fff',
                    color: '#555',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Later
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: COLORS.mediumGreen,
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Download size={16} /> Update Now
                </button>
              </>
            )}

            {status === 'ready' && (
              <button
                onClick={handleRestart}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: COLORS.mediumGreen,
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={16} /> Restart Now
              </button>
            )}

            {status === 'error' && (
              <button
                onClick={() => setDismissed(true)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  color: '#555',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default UpdateChecker;
