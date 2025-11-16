import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Sentry } from './Sentry';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

function MemoryCalculator() {
  const [lengthInput, setLengthInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Only allow numbers (integers) in input
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setLengthInput(value);
      setError('');
    }
  }, []);

  const bytesForArrayLength = useCallback((length) => {
    return BigInt(length) * BigInt(8);
  }, []);

  const humanReadable = useCallback((bytesBigInt) => {
    const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
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

    const length = BigInt(input);

    if (length < 0n) {
      setError('Array length cannot be negative');
      return;
    }

    if (length === 0n) {
      setError('Array length cannot be zero');
      return;
    }

    // ⚠️ No try/catch here — RangeError will be unhandled
    const lenNum = Number(length);
    const arr = new Array(lenNum); // RangeError if too large

    const bytes = bytesForArrayLength(length);

    setResult({
      length: lenNum,
      bytes: bytes,
      humanReadable: humanReadable(bytes),
      bits: bytes * 8n
    });

    if (Sentry && Sentry.captureMessage) {
      Sentry.captureMessage("Array memory calculation completed", {
        level: 'info',
        extra: {
          arrayLength: lenNum,
          memoryBytes: bytes.toString(),
          memoryReadable: humanReadable(bytes)
        }
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
    throw new Error('Unhandled runtime error from memory calculator!');
  };

  const testLargeNumberError = () => {
    setLengthInput('1000000000000000000000000000000000000000000000000');
    setError('');
    inputRef.current?.focus();
  };

  const testWorkingNumber = () => {
    setLengthInput('1000000');
    setError('');
    inputRef.current?.focus();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>JavaScript Array Memory Calculator</h1>
        <p>Estimate memory usage for JavaScript arrays</p>
        <div className="env-info">
          <strong>Sentry Status:</strong> {import.meta.env.VITE_SENTRY_DSN ? 'Active' : 'Not Configured'}
        </div>
      </header>

      <div className="calculator-container">
        <div className="input-section">
          <h2>Array Length:</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="e.g., 1000000"
              value={lengthInput}
              onChange={handleInputChange}
              onKeyUp={handleKeyUp}
              className="text-input"
              ref={inputRef}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <button
              className="btn btn-calculate"
              onClick={handleCalculate}
              disabled={!lengthInput.trim()}
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
              ✅ Successfully calculated memory for Array({result.length.toLocaleString()})
            </div>
            <div className="memory-result">
              <div className="memory-item">
                <span>Estimated memory usage:</span>
                <strong>{result.humanReadable}</strong>
              </div>
              <div className="memory-item">
                <span>Total bytes:</span>
                <strong>{result.bytes.toString()} bytes</strong>
              </div>
              <div className="memory-item">
                <span>Total bits:</span>
                <strong>{result.bits.toString()} bits</strong>
              </div>
            </div>
          </div>
        )}

        <div className="action-buttons">
          <button onClick={clearResults} className="btn btn-secondary">
            Clear
          </button>
          <button onClick={testWorkingNumber} className="btn btn-success">
            Test Working Number
          </button>
          <button onClick={testLargeNumberError} className="btn btn-warning">
            Test Large Number
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
            <li><strong>Integer-only input:</strong> Only whole numbers are allowed</li>
            <li><strong>Demo:</strong> Enter very large numbers to trigger "Invalid array length" errors captured by Sentry</li>
          </ul>
        </div>

        <div className="sentry-demo-info">
          <h3>Sentry Demo Features</h3>
          <ul>
            <li><strong>Unhandled Errors:</strong> "Invalid array length" RangeError is automatically captured</li>
            <li><strong>Error Context:</strong> Sentry records the input value, stack trace, and user actions</li>
            <li><strong>Real-time Monitoring:</strong> Errors appear in your Sentry dashboard immediately</li>
            <li><strong>Error Boundaries:</strong> React errors are gracefully handled with recovery options</li>
            <li><strong>Current Status:</strong> {import.meta.env.VITE_SENTRY_DSN ? 'Sentry Active' : 'Sentry Not Configured'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <MemoryCalculator />
    </ErrorBoundary>
  );
}

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