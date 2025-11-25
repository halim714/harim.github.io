export default async function handler(req, res) {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
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
                code: code
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
