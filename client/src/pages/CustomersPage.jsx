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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={`mb-8 p-6 rounded-lg shadow-md ${cardBg}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>Welcome back, {user?.firstName || 'User'}!</h1>
        <h2 className={`text-2xl font-semibold mt-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>Customer Management</h2>
        <p className={`mt-2 text-md ${secondaryTextColor}`}>Here you can view, add, and manage your customer list.</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <h2 className={`text-2xl font-bold ${textColor}`}>All Customers</h2>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} variant="primary">Add Customer</Button>
        )}
      </div>

      {showAddForm && <AddCustomerForm onAdd={handleAddCustomer} onCancel={() => setShowAddForm(false)} theme={theme} />}

      <div className={`mb-6 p-4 rounded-lg border ${cardBg}`}>
        <label className={`block text-sm font-medium ${secondaryTextColor} mb-2`}>Search Customers</label>
        <div className="relative">
          <svg className={`absolute left-3 top-3 w-5 h-5 ${secondaryTextColor}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg shadow-sm sm:text-sm ${inputBg} ${focusRing} transition-all duration-200`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className={`absolute right-3 top-3 text-gray-400 hover:${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {searchTerm && (
          <p className={`text-sm mt-2 ${secondaryTextColor}`}>
            Found {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="space-y-4 mt-6">
        {pagedCustomers.length > 0 ? pagedCustomers.map((customer) => (
          <div key={customer._id} className={`p-4 border rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${cardBg}`}>
            <div className="flex-grow">
              <Link to={`/customers/${customer._id}`} className={`font-bold text-lg hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                {customer.name}
              </Link>
              <p className={secondaryTextColor}>{customer.email || 'No email'}</p>
              <p className={secondaryTextColor}>{customer.phone || 'No phone'}</p>
            </div>
            <Button onClick={() => handleDeleteCustomer(customer._id)} variant="danger" size="sm">Delete</Button>
          </div>
        )) : <p className={`text-center py-8 ${secondaryTextColor}`}>No customers found.</p>}
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