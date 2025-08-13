const { OAuth2Client } = require('google-auth-library');

// const client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);
const client = new OAuth2Client();

async function verifyGoogleToken(token) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience:[
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID
      ],
    });
    return ticket.getPayload();
  } catch (error) {
    // throw new Error(error)
    throw new Error('Invalid Google token');
  }
}

module.exports = { verifyGoogleToken };