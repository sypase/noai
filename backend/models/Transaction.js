// models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  MerchantCode: String,
  RefId: String,
  TokenId: String,
  TranAmount: Number,
  RequestDate: Date,
  TransactionId: String,
  Msisdn: String,
  ImeTxnStatus: Number,
  ResponseDate: Date,
  ItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  UserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;