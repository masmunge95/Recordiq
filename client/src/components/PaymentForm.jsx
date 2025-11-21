import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import Button from './Button';

const PaymentForm = ({ invoice, onPayment, onCancel, loading }) => {
  const { theme } = useTheme();
  const [name, setName] = useState(invoice.customerName || '');
  const [email, setEmail] = useState(invoice.customer?.email || '');
  const [phone, setPhone] = useState(invoice.customer?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('mpesa'); // 'mpesa' or 'card'

  const handleSubmit = (e) => {
    e.preventDefault();
    onPayment({ name, email, phone, paymentMethod });
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const inputBg = theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100';
  const inputBorder = theme === 'dark' ? 'border-gray-600' : 'border-gray-300';

  return (
    <div className="fixed inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`p-8 rounded-lg shadow-lg w-full max-w-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-2xl font-bold mb-6 ${textColor}`}>Enter Payment Details</h2>
        <form onSubmit={handleSubmit}>
          {/* Payment Method Selection */}
          <div className="mb-6">
            <label className={`block mb-2 ${textColor}`}>Payment Method</label>
            <div className="flex gap-4">
              <label className={`flex items-center cursor-pointer ${textColor}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="mpesa"
                  checked={paymentMethod === 'mpesa'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mr-2"
                />
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                M-Pesa
              </label>
              <label className={`flex items-center cursor-pointer ${textColor}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mr-2"
                />
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Card
              </label>
            </div>
          </div>

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
          {paymentMethod === 'mpesa' && (
            <div className="mb-4">
              <label htmlFor="phone" className={`block mb-2 ${textColor}`}>Phone Number (M-Pesa)</label>
              <input
                type="text"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full p-2 rounded ${inputBg} ${inputBorder}`}
                placeholder="e.g., 254712345678"
                required
              />
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Format: 254XXXXXXXXX
              </p>
            </div>
          )}
          {paymentMethod === 'card' && (
            <div className={`mb-4 p-3 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'}`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                ℹ️ You'll be redirected to a secure payment page to enter your card details.
              </p>
            </div>
          )}

          {/* IntaSend Trust Badge */}
          <div className="mb-4 text-center">
            <a 
              href="https://intasend.com/security" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img 
                src={theme === 'dark' 
                  ? "https://intasend-prod-static.s3.amazonaws.com/img/trust-badges/intasend-trust-badge-with-mpesa-hr-dark.png"
                  : "https://intasend-prod-static.s3.amazonaws.com/img/trust-badges/intasend-trust-badge-with-mpesa-hr-light.png"
                }
                alt="IntaSend Secure Payments (PCI-DSS Compliant)"
                className="w-full max-w-[280px] h-auto mx-auto"
              />
            </a>
            <a 
              href="https://intasend.com/security" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`block text-xs mt-2 no-underline hover:underline ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Secured by IntaSend Payments
            </a>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button type="button" onClick={onCancel} variant="secondary">Cancel</Button>
            <Button type="submit" disabled={loading} variant="primary">
              {loading ? 'Processing...' : `Pay KES ${(Number(invoice.total) || 0).toFixed(2)}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;