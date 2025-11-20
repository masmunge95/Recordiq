import React, { useRef } from 'react';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '../context/ThemeContext';

/**
 * A layout component that wraps page content with a standard Header and Footer.
 */
export default function Layout({ children }) { 
    const { theme } = useTheme();
    const scrollTargetRef = useRef(null);

    return (
        <div className={`min-h-screen flex flex-col scroll-smooth ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
            <Header />
            <main className="flex-grow container mx-auto px-4 py-8 mt-16 scroll-mt-20">
                {children}
            </main>
            <Footer />
        </div>
    );
}