import express from 'express';
import Referral from '../models/Referral.js';
import { validate } from '../middlewares/validate.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.send('This is a test referral');
});

router.get("/earned-points", validate, async (req, res) => {
  console.log("Fetching earned points...");
  try {
    console.log(req.user._id);
    const test1 = await Referral.countDocuments({
      status: 'completed'
    });
    console.log(test1);
    
    // Count total completed referrals where the user was referred
    const totalCompletedReferrals = await Referral.countDocuments({
      referrerId: req.user._id,
      status: 'completed'
    });

    

    console.log("Total completed referrals:", totalCompletedReferrals);

    // Find all referrals where the referredUserId matches the logged-in user's ID
    const referrals = await Referral.find({ 
      referrerId: req.user._id,
      status: 'completed'
    }).populate('referrerId', 'name');
    
    console.log("Referrals:", referrals);

    // Map the results to return the referrer name and reward amount
    const earnedPoints = referrals.map(referral => ({
      referrerName: referral.referrerId.name,
      rewardAmount: referral.rewardAmount
    }));

    res.send({ earnedPoints, totalCompletedReferrals });
  } catch (error) {
    console.error("Error fetching earned points:", error);
    res.status(500).send("Internal server error");
  }
});

export default router;