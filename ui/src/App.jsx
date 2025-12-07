import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Sentry, 
  startTransaction, 
  startSpan, 
  endSpan, 
  getCurrentTraceId,
  captureMessageWithTrace 
} from './Sentry';
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
    
    // Start a transaction for the entire calculation
    const transaction = startTransaction('array_memory_calculation', {
      input_length: input,
      operation: 'calculate',
      timestamp: new Date().toISOString()
    });
    
    if (!transaction) {
      console.error('Failed to start transaction');
      return;
    }
    
    console.log(`[Transaction Started] ID: ${transaction.traceId}`);
    
    let length;
    
    try {
      // Span 1: Input Validation
      const validationSpan = transaction.startSpan('input_validation', { input }, 'validation');
      
      if (!input) {
        throw new Error('Please enter an array length');
      }
      length = BigInt(input);
      if (length === 0n) {
        throw new Error('Array length cannot be zero');
      }
      
      endSpan(validationSpan);
      
      const lenNum = Number(length);
      
      // Span 2: Array Creation
      const arraySpan = transaction.startSpan('array_creation', { 
        length: lenNum,
        length_string: input 
      }, 'process');
      
      const arr = new Array(lenNum);
      endSpan(arraySpan);
      
      // Span 3: Memory Calculation
      const calcSpan = transaction.startSpan('memory_calculation', { 
        length: lenNum,
        estimated_elements: arr.length 
      }, 'compute');
      
      const bytes = bytesForArrayLength(length);
      const hr = humanReadable(bytes);
      endSpan(calcSpan);
      
      // Span 4: Result Processing
      const resultSpan = transaction.startSpan('result_processing', { 
        bytes: bytes.toString(),
        human_readable: `${hr.value} ${hr.unit}`,
        bits: (bytes * 8n).toString()
      }, 'process');
      
      setResult({
        length: lenNum,
        bytes: bytes,
        humanReadable: `${hr.value} ${hr.unit}`,
        hrValue: hr.value,
        hrUnit: hr.unit,
        bits: bytes * 8n,
        traceId: transaction.traceId
      });
      
      endSpan(resultSpan);
      
      // End the transaction
      transaction.end();
      
      // Capture success message with trace context
      captureMessageWithTrace("Array memory calculation completed", 'info', {
        arrayLength: lenNum,
        memoryBytes: bytes.toString(),
        memoryReadable: `${hr.value} ${hr.unit}`,
        operation: 'calculate',
        success: true
      });
      
    } catch (err) {
      // End transaction on error
      if (transaction) transaction.end();
      
      setError(`Error: ${err.message}`);
      
      // Capture error with transaction context
      if (Sentry && Sentry.captureException) {
        Sentry.captureException(err, {
          tags: { 
            type: err.name,
            operation: 'calculate',
            trace_id: transaction?.traceId 
          },
          extra: { 
            input: lengthInput,
            length: length?.toString(),
            transactionId: transaction?.traceId,
            error_time: new Date().toISOString()
          }
        });
      }
      
      // For unhandled errors, rethrow asynchronously
      if (err.name === 'RangeError' || err.name === 'TypeError') {
        setTimeout(() => {
          throw err;
        }, 0);
      }
    }
  }, [lengthInput, bytesForArrayLength, humanReadable]);

  const handleKeyUp = useCallback((event) => {
    if (event.key === "Enter") {
      processCalculate();
    }
  }, [processCalculate]);

  const clearResults = useCallback(() => {
    // Start transaction for clear operation
    const transaction = startTransaction('clear_calculator', {
      had_result: !!result,
      had_error: !!error,
      previous_input: lengthInput,
      operation: 'clear'
    });
    
    if (transaction?.traceId) {
      console.log(`[Clear Transaction] ID: ${transaction.traceId}`);
    }
    
    // Span for clear operation
    const clearSpan = transaction?.startSpan('clear_operation', {
      previous_result_length: result?.length,
      previous_result_bytes: result?.bytes?.toString(),
      previous_trace_id: result?.traceId,
      action: 'user_triggered'
    }, 'action');
    
    setResult(null);
    setError('');
    setLengthInput('');
    inputRef.current?.focus();
    
    endSpan(clearSpan);
    if (transaction) transaction.end();
    
    // Capture clear action
    captureMessageWithTrace("User cleared calculator results", 'info', {
      action: 'clear_results',
      had_previous_result: !!result,
      had_previous_error: !!error,
      previous_input: lengthInput,
      previous_result: result ? {
        arrayLength: result.length,
        memoryBytes: result.bytes?.toString()
      } : null
    });
    
  }, [result, error, lengthInput]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>JavaScript Array Memory Usage (Estimated) Calculation</h1>
        <p>Sentry: Transaction Tracing + Error Capture Demo</p>
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
            
            {result.traceId && (
              <div className="trace-info">
                <strong>Trace ID:</strong> {result.traceId}
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
            <li><strong>Sentry Transaction Tracing:</strong>
              <ul>
                <li>Each calculation creates a complete transaction with unique Trace ID</li>
                <li>Nested spans track: Input Validation → Array Creation → Memory Calculation → Result Processing</li>
                <li>Clear button actions also create separate transactions</li>
                <li>Trace ID displayed with results for correlation</li>
                <li>All errors and messages include Trace ID for debugging</li>
              </ul>
            </li>
            <li><strong>Sentry Performance Monitoring:</strong>
              <ul>
                <li>Automatic performance instrumentation with browserTracingIntegration</li>
                <li>Transaction duration and status tracked automatically</li>
                <li>Distributed tracing ready for backend integration</li>
                <li>100% trace sampling rate for demo purposes</li>
              </ul>
            </li>
            <li><strong>Sentry Error Tracking:</strong>
              <ul>
                <li>Handled Errors: Empty and zero inputs are caught and logged</li>
                <li>Unhandled Errors: RangeError from large arrays captured automatically</li>
                <li>Custom deduplication: Reports 1st, 11th, 21th,,, errors daily</li>
                <li>Session Replay: Records user sessions for debugging</li>
                <li>Real-time monitoring in Sentry dashboard</li>
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