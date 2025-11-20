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
        setInvoices(data);
      } catch (err) {
        setError('Failed to load your invoices. Please try again later.');
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={`mb-8 p-6 rounded-lg shadow-md ${cardBg}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>
          Welcome, {user?.firstName || 'Customer'}!
        </h1>
        <h2 className={`text-2xl font-semibold mt-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
          Your Dashboard
        </h2>
        <p className={`mt-2 text-md ${secondaryTextColor}`}>
          Here you can view your outstanding invoices and make payments. You can also upload documents for review.
        </p>
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

      {!showAddForm && <OcrUploader onOcrComplete={handleOcrComplete} />}

      <div className="mt-8">
        <h2 className={`text-2xl font-bold ${textColor}`}>My Invoices</h2>
        <div className="space-y-4 mt-4">
          {loading ? (
            <p className={secondaryTextColor}>Loading your invoices...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : invoices.length > 0 ? (
            invoices.map(invoice => (
              <div key={invoice._id} className={`p-4 border rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${cardBg}`}>
                <div className="flex-grow">
                  <Link to={`/invoices/${invoice._id}`} className={`font-bold text-lg hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                    Invoice {invoice.invoiceNumber}
                  </Link>
                  <p className={secondaryTextColor}>Due: {new Date(invoice.dueDate).toLocaleDateString()} - <span className="font-medium">${(Number(invoice.total) || 0).toFixed(2)}</span></p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{invoice.status === 'sent' ? 'pending' : invoice.status}</div>
              </div>
            ))
          ) : (
            <p className={`text-center py-8 ${secondaryTextColor}`}>You have no invoices at the moment.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboardPage;