


import React, { useState } from 'react';
import axios from 'axios';

const ManualPayment = ({ item }) => {
  const [transactionDetails, setTransactionDetails] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [orderId, setOrderId] = useState('');

  const handlePayment = async () => {
    try {
      const response = await axios.post('/create-manual-order', { itemId: item });
      setQrData(response.data.qrData);
      setOrderId(response.data.orderId);
      setShowQR(true);
    } catch (error) {
      console.error('Error creating manual order:', error);
    }
  };

  const handleConfirmPayment = async () => {
    try {
      const response = await axios.post('/confirm-manual-payment', {
        transactionDetails,
        orderId,
      });
      // Handle successful payment confirmation
      console.log('Payment confirmed:', response.data);
    } catch (error) {
      console.error('Error confirming manual payment:', error);
    }
  };

  return (
    <div>
      {!showQR ? (
        <button onClick={handlePayment}>Pay Manually</button>
      ) : (
        <div>
          <h2>Scan QR Code and Enter Transaction Details</h2>
          <img src={qrData} alt="QR Code" />
          <input
            type="text"
            placeholder="Enter Transaction Details"
            value={transactionDetails}
            onChange={(e) => setTransactionDetails(e.target.value)}
          />
          <button onClick={handleConfirmPayment}>Confirm Payment</button>
        </div>
      )}
    </div>
  );
};

export default ManualPayment;