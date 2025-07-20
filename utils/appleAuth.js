const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys'
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

async function verifyAppleToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      algorithms: ['RS256'],
      audience: process.env.APPLE_CLIENT_ID,
      issuer: 'https://appleid.apple.com'
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = { verifyAppleToken };