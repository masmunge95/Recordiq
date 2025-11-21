import React, { useEffect } from 'react';
import { SignedIn, SignedOut, useSession, SignUpButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useTheme } from '../context/ThemeContext';

const FeatureCard = ({ icon, title, description }) => {
  const { theme } = useTheme();
  return (
    <div className={`w-full md:w-1/3 lg:max-w-sm rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-5 md:p-6 flex flex-col items-center text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
      <div className={`p-2 sm:p-3 rounded-full mb-3 sm:mb-4 ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
        {icon}
      </div>
      <h3 className={`text-lg sm:text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      <p className={`text-sm sm:text-base ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{description}</p>
    </div>
  );
};

const DocumentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const ReceiptIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" /></svg>;
const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const CreditCardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;

// This wrapper component prevents the `unsafeMetadata` prop from being passed to the DOM element.
// It accepts the props from SignUpButton, strips out the one it doesn't need, and forwards the rest.
const SignUpButtonWrapper = React.forwardRef(({ children, unsafeMetadata, ...props }, ref) => {
  return (
    <Button {...props} ref={ref}>
      {children}
    </Button>
  );
});

export default function HomePage({ setScrollTarget }) {
  // --- Hooks ---
  // All hooks must be called at the top level, before any conditional returns.
  const { isLoaded, session } = useSession();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isSeller = session?.user?.publicMetadata?.role === 'seller';

  useEffect(() => {
    if (session) {
      const role = session.user.publicMetadata.role;
      if (role === 'seller') {
        navigate('/seller-dashboard');
      } else if (role === 'customer') {
        navigate('/customer-dashboard');
      } else {
        // If user is signed in but has no role, send them to role selection
        navigate('/select-role');
      }
    }
  }, [session, navigate]);

  // --- Conditional Rendering ---
  // Now that all hooks have been called, we can safely return early.
  if (!isLoaded) {
    return <div className="text-center p-12">Loading...</div>;
  }

  return (
    <>
      {/* 3. Conditional Rendering Based on Role */}
      <SignedIn>
        {/* For signed-in users, show a loading indicator while redirecting */}
        <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Redirecting to your dashboard...</div>
      </SignedIn>
      <SignedOut>
        <div>
          {/* Hero Section */}
          <section ref={setScrollTarget} className="text-center py-8 sm:py-12 md:py-16">
            <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto mb-4 sm:mb-6 leading-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Welcome to <span className={`${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                Recordiq!
              </span>
            </h1>
            <p className="mt-4 sm:mt-6 max-w-2xl mx-auto text-sm sm:text-base md:text-lg mb-6 sm:mb-8 px-4">
              Your complete invoice and payment management solution.<br />
              Create invoices, scan receipts with OCR, track payments, and manage customers—all in one platform.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
              <SignUpButton mode="modal" unsafeMetadata={{ role: 'seller' }}>
                <SignUpButtonWrapper size="lg" variant="primary">
                    Start Managing Invoices
                </SignUpButtonWrapper>
              </SignUpButton>
              <SignUpButton mode="modal" unsafeMetadata={{ role: 'customer' }}>
                <SignUpButtonWrapper size="lg" variant="secondary">
                    View Your Invoices
                </SignUpButtonWrapper>
              </SignUpButton>
            </div>
          </section>

          {/* Features Section */}
          <section>
            <h2 className="text-3xl font-bold text-center mb-12 ">
              Why Choose Recordiq?
            </h2>
            <p className="text-center mx-auto max-w-2xl text-lg mb-12">
              Everything you need to manage invoices, payments, and customer records in one powerful platform.
            </p>
            <div className="flex flex-wrap justify-center gap-8">
              <FeatureCard
                icon={<DocumentIcon />}
                title="Invoice Management"
                description={ 
                  <>
                    <span className="block font-bold">Create professional invoices instantly.</span><br />
                    <span className="block">Generate, send, and track invoices with ease. Monitor payment status from draft to paid in real-time.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<ReceiptIcon />}
                title="OCR Document Scanning"
                description={
                  <>
                    <span className="block font-bold">Scan receipts and extract data automatically.</span><br />
                    <span className="block">Upload images of invoices or receipts and let AI extract the data to auto-populate your records.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<LockIcon />}
                title="Secure Authentication"
                description={
                  <>
                    <span className="block font-bold">Your data is protected and private.</span><br />
                    <span className="block">Enterprise-grade security powered by Clerk keeps your financial information safe and compliant.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<CreditCardIcon />}
                title="Payment Processing"
                description={
                  <>
                    <span className="block font-bold">Accept payments seamlessly.</span><br />
                    <span className="block">Integrated payment gateway allows customers to pay invoices online with automatic status updates.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<UsersIcon />}
                title="Customer Management"
                description={
                  <>
                    <span className="block font-bold">Track customer information and history.</span><br />
                    <span className="block">Maintain detailed customer profiles, view payment history, and access insights to build stronger relationships.</span>
                  </>
                }
              />
            </div>
          </section>
        </div>
      </SignedOut>
    </>
  );
}