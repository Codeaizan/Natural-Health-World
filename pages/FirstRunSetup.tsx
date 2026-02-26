import React, { useState } from 'react';
import { FolderOpen, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useTheme } from '../services/theme';

interface FirstRunSetupProps {
  onComplete: (dataPath: string) => void;
}

const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ onComplete }) => {
  const { isDark } = useTheme();
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const folder = await open({
        directory: true,
        multiple: false,
        title: 'Select location for Natural Health World data folder',
      });

      if (folder && typeof folder === 'string') {
        setSelectedPath(folder);
        setError('');
      }
    } catch (err) {
      console.error('Folder selection error:', err);
      setError('Failed to open folder picker. Please try again.');
    }
  };

  const handleContinue = async () => {
    if (!selectedPath) {
      setError('Please select a folder location first.');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const dataPath = `${selectedPath}\\Natural Health World Data`;
      const invoicesPath = `${dataPath}\\invoices`;
      const backupsPath = `${dataPath}\\backups`;

      // Create folders if they don't exist
      if (!(await exists(dataPath))) {
        await mkdir(dataPath, { recursive: true });
      }
      if (!(await exists(invoicesPath))) {
        await mkdir(invoicesPath, { recursive: true });
      }
      if (!(await exists(backupsPath))) {
        await mkdir(backupsPath, { recursive: true });
      }

      onComplete(dataPath);
    } catch (err) {
      console.error('Folder creation error:', err);
      setError(`Failed to create folders: ${(err as Error).message}. Please check permissions and try again.`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
      isDark ? 'bg-gray-900' : 'bg-gradient-to-br from-green-50 via-white to-green-50'
    }`}>
      <div className={`rounded-2xl shadow-xl border max-w-xl w-full p-8 transition-colors duration-300 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="text-green-700" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Natural Health World</h1>
          <p className="text-gray-500 mt-2">Let's set up your data storage location</p>
        </div>

        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            Choose a location where the application will store your <strong>invoices</strong> and <strong>backups</strong>. 
            A folder named <strong>"Natural Health World Data"</strong> will be created at your chosen location with the following structure:
          </p>
          <div className="mt-3 font-mono text-xs text-blue-700 bg-blue-100 rounded p-3">
            <div>📁 Natural Health World Data</div>
            <div className="ml-4">📁 invoices <span className="text-blue-500">— Downloaded invoice PDFs</span></div>
            <div className="ml-4">📁 backups <span className="text-blue-500">— Data backup files</span></div>
          </div>
          <p className="text-xs text-blue-600 mt-3">
            ⚠️ These folders will <strong>NOT</strong> be removed if you uninstall the app, keeping your data safe.
          </p>
        </div>

        {/* Folder Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Data Folder Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={selectedPath ? `${selectedPath}\\Natural Health World Data` : ''}
              placeholder="Click Browse to select a location..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"
            />
            <button
              onClick={handleBrowse}
              className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 whitespace-nowrap shadow-sm"
            >
              <FolderOpen size={18} />
              Browse
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={16} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Preview */}
        {selectedPath && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <CheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
            <div className="text-sm text-green-800">
              <p className="font-medium">Folders will be created at:</p>
              <p className="font-mono text-xs mt-1">{selectedPath}\Natural Health World Data\invoices</p>
              <p className="font-mono text-xs">{selectedPath}\Natural Health World Data\backups</p>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedPath || isCreating}
          className={`w-full py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-sm transition-all ${
            selectedPath && !isCreating
              ? 'bg-green-700 text-white hover:bg-green-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isCreating ? (
            <>Creating folders...</>
          ) : (
            <>
              Continue
              <ArrowRight size={20} />
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          You can change this location later from Settings → Data tab.
        </p>
      </div>
    </div>
  );
};

export default FirstRunSetup;
