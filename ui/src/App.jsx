import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Sentry, startManualTrace, addManualSpan, finishManualTrace, getCurrentTraceId } from './Sentry';
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
    
    const trace = startManualTrace('array_memory_calculation', 'manual.task');
    if (trace) {
      console.log(`[Trace Started] ID: ${trace.traceId}`);
    }
    
    let length;
    
    try {
      const validationSpan = addManualSpan('input_validation', { input }, 'manual.validation');
      
      if (!input) {
        throw new Error('Please enter an array length');
      }
      length = BigInt(input);
      if (length === 0n) {
        throw new Error('Array length cannot be zero');
      }
      
      if (validationSpan && validationSpan.finish) {
        validationSpan.finish();
      }
    } catch (err) {
      setError(err.message);
      
      if (trace && trace.transaction) {
        finishManualTrace(trace.transaction);
      }
      
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
      const arraySpan = addManualSpan('array_creation', { length: lenNum }, 'manual.process');
      const arr = new Array(lenNum);
      
      if (arraySpan && arraySpan.finish) {
        arraySpan.finish();
      }
      
      const calcSpan = addManualSpan('memory_calculation', { length: lenNum }, 'manual.compute');
      const bytes = bytesForArrayLength(length);
      const hr = humanReadable(bytes);
      
      if (calcSpan && calcSpan.finish) {
        calcSpan.finish();
      }
      
      const resultSpan = addManualSpan('result_processing', { 
        bytes: bytes.toString(),
        readable: `${hr.value} ${hr.unit}`
      }, 'manual.process');
      
      const currentTraceId = trace?.traceId || getCurrentTraceId();
      
      setResult({
        length: lenNum,
        bytes: bytes,
        humanReadable: `${hr.value} ${hr.unit}`,
        hrValue: hr.value,
        hrUnit: hr.unit,
        bits: bytes * 8n,
        traceId: currentTraceId
      });
      
      if (resultSpan && resultSpan.finish) {
        resultSpan.finish();
      }
      
      if (trace && trace.transaction) {
        finishManualTrace(trace.transaction);
      }
      
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
      const currentTraceId = trace?.traceId || getCurrentTraceId();
      
      if (trace && trace.transaction) {
        finishManualTrace(trace.transaction);
      }
      
      setError(`Error: ${err.message}`);
      
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
    const trace = startManualTrace('clear_results', 'manual.action');
    const currentTraceId = trace?.traceId;
    
    if (currentTraceId) {
      console.log(`[Clear Results] Trace ID: ${currentTraceId}`);
    }
    
    const clearSpan = addManualSpan('clear_operation', {
      hadResult: !!result,
      hadError: !!error,
      previousInput: lengthInput,
      previousResultLength: result?.length,
      previousResultBytes: result?.bytes?.toString(),
      previousTraceId: result?.traceId
    }, 'manual.action');
    
    setResult(null);
    setError('');
    setLengthInput('');
    inputRef.current?.focus();
    
    if (clearSpan && clearSpan.finish) {
      clearSpan.finish();
    }
    
    if (trace && trace.transaction) {
      finishManualTrace(trace.transaction);
    }
    
    if (Sentry && Sentry.captureMessage) {
      Sentry.captureMessage("User cleared calculator results", {
        level: 'info',
        tags: { 
          action: 'clear_results',
          trace_id: currentTraceId,
          had_previous_result: !!result,
          had_previous_error: !!error
        },
        extra: {
          previousResult: result ? {
            arrayLength: result.length,
            memoryBytes: result.bytes?.toString(),
            memoryReadable: result.humanReadable,
            traceId: result.traceId
          } : null,
          previousError: error || null,
          previousInput: lengthInput,
          traceId: currentTraceId
        }
      });
    }
  }, [result, error, lengthInput]);

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
            
            {/* {result.traceId && (
              <div className="trace-info">
                <strong>Trace ID:</strong> {result.traceId}
              </div>
            )} */}
            
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
                <li>Clear button actions also traced with full context</li>
                <li>Trace ID displayed with results for correlation</li>
                <li>Errors tagged with Trace ID for debugging</li>
              </ul>
            </li>
            <li><strong>Sentry Error Tracking:</strong>
              <ul>
                <li>Handled Errors: Empty and zero inputs are caught and logged</li>
                <li>Unhandled Errors: RangeError from large arrays captured automatically</li>
                <li>Custom deduplication: Reports 1st, 11th, 21th,,, errors daily</li>
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