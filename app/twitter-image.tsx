import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Scenery - AI Video Generation for React Components';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          backgroundImage: 'radial-gradient(circle at 25% 25%, #1a1a2e 0%, #000 50%), radial-gradient(circle at 75% 75%, #16213e 0%, #000 50%)',
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            opacity: 0.3,
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 60,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            opacity: 0.2,
            filter: 'blur(60px)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px',
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: 30,
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fff 0%, #a0a0a0 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              marginBottom: 20,
              letterSpacing: '-2px',
            }}
          >
            Scenery
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 32,
              color: '#888',
              marginBottom: 40,
              maxWidth: 800,
            }}
          >
            AI-Powered Video Generation for React Components
          </div>

          {/* Features */}
          <div
            style={{
              display: 'flex',
              gap: 40,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#667eea',
                fontSize: 20,
              }}
            >
              <span>7 Gemini Integrations</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#764ba2',
                fontSize: 20,
              }}
            >
              <span>Multi-Agent System</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#f5576c',
                fontSize: 20,
              }}
            >
              <span>Real Browser Rendering</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#555',
            fontSize: 18,
          }}
        >
          <span>Powered by Gemini 3 Pro</span>
          <span>•</span>
          <span>Google DeepMind Hackathon 2026</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
