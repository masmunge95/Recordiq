import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ContactPage = () => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={`mb-8 p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>Contact Us</h1>
        <p className={`mt-4 text-lg ${secondaryTextColor}`}>
          Have questions or feedback? We'd love to hear from you.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div>
            <h2 className={`text-2xl font-semibold ${textColor}`}>Get in Touch</h2>
            <div className={`mt-4 ${secondaryTextColor}`}>
              <p><strong>Email:</strong> <a href="mailto:support@recordiq.com" className="text-red-500 hover:underline">support@recordiq.com</a></p>
              <p className="mt-2"><strong>Phone:</strong> +1 (800) 555-1234</p>
              <p className="mt-2"><strong>Address:</strong> 123 Innovation Drive, Tech City, 12345</p>
            </div>
            <div className="mt-6">
              <h3 className={`text-xl font-semibold ${textColor}`}>Follow Us</h3>
              <div className="flex space-x-4 mt-2">
                <a href="#" className="text-red-500 hover:underline">Facebook</a>
                <a href="#" className="text-red-500 hover:underline">Twitter</a>
                <a href="#" className="text-red-500 hover:underline">LinkedIn</a>
              </div>
            </div>
          </div>
          <div>
            <h2 className={`text-2xl font-semibold ${textColor}`}>Send us a Message</h2>
            <form className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className={`block text-sm font-medium ${secondaryTextColor}`}>Name</label>
                <input type="text" id="name" name="name" className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`} />
              </div>
              <div>
                <label htmlFor="email" className={`block text-sm font-medium ${secondaryTextColor}`}>Email</label>
                <input type="email" id="email" name="email" className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`} />
              </div>
              <div>
                <label htmlFor="message" className={`block text-sm font-medium ${secondaryTextColor}`}>Message</label>
                <textarea id="message" name="message" rows="4" className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}></textarea>
              </div>
              <div>
                <button type="submit" className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="mt-8">
          <h2 className={`text-2xl font-semibold ${textColor}`}>Our Location</h2>
          <div className={`mt-4 h-64 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
            {/* Placeholder for a map */}
            <p className={`text-center pt-24 ${secondaryTextColor}`}>Map placeholder</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;