// routes/imepay.js
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Purchase from '../models/Purchase.js';
import CreditTransaction from '../models/CreditPool.js';
import Rewrites from '../models/Rewrites.js';
import dotenv from 'dotenv';
import logger from 'node-color-log';
import { validate } from "../middlewares/validate.js";

dotenv.config();

const router = express.Router();

// IME Pay configuration
const IME_PAY_API_URL = 'https://stg.imepay.com.np:7979/api/Web';
const MERCHANT_CODE = 'NOAI';
const API_USER = 'Noai';
const API_PASSWORD = 'ime@1234';
const MODULE = 'NOAI';

// Helper function to generate a unique RefId
const generateRefId = () => `REF-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

// Helper function to create authorization header
const getAuthHeader = () => `Basic ${Buffer.from(`${API_USER}:${API_PASSWORD}`).toString('base64')}`;

const getModule = () => Buffer.from(MODULE).toString('base64');

// Step 1: Get Token
async function getImePayToken(amount, refId) {
  try {
    const response = await axios.post(
      `${IME_PAY_API_URL}/GetToken`,
      {
        MerchantCode: MERCHANT_CODE,
        Amount: amount.toFixed(2),
        RefId: refId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
          Module: getModule(),
        },
      }
    );

    if (response.data.ResponseCode !== 0) {
      throw new Error(`Failed to get IME Pay token: ${response.data.ResponseCode}`);
    }

    return response.data;
  } catch (error) {
    console.error('IME Pay token request error:', error);
    throw error;
  }
}

// Step 2: Create IME Pay redirect URL
function createImePayRedirectUrl(tokenData, amount, respUrl, cancelUrl) {
  const payload = `${tokenData.TokenId}|${MERCHANT_CODE}|${tokenData.RefId}|${amount.toFixed(2)}|GET|${respUrl}|${cancelUrl}`;
  console.log(payload);
  const encodedPayload = Buffer.from(payload).toString('base64');
  return `https://stg.imepay.com.np:7979/WebCheckout/Checkout?data=${encodeURIComponent(encodedPayload)}`;
}

// Route to initiate IME Pay payment
router.post('/create-order-imepay', validate, async (req, res) => {
  try {
    const { item } = req.body;

    // Fetch the user from the database
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(req.user._id);

    // Fetch the item from the database
    const itemDetails = await Item.findById(item);
    if (!itemDetails) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const amount = itemDetails.price;
    const refId = generateRefId();

    // Step 1: Get Token
    const tokenData = await getImePayToken(amount, refId);

    // Store transaction details in your database
    await storeTransactionDetails({
      MerchantCode: MERCHANT_CODE,
      TranAmount: amount,
      RefId: refId,
      TokenId: tokenData.TokenId,
      RequestDate: new Date(),
      ItemId: item,
      UserId: user._id,
    });

    // Step 2: Create redirect URL
    const respUrl = `http://localhost:8080/imepay/callback`;
    const cancelUrl = `http://localhost:8080/imepay/payment-cancelled`;
    const redirectUrl = createImePayRedirectUrl(tokenData, amount, respUrl, cancelUrl);

    console.log(redirectUrl);

    // Return the redirect URL to the client
    res.json({ redirectUrl });
  } catch (error) {
    console.error('IME Pay order creation error:', error);
    res.status(500).json({ error: 'Failed to create IME Pay order' });
  }
});

// Step 5: Handle IME Pay callback
router.get('/callback', async (req, res) => {
  console.log("IME Pay callback received");
  try {
    const encodedData = req.query.data;
    const decodedData = Buffer.from(encodedData, 'base64').toString('utf-8');
    const [ResponseCode, ResponseDescription, Msisdn, TransactionId, RefId, TranAmount, TokenId] = decodedData.split('|');

    logger.log(ResponseCode, ResponseDescription, Msisdn, TransactionId, RefId, TranAmount, TokenId);

    // Update transaction details in the database
    await updateTransactionDetails({
      RefId,
      TransactionId,
      Msisdn,
      ImeTxnStatus: parseInt(ResponseCode),
      ResponseDate: new Date(),
    });

    if (ResponseCode === '0') {
      // Payment successful
      // Confirm the transaction
      await confirmImePayTransaction(RefId, TokenId, TransactionId, Msisdn);
      // res.redirect('/payment-success');
      res.redirect('http://localhost:3000/profile');
    } else {
      // Payment failed or cancelled
      res.redirect('/payment-failed');
    }
  } catch (error) {
    console.error('IME Pay callback error:', error);
    res.redirect('/payment-failed');
  }
});

