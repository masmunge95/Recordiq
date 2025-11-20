import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import Button from './Button';

const PaymentForm = ({ invoice, onPayment, onCancel, loading }) => {
  const { theme } = useTheme();
  const [name, setName] = useState(invoice.customerName || '');
  const [email, setEmail] = useState(invoice.customer?.email || '');
  const [phone, setPhone] = useState(invoice.customer?.phone || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onPayment({ name, email, phone });
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const inputBg = theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100';
  const inputBorder = theme === 'dark' ? 'border-gray-600' : 'border-gray-300';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`p-8 rounded-lg shadow-lg w-full max-w-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-2xl font-bold mb-6 ${textColor}`}>Enter Payment Details</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className={`block mb-2 ${textColor}`}>Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full p-2 rounded ${inputBg} ${inputBorder}`}
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="email" className={`block mb-2 ${textColor}`}>Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-2 rounded ${inputBg} ${inputBorder}`}
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="phone" className={`block mb-2 ${textColor}`}>Phone Number (for M-Pesa)</label>
            <input
              type="text"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full p-2 rounded ${inputBg} ${inputBorder}`}
              required
            />
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <Button type="button" onClick={onCancel} variant="secondary">Cancel</Button>
            <Button type="submit" disabled={loading} variant="primary">
              {loading ? 'Processing...' : `Pay $${(Number(invoice.total) || 0).toFixed(2)}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
