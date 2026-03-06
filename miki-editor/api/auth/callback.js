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

    // CORS: origin 검증을 토큰 교환 전에 수행 (UP-2 순서 버그 수정)
    let origin = req.headers.origin;
    if (!origin && req.headers.referer) {
        origin = new URL(req.headers.referer).origin;
    }
    origin = origin || '';

    const allowedOrigins = [
        process.env.ALLOWED_ORIGIN || 'https://meki.vercel.app',
        /^https:\/\/meki-.*\.vercel\.app$/,   // Vercel preview deploys (meki-*)
        /^https:\/\/miki-.*\.vercel\.app$/,   // Vercel preview deploys (miki-*)
        'https://miki-editor.vercel.app',     // 프로덕션 배포
        /^http:\/\/localhost:\d+$/,           // 로컬 개발
        /^http:\/\/127\.0\.0\.1:\d+$/         // 로컬 개발
    ];

    // Origin이 아예 빈 문자열이면 Same-Origin 요청이거나 프록시를 탔을 가능성이 높으므로 허용
    const isAllowed = !origin || allowedOrigins.some(o =>
        o instanceof RegExp ? o.test(origin) : o === origin
    );
    if (!isAllowed) {
        return res.status(403).json({ error: `Origin '${origin}' not allowed`, code: 'CORS_REJECTED' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);

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
            res.json({ token: data.access_token });
        } else {
            res.status(400).json({ error: data.error_description || 'Failed to get token' });
        }
    } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).json({ error: error.message });
    }
}

