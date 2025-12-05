// src/App.jsx
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
    if (b === 0) return { value: "0", unit: "B" };
    let i = 0;
    while (b >= 1024 && i < units.length - 1) {
      b /= 1024;
      i++;
    }
    return {
      value: b.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: units[i]
    };
  }, []);

  const processCalculate = useCallback(() => {
    const input = lengthInput.trim();
    setResult(null);
    setError('');
    
    let length;
    
    // ✅ Handle validation errors (empty and zero) - these are HANDLED errors
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

    const lenNum = Number(length);
    
    try {
      // ⚠️ This will throw RangeError for very large values (like 4294967296)
      const arr = new Array(lenNum);
      
      // If we get here, allocation succeeded
      const bytes = bytesForArrayLength(length);
      const hr = humanReadable(bytes);
      setResult({
        length: lenNum,
        bytes: bytes,
        humanReadable: `${hr.value} ${hr.unit}`,
        hrValue: hr.value,
        hrUnit: hr.unit,
        bits: bytes * 8n
      });
      
      if (Sentry && Sentry.captureMessage) {
        Sentry.captureMessage("Array memory calculation completed", {
          level: 'info',
          extra: {
            arrayLength: lenNum,
            memoryBytes: bytes.toString(),
            memoryReadable: `${hr.value} ${hr.unit}`
          }
        });
      }
    } catch (err) {
      console.error('Array creation error:', err);
      
      // Show error to user (like in the screenshot)
      setError(`Error: ${err.message}`);
      
      // ⚠️ Make it unhandled for Sentry by throwing it asynchronously
      // This will crash the app after showing the error
      setTimeout(() => {
        throw err;
      }, 0);
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
        <h1>JavaScript Array Memory Usage (Estimated) Calculation</h1>
        <p>Sentry: Capturing & Reporting (Handled + Unhandled) Issue</p>
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
              placeholder="e.g., 1 to 4294967295"
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
            {error}
          </div>
        )}
        {result && (
          <div className="result-section">
            <div className="success-message">
              <div className="message-content">
                Successfully calculated memory for Array({result.length.toLocaleString()}), estimated memory usage:
              </div>
              <div className="result-value">
                <strong className="value-only">{result.hrValue}</strong>
                <span className="unit-only">{result.hrUnit}</span>
              </div>
            </div>
            <div className="action-buttons">
              <button onClick={clearResults} className="btn btn-secondary">
                Clear
              </button>
            </div>
          </div>
        )}        
        <div className="info-section">
          <h3>About this Calculator & Sentry Demo</h3>
          <ul>
            <li>Estimates memory usage assuming each array element is a JavaScript Number (8 bytes)</li>
            <li>Shows large values to human-readable format (KB, MB, GB, etc.)</li>
            <li><strong>Integer-only input:</strong> Only whole numbers are allowed</li>
            <li><strong>Test with 4294967296</strong> to trigger an unhandled RangeError that Sentry will capture</li>
            <li><strong>Sentry Error Tracking:</strong>
              <ul>
                <li>Handled Errors: Empty and zero inputs are caught and logged without crashing</li>
                <li>Unhandled Errors: RangeError from large arrays (like 4294967296) will show error message then crash and be captured by Sentry</li>
                <li>Error Context: Sentry records input values, stack traces, and user actions</li>
                <li>Real-time Monitoring: Errors appear in your Sentry dashboard immediately</li>
                <li>Error Boundaries: React errors are gracefully handled with recovery options</li>
                <li><strong>Deduplication:</strong> Reports 1st, 10th, 20th errors daily</li>
              </ul>
            </li>
            {/* <li><strong>Current Status:</strong> {import.meta.env.VITE_SENTRY_DSN ? 'Sentry Active' : 'Sentry Not Configured'}</li> */}
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