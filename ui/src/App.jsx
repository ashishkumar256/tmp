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

  const processCalculate = useCallback(() => {
    const input = lengthInput.trim();
    setResult(null);
    setError('');
    let length;

    // ✅ Handle validation errors (empty and zero)
    try {
      if (!input) {
        throw new Error('Please enter an array length');
      }
      length = BigInt(input);
      if (length === 0n) {
        throw new Error('Array length cannot be zero');
      }
    } catch (err) {
      console.error('Validation error:', err);
      setError(err.message);
      if (Sentry && Sentry.captureException) {
        Sentry.captureException(err, {
          tags: { type: 'validation_error' },
          extra: { input: lengthInput }
        });
      }
      return;
    }

    // ❗ RangeError from this line is unhandled
    const lenNum = Number(length);
    const arr = new Array(lenNum);
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
      processCalculate();
    }
  }, [processCalculate]);

  const clearResults = useCallback(() => {
    setResult(null);
    setError('');
    setLengthInput('');
    inputRef.current?.focus();
  }, []);

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
              onClick={processCalculate}
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
        </div>
        <div className="info-section">
          <h3>About this Calculator & Sentry Demo</h3>
          <ul>
            <li>Estimates memory usage assuming each array element is a JavaScript Number (8 bytes)</li>
            <li>Shows both bytes and bits for the estimated memory usage</li>
            <li>Converts large values to human-readable format (KB, MB, GB, etc.)</li>
            <li><strong>Integer-only input:</strong> Only whole numbers are allowed</li>
            <li><strong>Sentry Error Tracking:</strong> 
              <ul>
                <li>Handled Errors: Empty and zero inputs are caught and logged without crashing</li>
                <li>Unhandled Errors: Very large array lengths trigger RangeError and crash the component</li>
                <li>Error Context: Sentry records input values, stack traces, and user actions</li>
                <li>Real-time Monitoring: Errors appear in your Sentry dashboard immediately</li>
                <li>Error Boundaries: React errors are gracefully handled with recovery options</li>
              </ul>
            </li>
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