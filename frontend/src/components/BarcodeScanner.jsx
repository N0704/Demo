import React, { useState, useRef, useEffect } from 'react';

const BarcodeScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Khởi động camera
  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setScanning(true);
      
      // Lấy danh sách sản phẩm
      fetchProducts();
    } catch (err) {
      setError('Không thể truy cập camera: ' + err.message);
    }
  };

  // Dừng camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setScanning(false);
    }
  };

  // Chụp ảnh và gửi đến backend
  const captureAndScan = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Đặt kích thước canvas bằng kích thước video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Vẽ frame video vào canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Chuyển đổi canvas thành base64
    const imageData = canvas.toDataURL('image/jpeg');
    
    // Gửi đến backend
    fetch('http://127.0.0.1:5000/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setResult(data);
        // Lấy lại danh sách sản phẩm sau khi quét thành công
        fetchProducts();
      } else {
        setError(data.message || 'Không tìm thấy mã vạch');
      }
    })
    .catch(err => {
      setError('Lỗi kết nối: ' + err.message);
    });
  };

  // Lấy danh sách sản phẩm từ backend
  const fetchProducts = () => {
    fetch('http://127.0.0.1:5000/products')
      .then(response => response.json())
      .then(data => {
        if (!data.error) {
          setProducts(data);
        }
      })
      .catch(err => {
        console.error('Lỗi khi lấy danh sách sản phẩm:', err);
      });
  };

  // Xử lý sự kiện phím
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Ngăn hành vi mặc định của phím Enter
      if (event.key === 'Enter') {
        event.preventDefault();
        
        if (scanning) {
          captureAndScan();
        } else {
          startCamera();
        }
      }
      
      // Thêm phím Escape để tắt camera
      if (event.key === 'Escape' && scanning) {
        event.preventDefault();
        stopCamera();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [scanning]);

  return (
    <div className="barcode-scanner">
      <h1>Quét Mã Vạch Sản Phẩm</h1>
      
      <div className="controls">
        {!scanning ? (
          <button onClick={startCamera}>Bật Camera</button>
        ) : (
          <button onClick={stopCamera}>Tắt Camera</button>
        )}
        
        {scanning && (
          <button onClick={captureAndScan}>Quét Mã Vạch (hoặc nhấn Enter)</button>
        )}
      </div>
      
      <div className="instructions">
        {scanning && <p>Hướng mã vạch vào camera và nhấn Enter để quét</p>}
      </div>
      
      <div className="camera-preview">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ display: scanning ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {result && (
        <div className="result">
          <h2>Kết quả quét:</h2>
          <p><strong>Mã vạch:</strong> {result.barcode}</p>
          <p><strong>Loại:</strong> {result.type}</p>
          <p><strong>Tên sản phẩm:</strong> {result.product.name}</p>
          <p><strong>Thương hiệu:</strong> {result.product.brand}</p>
          <p><strong>Số lượng:</strong> {result.product.quantity}</p>
        </div>
      )}
      
      <div className="product-list">
        <h2>Lịch sử sản phẩm</h2>
        <table>
          <thead>
            <tr>
              <th>Mã vạch</th>
              <th>Tên sản phẩm</th>
              <th>Thương hiệu</th>
              <th>Số lượng</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={index}>
                <td>{product.Barcode}</td>
                <td>{product.Name}</td>
                <td>{product.Brand}</td>
                <td>{product.Quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BarcodeScanner;