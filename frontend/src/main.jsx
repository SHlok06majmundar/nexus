import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import './components/clerk-styles.css'; // Import custom styles for Clerk
import './components/clerk-fixes.css'; // Import fixes for Clerk components
import './components/clerk-professional.css'; // Import professional styling for Clerk components
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import Meet from './Meet.jsx';
import Landing from './Landing.jsx';
import { ClerkProvider } from '@clerk/clerk-react';
import ErrorBoundary from './components/ErrorBoundary';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={clerkPubKey}
      appearance={{
        layout: {
          socialButtonsVariant: 'iconButton',
          showOptionalFields: false,
          logoPlacement: 'none',
          helpPageUrl: false,
          privacyPageUrl: false,
          termsPageUrl: false,
        },
        variables: {
          colorPrimary: '#6a11cb',
          colorTextOnPrimaryBackground: 'white',
          colorBackground: 'white',
          colorInputBackground: '#f9fafc',
          colorInputText: '#333',
          colorTextSecondary: '#666',
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '8px',
          spacingUnit: '0.75rem',
        },
        elements: {
          card: 'cl-card',
          formButtonPrimary: 'cl-formButtonPrimary',
          headerTitle: 'cl-headerTitle',
          headerSubtitle: 'cl-headerSubtitle',
          footerActionLink: 'cl-footerActionLink',
          footerActionText: 'cl-footerActionText',
          formFieldInput: 'cl-formFieldInput',
          formFieldLabel: 'cl-formFieldLabel',
          socialButtonsIconButton: 'cl-socialButtonsIconButton',
          identityPreviewText: 'cl-identityPreviewText',
          formFieldAction: 'cl-formFieldAction',
          dividerText: 'cl-dividerText',
          formFieldError: 'cl-formFieldError',
          userButtonTrigger: 'cl-userButtonTrigger',
        }
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ErrorBoundary><Landing /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/meet/:meetingId" element={<ErrorBoundary><Meet /></ErrorBoundary>} />
          <Route path="/meeting/:meetingId" element={<ErrorBoundary><Meet /></ErrorBoundary>} />
          <Route path="/join/:meetingId" element={<ErrorBoundary><Meet /></ErrorBoundary>} />
          <Route path="*" element={<ErrorBoundary><Landing /></ErrorBoundary>} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
