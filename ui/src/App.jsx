import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './App.css';

// Initialize Sentry
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
  debug: true,
});

function MemoryCalculator() {
  const [lengthInput, setLengthInput] = useState('');
  const [resultHtml, setResultHtml] = useState('Enter a value and click "Calculate" to see results.');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const inputRef = useRef(null);

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const bytesForArrayLength = useCallback((length) => {
    return BigInt(length) * BigInt(8);
  }, []);

  const humanReadable = useCallback((bytesBigInt) => {
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let b = Number(bytesBigInt);
    let i = 0;
    while (b >= 1024 && i + 1 < units.length) {
      b /= 1024;
      i++;
    }
    return b.toFixed(2) + " " + units[i];
  }, []);

  const triggerUnhandledError = () => {
    addLog('Triggering unhandled error...');
    throw new Error('Unhandled runtime error from memory calculator!');
  };

  const triggerUnhandledPromise = () => {
    addLog('Triggering unhandled promise rejection...');
    Promise.reject(new Error('Unhandled promise rejection from memory calculator!'));
  };

  const handleCalculate = useCallback(async () => {
    const input = lengthInput.trim();
    setResultHtml("");
    setIsLoading(true);
    addLog(`Calculating memory for array length: ${input}`);

    try {
      let length;
      try {
        length = BigInt(input);
      } catch (e) {
        Sentry.captureException(e, {
          tags: { type: 'invalid_input' },
          extra: { input }
        });
        setResultHtml(`<span class="status-error">❌ Invalid input. Must be a whole number. Error: ${e.message}</span>`);
        addLog('Invalid input error captured by Sentry');
        return;
      }

      if (length < 0) {
        const error = new Error("Negative array length provided");
        Sentry.captureException(error, {
          tags: { type: 'negative_length' },
          extra: { input, length: length.toString() }
        });
        setResultHtml(`<span class="status-error">❌ Length cannot be negative.</span>`);
        addLog('Negative length error captured by Sentry');
        return;
      }

      if (length > BigInt(Number.MAX_SAFE_INTEGER)) {
        addLog('Warning: Array length exceeds safe integer limit');
      }

      const lenNum = Number(length);
      const bytes = bytesForArrayLength(length);
      
      const successContent = `
        <div class="memory-result">
          <span class="status-success">✅ Successfully created new Array(${lenNum.toLocaleString()})</span>
          <div class="memory-display">
            <div class="memory-item">
              <span>Estimated memory usage:</span>
              <strong>${humanReadable(bytes)}</strong>
            </div>
            <div class="memory-item">
              <span>Array length:</span>
              <strong>${lenNum.toLocaleString()}</strong>
            </div>
            <div class="memory-item">
              <span>Total bytes:</span>
              <strong>${bytes.toString()} bytes</strong>
            </div>
            <div class="memory-item">
              <span>Total bits:</span>
              <strong>${(bytes * BigInt(8)).toString()} bits</strong>
            </div>
          </div>
        </div>
      `;
      setResultHtml(successContent);

      Sentry.captureMessage("Array memory calculation completed", {
        level: 'info',
        extra: {
          arrayLength: lenNum,
          memoryBytes: bytes.toString(),
          memoryReadable: humanReadable(bytes)
        }
      });
      addLog(`Calculation completed for array length: ${lenNum}`);

    } catch (error) {
      console.error('Calculation error:', error);
      Sentry.captureException(error, {
        tags: { type: 'calculation_error' },
        extra: { input: lengthInput }
      });
      setResultHtml(`<span class="status-error">❌ An unexpected error occurred. Please try again.</span>`);
      addLog('Unexpected calculation error captured by Sentry');
    } finally {
      setIsLoading(false);
    }
  }, [lengthInput, bytesForArrayLength, humanReadable, addLog]);

  const handleKeyUp = useCallback((event) => {
    if (event.key === "Enter") {
      handleCalculate();
    }
  }, [handleCalculate]);

  const testSentryError = useCallback(() => {
    try {
      const testError = new Error('This is a test error to verify Sentry integration');
      testError.name = 'SentryTestError';
      
      Sentry.withScope((scope) => {
        scope.setTag('test_type', 'manual_test');
        scope.setExtra('test_timestamp', new Date().toISOString());
        scope.setExtra('user_action', 'clicked_test_button');
        Sentry.captureException(testError);
      });
      
      setResultHtml('<span class="status-success">✅ Test error sent to Sentry! Check your Sentry dashboard.</span>');
      addLog('Manual test error sent to Sentry');
    } catch (error) {
      console.error('Failed to send test error to Sentry:', error);
      setResultHtml('<span class="status-error">❌ Failed to send test error to Sentry.</span>');
    }
  }, [addLog]);

  const testPerformanceTransaction = useCallback(() => {
    const transaction = Sentry.startTransaction({
      name: "Test Performance Transaction",
      op: "test",
    });

    Sentry.getCurrentScope().setSpan(transaction);

    setTimeout(() => {
      transaction.finish();
      setResultHtml('<span class="status-success">✅ Performance transaction sent to Sentry!</span>');
      addLog('Performance transaction sent to Sentry');
    }, 1000);
  }, [addLog]);

  const clearResults = useCallback(() => {
    setResultHtml('Enter a value and click "Calculate" to see results.');
    setLengthInput('');
    inputRef.current?.focus();
    addLog('Results cleared');
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧠 Memory Calculator + Sentry Demo</h1>
        <p>Calculate array memory usage and test Sentry error tracking with unhandled exceptions</p>
        <div className="env-info">
          <strong>Environment:</strong> Development |
          <strong> DSN:</strong> {import.meta.env.VITE_SENTRY_DSN ? 'Configured' : 'Not Configured'}
        </div>
      </header>

      <div className="dashboard">
        <div className="stats">
          <div className="stat-card">
            <h3>Status</h3>
            <p className="status">
              {import.meta.env.VITE_SENTRY_DSN ? 'Sentry Active' : 'Sentry Inactive (No DSN)'}
            </p>
          </div>
          <div className="stat-card">
            <h3>Activity Logs</h3>
            <p className="counter">{logs.length}</p>
          </div>
        </div>

        <div className="controls">
          <h2>Memory Calculator</h2>
          
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter array length (e.g., 1000000)"
              value={lengthInput}
              onChange={(e) => setLengthInput(e.target.value)}
              onKeyUp={handleKeyUp}
              disabled={isLoading}
              className="text-input"
              ref={inputRef}
            />
            <button
              className="btn btn-primary"
              onClick={handleCalculate}
              disabled={isLoading || !lengthInput.trim()}
            >
              {isLoading ? 'Calculating...' : 'Calculate Memory'}
            </button>
          </div>

          <div className="result-section">
            <div dangerouslySetInnerHTML={{ __html: resultHtml }} />
          </div>

          <h2>Error Simulation</h2>
          <div className="button-group">
            <button
              className="btn btn-danger"
              onClick={triggerUnhandledError}
            >
              🔥 Trigger Unhandled Error
            </button>

            <button
              className="btn btn-warning"
              onClick={triggerUnhandledPromise}
            >
              🔄 Unhandled Promise
            </button>

            <button
              className="btn btn-info"
              onClick={testSentryError}
            >
              🧪 Test Sentry Error
            </button>

            <button
              className="btn btn-success"
              onClick={testPerformanceTransaction}
            >
              📊 Test Performance
            </button>

            <button
              className="btn btn-secondary"
              onClick={clearResults}
            >
              🧹 Clear Results
            </button>
          </div>
        </div>

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
          <h3>Demo Highlights</h3>
          <ul>
            <li><strong>Unhandled Errors:</strong> Click "Trigger Unhandled Error" to see how Sentry catches errors without try-catch</li>
            <li><strong>Promise Rejections:</strong> Unhandled promises are automatically captured</li>
            <li><strong>Memory Calculations:</strong> Real-world scenario with potential edge cases</li>
            <li><strong>Error Context:</strong> Sentry captures user actions, input values, and environment data</li>
            <li><strong>Performance Monitoring:</strong> Track calculation performance and user interactions</li>
          </ul>
          
          <div className="tip">
            <strong>For Demo:</strong> 
            <br/>1. Show the app working normally
            <br/>2. Trigger unhandled errors to demonstrate automatic capture
            <br/>3. Show how Sentry provides context (user actions, inputs, stack traces)
            <br/>4. Demonstrate the difference with/without DSN configuration
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
          <h2>🚨 Memory Calculator Crashed!</h2>
          <p>This error has been automatically reported to Sentry.</p>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Main App component with Error Boundary
function App() {
  return (
    <ErrorBoundary>
      <MemoryCalculator />
    </ErrorBoundary>
  );
}

// Render the app directly
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

export default App;
