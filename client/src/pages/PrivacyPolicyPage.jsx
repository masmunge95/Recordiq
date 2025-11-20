import React from 'react';
import { useTheme } from '../context/ThemeContext';

const PrivacyPolicyPage = () => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={`mb-8 p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>Privacy Policy</h1>
        <p className={`mt-4 text-lg ${secondaryTextColor}`}>
          Your privacy is important to us. It is Recordiq's policy to respect your privacy regarding any information we may collect from you across our website.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>1. Information We Collect</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>2. How We Use Your Information</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We use the information we collect in various ways, including to provide, operate, and maintain our website, improve, personalize, and expand our website, and understand and analyze how you use our website.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>3. Data Security</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We are committed to protecting your data. We use a variety of security measures to maintain the safety of your personal information, including encryption and secure server infrastructure.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>4. Cookies and Tracking Technologies</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We use cookies and similar tracking technologies to track the activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>5. Third-Party Services</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          Our service may contain links to other sites that are not operated by us. If you click on a third-party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>6. Your Data Protection Rights</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          You have certain data protection rights. We aim to take reasonable steps to allow you to correct, amend, delete, or limit the use of your Personal Data.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>7. Changes to This Policy</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>8. Contact Us</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@recordiq.com" className="text-red-500 hover:underline">privacy@recordiq.com</a>.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;