import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';

const RoleSelectionPage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = async (role) => {
    if (!user) return;

    setLoading(true);
    try {
      await user.update({
        unsafeMetadata: { ...user.publicMetadata, role },
      });
      // Redirect based on the newly selected role
      navigate(role === 'seller' ? '/records' : '/customer-dashboard');
    } catch (error) {
      console.error('Failed to update user role:', error);
      setLoading(false);
    }
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="p-4 sm:p-6 lg:p-8 text-center">
      <div className={`max-w-2xl mx-auto p-8 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>Complete Your Registration</h1>
        <p className={`mt-4 text-lg ${secondaryTextColor}`}>
          Welcome, {user?.firstName || 'User'}! To get started, please choose your account type.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button onClick={() => handleRoleSelect('seller')} size="lg" variant="primary" disabled={loading}>
            I want to be a Seller
          </Button>
          <Button onClick={() => handleRoleSelect('customer')} size="lg" variant="secondary" disabled={loading}>
            I want to be a Customer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionPage;