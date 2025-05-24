import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verify(tokenId) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    return { email, name };
  } catch (error) {
    if (error.message.includes('wrong number of segments in token')) {
      throw new Error('Invalid token');
    } else if (error.message.includes('Token used too late')) {
      throw new Error('Token expired');
    } else {
      throw new Error('Error verifying Google authentication token');
    }
  }
}