// Step 6: Confirm Transaction
async function confirmImePayTransaction(refId, tokenId, transactionId, msisdn) {
  try {
    console.log(IME_PAY_API_URL);
    const response = await axios.post(
      `${IME_PAY_API_URL}/Confirm`,
      {
        MerchantCode: MERCHANT_CODE,
        RefId: refId,
        TokenId: tokenId,
        TransactionId: transactionId,
        Msisdn: msisdn,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
          Module: getModule(),
        },
      }
    );

    console.log(response.data);
    console.log(response.data.ResponseCode);

    // Map ResponseCode to ImeTxnStatus
    let imeTxnStatus;
    switch (response.data.ResponseCode) {
      case 0:
        imeTxnStatus = 0; // Success
        console.log("_____Confirmation__SUCCESS____");
        break;
      case 1:
        imeTxnStatus = 1; // Fail
        console.log("_____Confirmation__FAIL____");
        break;
      case 2:
        imeTxnStatus = 2; // Error
        console.log("_____Confirmation__ERROR____");
        break;
      case 3:
        imeTxnStatus = 3; // Cancelled
        console.log("_____Confirmation__CANCELLED____");
        break;
      default:
        imeTxnStatus = 2; // Treat unknown response codes as errors
        console.log("_____Confirmation__UNKNOWN_ERROR____");
    }

    // Update transaction status in your database
    await updateTransactionDetails({
      RefId: refId,
      TransactionId: transactionId,
      Msisdn: msisdn,
      ImeTxnStatus: imeTxnStatus,
      ResponseDate: new Date(),
    });

    if (imeTxnStatus === 0) {
      // Payment successful, update other models
      await updateModelsAfterSuccessfulPayment(refId);
    } else {
      throw new Error(`Failed to confirm IME Pay transaction: ${response.data.ResponseCode}`);
    }

    return response.data;
  } catch (error) {
    console.error('IME Pay confirmation error:', error);
    throw error;
  }
}

// Helper function to store transaction details
async function storeTransactionDetails(transactionData) {
  try {
    const transaction = new Transaction(transactionData);
    await transaction.save();
    console.log('Transaction details stored successfully');
  } catch (error) {
    console.error('Error storing transaction details:', error);
    throw error;
  }
}

// Helper function to update transaction details
async function updateTransactionDetails(transactionData) {
  try {
    await Transaction.updateOne({ RefId: transactionData.RefId }, transactionData);
    console.log('Transaction details updated successfully');
  } catch (error) {
    console.error('Error updating transaction details:', error);
    throw error;
  }
}

// Helper function to update models after successful payment
async function updateModelsAfterSuccessfulPayment(refId) {
  try {
    // Fetch the transaction details
    const transaction = await Transaction.findOne({ RefId: refId });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Fetch the item details
    const item = await Item.findById(transaction.ItemId);
    if (!item) {
      throw new Error('Item not found');
    }

    // Create a new Purchase
    const purchase = new Purchase({
      userId: transaction.UserId,
      itemId: transaction.ItemId,
      transactionId: transaction.TransactionId,
      amount: transaction.TranAmount,
      paymentMethod: 'IME Pay',
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    });
    await purchase.save();

    // Create a new CreditTransaction
    const creditTransaction = new CreditTransaction({
      userId: transaction.UserId,
      type: 'credit_purchase',
      amount: transaction.TranAmount,
    });
    await creditTransaction.save();

    // Update or create Rewrites
    const existingRewrites = await Rewrites.findOne({ userId: transaction.UserId });
    if (existingRewrites) {
      existingRewrites.rewrites += item.rewriteLimit;
      existingRewrites.expirationDate = new Date(Math.max(existingRewrites.expirationDate, purchase.expirationDate));
      await existingRewrites.save();
    } else {
      const newRewrites = new Rewrites({
        userId: transaction.UserId,
        rewrites: item.rewriteLimit,
        expirationDate: purchase.expirationDate,
      });
      await newRewrites.save();
    }

    console.log('Models updated successfully after payment');
  } catch (error) {
    console.error('Error updating models after payment:', error);
    throw error;
  }
}

// Additional routes for payment outcomes
router.get('/payment-success', (req, res) => {
  res.send('Payment successful! Thank you for your purchase.');
});

router.get('/payment-failed', (req, res) => {
  res.send('Payment failed. Please try again or contact support.');
});

router.get('/payment-cancelled', (req, res) => {
  res.send('Payment cancelled. You can try again when you\'re ready.');
});

export default router;