import express from 'express';

const router = express.Router();

// Test route
router.get('/', (req, res) => {
  res.send('This is a test route');
});


export default router;