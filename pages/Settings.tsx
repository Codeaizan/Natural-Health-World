import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { CompanySettings, SalesPerson, User } from '../types';
import { COLORS } from '../constants';
import { Save, Plus, Trash2, Shield, CreditCard, FileText, Database, Upload, Lock, User as UserIcon } from 'lucide-react';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<CompanySettings>(StorageService.getSettings());
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newSPName, setNewSPName] = useState('');
  const [activeTab, setActiveTab] = useState('company');

  // New User State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
      setSalesPersons(StorageService.getSalesPersons());
      setUsers(StorageService.getUsers());
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      StorageService.saveSettings(settings);
      alert('Settings saved successfully!');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                  setSettings({ ...settings, logo: evt.target.result as string });
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const addSalesPerson = () => {
      if (!newSPName.trim()) return;
      StorageService.saveSalesPerson({ id: 0, name: newSPName, isActive: true });
      setSalesPersons(StorageService.getSalesPersons());
      setNewSPName('');
  };

  const toggleSalesPerson = (sp: SalesPerson) => {
      StorageService.saveSalesPerson({ ...sp, isActive: !sp.isActive });
      setSalesPersons(StorageService.getSalesPersons());
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUsername || !newPassword) {
          alert("Username and Password required");
          return;
      }
      if (newPassword !== confirmPassword) {
          alert("Passwords do not match");
          return;
      }

      const hash = await StorageService.hashPassword(newPassword);
      const user: User = {
          username: newUsername,
          passwordHash: hash,
          role: 'admin', // Simple role for now
      };
      
      StorageService.saveUser(user);
      setUsers(StorageService.getUsers());
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      alert("User updated/created successfully");
  };

  const clearData = () => {
      if (window.confirm("CRITICAL WARNING: This will delete ALL bills, customers, and products. Are you sure?")) {
          if(window.prompt("Type 'DELETE' to confirm") === 'DELETE') {
             localStorage.clear();
             window.location.reload();
          }
      }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Shield className="mr-3 text-green-700" /> System Settings
      </h2>

      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
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

      <form onSubmit={handleSaveSettings}>
          
          {/* COMPANY SETTINGS */}
          {activeTab === 'company' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                  <h3 className="font-bold text-lg text-gray-700 mb-2 flex items-center"><FileText className="mr-2" size={20}/> Company Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-2 flex items-center gap-4 p-4 bg-gray-50 rounded border">
                          {settings.logo ? <img src={settings.logo} alt="Logo" className="h-16 w-auto object-contain" /> : <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">No Logo</div>}
                          <div>
                              <label className="cursor-pointer bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50 shadow-sm flex items-center"><Upload size={14} className="mr-2"/> Upload Logo<input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} /></label>
                          </div>
                          {settings.logo && <button type="button" onClick={() => setSettings({...settings, logo: ''})} className="text-red-500 text-sm hover:underline">Remove</button>}
                      </div>
                      <div><label className="label">Company Name</label><input required className="input" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} /></div>
                      <div><label className="label">Tagline</label><input className="input" value={settings.tagline} onChange={e => setSettings({...settings, tagline: e.target.value})} /></div>
                      <div><label className="label">Subtitle / Description</label><input className="input" value={settings.subtitle || ''} onChange={e => setSettings({...settings, subtitle: e.target.value})} /></div>
                      <div><label className="label">Certifications</label><input className="input" placeholder="e.g. GMP Certified" value={settings.certifications || ''} onChange={e => setSettings({...settings, certifications: e.target.value})} /></div>
                      <div className="col-span-2"><label className="label">Office Address</label><textarea className="input h-20" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} /></div>
                      <div className="col-span-2"><label className="label">Factory Address (Optional)</label><textarea className="input h-20" value={settings.factoryAddress || ''} onChange={e => setSettings({...settings, factoryAddress: e.target.value})} /></div>
                      <div><label className="label">Phone</label><input required className="input" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} /></div>
                      <div><label className="label">Email</label><input type="email" required className="input" value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} /></div>
                      <div><label className="label">Instagram Handle</label><input className="input" value={settings.instagram || ''} onChange={e => setSettings({...settings, instagram: e.target.value})} /></div>
                      <div><label className="label">GSTIN</label><input className="input" value={settings.gstin} onChange={e => setSettings({...settings, gstin: e.target.value})} /></div>
                      <div><label className="label">State Name</label><input className="input" value={settings.stateName || ''} onChange={e => setSettings({...settings, stateName: e.target.value})} /></div>
                      <div><label className="label">State Code</label><input className="input" value={settings.stateCode || ''} onChange={e => setSettings({...settings, stateCode: e.target.value})} /></div>
                  </div>
              </div>
          )}

          {/* BILLING */}
          {activeTab === 'billing' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                 <div>
                     <h3 className="font-bold text-lg text-gray-700 mb-4 flex items-center"><CreditCard className="mr-2" size={20}/> Banking Details</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-3 p-4 bg-blue-50 rounded border border-blue-100">
                             <h4 className="font-semibold text-blue-800">GST Account (Primary)</h4>
                             <input className="input" placeholder="Bank Name" value={settings.gstBankName} onChange={e => setSettings({...settings, gstBankName: e.target.value})} />
                             <input className="input" placeholder="Account No" value={settings.gstAccountNo} onChange={e => setSettings({...settings, gstAccountNo: e.target.value})} />
                             <input className="input" placeholder="IFSC Code" value={settings.gstIfsc} onChange={e => setSettings({...settings, gstIfsc: e.target.value})} />
                             <input className="input" placeholder="Branch" value={settings.gstBranch || ''} onChange={e => setSettings({...settings, gstBranch: e.target.value})} />
                             <input className="input" placeholder="UPI ID (Optional)" value={settings.gstUpi || ''} onChange={e => setSettings({...settings, gstUpi: e.target.value})} />
                         </div>
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
                 <div className="border-t pt-4">
                     <h3 className="font-bold text-lg text-gray-700 mb-4">Invoice Configuration</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div><label className="label">Invoice Prefix</label><input className="input w-32" value={settings.invoicePrefix} onChange={e => setSettings({...settings, invoicePrefix: e.target.value})} /></div>
                         <div><label className="label">Next Invoice Start No.</label><input type="number" className="input w-32" value={settings.invoiceStartNumber || 1} onChange={e => setSettings({...settings, invoiceStartNumber: parseInt(e.target.value) || 1})} /></div>
                         <div className="col-span-2"><label className="label">Footer Text</label><input className="input" value={settings.footerText || ''} onChange={e => setSettings({...settings, footerText: e.target.value})} /></div>
                         <div className="col-span-2"><label className="label">Terms & Conditions</label><textarea className="input h-32 font-mono text-xs" value={settings.terms || ''} onChange={e => setSettings({...settings, terms: e.target.value})} /></div>
                     </div>
                 </div>
              </div>
          )}

          {/* SALES TEAM */}
          {activeTab === 'sales' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                  <h3 className="font-bold text-lg text-gray-700">Sales Representatives</h3>
                  <div className="flex gap-2 mb-4">
                      <input className="input max-w-sm" placeholder="Enter Name..." value={newSPName} onChange={e => setNewSPName(e.target.value)}/>
                      <button type="button" onClick={addSalesPerson} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"><Plus size={18} className="mr-2" /> Add</button>
                  </div>
                  <div className="space-y-2 max-w-xl">
                      {salesPersons.map(sp => (
                          <div key={sp.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                              <span className={!sp.isActive ? 'text-gray-400 line-through' : 'font-medium'}>{sp.name}</span>
                              <button type="button" onClick={() => toggleSalesPerson(sp)} className={`text-xs px-2 py-1 rounded border ${sp.isActive ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-green-50 text-green-700 border-green-200'}`}>{sp.isActive ? 'Deactivate' : 'Activate'}</button>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                   <h3 className="font-bold text-lg text-gray-700 flex items-center"><Lock className="mr-2" size={20} /> User Management</h3>
                   
                   <div className="bg-gray-50 p-4 rounded border">
                       <h4 className="font-semibold mb-3">Change Password / Add User</h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <input className="input" placeholder="Username (e.g. admin)" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                           <input type="password" className="input" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                           <input type="password" className="input" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                       </div>
                       <button type="button" onClick={handleUpdateUser} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700">Update / Create User</button>
                   </div>

                   <div className="space-y-2">
                       <h4 className="font-semibold text-gray-600">Existing Users</h4>
                       {users.map((u, i) => (
                           <div key={i} className="flex items-center p-2 border-b last:border-0">
                               <UserIcon size={16} className="mr-2 text-gray-400"/>
                               <span className="font-medium">{u.username}</span>
                               <span className="ml-auto text-xs text-gray-500">Last Login: {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</span>
                           </div>
                       ))}
                   </div>
              </div>
          )}

          {/* DATA */}
          {activeTab === 'data' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                  <h3 className="font-bold text-lg text-gray-700 flex items-center"><Database className="mr-2" size={20} /> Data Management</h3>
                  <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <h4 className="font-bold text-red-700 mb-2">Danger Zone</h4>
                      <p className="text-sm text-red-600 mb-4">Clearing data will remove all products, customers, and bills permanently.</p>
                      <button type="button" onClick={clearData} className="px-4 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700 flex items-center"><Trash2 size={18} className="mr-2" /> Clear All Data</button>
                  </div>
              </div>
          )}

          {(activeTab === 'company' || activeTab === 'billing') && (
              <div className="mt-6 flex justify-end">
                  <button type="submit" className="px-6 py-3 bg-green-700 text-white font-bold rounded-lg shadow-lg hover:bg-green-800 flex items-center"><Save size={20} className="mr-2"/> Save Settings</button>
              </div>
          )}
      </form>
      
      <style>{`
        .label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
        .input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: ${COLORS.sageGreen}; ring: 2px solid ${COLORS.sageGreen}; }
      `}</style>
    </div>
  );
};

export default Settings;