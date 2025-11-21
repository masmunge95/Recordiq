import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { getMyInvoices } from '../services/portalService';
import { useTheme } from '../context/ThemeContext';
import OcrUploader from '../components/OcrUploader';
import Button from '../components/Button';
import AddRecordForm from '../components/AddRecordForm'; // Import the reusable form

const CustomerAddRecordForm = ({ onAdd, onCancel, theme }) => {
  const [recordType, setRecordType] = useState('payment');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ type: recordType, description, amount, invoiceNumber });
  };

  return (
    <form onSubmit={handleSubmit} className={`p-4 my-4 border rounded-lg ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Add Record Manually</h3>
      <div className="space-y-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Record Type</label>
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
            <option value="payment">Proof of Payment</option>
            <option value="utility">Utility Reading</option>
          </select>
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Invoice Number (Optional)</label>
          <input type="text" placeholder="e.g., INV-1001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
          <input type="text" placeholder="e.g., Payment for Invoice #123" value={description} onChange={(e) => setDescription(e.target.value)} required className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{recordType === 'utility' ? 'Reading Value' : 'Amount'}</label>
          <input type="text" placeholder={recordType === 'utility' ? 'e.g., 12345 kWh' : 'e.g., 50.00'} value={amount} onChange={(e) => setAmount(e.target.value)} required className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        </div>
      </div>
      <div className="flex justify-end gap-4 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Submit for Review</Button>
      </div>
    </form>
  );
};

const CustomerDashboardPage = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  const { isLoaded } = useAuth();
  const [invoices, setInvoices] = useState([]); // To hold invoices for this customer
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ocrData, setOcrData] = useState({}); // Use the same state structure as RecordsPage

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const data = await getMyInvoices();
        // Ensure data is an array before setting state
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching invoices:', err);
        setError('Failed to load your invoices. Please try again later.');
        setInvoices([]); // Set to empty array on error
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [user, isLoaded]);

  const handleOcrComplete = (result) => { // This now mirrors the seller's page
    console.log('Customer OCR Data:', result);
    setOcrData({ data: result.data, documentType: result.documentType });
    setShowAddForm(true); // Set to true to show the AddRecordForm
  };

  const handleAddRecord = (recordData) => {
    // This function will now be used by AddRecordForm
    // TODO: Implement logic to save the record (e.g., call createRecord service)
    console.log('Record Data to be submitted:', recordData);
    alert('Record submitted for review!');
    setShowAddForm(false);
    setOcrData({}); // Clear the OCR data
  }

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className={`mb-8 p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <h1 className={`text-4xl font-bold ${textColor} mb-2`}>
          <span className="inline-flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Welcome, {user?.firstName || 'Customer'}!
          </span>
        </h1>
        <p className={`text-lg ${secondaryTextColor}`}>Manage your invoices and upload documents for review</p>
      </div>

      <div className="flex justify-end mb-4">
        {!showAddForm && ( // Only show manual add button if the form isn't already open
          <Button onClick={() => setShowAddForm(true)} variant="primary">
            Add Record Manually
          </Button>
        )}
      </div>

      {showAddForm && ( // This now renders the main, reusable form
        <AddRecordForm onAddRecord={handleAddRecord} onCancel={() => setShowAddForm(false)} initialData={ocrData} />
      )}

      {!showAddForm && <OcrUploader onOcrComplete={handleOcrComplete} userRole="customer" />}

      {/* Invoices Section */}
      <div className={`mt-8 p-6 rounded-xl shadow-md backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
        <h2 className={`text-2xl font-semibold ${textColor} mb-6 flex items-center gap-2`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          My Invoices
        </h2>

        {loading ? (
          <div className={`text-center py-12 ${secondaryTextColor}`}>Loading your invoices...</div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-lg">{error}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold ${textColor} mb-2`}>No Invoices Yet</h3>
            <p className={`text-lg ${secondaryTextColor}`}>Your invoices will appear here when they're created</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <Link
                key={invoice._id}
                to={`/invoices/${invoice._id}`}
                className={`block p-6 rounded-lg shadow-md border transition-all hover:shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700/70'
                    : 'bg-white border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`text-xl font-semibold ${textColor} mb-1`}>
                        Invoice #{invoice.invoiceNumber}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className={`text-sm ${secondaryTextColor}`}>
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${
                        invoice.status === 'paid'
                          ? theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800'
                          : invoice.status === 'sent' || invoice.status === 'pending'
                          ? theme === 'dark' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                          : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status === 'paid' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        )}
                        {invoice.status === 'sent' ? 'Pending' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'} mb-2`}>
                      KSH {(Number(invoice.total) || 0).toFixed(2)}
                    </p>
                    <Button variant="primary" size="sm">
                      <span className="flex items-center gap-1">
                        View Details
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboardPage;