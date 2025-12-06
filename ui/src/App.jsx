// src/App.jsx
import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Sentry, startManualTrace, addManualSpan, getCurrentTraceId } from './Sentry';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

function MemoryCalculator() {
  const [lengthInput, setLengthInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [traceId, setTraceId] = useState('');
  const inputRef = useRef(null);
  
  // Debug logging helper
  const logTraceEvent = useCallback((event, data = {}) => {
    const currentTraceId = getCurrentTraceId();
    console.log(`[Trace Event] ${event}`, {
      ...data,
      traceId: currentTraceId,
      timestamp: new Date().toISOString()
    });
    
    // Also log to Sentry as breadcrumb
    if (Sentry && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        category: 'manual_trace',
        message: event,
        level: 'info',
        data: {
          ...data,
          traceId: currentTraceId
        }
      });
    }
  }, []);

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
    setTraceId('');
    
    // Start manual trace
    const traceResult = startManualTrace();
    if (traceResult) {
      setTraceId(traceResult.traceId);
      console.log(`[Manual Trace] Started trace: ${traceResult.traceId}`);
    }
    
    logTraceEvent('calculation_started', { input: lengthInput });
    
    let length;
    
    // ✅ Handle validation errors
    try {
      // Add span for validation - spans automatically finish when callback returns
      addManualSpan('input_validation', { input }, 'validation');
      logTraceEvent('input_validation_started', { input });
      
      if (!input) {
        throw new Error('Please enter an array length');
      }
      length = BigInt(input);
      if (length === 0n) {
        throw new Error('Array length cannot be zero');
      }
      
      logTraceEvent('input_validation_passed', { length: length.toString() });
    } catch (err) {
      console.error('Validation error:', err);
      setError(err.message);
      
      logTraceEvent('input_validation_failed', { error: err.message, input: lengthInput });
      
      if (Sentry && Sentry.captureException) {
        Sentry.captureException(err, {
          tags: { type: 'validation_error', trace_id: traceResult?.traceId },
          extra: { input: lengthInput }
        });
      }
      return;
    }
    
    const lenNum = Number(length);
    
    try {
      // Add span for array creation
      addManualSpan('array_creation', { length: lenNum }, 'process');
      logTraceEvent('array_creation_started', { length: lenNum });
      
      const arr = new Array(lenNum);
      logTraceEvent('array_created', { length: lenNum, success: true });
      
      // Add span for calculation
      addManualSpan('memory_calculation', { length: lenNum }, 'compute');
      logTraceEvent('memory_calculation_started', { length: lenNum });
      
      const bytes = bytesForArrayLength(length);
      const hr = humanReadable(bytes);
      
      logTraceEvent('memory_calculated', { 
        bytes: bytes.toString(),
        readable: `${hr.value} ${hr.unit}`
      });
      
      // Add span for result processing
      addManualSpan('result_processing', { 
        bytes: bytes.toString(),
        readable: `${hr.value} ${hr.unit}`
      }, 'process');
      
      const currentTraceId = traceResult?.traceId || getCurrentTraceId();
      logTraceEvent('result_processing_started', { 
        bytes: bytes.toString(),
        readable: `${hr.value} ${hr.unit}`,
        traceId: currentTraceId
      });
      
      setResult({
        length: lenNum,
        bytes: bytes,
        humanReadable: `${hr.value} ${hr.unit}`,
        hrValue: hr.value,
        hrUnit: hr.unit,
        bits: bytes * 8n,
        traceId: currentTraceId
      });
      
      logTraceEvent('calculation_completed', { 
        length: lenNum,
        bytes: bytes.toString(),
        readable: `${hr.value} ${hr.unit}`,
        traceId: currentTraceId
      });
      
      if (Sentry && Sentry.captureMessage) {
        Sentry.captureMessage("Array memory calculation completed", {
          level: 'info',
          tags: { trace_id: currentTraceId },
          extra: {
            arrayLength: lenNum,
            memoryBytes: bytes.toString(),
            memoryReadable: `${hr.value} ${hr.unit}`,
            traceId: currentTraceId
          }
        });
      }
    } catch (err) {
      console.error('Array creation error:', err);
      
      const currentTraceId = traceResult?.traceId || getCurrentTraceId();
      logTraceEvent('calculation_failed', { 
        error: err.message, 
        length: lenNum,
        traceId: currentTraceId
      });
      
      setError(`Error: ${err.message} (Trace ID: ${currentTraceId})`);
      
      setTimeout(() => {
        throw err;
      }, 0);
    }
  }, [lengthInput, bytesForArrayLength, humanReadable, logTraceEvent]);

  const handleKeyUp = useCallback((event) => {
    if (event.key === "Enter") {
      processCalculate();
    }
  }, [processCalculate]);

  const clearResults = useCallback(() => {
    setResult(null);
    setError('');
    setLengthInput('');
    setTraceId('');
    inputRef.current?.focus();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>JavaScript Array Memory Usage (Estimated) Calculation</h1>
        <p>Sentry: Manual Tracing + Error Capture Demo</p>
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
            
            {traceId && (
              <div className="trace-info">
                <strong>Trace ID:</strong> {traceId}
              </div>
            )}
            
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
            <li><strong>Sentry Manual Tracing:</strong>
              <ul>
                <li>Each calculation creates a distributed trace with unique Trace ID</li>
                <li>Spans track: Input Validation → Array Creation → Memory Calculation → Result Processing</li>
                <li>Trace ID is displayed with results for correlation</li>
                <li>Errors are tagged with Trace ID for debugging</li>
                <li><strong>Clean Structure:</strong> No unnecessary intermediate spans</li>
              </ul>
            </li>
            <li><strong>Sentry Error Tracking:</strong>
              <ul>
                <li>Handled Errors: Empty and zero inputs are caught and logged</li>
                <li>Unhandled Errors: RangeError from large arrays will crash and be captured</li>
                <li>Error Context: Sentry records input values, stack traces, and trace IDs</li>
                <li>Real-time Monitoring: Errors appear in your Sentry dashboard immediately</li>
                <li><strong>Deduplication:</strong> Reports 1st, 10th, 20th errors daily</li>
              </ul>
            </li>
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