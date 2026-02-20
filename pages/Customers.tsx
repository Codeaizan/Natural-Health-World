import React, { useState, useEffect } from 'react';
import { Customer, Bill } from '../types';
import { StorageService } from '../services/storage';
import { COLORS } from '../constants';
import { Search, Plus, Phone, MapPin, History, Download, X, Merge, Filter } from 'lucide-react';
import { searchMatch } from '../utils';

const Customers: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [current, setCurrent] = useState<Partial<Customer>>({});
    const [error, setError] = useState('');

    // History Modal
    const [viewHistory, setViewHistory] = useState<Customer | null>(null);
    const [customerBills, setCustomerBills] = useState<Bill[]>([]);
    const [historyStart, setHistoryStart] = useState('');
    const [historyEnd, setHistoryEnd] = useState('');

    // Merge Modal
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [mergeFrom, setMergeFrom] = useState<string>('');
    const [mergeTo, setMergeTo] = useState<string>('');

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        const data = await StorageService.getCustomers();
        setCustomers(data);
    };

    // Filter History when dates change or modal opens
    useEffect(() => {
        if(viewHistory) {
            const loadHistory = async () => {
                const allBills = await StorageService.getBills();
                let relevant = allBills
                    .filter(b => b.customerId === viewHistory.id)
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                if (historyStart) {
                    relevant = relevant.filter(b => b.date >= historyStart);
                }
                if (historyEnd) {
                    // Add 1 day to include the end date fully or just string compare
                    relevant = relevant.filter(b => b.date.split('T')[0] <= historyEnd);
                }

                setCustomerBills(relevant);
            };
            loadHistory();
        }
    }, [viewHistory, historyStart, historyEnd]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if(!current.name || !current.phone) {
            setError('Name and Phone are required.');
            return;
        }

        // Basic GSTIN Validation
        if (current.gstin) {
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstinRegex.test(current.gstin)) {
                setError('Invalid GSTIN format. It should be 15 characters (e.g., 19ABCDE1234F1Z5)');
                return;
            }
        }
        
        await StorageService.saveCustomer({
            id: current.id || 0,
            name: current.name,
            phone: current.phone,
            email: current.email || '',
            address: current.address || '',
            gstin: current.gstin || ''
        });
        await loadCustomers();
        setIsModalOpen(false);
    };

    const handleMerge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mergeFrom === mergeTo) {
            alert("Cannot merge a customer into themselves.");
            return;
        }
        if (!mergeFrom || !mergeTo) {
            alert("Please select both customers.");
            return;
        }

        const confirm = window.confirm("Are you sure? This will move all bills from the source customer to the target customer and DELETE the source customer profile. This cannot be undone.");
        if (confirm) {
            await StorageService.mergeCustomers(Number(mergeFrom), Number(mergeTo));
            alert("Customers merged successfully.");
            await loadCustomers();
            setIsMergeModalOpen(false);
            setMergeFrom('');
            setMergeTo('');
        }
    };

    const handleExport = () => {
        if (customers.length === 0) return alert("No customers to export");
        const headers = ["Name", "Phone", "Email", "Address", "GSTIN"];
        const rows = customers.map(c => [
            `"${c.name}"`,
            `"${c.phone}"`,
            c.email || "",
            `"${(c.address || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            c.gstin || ""
        ].join(","));
        
        const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = `customers_export_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const openModal = (customer?: Customer) => {
        setCurrent(customer || {});
        setError('');
        setIsModalOpen(true);
    };

    const openHistory = (c: Customer) => {
        setHistoryStart('');
        setHistoryEnd('');
        setViewHistory(c);
    };

    const filtered = customers.filter(c => {
        const searchString = `${c.name} ${c.phone} ${c.email || ''} ${c.gstin || ''}`;
        return searchMatch(searchString, search);
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Search Customers (Name, Phone, GSTIN)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => setIsMergeModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 border border-purple-200"
                    >
                        <Merge size={18} className="mr-2"/> Merge
                    </button>
                    <button 
                        onClick={handleExport}
                        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border"
                    >
                        <Download size={18} className="mr-2"/> Export CSV
                    </button>
                    <button 
                        onClick={() => openModal()}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow"
                    >
                        <Plus size={18} className="mr-2"/> Add Customer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(c => (
                    <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg text-gray-800">{c.name}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => openHistory(c)} className="text-gray-400 hover:text-blue-600" title="View History">
                                    <History size={18} />
                                </button>
                                <button onClick={() => openModal(c)} className="text-sm text-blue-600 hover:underline">Edit</button>
                            </div>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 cursor-pointer" onClick={() => openHistory(c)}>
                            <div className="flex items-center"><Phone size={14} className="mr-2"/> {c.phone}</div>
                            <div className="flex items-center"><MapPin size={14} className="mr-2"/> <span className="truncate">{c.address || 'No Address'}</span></div>
                            {c.gstin && <div className="mt-2 text-xs font-mono bg-gray-100 p-1 rounded inline-block">GST: {c.gstin}</div>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit/Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{current.id ? 'Edit Customer' : 'New Customer'}</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            {error && (
                                <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
                                    {error}
                                </div>
                            )}
                            <input required placeholder="Name *" className="w-full p-2 border rounded" value={current.name || ''} onChange={e => setCurrent({...current, name: e.target.value})}/>
                            <input required placeholder="Phone *" className="w-full p-2 border rounded" value={current.phone || ''} onChange={e => setCurrent({...current, phone: e.target.value})}/>
                            <input type="email" placeholder="Email" className="w-full p-2 border rounded" value={current.email || ''} onChange={e => setCurrent({...current, email: e.target.value})}/>
                            <input 
                                placeholder="GSTIN (e.g. 19ABCDE1234F1Z5)" 
                                className="w-full p-2 border rounded" 
                                value={current.gstin || ''} 
                                maxLength={15}
                                onChange={e => setCurrent({...current, gstin: e.target.value.toUpperCase()})}
                            />
                            <textarea placeholder="Address" className="w-full p-2 border rounded h-24" value={current.address || ''} onChange={e => setCurrent({...current, address: e.target.value})}/>
                            
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Merge Modal */}
            {isMergeModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center"><Merge className="mr-2"/> Merge Customers</h2>
                            <button onClick={() => setIsMergeModalOpen(false)}><X className="text-gray-400"/></button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                            Select the Duplicate customer to move records FROM, and the Primary customer to move records TO. The duplicate will be deleted.
                        </p>
                        <form onSubmit={handleMerge} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Move FROM (Duplicate)</label>
                                <select 
                                    className="w-full p-2 border rounded" 
                                    value={mergeFrom} 
                                    onChange={e => setMergeFrom(e.target.value)}
                                    required
                                >
                                    <option value="">Select Customer...</option>
                                    {customers.filter(c => c.id.toString() !== mergeTo).map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-center">
                                <div className="bg-gray-100 p-2 rounded-full"><Download size={20} className="text-gray-500" /></div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Move TO (Primary)</label>
                                <select 
                                    className="w-full p-2 border rounded" 
                                    value={mergeTo} 
                                    onChange={e => setMergeTo(e.target.value)}
                                    required
                                >
                                    <option value="">Select Customer...</option>
                                    {customers.filter(c => c.id.toString() !== mergeFrom).map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setIsMergeModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700">Merge Records</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {viewHistory && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
                        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 rounded-t-xl gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{viewHistory.name}</h3>
                                <p className="text-sm text-gray-500">Purchase History</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border">
                                    <span className="text-xs text-gray-500">From:</span>
                                    <input 
                                        type="date" 
                                        className="text-xs outline-none" 
                                        value={historyStart} 
                                        onChange={e => setHistoryStart(e.target.value)} 
                                    />
                                    <span className="text-xs text-gray-500">To:</span>
                                    <input 
                                        type="date" 
                                        className="text-xs outline-none" 
                                        value={historyEnd} 
                                        onChange={e => setHistoryEnd(e.target.value)} 
                                    />
                                </div>
                                <button onClick={() => setViewHistory(null)} className="p-2 hover:bg-gray-200 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-4">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-100 sticky top-0 text-gray-600">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Invoice #</th>
                                        <th className="p-3">Items</th>
                                        <th className="p-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {customerBills.map(bill => (
                                        <tr key={bill.id} className="hover:bg-gray-50">
                                            <td className="p-3">{new Date(bill.date).toLocaleDateString()}</td>
                                            <td className="p-3 font-mono">{bill.invoiceNumber}</td>
                                            <td className="p-3 text-gray-500">
                                                {bill.items.length} items ({bill.items.map(i => i.productName).join(', ').slice(0,30)}...)
                                            </td>
                                            <td className="p-3 text-right font-bold">₹{bill.grandTotal.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {customerBills.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400">No purchase history found for selected range.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
                            <span className="text-gray-600">Total Transactions: {customerBills.length}</span>
                            <span className="text-xl font-bold text-green-700">
                                Total Value: ₹{customerBills.reduce((sum, b) => sum + b.grandTotal, 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;