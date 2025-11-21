import { useUser } from '@clerk/clerk-react';
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getCustomers } from '../services/customerService'; // Only need getCustomers for sync
import Button from '../components/Button';
import db from '../db'; // Import the Dexie database instance
import { sanitizeArrayForDb, sanitizeForDb } from '../services/dbUtils';

const AddCustomerForm = ({ onAdd, onCancel, theme }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ name, email, phone });
  };

  return (
    <form onSubmit={handleSubmit} className={`p-4 my-4 border rounded-lg ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Add New Customer</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
      </div>
      <div className="flex justify-end gap-4 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Save Customer</Button>
      </div>
    </form>
  );
};

export default function CustomersPage() {
  const { theme } = useTheme();
  const { isLoaded, user } = useUser();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const fetchCustomers = async () => {
      setLoading(true);
      setError(null);

      // 1. Get customers from the local database first for instant UI.
      const localCustomers = await db.customers.toArray();
      setCustomers(localCustomers);
      setFilteredCustomers(localCustomers);

      // 2. Try to sync with the server to get the latest data.
      try {
        const serverCustomers = await getCustomers();
        // Check if exists, then update or insert
        const sanitized = sanitizeArrayForDb(serverCustomers);
        for (const customer of sanitized) {
          try {
            // Find existing by unique `_id` index
            const existing = await db.customers.where('_id').equals(String(customer._id)).first();
            if (existing && existing.id !== undefined) {
              try {
                await db.customers.update(existing.id, customer);
              } catch (updateErr) {
                if (updateErr.name !== 'ConstraintError') {
                  console.warn(`[CustomersPage] Error updating customer ${customer._id}:`, updateErr);
                }
              }
            } else {
              try {
                await db.customers.add(customer);
              } catch (addErr) {
                // If add fails due to constraint, try to find and update by primary key
                if (addErr.name === 'ConstraintError') {
                  try {
                    const fallback = await db.customers.where('_id').equals(String(customer._id)).first();
                    if (fallback && fallback.id !== undefined) await db.customers.update(fallback.id, customer);
                  } catch (e) { /* swallow */ }
                } else {
                  console.warn(`[CustomersPage] Failed to add customer ${customer._id}:`, addErr);
                }
              }
            }
          } catch (putErr) {
            console.warn(`[CustomersPage] Failed to sync customer ${customer._id}:`, putErr);
          }
        }
        const updatedLocalCustomers = await db.customers.toArray();
        setCustomers(updatedLocalCustomers);
        setFilteredCustomers(updatedLocalCustomers);
      } catch (err) {
        setError('Could not connect to the server. Displaying offline data.');
        console.error('Failed to sync customers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [isLoaded]);

  // Client-side search effect
  useEffect(() => {
    const results = customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredCustomers(results);
  }, [searchTerm, customers]);

  const handleAddCustomer = async (customerData) => {
    try {
      const localId = crypto.randomUUID();
      // Optimistically add to the local database
      await db.customers.add(sanitizeForDb({
        _id: localId,
        ...customerData,
        syncStatus: 'pending',
      }));

      // Add a job to the sync queue
      await db.syncQueue.add({
        entity: 'customers',
        action: 'create',
        entityId: localId,
        payload: { _id: localId, ...customerData },
        tempId: localId,
        timestamp: new Date().toISOString(),
      });

      // Wait for sync queue to process this item (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        const pending = await db.syncQueue.where('entityId').equals(localId).toArray();
        if (pending.length === 0) {
          console.log('[CustomersPage] Customer sync completed successfully');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
        attempts++;
      }

      // Update UI
      const updatedCustomers = await db.customers.toArray();
      setCustomers(updatedCustomers);
      setShowAddForm(false);
    } catch (err) {
      setError('Failed to save customer locally. They may already exist.');
      console.error('Add customer error:', err);
    }
  };

  const handleDeleteCustomer = async (customerId) => {
      if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        // Optimistically delete from the local database (delete by _id index)
        await db.customers.where('_id').equals(String(customerId)).delete();
        // Add a job to the sync queue
        await db.syncQueue.add({
          entity: 'customers',
          entityId: customerId,
          action: 'delete',
          timestamp: new Date().toISOString(),
        });
        // Update UI
        setCustomers(customers.filter(c => c._id !== customerId));
      } catch (err) {
        setError('Failed to delete customer locally.');
      }
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = 'Customer-List';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const handleDownloadCSV = () => {
    // Prepare CSV headers
    const headers = ['Name', 'Email', 'Phone', 'Created Date'];
    
    // Prepare CSV rows
    const rows = customers.map(customer => [
      customer.name || '',
      customer.email || '',
      customer.phone || '',
      customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : ''
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const inputBg = theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900';
  const focusRing = 'focus:border-red-500 focus:ring-red-500';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const pagedCustomers = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // If filter changes and current page is out of range, clamp it
  useEffect(() => {
    if (currentPage > totalPages) {
      setSearchParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, setSearchParams]);

  if (loading) return <div className={`p-8 text-center ${textColor}`}>Loading customers...</div>;
  if (error) return <div className={`p-8 text-center text-red-500`}>{error}</div>;

  return (
    <div className="px-0 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className={`mb-4 sm:mb-6 md:mb-8 mx-3 sm:mx-0 p-4 sm:p-6 md:p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${textColor}`}>
              <span className="inline-flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Customer Management
              </span>
            </h1>
            <p className={`text-lg ${secondaryTextColor}`}>
              Build relationships and track your client base
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!showAddForm && customers.length > 0 && (
              <>
                <Button onClick={handlePrint} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </span>
                </Button>
                <Button onClick={handleDownloadCSV} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </span>
                </Button>
              </>
            )}
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="primary" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  Add Customer
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {!showAddForm && customers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
          <div className={`p-4 sm:p-5 md:p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Total Customers</p>
                <p className={`text-3xl font-bold ${textColor}`}>{customers.length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 sm:p-5 md:p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>With Email</p>
                <p className={`text-3xl font-bold ${textColor}`}>{customers.filter(c => c.email).length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 sm:p-5 md:p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>With Phone</p>
                <p className={`text-3xl font-bold ${textColor}`}>{customers.filter(c => c.phone).length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddForm && <AddCustomerForm onAdd={handleAddCustomer} onCancel={() => setShowAddForm(false)} theme={theme} />}

      {/* Search Box */}
      {customers.length > 0 && (
        <div className={`mb-6 p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
          <label className={`block text-sm font-semibold ${textColor} mb-3 flex items-center gap-2`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search Customers
          </label>
          <div className="relative">
            <svg className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${secondaryTextColor}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-12 pr-12 py-3 border rounded-xl shadow-sm text-base ${inputBg} ${focusRing} transition-all duration-200`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className={`absolute right-4 top-1/2 -translate-y-1/2 ${secondaryTextColor} hover:${textColor} transition-colors`}
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          {searchTerm && (
            <div className={`flex items-center gap-2 mt-3 text-sm ${secondaryTextColor}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Found <span className="font-semibold">{filteredCustomers.length}</span> customer{filteredCustomers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Customer Cards */}
      <div className="space-y-4">
        {pagedCustomers.length > 0 ? (
          <>
            <div className={`mb-4 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
              <p className={`text-sm ${secondaryTextColor}`}>
                Showing <span className="font-semibold">{pagedCustomers.length}</span> of <span className="font-semibold">{filteredCustomers.length}</span> customer{filteredCustomers.length !== 1 ? 's' : ''}
              </p>
            </div>
            {pagedCustomers.map((customer) => (
              <div key={customer._id} className={`p-6 border rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'}`}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <Link to={`/customers/${customer._id}`} className={`font-bold text-2xl hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                        {customer.name}
                      </Link>
                    </div>
                    
                    <div className="space-y-2">
                      {customer.email && (
                        <div className={`flex items-center gap-2 ${secondaryTextColor}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
                        </div>
                      )}
                      {customer.phone && (
                        <div className={`flex items-center gap-2 ${secondaryTextColor}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                        </div>
                      )}
                      {!customer.email && !customer.phone && (
                        <p className={`text-sm italic ${secondaryTextColor}`}>No contact information</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Link to={`/customers/${customer._id}`}>
                      <Button variant="secondary" size="sm">
                        <span className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </span>
                      </Button>
                    </Link>
                    <Button onClick={() => handleDeleteCustomer(customer._id)} variant="danger" size="sm">
                      <span className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className={`text-center py-16 px-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold mb-2 ${textColor}`}>No Customers Yet</h3>
            <p className={`mb-6 max-w-md mx-auto ${secondaryTextColor}`}>
              {searchTerm ? 'No customers match your search. Try different keywords.' : 'Start building your customer base by adding your first customer.'}
            </p>
            {!searchTerm && !showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="primary">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  Add Your First Customer
                </span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setSearchParams({ page: String(Math.max(1, currentPage - 1)) })}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Prev
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setSearchParams({ page: String(page) })}
                className={`px-3 py-1 rounded ${page === currentPage ? (theme === 'dark' ? 'bg-red-400 text-gray-900' : 'bg-red-500 text-white') : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200')}`}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => setSearchParams({ page: String(Math.min(totalPages, currentPage + 1)) })}
            disabled={currentPage === totalPages}
            className={`px-3 py-1 rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}