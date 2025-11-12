import React, { useState } from 'react';
import * as Sentry from '@sentry/react';
import './App.css';

// Initialize Sentry - Use a test DSN or leave empty for development
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: "development",
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: true, // Enable debug mode to see Sentry logs in console
});

function App() {
  const [counter, setCounter] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [simulatedError, setSimulatedError] = useState('');
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Function to simulate different types of errors
  const triggerError = (errorType) => {
    switch (errorType) {
      case 'runtime':
        addLog('Triggering runtime error...');
        // This will cause a runtime error
        throw new Error('Simulated runtime error from UI button!');
      
      case 'api':
        addLog('Simulating API error...');
        // Simulate API error
        Sentry.captureException(new Error('Simulated API fetch error'));
        setSimulatedError('API error captured and sent to Sentry!');
        break;
      
      case 'validation':
        addLog('Testing validation...');
        // Simulate validation error
        if (!userInput.trim()) {
          Sentry.captureMessage('User submitted empty form', 'warning');
          setSimulatedError('Validation warning captured!');
        } else {
          Sentry.captureMessage(`User submitted: ${userInput}`, 'info');
          setSimulatedError('Form submitted successfully!');
        }
        break;
      
      case 'promise':
        addLog('Simulating promise rejection...');
        // Simulate unhandled promise rejection
        Promise.reject(new Error('Simulated unhandled promise rejection'));
        setSimulatedError('Promise rejection simulated!');
        break;
      
      default:
        break;
    }
  };

  // Function to manually capture exceptions
  const captureCustomError = () => {
    try {
      addLog('Testing custom error capture...');
      // Some operation that might fail
      if (counter > 5) {
        throw new Error('Counter is too high!');
      }
      setCounter(counter + 1);
    } catch (error) {
      Sentry.captureException(error);
      setSimulatedError('Custom error captured: ' + error.message);
    }
  };

  // Function to set user context
  const setUserContext = () => {
    addLog('Setting user context...');
    Sentry.setUser({
      id: '12345',
      username: 'demo_user',
      email: 'user@example.com',
    });
    setSimulatedError('User context set for Sentry!');
  };

  // Function to add custom tags
  const addCustomTags = () => {
    addLog('Adding custom tags...');
    Sentry.setTag('page', 'learning-sentry');
    Sentry.setTag('feature', 'error-demo');
    setSimulatedError('Custom tags added!');
  };

  // Function to capture breadcrumb
  const addBreadcrumb = () => {
    addLog('Adding breadcrumb...');
    Sentry.addBreadcrumb({
      category: 'user',
      message: 'User performed custom action',
      level: 'info',
    });
    setSimulatedError('Breadcrumb added!');
  };

  // Test Sentry with a fake DSN to see what happens
  const testWithoutDSN = () => {
    addLog('Testing without DSN...');
    try {
      throw new Error('This error has no DSN configured');
    } catch (error) {
      Sentry.captureException(error);
    }
    setSimulatedError('Error captured (check console for Sentry debug messages)');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚨 Sentry Learning UI</h1>
        <p>Interact with the buttons below to generate different types of errors and events</p>
        <div className="env-info">
          <strong>Environment:</strong> Development | 
          <strong> DSN:</strong> {import.meta.env.VITE_SENTRY_DSN ? 'Configured' : 'Not Configured'}
        </div>
      </header>

      <div className="dashboard">
        <div className="stats">
          <div className="stat-card">
            <h3>Counter</h3>
            <p className="counter">{counter}</p>
          </div>
          <div className="stat-card">
            <h3>Status</h3>
            <p className="status">
              {import.meta.env.VITE_SENTRY_DSN ? 'Sentry Active' : 'Sentry Inactive (No DSN)'}
            </p>
          </div>
        </div>

        <div className="controls">
          <h2>Error Simulation</h2>
          
          <div className="button-group">
            <button 
              className="btn btn-danger"
              onClick={() => triggerError('runtime')}
            >
              🔥 Trigger Runtime Error
            </button>
            
            <button 
              className="btn btn-warning"
              onClick={() => triggerError('api')}
            >
              🌐 Simulate API Error
            </button>
            
            <button 
              className="btn btn-info"
              onClick={captureCustomError}
            >
              ⚡ Capture Custom Error
            </button>
            
            <button 
              className="btn btn-secondary"
              onClick={() => triggerError('promise')}
            >
              🔄 Promise Rejection
            </button>

            <button 
              className="btn btn-test"
              onClick={testWithoutDSN}
            >
              🧪 Test Without DSN
            </button>
          </div>

          <div className="form-group">
            <h3>Form Validation Demo</h3>
            <input
              type="text"
              placeholder="Enter something..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="text-input"
            />
            <button 
              className="btn btn-primary"
              onClick={() => triggerError('validation')}
            >
              📝 Submit Form
            </button>
          </div>

          <h2>Sentry Features</h2>
          <div className="button-group">
            <button 
              className="btn btn-success"
              onClick={setUserContext}
            >
              👤 Set User Context
            </button>
            
            <button 
              className="btn btn-success"
              onClick={addCustomTags}
            >
              🏷️ Add Custom Tags
            </button>
            
            <button 
              className="btn btn-success"
              onClick={addBreadcrumb}
            >
              🍞 Add Breadcrumb
            </button>
          </div>
        </div>

        {simulatedError && (
          <div className="notification">
            <p>{simulatedError}</p>
            <button onClick={() => setSimulatedError('')}>Dismiss</button>
          </div>
        )}

        <div className="logs-section">
          <div className="logs-header">
            <h3>Activity Logs</h3>
            <button onClick={clearLogs} className="btn btn-clear">Clear Logs</button>
          </div>
          <div className="logs-container">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">{log}</div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h3>What to expect:</h3>
          <ul>
            <li>🔥 Runtime errors will crash the app (in development)</li>
            <li>🌐 API errors are captured without breaking the app</li>
            <li>⚡ Custom errors demonstrate try-catch with Sentry</li>
            <li>👤 User context helps identify affected users</li>
            <li>🏷️ Tags help filter and search events</li>
            <li>🍞 Breadcrumbs create event trails</li>
            <li>🧪 Test without DSN to see Sentry debug behavior</li>
          </ul>
          <div className="tip">
            <strong>Tip:</strong> Open browser console to see Sentry debug messages when no DSN is configured.
          </div>
        </div>
      </div>
    </div>
  );
}

// Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error);
    Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong! 🚨</h2>
          <p>This error has been reported to Sentry.</p>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export with error boundary
export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
