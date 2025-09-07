import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const QRCodeGenerator = ({ url, size = 200 }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 1,
        color: {
          dark: '#6A11CB', // Dark purple color (dots)
          light: '#FFFFFF' // Background
        }
      }, error => {
        if (error) console.error('Error generating QR code:', error);
      });
    }
  }, [url, size]);

  return (
    <canvas ref={canvasRef} />
  );
};

export default QRCodeGenerator;
