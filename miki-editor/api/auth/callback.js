export default async function handler(req, res) {
    const { code, code_verifier, state } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    if (!code_verifier) {
        return res.status(400).json({ error: 'No code_verifier provided (PKCE required)' });
    }

    if (!state) {
        return res.status(400).json({ error: 'No state parameter provided (CSRF protection required)' });
    }

    try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: code,
                code_verifier: code_verifier
            })
        });

        const data = await response.json();

        if (data.access_token) {
            // CORS 설정
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.json({ token: data.access_token });
        } else {
            res.status(400).json({ error: data.error_description || 'Failed to get token' });
        }
    } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).json({ error: error.message });
    }
}
