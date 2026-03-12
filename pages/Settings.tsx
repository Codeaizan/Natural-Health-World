import React, { useState, useEffect } from 'react';                           // React hooks
import { useToast } from '../components/Toast';                                 // Toast notifications
import { StorageService } from '../services/storage';                           // Database access
import { CompanySettings, SalesPerson, User } from '../types';                  // Type definitions
import { COLORS, DEFAULT_SETTINGS } from '../constants';                       // App constants
import { Save, Plus, Trash2, Shield, CreditCard, FileText, Database, Upload, Lock, User as UserIcon, Download, FolderOpen } from 'lucide-react'; // Icons
import { getDataPath, setDataPath, clearCachedPath, ensureDataFolders } from '../services/dataPath'; // Data path utilities

const Settings: React.FC = () => {
  const toast = useToast();                                                   // Toast system
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS); // Company info (name, address, bank, GST, etc)
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);        // Sales staff list
  const [users, setUsers] = useState<User[]>([]);                             // App users (for login)
  const [newSPName, setNewSPName] = useState('');                             // Input for new sales person
  const [activeTab, setActiveTab] = useState('company');                      // Tab selector (company, staff, users, backup)

  // New User State — User creation form
  const [newUsername, setNewUsername] = useState('');                         // New user username
  const [newPassword, setNewPassword] = useState('');                         // New user password
  const [confirmPassword, setConfirmPassword] = useState('');                 // Password confirmation

  const [logoUploadStatus, setLogoUploadStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ status: 'idle' }); // Logo upload state

  const fileInputRef = React.useRef<HTMLInputElement>(null);                  // File input ref for logo
  const [backupStatus, setBackupStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ status: 'idle' }); // Backup/restore state

  // Data path state — Storage location management
  const [dataPathValue, setDataPathValue] = useState<string>('');             // Current data storage path
  const [dataPathStatus, setDataPathStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ status: 'idle' }); // Path update state

  // === LIFECYCLE: Load settings, sales persons, users, data path on mount ===
  useEffect(() => {
      const loadData = async () => {
        // Fetch all settings data from storage
        const settingsData = await StorageService.getSettings();
        const sp = await StorageService.getSalesPersons();
        const u = await StorageService.getUsers();
        // Populate state with fetched data
        setSettings(settingsData);
        setSalesPersons(sp);
        setUsers(u);
        // Load custom data storage path (e.g. external drive for backups/invoices)
        const dp = await getDataPath();
        if (dp) setDataPathValue(dp);
      };
      loadData();
  }, []);

  // === HANDLER: Save company settings to database ===
  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          // Persist settings object to StorageService
          await StorageService.saveSettings(settings);
          toast.success('Settings Saved', 'Settings saved successfully!');
      } catch (err) {
          toast.error('Save Failed', 'Failed to save settings. Storage might be full.');
      }
  };

  // === HANDLER: Upload company logo image and convert to base64 data URL ===
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file size (max 5000KB for logo to keep database lean)
      const maxSizeKB = 5000;
      if (file.size > maxSizeKB * 1024) {
          setLogoUploadStatus({ status: 'error', message: `File too large. Max ${maxSizeKB}KB allowed.` });
          setTimeout(() => setLogoUploadStatus({ status: 'idle' }), 3000);
          return;
      }

      // Validate that file is an image (check MIME type)
      if (!file.type.startsWith('image/')) {
          setLogoUploadStatus({ status: 'error', message: 'Please select a valid image file.' });
          setTimeout(() => setLogoUploadStatus({ status: 'idle' }), 3000);
          return;
      }

      // Begin file read process
      setLogoUploadStatus({ status: 'loading' });

      // Read file as base64 data URL for embedding in settings
      const reader = new FileReader();
      reader.onload = (evt) => {
          if (evt.target?.result) {
              try {
                  // Convert to data URL string (e.g. "data:image/png;base64,...")
                  const dataUrl = evt.target.result as string;
                  // Update settings with logo data
                  setSettings({ ...settings, logo: dataUrl });
                  setLogoUploadStatus({ status: 'success', message: 'Logo uploaded. Click "Save Settings" to persist.' });
                  setTimeout(() => setLogoUploadStatus({ status: 'idle' }), 3000);
              } catch (err) {
                  setLogoUploadStatus({ status: 'error', message: 'Failed to process image.' });
                  setTimeout(() => setLogoUploadStatus({ status: 'idle' }), 3000);
              }
          }
      };
      reader.onerror = () => {
          setLogoUploadStatus({ status: 'error', message: 'Failed to read file.' });
          setTimeout(() => setLogoUploadStatus({ status: 'idle' }), 3000);
      };
      reader.readAsDataURL(file);
  };

  // === HANDLER: Add new sales person to team ===
  const addSalesPerson = async () => {
      // Guard: reject empty input
      if (!newSPName.trim()) return;
      // Create new SalesPerson record (id=0 for auto-increment in DB)
      await StorageService.saveSalesPerson({ id: 0, name: newSPName, isActive: true });
      // Refresh list from database
      const sp = await StorageService.getSalesPersons();
      setSalesPersons(sp);
      // Clear input field
      setNewSPName('');
  };

  // === HANDLER: Toggle sales person active/inactive status ===
  const toggleSalesPerson = async (sp: SalesPerson) => {
      // Flip the isActive boolean for the sales person
      await StorageService.saveSalesPerson({ ...sp, isActive: !sp.isActive });
      // Refresh list from database
      const updated = await StorageService.getSalesPersons();
      setSalesPersons(updated);
  };

  // === HANDLER: Create new user or update existing user password ===
  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      // Validate input fields are not empty
      if (!newUsername || !newPassword) {
          toast.warning('Missing Fields', 'Username and Password required');
          return;
      }
      // Enforce minimum password length (6 chars) for security
      if (newPassword.length < 6) {
          toast.warning('Weak Password', 'Password must be at least 6 characters long');
          return;
      }
      // Verify passwords match before saving
      if (newPassword !== confirmPassword) {
          toast.warning('Password Mismatch', 'Passwords do not match');
          return;
      }

      // Hash password using storage service (bcrypt or similar)
      const hash = await StorageService.hashPassword(newPassword);
      // Create User object with hashed password
      const user: User = {
          username: newUsername,
          passwordHash: hash,
          role: 'admin', // Simple role for now (can be expanded later)
      };
      
      // Save user to database (creates or overwrites)
      await StorageService.saveUser(user);
      // Refresh users list from database
      const u = await StorageService.getUsers();
      setUsers(u);
      // Clear form fields after success
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('User Saved', 'User updated/created successfully');
  };

  // === HANDLER: Nuclear option - delete ALL app data (bills, products, customers, settings) ===
  const clearData = async () => {
      // Show confirmation dialog with warning message and required text input
      const confirmed = await toast.confirm({
          title: 'Clear All Data',
          message: 'CRITICAL WARNING: This will delete ALL bills, customers, and products. This cannot be undone.',
          confirmText: 'Delete All',
          danger: true,
          requiredInput: 'DELETE'
      });
      // Only proceed if user confirmed by typing "DELETE"
      if (confirmed) {
          try {
              // Erase all data from storage
              await StorageService.clearAllData();
              toast.success('Data Cleared', 'All data cleared successfully. Page will reload.');
              // Reload page to show fresh state
              setTimeout(() => window.location.reload(), 1500);
          } catch (err) {
              console.error('Failed to clear data:', err);
              toast.error('Clear Failed', 'Failed to clear data: ' + (err as Error).message);
          }
      }
  };

  // === HANDLER: Generate backup JSON file and save/download ===
  const handleBackupDownload = async () => {
      try {
          // Update status to loading
          setBackupStatus({ status: 'loading' });
          // Generate full backup JSON (all bills, products, customers, settings)
          const backupContent = await StorageService.exportBackupFile();
          // Create timestamped filename (e.g. nhw-backup-2024-01-15.json)
          const fileName = `nhw-backup-${new Date().toISOString().split('T')[0]}.json`;

          try {
            // === TAURI PATH: Use native save dialog ===
            // Import Tauri APIs dynamically
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');
            const { getBackupsPath } = await import('../services/dataPath');

            // Get custom backups folder (defaulting to data path if set)
            const backupsDir = await getBackupsPath();
            // Set default path to suggested backups directory
            const defaultPath = backupsDir ? `${backupsDir}\\${fileName}` : fileName;

            // Show OS native save dialog
            const filePath = await save({
              defaultPath,
              filters: [{ name: 'JSON Files', extensions: ['json'] }],
            });

            // Write file if user confirmed save dialog
            if (filePath) {
              await writeTextFile(filePath, backupContent);
              setBackupStatus({ status: 'success', message: `Backup saved to: ${filePath}` });
            } else {
              // User cancelled; reset to idle
              setBackupStatus({ status: 'idle' });
            }
          } catch {
            // === FALLBACK: Browser download (if Tauri dialogs fail or running in browser) ===
            const blob = new Blob([backupContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setBackupStatus({ status: 'success', message: 'Backup downloaded to your browser downloads folder.' });
          }
          // Auto-dismiss status after 4 seconds
          setTimeout(() => setBackupStatus({ status: 'idle' }), 4000);
      } catch (err) {
          // Handle backup generation errors
          setBackupStatus({ status: 'error', message: 'Failed to create backup' });
          setTimeout(() => setBackupStatus({ status: 'idle' }), 3000);
      }
  };

  // === HANDLER: Import backup JSON file and restore all data ===
  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file extension is .json
      if (!file.name.endsWith('.json')) {
          setBackupStatus({ status: 'error', message: 'Please select a valid JSON backup file' });
          setTimeout(() => setBackupStatus({ status: 'idle' }), 3000);
          return;
      }

      // Begin file read process
      setBackupStatus({ status: 'loading' });
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              // Parse backup JSON content
              if (evt.target?.result) {
                  const jsonContent = evt.target.result as string;
                  // Call import function to merge/restore backup data
                  const result = await StorageService.importBackupFile(jsonContent);
                  if (result.success) {
                      // Backup import succeeded
                      setBackupStatus({ status: 'success', message: result.message });
                      // Reload page after 2 seconds to show restored data
                      setTimeout(() => {
                          window.location.reload();
                      }, 2000);
                  } else {
                      // Backup import failed (invalid format, etc)
                      setBackupStatus({ status: 'error', message: result.message });
                      setTimeout(() => setBackupStatus({ status: 'idle' }), 3000);
                  }
              }
          } catch (err) {
              // JSON parsing error or import error
              setBackupStatus({ status: 'error', message: 'Failed to parse backup file' });
              setTimeout(() => setBackupStatus({ status: 'idle' }), 3000);
          }
      };
      reader.onerror = () => {
          // File read error (permission denied, file deleted, etc)
          setBackupStatus({ status: 'error', message: 'Failed to read file' });
          setTimeout(() => setBackupStatus({ status: 'idle' }), 3000);
      };
      // Read file as plain text (JSON)
      reader.readAsText(file);
      
      // Reset file input so user can select the same file again if needed
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  // === HANDLER: Change data storage location (invoices, backups folder) ===
  const handleChangeDataPath = async () => {
    try {
      // Import Tauri APIs dynamically
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { mkdir, exists } = await import('@tauri-apps/plugin-fs');

      // Show OS native folder picker dialog
      const folder = await open({
        directory: true,
        multiple: false,
        title: 'Select new location for Natural Health World data folder',
      });

      // Process selected folder
      if (folder && typeof folder === 'string') {
        setDataPathStatus({ status: 'loading' });
        // Construct data path with subfolders
        const newDataPath = `${folder}\\Natural Health World Data`;
        const invoicesPath = `${newDataPath}\\invoices`;
        const backupsPath = `${newDataPath}\\backups`;

        // Create folder structure if not exists (recursive create)
        if (!(await exists(newDataPath))) {
          await mkdir(newDataPath, { recursive: true });
        }
        if (!(await exists(invoicesPath))) {
          await mkdir(invoicesPath, { recursive: true });
        }
        if (!(await exists(backupsPath))) {
          await mkdir(backupsPath, { recursive: true });
        }

        // Clear cached path and save new path to app config
        clearCachedPath();
        await setDataPath(newDataPath);
        // Update UI state
        setDataPathValue(newDataPath);
        setDataPathStatus({ status: 'success', message: 'Data location updated successfully!' });
        setTimeout(() => setDataPathStatus({ status: 'idle' }), 3000);
      }
    } catch (err) {
      // Handle folder selection or creation errors
      setDataPathStatus({ status: 'error', message: `Failed to change data location: ${(err as Error).message}` });
      setTimeout(() => setDataPathStatus({ status: 'idle' }), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* === PAGE HEADER === */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Shield className="mr-3 text-green-700" /> System Settings
      </h2>

      {/* === TAB NAVIGATION === Buttons for company/billing/sales/users/data sections */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          {['company', 'billing', 'sales', 'users', 'data'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium capitalize transition-colors ${activeTab === tab ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  {tab}
              </button>
          ))}
      </div>

      {/* === FORM WRAPPER === All settings sections inside form (save to DB) */}
      <form onSubmit={handleSaveSettings}>
        
          {/* === TAB: COMPANY SETTINGS === Basic info, address, contact, tax IDs, state codes */}
          {activeTab === 'company' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                  <h3 className="font-bold text-lg text-gray-700 mb-2 flex items-center"><FileText className="mr-2" size={20}/> Company Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* === LOGO UPLOAD SECTION === File picker with preview and delete button */}
                      <div className="col-span-2 p-4 bg-gray-50 rounded border">
                          <label className="label mb-2">Company Logo</label>
                          <div className="flex items-start gap-4">
                              {/* Logo preview with hover delete button */}
                              {settings.logo ? (
                                  <div className="relative group">
                                      <img src={settings.logo} alt="Logo" className="h-20 w-auto object-contain rounded border bg-white p-1" />
                                      <button type="button" onClick={() => setSettings({...settings, logo: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">&times;</button>
                                  </div>
                              ) : null}
                              {/* File input with visual drop zone */}
                              <div className="flex-1">
                                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-green-400 rounded-lg p-4 transition-colors bg-white hover:bg-green-50/50">
                                      <Upload size={24} className="text-gray-400 mb-1" />
                                      <span className="text-sm text-gray-500">Click to upload logo</span>
                                      <span className="text-xs text-gray-400 mt-1">PNG, JPG, SVG — max 5MB</span>
                                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                  </label>
                                  {/* Upload status message */}
                                  {logoUploadStatus.status !== 'idle' && (
                                      <div className={`mt-2 text-xs font-medium ${logoUploadStatus.status === 'success' ? 'text-green-600' : logoUploadStatus.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                                          {logoUploadStatus.status === 'loading' && '⏳ '}
                                          {logoUploadStatus.status === 'success' && '✓ '}
                                          {logoUploadStatus.status === 'error' && '✗ '}
                                          {logoUploadStatus.message}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                      {/* Company name field */}
                      <div><label className="label">Company Name</label><input required className="input" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} /></div>
                      {/* Company tagline */}
                      <div><label className="label">Tagline</label><input className="input" value={settings.tagline} onChange={e => setSettings({...settings, tagline: e.target.value})} /></div>
                      {/* Longer description */}
                      <div><label className="label">Subtitle / Description</label><input className="input" value={settings.subtitle || ''} onChange={e => setSettings({...settings, subtitle: e.target.value})} /></div>
                      {/* Certifications (e.g. GMP, ISO) */}
                      <div><label className="label">Certifications</label><input className="input" placeholder="e.g. GMP Certified" value={settings.certifications || ''} onChange={e => setSettings({...settings, certifications: e.target.value})} /></div>
                      {/* Main office address */}
                      <div className="col-span-2"><label className="label">Office Address</label><textarea className="input h-20" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} /></div>
                      {/* Factory address (optional) */}
                      <div className="col-span-2"><label className="label">Factory Address (Optional)</label><textarea className="input h-20" value={settings.factoryAddress || ''} onChange={e => setSettings({...settings, factoryAddress: e.target.value})} /></div>
                      {/* Phone number for customer contact */}
                      <div><label className="label">Phone</label><input required className="input" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} /></div>
                      {/* Email for customer contact */}
                      <div><label className="label">Email</label><input type="email" required className="input" value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} /></div>
                      {/* Social media handle */}
                      <div><label className="label">Instagram Handle</label><input className="input" value={settings.instagram || ''} onChange={e => setSettings({...settings, instagram: e.target.value})} /></div>
                      {/* GST identification number (16 chars) */}
                      <div><label className="label">GSTIN</label><input className="input" value={settings.gstin} onChange={e => setSettings({...settings, gstin: e.target.value})} /></div>
                      {/* PAN number (10 chars, auto-uppercase) */}
                      <div><label className="label">PAN Number</label><input className="input" placeholder="e.g. ABCDE1234F" maxLength={10} value={settings.panNumber || ''} onChange={e => setSettings({...settings, panNumber: e.target.value.toUpperCase()})} /></div>
                      {/* State name for GST purposes */}
                      <div><label className="label">State Name</label><input className="input" value={settings.stateName || ''} onChange={e => setSettings({...settings, stateName: e.target.value})} /></div>
                      {/* State code (2 digits used for IGST vs SGST/CGST detection) */}
                      <div><label className="label">State Code</label><input className="input" value={settings.stateCode || ''} onChange={e => setSettings({...settings, stateCode: e.target.value})} /></div>
                  </div>
              </div>
          )}

          {/* === TAB: BILLING SETTINGS === Banking details, invoice prefix, terms & conditions, preview */}
          {activeTab === 'billing' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                 <div>
                     <h3 className="font-bold text-lg text-gray-700 mb-4 flex items-center"><CreditCard className="mr-2" size={20}/> Banking Details</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* === GST ACCOUNT (Primary) === Used for GST compliance and invoicing */}
                         <div className="space-y-3 p-4 bg-blue-50 rounded border border-blue-100">
                             <h4 className="font-semibold text-blue-800">GST Account (Primary)</h4>
                             <input className="input" placeholder="Bank Name" value={settings.gstBankName} onChange={e => setSettings({...settings, gstBankName: e.target.value})} />
                             <input className="input" placeholder="Account No" value={settings.gstAccountNo} onChange={e => setSettings({...settings, gstAccountNo: e.target.value})} />
                             <input className="input" placeholder="IFSC Code" value={settings.gstIfsc} onChange={e => setSettings({...settings, gstIfsc: e.target.value})} />
                             <input className="input" placeholder="Branch" value={settings.gstBranch || ''} onChange={e => setSettings({...settings, gstBranch: e.target.value})} />
                             <input className="input" placeholder="UPI ID (Optional)" value={settings.gstUpi || ''} onChange={e => setSettings({...settings, gstUpi: e.target.value})} />
                         </div>
                         {/* === NON-GST ACCOUNT === For personal/non-GST transactions */}
                         <div className="space-y-3 p-4 bg-gray-50 rounded border border-gray-200">
                             <h4 className="font-semibold text-gray-700">Non-GST / Personal Account</h4>
                             <input className="input" placeholder="Bank Name" value={settings.nonGstBankName} onChange={e => setSettings({...settings, nonGstBankName: e.target.value})} />
                             <input className="input" placeholder="Account No" value={settings.nonGstAccountNo} onChange={e => setSettings({...settings, nonGstAccountNo: e.target.value})} />
                             <input className="input" placeholder="IFSC Code" value={settings.nonGstIfsc} onChange={e => setSettings({...settings, nonGstIfsc: e.target.value})} />
                             <input className="input" placeholder="Branch" value={settings.nonGstBranch || ''} onChange={e => setSettings({...settings, nonGstBranch: e.target.value})} />
                             <input className="input" placeholder="UPI ID (Optional)" value={settings.nonGstUpi || ''} onChange={e => setSettings({...settings, nonGstUpi: e.target.value})} />
                         </div>
                     </div>
                 </div>
                 {/* === INVOICE CONFIGURATION === Separate numbering for GST and Non-GST bills */}
                 <div className="border-t pt-4">
                     <h3 className="font-bold text-lg text-gray-700 mb-4">Invoice Configuration</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                         {/* GST Invoice Series */}
                         <div className="space-y-3 p-4 bg-blue-50 rounded border border-blue-100">
                             <h4 className="font-semibold text-blue-800">GST Invoice Series</h4>
                             <div><label className="label">Prefix</label><input className="input w-32" value={settings.invoicePrefix} onChange={e => setSettings({...settings, invoicePrefix: e.target.value})} placeholder="e.g. NH" /></div>
                             <div><label className="label">Start No.</label><input type="number" className="input w-32" value={settings.invoiceStartNumber || 1} onChange={e => setSettings({...settings, invoiceStartNumber: parseInt(e.target.value) || 1})} /></div>
                             <p className="text-xs text-blue-600">Preview: {settings.invoicePrefix || 'NH'}/0001/25-26</p>
                         </div>
                         {/* Non-GST Invoice Series */}
                         <div className="space-y-3 p-4 bg-gray-50 rounded border border-gray-200">
                             <h4 className="font-semibold text-gray-700">Non-GST Invoice Series</h4>
                             <div><label className="label">Prefix</label><input className="input w-32" value={settings.nonGstInvoicePrefix || ''} onChange={e => setSettings({...settings, nonGstInvoicePrefix: e.target.value})} placeholder="e.g. NHW" /></div>
                             <div><label className="label">Start No.</label><input type="number" className="input w-32" value={settings.nonGstInvoiceStartNumber || 1} onChange={e => setSettings({...settings, nonGstInvoiceStartNumber: parseInt(e.target.value) || 1})} /></div>
                             <p className="text-xs text-gray-500">Preview: {settings.nonGstInvoicePrefix || settings.invoicePrefix || 'NHW'}/0001/25-26</p>
                         </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {/* Footer text shown on every invoice */}
                         <div className="col-span-2"><label className="label">Footer Text</label><input className="input" value={settings.footerText || ''} onChange={e => setSettings({...settings, footerText: e.target.value})} /></div>
                         {/* Terms & conditions displayed below items table */}
                         <div className="col-span-2"><label className="label">Terms & Conditions</label><textarea className="input h-32 font-mono text-xs" value={settings.terms || ''} onChange={e => setSettings({...settings, terms: e.target.value})} /></div>
                     </div>
                 </div>

                 {/* === INVOICE LIVE PREVIEW === Shows sample invoice as settings are updated */}
                 <div className="border-t pt-4">
                     <h3 className="font-bold text-lg text-gray-700 mb-4 flex items-center"><FileText className="mr-2" size={20}/> Invoice Preview</h3>
                     <div id="invoice-preview" className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-6 text-sm" style={{fontFamily: 'serif'}}>
                         {/* Invoice header with logo and company name */}
                         <div className="flex justify-between items-start mb-4 border-b pb-3">
                             <div className="flex items-start gap-3">
                                 {/* Logo or placeholder */}
                                 {settings.logo ? (
                                     <img src={settings.logo} alt="Logo" className="h-12 w-auto object-contain" />
                                 ) : (
                                     <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-400 border">Logo</div>
                                 )}
                                 {/* Company details */}
                                 <div>
                                     <h4 className="text-lg font-bold text-gray-900">{settings.name || 'Company Name'}</h4>
                                     <p className="text-xs text-gray-500">{settings.tagline || 'Tagline'}</p>
                                     <p className="text-[10px] text-gray-400 mt-1">{settings.address || 'Address'}</p>
                                     {settings.gstin && <p className="text-[10px] text-gray-400">GSTIN: {settings.gstin}</p>}
                                     {settings.panNumber && <p className="text-[10px] text-gray-400">PAN: {settings.panNumber}</p>}
                                 </div>
                             </div>
                             {/* Invoice title and date */}
                             <div className="text-right">
                                 <p className="text-xs font-bold text-gray-700">INVOICE</p>
                                 <p className="text-sm font-bold text-blue-600">{settings.invoicePrefix || 'NH'}/0001/25-26</p>
                                 <p className="text-[10px] text-gray-400">Non-GST: {settings.nonGstInvoicePrefix || settings.invoicePrefix || 'NHW'}/0001/25-26</p>
                                 <p className="text-[10px] text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                             </div>
                         </div>
                         {/* Bill to and details section */}
                         <div className="grid grid-cols-2 gap-4 mb-3 text-[10px]">
                             <div>
                                 <p className="font-bold text-gray-600 mb-1">BILL TO:</p>
                                 <p className="text-gray-500">Customer Name</p>
                                 <p className="text-gray-400">Phone / Address</p>
                             </div>
                             <div className="text-right">
                                 <p className="font-bold text-gray-600 mb-1">DETAILS:</p>
                                 <p className="text-gray-500">Sales Person: Rep Name</p>
                             </div>
                         </div>
                         {/* Sample items table */}
                         <table className="w-full text-[10px] mb-3 border-collapse">
                             <thead><tr className="bg-gray-100 border-b"><th className="p-1.5 text-left">Item</th><th className="p-1.5 text-center">Qty</th><th className="p-1.5 text-right">Rate</th><th className="p-1.5 text-right">Amount</th></tr></thead>
                             <tbody>
                                 <tr className="border-b border-gray-100"><td className="p-1.5">Sample Product</td><td className="p-1.5 text-center">2</td><td className="p-1.5 text-right">₹500.00</td><td className="p-1.5 text-right font-semibold">₹1,000.00</td></tr>
                             </tbody>
                         </table>
                         {/* Grand total */}
                         <div className="text-right text-xs font-bold text-gray-700 mb-3">Grand Total: ₹1,000.00</div>
                         {/* Bank details footer */}
                         <div className="border-t pt-2 text-[10px] text-gray-500">
                             <p className="font-semibold text-gray-600">Bank Details:</p>
                             <p>{settings.gstBankName || 'Bank Name'} | A/C: {settings.gstAccountNo || 'XXXX'} | IFSC: {settings.gstIfsc || 'XXXX'}</p>
                         </div>
                         {/* Custom footer text */}
                         {settings.footerText && <p className="text-center text-[10px] text-gray-400 mt-2 border-t pt-2">{settings.footerText}</p>}
                     </div>
                     <p className="text-xs text-gray-400 mt-2 text-center italic">This preview updates as you type. Save settings to apply.</p>
                 </div>
              </div>
          )}

          {/* === TAB: SALES TEAM === Manage active/inactive sales representatives */}
          {activeTab === 'sales' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                  <h3 className="font-bold text-lg text-gray-700">Sales Representatives</h3>
                  {/* === INPUT ROW === Add new sales person */}
                  <div className="flex gap-2 mb-4">
                      <input className="input max-w-sm" placeholder="Enter Name..." value={newSPName} onChange={e => setNewSPName(e.target.value)}/>
                      <button type="button" onClick={addSalesPerson} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"><Plus size={18} className="mr-2" /> Add</button>
                  </div>
                  {/* === SALES PERSONS LIST === Shows each sales person with active/inactive toggle */}
                  <div className="space-y-2 max-w-xl">
                      {salesPersons.map(sp => (
                          <div key={sp.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                              {/* Name strikethrough if inactive */}
                              <span className={!sp.isActive ? 'text-gray-400 line-through' : 'font-medium'}>{sp.name}</span>
                              {/* Activate/Deactivate button toggle */}
                              <button type="button" onClick={() => toggleSalesPerson(sp)} className={`text-xs px-2 py-1 rounded border ${sp.isActive ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-green-50 text-green-700 border-green-200'}`}>{sp.isActive ? 'Deactivate' : 'Activate'}</button>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* === TAB: USERS === Manage app login credentials for different users */}
          {activeTab === 'users' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                   <h3 className="font-bold text-lg text-gray-700 flex items-center"><Lock className="mr-2" size={20} /> User Management</h3>
                   
                   {/* === CREATE/UPDATE USER FORM === Add new user or change password */}
                   <div className="bg-gray-50 p-4 rounded border">
                       <h4 className="font-semibold mb-3">Change Password / Add User</h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <input className="input" placeholder="Username (e.g. admin)" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                           <input type="password" className="input" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                           <input type="password" className="input" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                       </div>
                       <button type="button" onClick={handleUpdateUser} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700">Update / Create User</button>
                   </div>

                   {/* === EXISTING USERS LIST === Shows all users and their last login */}
                   <div className="space-y-2">
                       <h4 className="font-semibold text-gray-600">Existing Users</h4>
                       {users.map((u, i) => (
                           <div key={i} className="flex items-center p-2 border-b last:border-0">
                               <UserIcon size={16} className="mr-2 text-gray-400"/>
                               <span className="font-medium">{u.username}</span>
                               {/* Last login timestamp */}
                               <span className="ml-auto text-xs text-gray-500">Last Login: {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</span>
                           </div>
                       ))}
                   </div>
              </div>
          )}

          {/* === TAB: DATA MANAGEMENT === Backup/restore, data folder location, clear all data */}
          {activeTab === 'data' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                  <h3 className="font-bold text-lg text-gray-700 flex items-center"><Database className="mr-2" size={20} /> Data Management</h3>
                  
                  {/* === DATA LOCATION SECTION === Configuration of storage folder (invoices, backups) */}
                  <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
                      <h4 className="font-bold text-green-700 mb-3 flex items-center"><FolderOpen size={18} className="mr-2" /> Data Storage Location</h4>
                      <p className="text-sm text-green-600 mb-3">This is where your invoices and backups are saved. These folders are <strong>not removed</strong> when you uninstall the app.</p>
                      {/* Data path display */}
                      {dataPathValue ? (
                        <div className="mb-3">
                          <div className="font-mono text-xs bg-green-100 text-green-800 p-3 rounded border border-green-200">
                            <div>📁 {dataPathValue}</div>
                            <div className="ml-4">📁 invoices</div>
                            <div className="ml-4">📁 backups</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-3 italic">No data location configured.</p>
                      )}
                      {/* Change location button */}
                      <button
                        type="button"
                        onClick={handleChangeDataPath}
                        className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 flex items-center font-medium"
                      >
                        <FolderOpen size={18} className="mr-2" /> {dataPathValue ? 'Change Location' : 'Set Location'}
                      </button>
                      {/* Status message for data path change */}
                      {dataPathStatus.status !== 'idle' && (
                          <div className={`mt-3 text-sm font-medium p-2 rounded-lg ${
                              dataPathStatus.status === 'success'
                                  ? 'bg-green-100 text-green-700'
                                  : dataPathStatus.status === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-blue-100 text-blue-700'
                          }`}>
                              {dataPathStatus.status === 'loading' && '⏳ '}
                              {dataPathStatus.status === 'success' && '✓ '}
                              {dataPathStatus.status === 'error' && '✗ '}
                              {dataPathStatus.message}
                          </div>
                      )}
                  </div>

                  {/* === BACKUP & RESTORE SECTION === Download/import data backups */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                      <h4 className="font-bold text-blue-700 mb-3">Backup & Restore</h4>
                      <p className="text-sm text-blue-600 mb-4">Create backups of all your data (bills, products, customers, settings) and restore them whenever needed.</p>
                      {/* Backup buttons */}
                      <div className="flex gap-3 flex-wrap">
                          <button 
                              type="button" 
                              onClick={handleBackupDownload}
                              className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 flex items-center font-medium"
                          >
                              <Download size={18} className="mr-2" /> Download Backup (.JSON)
                          </button>
                          <button 
                              type="button" 
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 flex items-center font-medium"
                          >
                              <Upload size={18} className="mr-2" /> Import Backup
                          </button>
                          {/* Hidden file input for backup import */}
                          <input
                              ref={fileInputRef}
                              type="file"
                              accept=".json"
                              onChange={handleBackupUpload}
                              className="hidden"
                          />
                      </div>
                      {/* Backup status message */}
                      {backupStatus.status !== 'idle' && (
                          <div className={`mt-3 text-sm font-medium p-2 rounded-lg ${
                              backupStatus.status === 'success' 
                                  ? 'bg-green-100 text-green-700' 
                                  : backupStatus.status === 'error' 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-blue-100 text-blue-700'
                          }`}>
                              {backupStatus.status === 'loading' && '⏳ '}
                              {backupStatus.status === 'success' && '✓ '}
                              {backupStatus.status === 'error' && '✗ '}
                              {backupStatus.message}
                          </div>
                      )}
                  </div>
                  
                  {/* === DANGER ZONE === Clear all data (irreversible) */}
                  <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <h4 className="font-bold text-red-700 mb-2">Danger Zone</h4>
                      <p className="text-sm text-red-600 mb-4">Clearing data will remove all products, customers, and bills permanently.</p>
                      <button type="button" onClick={clearData} className="px-4 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700 flex items-center"><Trash2 size={18} className="mr-2" /> Clear All Data</button>
                  </div>
              </div>
          )}

          {/* === SAVE BUTTON === Only show for company/billing tabs */}
          {(activeTab === 'company' || activeTab === 'billing') && (
              <div className="mt-6 flex justify-end">
                  <button type="submit" className="px-6 py-3 bg-green-700 text-white font-bold rounded-lg shadow-lg hover:bg-green-800 flex items-center"><Save size={20} className="mr-2"/> Save Settings</button>
              </div>
          )}
      </form>
    </div>
  );
};

// === EXPORT === React component for system settings management
export default Settings;