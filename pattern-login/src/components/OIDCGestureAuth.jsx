import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function OIDCGestureAuth() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [gestureData, setGestureData] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const canvasRef = useRef(null);
  
  const sessionId = searchParams.get('session');
  const redirectUri = searchParams.get('redirect');
  const state = searchParams.get('state');

  useEffect(() => {
    if (!sessionId || !redirectUri || !state) {
      setStatus('❌ Invalid authentication request');
    }
  }, [sessionId, redirectUri, state]);

  // Canvas drawing
  const startDrawing = (e) => {
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      timestamp: Date.now()
    };
    setGestureData([point]);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (gestureData.length > 0) {
      const lastPoint = gestureData[gestureData.length - 1];
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    setGestureData([...gestureData, { x, y, timestamp: Date.now() }]);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setGestureData([]);
    setStatus('');
  };

  const submitGesture = async () => {
    if (gestureData.length < 3) {
      setStatus('❌ Please draw a pattern first');
      return;
    }

    setLoading(true);
    setStatus('⏳ Verifying your gesture...');

    try {
      const response = await fetch('http://localhost:5000/api/oidc/verify-gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          gestureData
        })
      });

      const result = await response.json();

      if (result.success) {
        setStatus('✅ Authentication successful! Redirecting...');
        setTimeout(() => {
          window.location.href = result.redirectUrl;
        }, 1000);
      } else {
        setStatus(`❌ ${result.error || 'Authentication failed'}`);
        setLoading(false);
      }
    } catch (error) {
      console.error('OIDC Auth Error:', error);
      setStatus('❌ Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2.5rem',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', color: '#333', fontSize: '1.8rem' }}>
            🔐 SecuADR Authentication
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '0.95rem' }}>
            Draw your gesture pattern to authenticate
          </p>
        </div>

        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          style={{
            border: '3px solid #667eea',
            borderRadius: '12px',
            cursor: 'crosshair',
            background: 'white',
            display: 'block',
            margin: '0 auto',
            touchAction: 'none'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />

        <div style={{ 
          marginTop: '1.5rem',
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center'
        }}>
          <button
            onClick={clearCanvas}
            disabled={loading}
            style={{
              padding: '0.8rem 2rem',
              border: '2px solid #667eea',
              background: 'white',
              color: '#667eea',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              opacity: loading ? 0.5 : 1
            }}
          >
            Clear
          </button>
          <button
            onClick={submitGesture}
            disabled={loading}
            style={{
              padding: '0.8rem 2rem',
              border: '2px solid #667eea',
              background: '#667eea',
              color: 'white',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              opacity: loading ? 0.5 : 1
            }}
          >
            Authenticate
          </button>
        </div>

        {status && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            borderRadius: '8px',
            background: status.includes('✅') ? '#d4edda' : 
                       status.includes('⏳') ? '#fff3cd' : '#f8d7da',
            color: status.includes('✅') ? '#155724' : 
                   status.includes('⏳') ? '#856404' : '#721c24',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            {status}
          </div>
        )}

        <div style={{ 
          marginTop: '2rem', 
          textAlign: 'center',
          color: '#999',
          fontSize: '0.85rem' 
        }}>
          🔒 Secured by SecuADR AI-Powered Authentication
        </div>
      </div>
    </div>
  );
}
