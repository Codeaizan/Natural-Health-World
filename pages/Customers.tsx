// Import React and hooks for state management and side effects
import React, { useState, useEffect } from 'react';
// Import custom Toast hook for displaying user notifications (success, warning, confirm)
import { useToast } from '../components/Toast';
// Import TypeScript type definitions for Customer and Bill data structures
import { Customer, Bill } from '../types';
// Import StorageService for database operations (CRUD operations for customers and bills)
import { StorageService } from '../services/storage';
// Import icon components from lucide-react library for UI elements
import { Search, Plus, Phone, MapPin, History, Download, X, Merge } from 'lucide-react';
// Import utility function to perform fuzzy/partial text search on customer records
import { searchMatch } from '../utils';
// Import skeleton loading component shown while customer data is being fetched
import { CardGridSkeleton } from '../components/Skeleton';
// Import empty state component displayed when no customers exist or search returns no results
import EmptyState from '../components/EmptyState';

// Define the Customers component as a React functional component with TypeScript type annotation
const Customers: React.FC = () => {
    // State to store the complete list of all customers retrieved from database
    const [customers, setCustomers] = useState<Customer[]>([]);
    // State to store the search input value entered by the user in the search box
    const [search, setSearch] = useState('');
    // State to control whether the Add/Edit Customer modal dialog is open or closed
    const [isModalOpen, setIsModalOpen] = useState(false);
    // State to store the currently selected or edited customer data (partial allows incomplete data during editing)
    const [current, setCurrent] = useState<Partial<Customer>>({});
    // State to store and display validation error messages in the add/edit customer modal
    const [error, setError] = useState('');

    // Section: History Modal State - manages the purchase history dialog for viewing customer transactions

    // State to store the customer object selected for viewing purchase history (null when modal is closed)
    const [viewHistory, setViewHistory] = useState<Customer | null>(null);
    // State to store the list of bills belonging to the customer viewing their purchase history
    const [customerBills, setCustomerBills] = useState<Bill[]>([]);
    // State to store the "from" date for filtering purchase history (filters bills from this date onwards)
    const [historyStart, setHistoryStart] = useState('');
    // State to store the "to" date for filtering purchase history (filters bills until this date)
    const [historyEnd, setHistoryEnd] = useState('');

    // Section: Merge Modal State - manages the customer merge/deduplication dialog

    // State to control whether the Merge Customers modal dialog is open or closed
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    // State to store the ID of the source customer being merged (duplicate that will be deleted)
    const [mergeFrom, setMergeFrom] = useState<string>('');
    // State to store the ID of the target customer for merging (primary customer that will remain)
    const [mergeTo, setMergeTo] = useState<string>('');
    // State to track whether initial data is still loading (shows skeleton loader while true)
    const [loading, setLoading] = useState(true);
    // Hook to access toast notification functionality for user feedback and alerts
    const toast = useToast();

    // useEffect hook that runs once on component mount (empty dependency array) to load initial customer data
    useEffect(() => {
        // Call loadCustomers function to fetch and populate the customers list from storage
        loadCustomers();
    }, []);

    // Async function to fetch all customers from storage and update component state
    const loadCustomers = async () => {
        // Call database service to retrieve all customer records
        const data = await StorageService.getCustomers();
        // Update state with the fetched customer data to trigger re-render
        setCustomers(data);
        // Set loading to false to hide the skeleton loader and display actual content
        setLoading(false);
    };

    // useEffect hook that runs when purchase history modal is opened or date filters change
    // Dependencies: [viewHistory, historyStart, historyEnd] - triggers when any of these change
    useEffect(() => {
        // Only load history if a customer is selected to view (viewHistory is not null)
        if(viewHistory) {
            // Define async function to fetch and filter customer's bills/purchases from database
            const loadHistory = async () => {
                // Fetch all bills from database
                const allBills = await StorageService.getBills();
                // Filter bills to only include those belonging to the currently viewing customer
                // Sort bills by date in descending order (newest first)
                let relevant = allBills
                    .filter(b => b.customerId === viewHistory.id)
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                // If user specified a start date, filter bills to only include those on or after this date
                if (historyStart) {
                    relevant = relevant.filter(b => b.date >= historyStart);
                }
                // If user specified an end date, filter bills to only include those on or before this date
                if (historyEnd) {
                    // Extract date portion only (handle datetime strings) for string comparison with end date
                    relevant = relevant.filter(b => b.date.split('T')[0] <= historyEnd);
                }

                // Update state with the filtered bill list to display in the history table
                setCustomerBills(relevant);
            };
            // Call the async function to load and filter the history data
            loadHistory();
        }
    }, [viewHistory, historyStart, historyEnd]);

    // Async event handler for saving a new or edited customer record
    // Called when the Add/Edit customer form is submitted
    const handleSave = async (e: React.FormEvent) => {
        // Prevent default form submission behavior (page reload)
        e.preventDefault();
        // Clear any previous error messages before validation
        setError('');

        // Validate that both Name and Phone fields are filled (these are required)
        if(!current.name || !current.phone) {
            // Set error message if required fields are empty
            setError('Name and Phone are required.');
            // Exit the function without saving
            return;
        }

        // Section: GSTIN (Goods and Services Tax Identification Number) validation for India

        // Check if GSTIN was provided (it's optional, so only validate if not empty)
        if (current.gstin) {
            // Define regex pattern for valid Indian GSTIN format (15 characters with specific patterns)
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            // Test if the entered GSTIN matches the valid format
            if (!gstinRegex.test(current.gstin)) {
                // Set error message if GSTIN format is invalid
                setError('Invalid GSTIN format. It should be 15 characters (e.g., 19ABCDE1234F1Z5)');
                // Exit the function without saving
                return;
            }
        }
        
        // If all validations pass, prepare the customer object and save to database
        await StorageService.saveCustomer({
            // Use existing customer ID if editing, or 0 (new) if adding a new customer
            id: current.id || 0,
            // Customer name is required and comes from form input
            name: current.name,
            // Phone number is required and comes from form input
            phone: current.phone,
            // Email is optional, default to empty string if not provided
            email: current.email || '',
            // Address is optional, default to empty string if not provided
            address: current.address || '',
            // GSTIN is optional, default to empty string if not provided
            gstin: current.gstin || ''
        });
        // Reload the customers list from database to show the newly added/edited customer
        await loadCustomers();
        // Close the add/edit modal dialog after successful save
        setIsModalOpen(false);
    };

    // Async event handler for merging/deduplicating customer records (combines two customer records)
    // Called when the Merge Customers form is submitted
    const handleMerge = async (e: React.FormEvent) => {
        // Prevent default form submission behavior (page reload)
        e.preventDefault();
        // Validate that the source customer is not the same as the target customer
        if (mergeFrom === mergeTo) {
            // Show warning toast if user tries to merge a customer into themselves
            toast.warning('Invalid Merge', 'Cannot merge a customer into themselves.');
            // Exit function without merging
            return;
        }
        // Validate that both source and target customers have been selected
        if (!mergeFrom || !mergeTo) {
            // Show warning toast if either selection is missing
            toast.warning('Missing Selection', 'Please select both customers.');
            // Exit function without merging
            return;
        }

        // Show a confirmation dialog warning about destructive action (customer will be deleted)
        const confirmed = await toast.confirm({
            // Title displayed in the confirmation dialog
            title: 'Merge Customers',
            // Message explaining what will happen during merge
            message: 'This will move all bills from the source customer to the target customer and DELETE the source customer profile. This cannot be undone.',
            // Text for the confirm button
            confirmText: 'Merge',
            // Mark as dangerous operation to show warning styling
            danger: true
        });
        // Only proceed with merge if user confirmed the action
        if (confirmed) {
            // Call database service to merge the customers (move bills and delete source)
            await StorageService.mergeCustomers(Number(mergeFrom), Number(mergeTo));
            // Show success toast notification to confirm merge completed
            toast.success('Merge Complete', 'Customers merged successfully.');
            // Reload the customer list to reflect the deletion of source customer
            await loadCustomers();
            // Close the merge modal dialog
            setIsMergeModalOpen(false);
            // Clear the source customer selection
            setMergeFrom('');
            // Clear the target customer selection
            setMergeTo('');
        }
    };

    // Async event handler to export all customers to a CSV (comma-separated values) file
    // Called when the "Export CSV" button is clicked
    const handleExport = async () => {
        // Check if there are any customers to export; show warning if list is empty
        if (customers.length === 0) { 
            // Show warning toast if no customers exist to export
            toast.warning('Nothing to Export', 'No customers to export'); 
            // Exit function early
            return; 
        }
        // Define the column headers for the CSV file
        const headers = ["Name", "Phone", "Email", "Address", "GSTIN"];
        // Define a helper function to properly escape values for CSV format (handle commas, quotes, newlines)
        const csvEscape = (val: string) => {
            // Check if the value contains special characters that need escaping for CSV
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                // Wrap value in quotes and escape any internal quotes by doubling them
                return `"${val.replace(/"/g, '""')}"`;
            }
            // Return value as-is if no special characters exist
            return val;
        };
        // Transform each customer object into a CSV row (array of comma-separated values)
        const rows = customers.map(c => [
            // Escape and include customer name
            csvEscape(c.name),
            // Escape and include customer phone
            csvEscape(c.phone),
            // Escape and include customer email (or empty string if not provided)
            csvEscape(c.email || ''),
            // Escape and include customer address, replacing newlines with spaces
            csvEscape((c.address || '').replace(/\n/g, ' ')),
            // Escape and include customer GSTIN (or empty string if not provided)
            csvEscape(c.gstin || '')
        // Join all values in the row with commas
        ].join(","));
        
        // Construct the complete CSV content by joining header row and data rows with newlines
        const csv = [headers.join(","), ...rows].join("\n");
        // Dynamically import the saveCsvFile utility function from utils module
        const { saveCsvFile } = await import('../utils');
        // Call the utility function to save the CSV file with a timestamped filename
        // Filename format: customers_export_YYYY-MM-DD.csv
        await saveCsvFile(`customers_export_${new Date().toISOString().slice(0,10)}.csv`, csv);
    };

    // Helper function to open the add/edit customer modal
    // Accepts an optional customer object; if not provided, modal will be in "add new" mode
    const openModal = (customer?: Customer) => {
        // Set the current state to the selected customer for editing, or empty object for new customer
        setCurrent(customer || {});
        // Clear any validation error messages from previous form submission
        setError('');
        // Set the modal's open state to true to display the modal dialog
        setIsModalOpen(true);
    };

    // Helper function to open the purchase history modal for a selected customer
    const openHistory = (c: Customer) => {
        // Clear the start date filter to show all history initially
        setHistoryStart('');
        // Clear the end date filter to show all history initially
        setHistoryEnd('');
        // Set the customer whose history should be viewed (triggers useEffect to load bills)
        setViewHistory(c);
    };

    // Filter customers based on the search input
    // This variable creates a new array containing only customers that match the search term
    const filtered = customers.filter(c => {
        // Combine all searchable customer fields into a single string for fuzzy matching
        const searchString = `${c.name} ${c.phone} ${c.email || ''} ${c.gstin || ''}`;
        // Use the searchMatch utility function to perform fuzzy/partial text search
        return searchMatch(searchString, search);
    });

    // Main component return statement - renders the full customers page UI
    return (
        <div className="space-y-6">
            {/* Header with search and action buttons */}
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

            {/* Customer cards grid */}
            {loading ? <CardGridSkeleton count={6} /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState 
                            type="customers" 
                            title="No customers found" 
                            description={search ? 'Try a different search term' : 'Add your first customer to get started'} 
                            action={!search ? { label: 'Add Customer', onClick: () => openModal() } : undefined} 
                        />
                    </div>
                ) : 
                filtered.map(c => (
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
            )}

            {/* Add/Edit Customer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-overlayFade">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-slideUp">
                        <h2 className="text-xl font-bold mb-4">{current.id ? 'Edit Customer' : 'New Customer'}</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            {error && (
                                <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
                                    {error}
                                </div>
                            )}
                            <input 
                                required 
                                placeholder="Name *" 
                                className="w-full p-2 border rounded" 
                                value={current.name || ''} 
                                onChange={e => setCurrent({...current, name: e.target.value})}
                            />
                            <input 
                                required 
                                placeholder="Phone *" 
                                className="w-full p-2 border rounded" 
                                value={current.phone || ''} 
                                onChange={e => setCurrent({...current, phone: e.target.value})}
                            />
                            <input 
                                type="email" 
                                placeholder="Email" 
                                className="w-full p-2 border rounded" 
                                value={current.email || ''} 
                                onChange={e => setCurrent({...current, email: e.target.value})}
                            />
                            <input 
                                placeholder="GSTIN (e.g. 19ABCDE1234F1Z5)" 
                                className="w-full p-2 border rounded" 
                                value={current.gstin || ''} 
                                maxLength={15}
                                onChange={e => setCurrent({...current, gstin: e.target.value.toUpperCase()})}
                            />
                            <textarea 
                                placeholder="Address" 
                                className="w-full p-2 border rounded h-24" 
                                value={current.address || ''} 
                                onChange={e => setCurrent({...current, address: e.target.value})}
                            />
                            
                            <div className="flex justify-end gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-green-600 text-white rounded">
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Merge Customers Modal */}
            {isMergeModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-overlayFade">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-slideUp">
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
                            {/* Visual divider showing direction of merge */}
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
                                <button 
                                    type="button" 
                                    onClick={() => setIsMergeModalOpen(false)} 
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700">
                                    Merge Records
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Purchase History Modal */}
            {viewHistory && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-overlayFade">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col animate-slideUp md:translate-x-8">
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
                                                {(() => { 
                                                    const items = bill.items.map(i => i.productName).join(', '); 
                                                    return `${bill.items.length} items (${items.length > 30 ? items.slice(0,30) + '...' : items})`; 
                                                })()}
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

// Export the Customers component as the default export so it can be imported and used in routing
export default Customers;