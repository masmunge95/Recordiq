import React, { useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import { syncWithServer } from './services/syncService';
import db from './db';
import { useSession } from '@clerk/clerk-react';

// Import the new and renamed pages
import DashboardPage from './pages/DashboardPage';
import RecordsPage from './pages/RecordsPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import CustomerDashboardPage from './pages/CustomerDashboardPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import UtilityServicesPage from './pages/UtilityServicesPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SubscriptionPage from './pages/SubscriptionPage';

const AppLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

const PrivateRoute = ({ children }) => {
  const { isLoaded, session } = useSession();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  // Periodically sync the queue with the server (every 5 seconds)
  useEffect(() => {
    let isMounted = true;
    
    const syncInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const pendingCount = await db.syncQueue.count();
        if (pendingCount > 0) {
          console.log(`[App] Triggering sync for ${pendingCount} pending items.`);
          await syncWithServer();
        }
      } catch (error) {
        console.error('[App] Sync error (non-blocking):', error);
        // Don't rethrow - we want sync errors to not crash the app
      }
    }, 5000); // Sync every 5 seconds if there are pending items

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, []);

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/sign-in" element={<Navigate to="/" />} />
          <Route path="/sign-up" element={<Navigate to="/" />} />
          
          <Route path="records" element={<PrivateRoute><RecordsPage /></PrivateRoute>} />
          <Route path="invoices" element={<PrivateRoute><InvoicesPage /></PrivateRoute>} />
          <Route path="invoices/:id" element={<PrivateRoute><InvoiceDetailPage /></PrivateRoute>} />
          <Route path="customers" element={<PrivateRoute><CustomersPage /></PrivateRoute>} />
          <Route path="customers/:id" element={<PrivateRoute><CustomerDetailPage /></PrivateRoute>} />
          <Route path="customer-dashboard" element={<PrivateRoute><CustomerDashboardPage /></PrivateRoute>} />
          <Route path="seller-dashboard" element={<PrivateRoute><SellerDashboardPage /></PrivateRoute>} />
          <Route path="select-role" element={<PrivateRoute><RoleSelectionPage /></PrivateRoute>} />
          <Route path="subscription" element={<PrivateRoute><SubscriptionPage /></PrivateRoute>} />

          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="services" element={<UtilityServicesPage />} />
          <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App;
