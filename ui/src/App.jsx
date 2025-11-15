import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './App.css';

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: "development",
  debug: true,
});

function MemoryCalculator() {
  const [lengthInput, setLengthInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const bytesForArrayLength = useCallback((length) => {
    return BigInt(length) * BigInt(8);
  }, []);

  const humanReadable = useCallback((bytesBigInt) => {
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let b = Number(bytesBigInt);
    
    if (b === 0) return "0 B";
    
    let i = 0;
    while (b >= 1024 && i < units.length - 1) {
      b /= 1024;
      i++;
    }
    
    return b.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + units[i];
  }, []);

  const handleCalculate = useCallback(() => {
    const input = lengthInput.trim();
    setResult(null);
    setError('');

    if (!input) {
      setError('Please enter an array length');
      return;
    }

    try {
      // Validate input is a valid number
      if (!/^-?\d+$/.test(input)) {
        throw new Error('Invalid input. Must be a whole number.');
      }

      const length = BigInt(input);
      
      if (length < 0n) {
        throw new Error('Array length cannot be negative');
      }

      if (length > BigInt(Number.MAX_SAFE_INTEGER)) {
        // This will trigger a RangeError for array creation
        const arr = new Array(Number(length));
      }

      const bytes = bytesForArrayLength(length);
      const lenNum = Number(length);
      
      setResult({
        length: lenNum,
        bytes: bytes,
        humanReadable: humanReadable(bytes),
        bits: bytes * 8n
      });

      // Log to Sentry for demo purposes
      Sentry.captureMessage("Array memory calculation completed", {
        level: 'info',
        extra: {
          arrayLength: lenNum,
          memoryBytes: bytes.toString(),
          memoryReadable: humanReadable(bytes)
        }
      });

    } catch (err) {
      console.error('Calculation error:', err);
      setError(err.message);
      
      // Capture error in Sentry
      Sentry.captureException(err, {
        tags: { type: 'calculation_error' },
        extra: { input: lengthInput }
      });
    }
  }, [lengthInput, bytesForArrayLength, humanReadable]);

  const handleKeyUp = useCallback((event) => {
    if (event.key === "Enter") {
      handleCalculate();
    }
  }, [handleCalculate]);

  const clearResults = useCallback(() => {
    setResult(null);
    setError('');
    setLengthInput('');
    inputRef.current?.focus();
  }, []);

  const triggerUnhandledError = () => {
    // This will be caught by Sentry automatically
    throw new Error('Unhandled runtime error from memory calculator!');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>JavaScript Array Memory Calculator</h1>
        <p>Estimate memory usage for JavaScript arrays</p>
      </header>

      <div className="calculator-container">
        <div className="input-section">
          <h2>Array Length:</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="e.g., 1000000"
              value={lengthInput}
              onChange={(e) => setLengthInput(e.target.value)}
              onKeyUp={handleKeyUp}
              className="text-input"
              ref={inputRef}
            />
            <button
              className="btn btn-calculate"
              onClick={handleCalculate}
            >
              Calculate
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="result-section">
            <div className="success-message">
              ✅ Successfully created new Array({result.length.toLocaleString()})
            </div>
            <div className="memory-result">
              <div className="memory-item">
                <span>Estimated memory usage:</span>
                <strong>{result.humanReadable}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="action-buttons">
          <button onClick={clearResults} className="btn btn-secondary">
            Clear
          </button>
          <button onClick={triggerUnhandledError} className="btn btn-danger">
            Trigger Unhandled Error
          </button>
        </div>

        <div className="info-section">
          <h3>About this calculator</h3>
          <ul>
            <li>Estimates memory usage assuming each array element is a JavaScript Number (8 bytes)</li>
            <li>Shows both bytes and bits for the estimated memory usage</li>
            <li>Converts large values to human-readable format (KB, MB, GB, etc.)</li>
          </ul>
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
          <h2>🚨 Application Crashed!</h2>
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
