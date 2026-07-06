// ---------- OAuth 2.0 PKCE helpers ----------
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

function generateCodeChallenge(verifier) {
  const hash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return hash.then(buffer => base64URLEncode(new Uint8Array(buffer)));
}

function base64URLEncode(buffer) {
  return btoa(String.fromCharCode.apply(null, buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---------- Cognito configuration ----------
const COGNITO_DOMAIN = "smart-fleet-469128506110.auth.us-east-1.amazoncognito.com"; // replace with your domain
const CLIENT_ID = "jtrstosb4lab49ro1eoqn5orc";      // get from Terraform output
const REDIRECT_URI = window.location.origin + "/index.html";  // our dashboard
const AUTHORIZE_URL = `https://${COGNITO_DOMAIN}/oauth2/authorize`;
const TOKEN_URL = `https://${COGNITO_DOMAIN}/oauth2/token`;

// ---------- Token storage ----------
function setTokens(idToken, accessToken, refreshToken, expiresIn) {
  sessionStorage.setItem('id_token', idToken);
  sessionStorage.setItem('access_token', accessToken);
  sessionStorage.setItem('refresh_token', refreshToken);
  // Note: id_token expiry is in seconds, convert to timestamp
  const expiryTime = Date.now() + expiresIn * 1000;
  sessionStorage.setItem('token_expiry', expiryTime);
}

function getStoredTokens() {
  return {
    idToken: sessionStorage.getItem('id_token'),
    accessToken: sessionStorage.getItem('access_token'),
    refreshToken: sessionStorage.getItem('refresh_token'),
    expiry: parseInt(sessionStorage.getItem('token_expiry') || '0')
  };
}

function isTokenValid() {
  const { idToken, expiry } = getStoredTokens();
  return idToken && expiry && Date.now() < expiry - 60000; // 1 min buffer
}

// ---------- Initiate login ----------
async function login() {
  const codeVerifier = generateCodeVerifier();
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'openid email profile'
  });

  window.location.href = `${AUTHORIZE_URL}?${params.toString()}`;
}

// ---------- Handle callback and exchange code for tokens ----------
async function handleAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (!code) return false;

  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  if (!codeVerifier) throw new Error('Missing code verifier');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code: code,
    code_verifier: codeVerifier
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });

  const data = await response.json();
  if (data.id_token) {
    setTokens(data.id_token, data.access_token, data.refresh_token, data.expires_in);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  } else {
    console.error('Token exchange failed', data);
    return false;
  }
}

// ---------- Refresh token (if needed) ----------
async function refreshAccessToken() {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) throw new Error('No refresh token');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  const data = await response.json();
  setTokens(data.id_token, data.access_token, data.refresh_token, data.expires_in);
  return data.id_token;
}

// ---------- Logout ----------
function logout() {
  // Clear all local session storage
  sessionStorage.clear();

  // Construct the Cognito logout URL
  const logoutUrl = `https://${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(window.location.origin)}`;
  window.location.href = logoutUrl;
}