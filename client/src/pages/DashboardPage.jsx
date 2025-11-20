import React, { useEffect } from 'react';
import { SignedIn, SignedOut, useSession, SignUpButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useTheme } from '../context/ThemeContext';

const FeatureCard = ({ icon, title, description }) => {
  const { theme } = useTheme();
  return (
    <div className={`w-full md:w-1/3 lg:max-w-sm rounded-xl shadow-lg p-6 flex flex-col items-center text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
      <div className={`p-3 rounded-full mb-4 ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
        {icon}
      </div>
      <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{description}</p>
    </div>
  );
};

const PenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;
const CategoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const AuthIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;

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
          <section ref={setScrollTarget} className="text-center py-16">
            <h1 className={`text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl max-w-4xl mx-auto mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Welcome to <span className={`${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                Recordiq!
              </span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg mb-8">
              Welcome to the all-new .<br />
              Built with care on MERN, and kept safe by Clerk. Sign in below to start creating or exploring.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
              <SignUpButton mode="modal" unsafeMetadata={{ role: 'seller' }}>
                <SignUpButtonWrapper size="lg" variant="primary">
                    Start selling your products
                </SignUpButtonWrapper>
              </SignUpButton>
              <SignUpButton mode="modal" unsafeMetadata={{ role: 'customer' }}>
                <SignUpButtonWrapper size="lg" variant="secondary">
                    Join today and start shopping
                </SignUpButtonWrapper>
              </SignUpButton>
            </div>
          </section>

          {/* Features Section */}
          <section>
            <h2 className="text-3xl font-bold text-center mb-12 ">
              Features
            </h2>
            <p className="text-center mx-auto max-w-2xl text-lg mb-12">
              Discover the features that make Recordiq more than just another platform —
              your space to buy, sell, and connect.
            </p>
            <div className="flex flex-wrap justify-center gap-8">
              <FeatureCard
                icon={<PenIcon />}
                title="Seller-Friendly Interface"
                description={ 
                  <>
                    <span className="block font-bold">Manage your products with ease.</span><br />
                    <span className="block">With a user-friendly interface designed for sellers, you can easily add, update, and organize your product listings straight from the dashboard.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<CategoryIcon />}
                title="Comprehensive Record Keeping"
                description={
                  <>
                    <span className="block font-bold">Record tracking made easier.</span><br />
                    <span className="block">Keep track of every sale, service, and transaction with ease, ensuring your business runs smoothly and efficiently.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<AuthIcon />}
                title="Effortless Security"
                description={
                  <>
                    <span className="block font-bold">Sign in seamlessly and safely.</span><br />
                    <span className="block">Clerk keeps your data protected behind the scenes so you can focus on sharing your voice — stress-free and secure.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<AuthIcon />}
                title="Invoice & Payment Management"
                description={
                  <>
                    <span className="block font-bold">Manage your invoices and payments effortlessly.</span><br />
                    <span className="block">Keep track of all your financial transactions in one place, ensuring smooth and efficient business operations.</span>
                  </>
                }
              />
              <FeatureCard
                icon={<AuthIcon />}
                title="Customer Insights"
                description={
                  <>
                    <span className="block font-bold">Gain valuable insights into your customers.</span><br />
                    <span className="block">Understand customer behavior and preferences to tailor your offerings and improve satisfaction.</span>
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