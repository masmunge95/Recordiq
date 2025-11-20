import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth, useUser } from '@clerk/clerk-react';
import Button from '../components/Button';
import db from '../db';
import { sanitizeForDb } from '../services/dbUtils';

const CustomerDetailPage = () => {
  const { id } = useParams();
  const { theme } = useTheme();
  const { isLoaded } = useAuth();
  const { user } = useUser();

  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!isLoaded) return;

    const fetchCustomerDetails = async () => {
      try {
        setLoading(true);

        // 1. Fetch customer from local DB by _id index
        const localCustomer = await db.customers.where('_id').equals(String(id)).first();
        if (localCustomer) {
          setCustomer(localCustomer);
          setFormData({ name: localCustomer.name || '', email: localCustomer.email || '', phone: localCustomer.phone || '' });
        }

        // 2. Fetch invoices for this customer
        const customerInvoices = await db.invoices
          .where('customerId')
          .equals(String(id))
          .toArray();
        setInvoices(customerInvoices.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)));

        setError(null);
      } catch (err) {
        console.error('Failed to fetch customer details:', err);
        setError('Failed to load customer details.');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerDetails();
  }, [id, isLoaded]);

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!customer) return;

    try {
      // Update in local DB
      const existing = await db.customers.where('_id').equals(String(id)).first();
      if (existing && existing.id !== undefined) {
        await db.customers.update(existing.id, { ...formData, syncStatus: 'pending' });
      } else {
        await db.customers.put({ _id: id, ...formData, syncStatus: 'pending' });
      }

      // Queue for server sync
      await db.syncQueue.add({
        entity: 'customers',
        action: 'update',
        entityId: id,
        payload: formData,
        timestamp: new Date().toISOString(),
      });

      // Reload customer data
      const updated = await db.customers.where('_id').equals(String(id)).first();
      setCustomer(updated);
      setEditMode(false);
    } catch (err) {
      setError('Failed to update customer.');
      console.error('Update error:', err);
    }
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const inputBg = theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const focusRing = 'focus:border-red-500 focus:ring-red-500';

  if (loading) return <div className={`p-8 text-center ${textColor}`}>Loading customer details...</div>;
  if (!customer) return (
    <div className="p-8 text-center">
      <p className={textColor}>Customer not found.</p>
      <Link to="/customers" className="text-red-600 dark:text-red-400 hover:underline mt-4">← Back to Customers</Link>
    </div>
  );

  return (
    <div className={`p-4 sm:p-6 lg:p-8 ${textColor}`}>
      <div className="mb-4">
        <Link to="/customers" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          ← Back to Customers
        </Link>
      </div>

      {error && <div className={`p-4 mb-6 bg-red-100 text-red-800 rounded-lg`}>{error}</div>}

      <div className={`p-6 rounded-lg shadow-md ${cardBg} mb-6`}>
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant="secondary">Edit</Button>
          )}
        </div>

        {editMode ? (
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className={`w-full p-2 border rounded ${inputBg} ${focusRing}`}
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full p-2 border rounded ${inputBg} ${focusRing}`}
              />
              <input
                type="tel"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full p-2 border rounded ${inputBg} ${focusRing}`}
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button type="button" variant="secondary" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className={secondaryTextColor}><strong>Email:</strong> {customer.email || 'N/A'}</p>
            <p className={secondaryTextColor}><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
            <p className={secondaryTextColor}><strong>Status:</strong> {customer.isActive ? 'Active' : 'Inactive'}</p>
          </div>
        )}
      </div>

      <div className={`p-6 rounded-lg shadow-md ${cardBg}`}>
        <h2 className="text-2xl font-bold mb-4">Invoice History</h2>
        {invoices.length > 0 ? (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <Link
                key={invoice._id}
                to={`/invoices/${invoice._id}`}
                className={`p-4 border rounded-lg flex justify-between items-center ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                <div className="flex-grow">
                  <p className="font-semibold">Invoice {invoice.invoiceNumber}</p>
                  <p className={secondaryTextColor}>Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${(Number(invoice.total) || 0).toFixed(2)}</p>
                  <p className={`text-sm ${
                    invoice.status === 'paid' ? 'text-green-600' :
                    invoice.status === 'sent' ? 'text-blue-600' :
                    'text-yellow-600'
                  }`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className={secondaryTextColor}>No invoices for this customer yet.</p>
        )}
      </div>
    </div>
  );
};

export default CustomerDetailPage;
