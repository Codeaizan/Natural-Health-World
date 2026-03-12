import React, { useState } from 'react';                                      // React hooks
import { FolderOpen, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';  // Icons

// Props interface for setup wizard completion callback
interface FirstRunSetupProps {
  onComplete: (dataPath: string) => void;  // Called when setup finishes with selected data folder path
}

// === COMPONENT: First-run setup wizard for data folder configuration ===
const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ onComplete }) => {
  // User-selected base folder path (will create "Natural Health World Data" subfolder here)
  const [selectedPath, setSelectedPath] = useState<string>('');
  // Error message display (e.g., permission denied, selection cancelled)
  const [error, setError] = useState<string>('');
  // Loading state during folder creation
  const [isCreating, setIsCreating] = useState(false);

  // === HANDLER: Open Tauri folder picker dialog ===
  const handleBrowse = async () => {
    try {
      // Import Tauri dialog plugin for folder selection
      const { open } = await import('@tauri-apps/plugin-dialog');
      
      // Open native file browser dialog (directory mode, single selection)
      const folder = await open({
        directory: true,  // Show folder picker, not file picker
        multiple: false,  // Only allow one folder selection
        title: 'Select location for Natural Health World data folder',
      });

      if (folder && typeof folder === 'string') {
        setSelectedPath(folder);  // Store selected path
        setError('');  // Clear any previous errors
      }
    } catch (err) {
      console.error('Folder selection error:', err);
      // User cancelled or dialog failed
      setError('Failed to open folder picker. Please try again.');
    }
  };

  // === HANDLER: Create folder structure and complete setup ===
  const handleContinue = async () => {
    // Validate: ensure path was selected
    if (!selectedPath) {
      setError('Please select a folder location first.');
      return;
    }

    setIsCreating(true);  // Show loading state
    setError('');  // Clear errors

    try {
      // Import Tauri filesystem plugin for directory operations
      const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
      
      // Build directory paths for data structure
      const dataPath = `${selectedPath}\\Natural Health World Data`;  // Main data folder
      const invoicesPath = `${dataPath}\\invoices`;  // Subfolder for downloaded invoice PDFs
      const backupsPath = `${dataPath}\\backups`;  // Subfolder for backup files

      // Create main data folder if it doesn't exist
      if (!(await exists(dataPath))) {
        await mkdir(dataPath, { recursive: true });
      }
      
      // Create invoices subfolder if it doesn't exist
      if (!(await exists(invoicesPath))) {
        await mkdir(invoicesPath, { recursive: true });
      }
      
      // Create backups subfolder if it doesn't exist
      if (!(await exists(backupsPath))) {
        await mkdir(backupsPath, { recursive: true });
      }

      // Call parent callback with data path, triggers app main screen
      onComplete(dataPath);
    } catch (err) {
      console.error('Folder creation error:', err);
      // Show error (likely permission issue)
      setError(`Failed to create folders: ${(err as Error).message}. Please check permissions and try again.`);
    } finally {
      setIsCreating(false);  // Always hide loading state
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-white to-green-50">
      {/* === SETUP CARD === Main wizard panel with rounded, shadowed container */}
      <div className="rounded-2xl shadow-xl border max-w-xl w-full p-8 bg-white border-gray-100">
        {/* === HEADER SECTION === Welcome title with icon */}
        <div className="text-center mb-8">
          {/* Folder icon in green circle */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="text-green-700" size={32} />
          </div>
          {/* Main heading */}
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Natural Health World</h1>
          {/* Subheading */}
          <p className="text-gray-500 mt-2">Let's set up your data storage location</p>
        </div>

        {/* === EXPLANATION BOX === Information about folder structure and safety */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            Choose a location where the application will store your <strong>invoices</strong> and <strong>backups</strong>. 
            A folder named <strong>"Natural Health World Data"</strong> will be created at your chosen location with the following structure:
          </p>
          {/* Visual folder structure diagram */}
          <div className="mt-3 font-mono text-xs text-blue-700 bg-blue-100 rounded p-3">
            <div>📁 Natural Health World Data</div>
            <div className="ml-4">📁 invoices <span className="text-blue-500">— Downloaded invoice PDFs</span></div>
            <div className="ml-4">📁 backups <span className="text-blue-500">— Data backup files</span></div>
          </div>
          {/* Safety note: data persists after uninstall */}
          <p className="text-xs text-blue-600 mt-3">
            ⚠️ These folders will <strong>NOT</strong> be removed if you uninstall the app, keeping your data safe.
          </p>
        </div>

        {/* === FOLDER SELECTION INPUT === Path display and browse button */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Data Folder Location</label>
          <div className="flex gap-2">
            {/* Read-only text field showing constructed full path */}
            <input
              type="text"
              readOnly
              value={selectedPath ? `${selectedPath}\\Natural Health World Data` : ''}
              placeholder="Click Browse to select a location..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"
            />
            {/* Browse button: opens Tauri file picker */}
            <button
              onClick={handleBrowse}
              className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 whitespace-nowrap shadow-sm"
            >
              <FolderOpen size={18} />
              Browse
            </button>
          </div>
        </div>

        {/* === ERROR STATE === Shows if folder selection or creation failed */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={16} />
            {/* Error message text */}
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* === PREVIEW STATE === Shows selected path and folder creation details */}
        {selectedPath && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <CheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
            <div className="text-sm text-green-800">
              {/* Confirmation message */}
              <p className="font-medium">Folders will be created at:</p>
              {/* Full paths that will be created */}
              <p className="font-mono text-xs mt-1">{selectedPath}\Natural Health World Data\invoices</p>
              <p className="font-mono text-xs">{selectedPath}\Natural Health World Data\backups</p>
            </div>
          </div>
        )}

        {/* === CONTINUE BUTTON === Disabled until path selected, shows loading during creation */}
        <button
          onClick={handleContinue}
          disabled={!selectedPath || isCreating}  // Disabled if no path or creating folders
          className={`w-full py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-sm transition-all ${
            selectedPath && !isCreating
              ? 'bg-green-700 text-white hover:bg-green-800'  // Enabled: green button
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'  // Disabled: gray button
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

        {/* === HELPER TEXT === Shows path to settings for reconfiguration */}
        <p className="text-xs text-gray-400 text-center mt-4">
          You can change this location later from Settings → Data tab.
        </p>
      </div>
    </div>
  );
};

// === COMPONENT EXPORT === First-run setup wizard for data folder location configuration
export default FirstRunSetup;
