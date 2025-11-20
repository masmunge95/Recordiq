import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getCustomers } from '../services/customerService';
import { useUser } from '@clerk/clerk-react';

const AddRecordForm = ({ onAddRecord, onCancel, initialData = {} }) => {
  const { user } = useUser();
  const { theme } = useTheme();
  const [recordType, setRecordType] = useState(initialData.documentType || 'receipt');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerAddress, setCustomerAddress] = useState({ apartment: '', county: '' });
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [items, setItems] = useState([]);
  const [fees, setFees] = useState([]);
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [promotions, setPromotions] = useState('');
  // State for utility bills
  const [utilityProvider, setUtilityProvider] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [utilityAmountDue, setUtilityAmountDue] = useState('');
  const [utilityDueDate, setUtilityDueDate] = useState('');
  const [meterReading, setMeterReading] = useState('');
  const [modelSpecs, setModelSpecs] = useState(null); // New state for model specs
  const [utilityType, setUtilityType] = useState('electricity');
  const [customUtilityType, setCustomUtilityType] = useState('');
  const [image, setImage] = useState(null);
  const [customers, setCustomers] = useState([]);

  // Determine if the current user is a seller to conditionally show UI elements
  const isSeller = user?.publicMetadata?.role === 'seller';

  useEffect(() => {
    const fetchCustomers = async () => {
      const data = await getCustomers();
      setCustomers(data);
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (initialData.data) {
      const ocrData = initialData.data;
      const docType = initialData.documentType || 'receipt';
      setRecordType(docType);

      if (docType === 'utility') {
        // Correctly map the new utility meter data structure
        setUtilityProvider(ocrData.manufacturer || '');
        setAccountNumber(ocrData.serialNumber || '');
        setUtilityAmountDue(''); // Decouple from mainReading; user should enter this.
        setModelSpecs(ocrData.modelSpecs || null); // Capture the model specs
        setMeterReading(ocrData.mainReading || ''); // Also use mainReading for the meter reading field

        // Set a default date since meter readings don't have one
        if (!ocrData.dueDate) {
          const date = new Date();
          if (!isNaN(date.getTime())) {
            setUtilityDueDate(date.toISOString().split('T')[0]);
          }
        }
      } else { // Handle receipt/invoice
        setBusinessName(ocrData.businessName || '');
        setBusinessAddress(ocrData.businessAddress || '');
        setInvoiceId(ocrData.invoiceNo || '');
        setPaymentMethod(ocrData.paymentMethod || '');
        setPromotions(ocrData.promotions || '');

        if (ocrData.invoiceDate) {
          const date = new Date(ocrData.invoiceDate);
          if (!isNaN(date.getTime())) {
            setInvoiceDate(date.toISOString().split('T')[0]);
          }
        }

        const initialItems = ocrData.items || [];
        const initialFees = ocrData.fees || [];
        const initialTax = ocrData.tax || 0;
        setItems(initialItems);
        setFees(initialFees);
        setTax(initialTax);

        const newSubtotal = initialItems.reduce((acc, item) => acc + parseFloat(item.totalPrice || 0), 0);
        const feesTotal = initialFees.reduce((acc, fee) => acc + parseFloat(fee.amount || 0), 0);
        const newTotal = newSubtotal + feesTotal + parseFloat(initialTax);
        setSubtotal(newSubtotal.toFixed(2));
        setTotal(newTotal.toFixed(2));
      }
      // Map deliveryDetails from OCR to customerAddress state
      setCustomerAddress({ apartment: ocrData.deliveryDetails?.Apartment || '', county: ocrData.deliveryDetails?.['Delivery Area'] || '' });
    }
  }, [initialData]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // When quantity or unit price changes, automatically update the item's total price.
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = parseFloat(newItems[index].quantity || 0);
      const unitPrice = parseFloat(newItems[index].unitPrice || 0);
      newItems[index].totalPrice = (quantity * unitPrice).toFixed(2);
    }

    setItems(newItems);
  };

  const handleFeeChange = (index, field, value) => {
    const newFees = [...fees];
    newFees[index][field] = value;
    setFees(newFees);
  };

  const handleAddItem = () => {
    setItems([...items, { sku: '', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const handleCustomerAddressChange = (field, value) => {
    setCustomerAddress(prevState => ({
      ...prevState,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // This should now call a function to create an INVOICE, not a generic record.
    const formData = new FormData();
    formData.append('recordType', recordType);
    formData.append('customerId', customerId);
    formData.append('recordDate', invoiceDate);
    if (image) {
      formData.append('image', image);
    }

    if (recordType === 'utility') {
      formData.append('type', 'expense');
      formData.append('amount', parseFloat(utilityAmountDue || 0));
      formData.append('description', `Utility Bill from ${utilityProvider} - Acct: ${accountNumber}`);
      const ocrPayload = { manufacturer: utilityProvider, serialNumber: accountNumber, mainReading: utilityAmountDue, dueDate: utilityDueDate, usage: meterReading };
      formData.append('ocrData', JSON.stringify(ocrPayload));
      formData.append('modelSpecs', JSON.stringify(modelSpecs));
    } else {
      formData.append('type', 'sale'); // Assuming receipts/invoices are sales
      formData.append('amount', parseFloat(total || 0));
      formData.append('description', `Invoice/Receipt from ${businessName || 'N/A'}`);
      // Now we can send the full structured data!
      const ocrPayload = { items, fees, subtotal, total, businessName, businessAddress, paymentMethod, promotions };
      formData.append('ocrData', JSON.stringify(ocrPayload));
    }

    // The onAddRecord function expects formData for file uploads
    onAddRecord(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={`p-4 border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Add New Record</h2>

      {/* Conditionally render the Record Type selector */}
      {initialData.documentType !== 'utility' && (
        <div className="mb-4">
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Record Type</label>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          >
            <option value="receipt">Receipt</option>
            <option value="invoice">Invoice</option>
            <option value="utility">Utility Reading</option>
          </select>
        </div>
      )}

      {/* Customer Details */}
      {isSeller && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
            required
          >
            <option value="">Select a customer</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>
                {customer.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Apartment" value={customerAddress.apartment} onChange={(e) => handleCustomerAddressChange('apartment', e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
            <input type="text" placeholder="County" value={customerAddress.county} onChange={(e) => handleCustomerAddressChange('county', e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          </div>
        </div>
      )}

      {/* Invoice Details */}
      {recordType === 'utility' ? (
        <div className="space-y-4 mb-4">
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Provider Name</label>
            <input type="text" placeholder="e.g., Power & Light Co." value={utilityProvider} onChange={(e) => setUtilityProvider(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          </div>
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Account Number</label>
            <input type="text" placeholder="e.g., 123456789" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          </div>
          {isSeller && (
            <div>
              <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Amount Due</label>
              <input type="number" step="0.01" placeholder="e.g., 75.50" value={utilityAmountDue} onChange={(e) => setUtilityAmountDue(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
            </div>
          )}
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Due Date</label>
            <input type="date" value={utilityDueDate} onChange={(e) => setUtilityDueDate(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          </div>
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Meter Reading</label>
            <input type="text" placeholder="Enter meter reading" value={meterReading} onChange={(e) => setMeterReading(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          </div>
          {modelSpecs && (
            <div className={`p-3 mt-4 border rounded-lg ${theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
              <h4 className={`text-md font-semibold mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>Device Specifications</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {modelSpecs.q3 && <p><span className="font-medium">Q3:</span> {modelSpecs.q3}</p>}
                {modelSpecs.q3_q1_ratio && <p><span className="font-medium">Q3/Q1 Ratio:</span> {modelSpecs.q3_q1_ratio}</p>}
                {modelSpecs.pn && <p><span className="font-medium">PN:</span> {modelSpecs.pn}</p>}
                {modelSpecs.class && <p><span className="font-medium">Class:</span> {modelSpecs.class}</p>}
                {initialData.data.standard && <p><span className="font-medium">Standard:</span> {initialData.data.standard}</p>}
                {modelSpecs.multipliers && modelSpecs.multipliers.length > 0 && (
                  <p className="col-span-2"><span className="font-medium">Multipliers:</span> {modelSpecs.multipliers.join(', ')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input type="text" placeholder="Invoice #" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
            <input type="date" placeholder="Invoice Date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          </div>
          {/* Business Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input type="text" placeholder="Business Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
            <input type="text" placeholder="Business Address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          </div>

          {/* Items Table */}
          <div className="mb-4">
            <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Items</h3>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Description</th>
                  <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Quantity</th>
                  <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Unit Price</th>
                  <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><input type="text" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} /></td>
                    <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><input type="text" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} /></td>
                    <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><input type="text" value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} /></td>
                    <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><input type="text" value={item.totalPrice} readOnly className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-2">
              <button type="button" onClick={handleAddItem} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
                + Add Item
              </button>
            </div>
          </div>

          {/* Fees Section */}
          {fees.length > 0 && (
            <div className="mb-4">
              <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Fees & Charges</h3>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Description</th>
                    <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((fee, index) => (
                    <tr key={index}>
                      <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <input type="text" value={fee.description} onChange={(e) => handleFeeChange(index, 'description', e.target.value)} className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
                      </td>
                      <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <input type="text" value={fee.amount} onChange={(e) => handleFeeChange(index, 'amount', e.target.value)} className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Subtotal</label>
              <input type="text" placeholder="Subtotal" value={subtotal} readOnly className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`} />
            </div>
            <div>
              <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Tax</label>
              <input type="text" placeholder="Tax" value={tax} onChange={(e) => setTax(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
            </div>
            <div>
              <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Total</label>
              <input type="text" placeholder="Total" value={total} readOnly className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`} />
            </div>
          </div>

          {/* Payment and Promotions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Payment Method</label>
              <input type="text" placeholder="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
            </div>
            <div>
              <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Promotions / Discounts</label>
              <input type="text" placeholder="Promotions / Discounts" value={promotions} onChange={(e) => setPromotions(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
            </div>
          </div>
        </>
      )}

      <div className="mb-4">
        <label className={`block mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Image</label>
        <input
          type="file"
          onChange={(e) => setImage(e.target.files[0])}
          className={`w-full p-2 border rounded text-sm ${theme === 'dark' ? 'text-gray-300 border-gray-600 bg-gray-700' : 'text-gray-500 border-gray-300 bg-gray-50'}`}
        />
      </div>
      <div className="flex justify-start sm:justify-end flex-wrap gap-4">
        <button type="button" onClick={onCancel} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
          Cancel
        </button>
        <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
          Add Record
        </button>
      </div>
    </form>
  );
};

export default AddRecordForm;
