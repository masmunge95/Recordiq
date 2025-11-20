import React from 'react';
import { useTheme } from '../context/ThemeContext';

const AboutPage = () => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={`mb-8 p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>About Recordiq</h1>
        <p className={`mt-4 text-lg ${secondaryTextColor}`}>
          Recordiq is a powerful tool designed to help you manage your financial records with ease. From digitizing receipts with our state-of-the-art OCR technology to creating and tracking invoices, our goal is to streamline your workflow.
        </p>
        <p className={`mt-4 ${secondaryTextColor}`}>
          Whether you are a small business owner, a freelancer, or just someone looking to keep better track of personal expenses, Recordiq provides the features you need to stay organized and efficient.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Our Mission</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          Our mission is to empower individuals and businesses to take control of their finances through intuitive and powerful tools. We believe that financial management should be simple, accessible, and stress-free.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Our Vision</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We envision a world where everyone has the financial literacy and tools to achieve their goals. We are committed to building a platform that not only manages records but also provides insights to help you make smarter financial decisions.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Our Values</h2>
        <ul className={`mt-2 ${secondaryTextColor} list-disc list-inside`}>
          <li><strong>Customer-Centric:</strong> We put our users at the heart of everything we do.</li>
          <li><strong>Innovation:</strong> We constantly strive to improve and innovate our products.</li>
          <li><strong>Integrity:</strong> We are committed to the highest standards of privacy and security.</li>
          <li><strong>Simplicity:</strong> We believe in making complex tasks simple and intuitive.</li>
        </ul>
      </div>
    </div>
  );
};

export default AboutPage;