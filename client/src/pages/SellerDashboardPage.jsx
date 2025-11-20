import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import db from '../db';

const SellerDashboardPage = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  const [stats, setStats] = useState({ totalInvoices: 0, sentInvoices: 0, paidInvoices: 0, totalRevenue: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBgColor = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Fetch all invoices for this seller
        const allInvoices = await db.invoices.toArray();
        
        // Calculate stats
        const totalInvoices = allInvoices.length;
        const sentInvoices = allInvoices.filter(inv => inv.status === 'sent').length;
        const paidInvoices = allInvoices.filter(inv => inv.status === 'paid').length;
        const totalRevenue = allInvoices
          .filter(inv => inv.status === 'paid')
          .reduce((sum, inv) => sum + (inv.total || 0), 0);

        setStats({
          totalInvoices,
          sentInvoices,
          paidInvoices,
          totalRevenue,
        });

        // Get recent invoices (last 5)
        const recent = allInvoices
          .sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0))
          .slice(0, 5);
        setRecentInvoices(recent);

        // Get top customers by invoice count
        const customerMap = {};
        allInvoices.forEach(inv => {
          const customerId = inv.customerId || inv.customer;
          if (!customerMap[customerId]) {
            customerMap[customerId] = {
              customerId,
              customerName: inv.customerName || 'Unknown',
              count: 0,
              totalAmount: 0,
            };
          }
          customerMap[customerId].count += 1;
          customerMap[customerId].totalAmount += inv.total || 0;
        });

        const topCustomersList = Object.values(customerMap)
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .slice(0, 5);

        setTopCustomers(topCustomersList);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const StatCard = ({ label, value, color = 'red' }) => (
    <div className={`p-4 rounded-lg shadow-md ${cardBgColor} border ${borderColor}`}>
      <p className={`text-sm font-medium ${secondaryTextColor}`}>{label}</p>
      <p className={`text-2xl font-bold ${color === 'red' ? 'text-red-600' : 'text-green-600'} mt-2`}>{value}</p>
    </div>
  );

  if (loading) {
    return <div className={`p-8 text-center ${textColor}`}>Loading dashboard...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Welcome Banner */}
      <div className={`mb-8 p-6 rounded-lg shadow-md ${cardBgColor} border ${borderColor}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>Welcome back, {user?.firstName || 'Seller'}!</h1>
        <p className={`mt-2 text-lg ${secondaryTextColor}`}>Here's a quick overview of your business performance.</p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Invoices" value={stats.totalInvoices} />
        <StatCard label="Sent Invoices" value={stats.sentInvoices} />
        <StatCard label="Paid Invoices" value={stats.paidInvoices} />
        <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Recent Invoices */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-6 rounded-lg shadow-md ${cardBgColor} border ${borderColor}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-2xl font-semibold ${textColor}`}>Recent Invoices</h2>
              <Link to="/invoices">
                <Button variant="secondary" size="sm">View All</Button>
              </Link>
            </div>

            {recentInvoices.length > 0 ? (
              <div className="flow-root">
                <ul className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {recentInvoices.map(invoice => (
                    <li key={invoice._id} className="py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1">
                          <Link
                            to={`/invoices/${invoice._id}`}
                            className={`text-sm font-medium ${theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} transition-colors`}
                          >
                            Invoice {invoice.invoiceNumber}
                          </Link>
                          <p className={`text-sm ${secondaryTextColor} truncate`}>{invoice.customerName || 'Unknown Customer'}</p>
                        </div>
                        <div className="flex justify-between sm:justify-end items-center gap-4">
                          <div className={`text-sm font-semibold ${textColor}`}>
                            ${(invoice.total || 0).toFixed(2)}
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                              : invoice.status === 'sent'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {invoice.status?.charAt(0).toUpperCase() + invoice.status?.slice(1) || 'Draft'}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={`text-center ${secondaryTextColor} py-8`}>No invoices yet. Create your first invoice!</p>
            )}
          </div>
        </div>

        {/* Right column - Quick Actions & Top Customers */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className={`p-6 rounded-lg shadow-md ${cardBgColor} border ${borderColor}`}>
            <h2 className={`text-2xl font-semibold ${textColor} mb-4`}>Quick Actions</h2>
            <div className="space-y-3">
              <Link to="/invoices">
                <Button variant="primary" className="w-full">Create Invoice</Button>
              </Link>
              <Link to="/customers">
                <Button variant="secondary" className="w-full">Manage Customers</Button>
              </Link>
              <Link to="/records">
                <Button variant="secondary" className="w-full">View Records</Button>
              </Link>
            </div>
          </div>

          {/* Top Customers */}
          <div className={`p-6 rounded-lg shadow-md ${cardBgColor} border ${borderColor}`}>
            <h2 className={`text-2xl font-semibold ${textColor} mb-4`}>Top Customers</h2>
            {topCustomers.length > 0 ? (
              <ul className={`space-y-3 ${secondaryTextColor}`}>
                {topCustomers.map((customer, idx) => (
                  <li key={customer.customerId} className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${textColor}`}>{idx + 1}. {customer.customerName}</p>
                      <p className="text-xs">{customer.count} invoice{customer.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-sm font-semibold ${textColor}`}>${customer.totalAmount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-center ${secondaryTextColor} py-4 text-sm`}>No customer data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboardPage;
