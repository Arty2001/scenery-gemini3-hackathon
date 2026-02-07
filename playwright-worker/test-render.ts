/**
 * Quick test script for the Playwright worker
 * Run with: npx tsx test-render.ts
 */

const testBundle = `
// Simple test component
window.__SCENERY_COMPONENT__ = function TestButton(props) {
  return React.createElement('button', {
    style: { padding: '8px 16px', backgroundColor: '#171717', color: '#fff', borderRadius: '6px' },
    type: 'button',
  }, props.label || 'Click me');
};
`;

async function test() {
  console.log('Testing Playwright worker...\n');

  // Test health
  const healthRes = await fetch('http://localhost:3001/health');
  const health = await healthRes.json();
  console.log('Health check:', health);

  // Test render
  console.log('\nTesting render...');
  const renderRes = await fetch('http://localhost:3001/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bundledJs: testBundle,
      componentName: 'TestButton',
      props: { label: 'Hello World' },
      timeout: 10000,
    }),
  });

  const result = await renderRes.json();
  console.log('\nRender result:');
  console.log('Success:', result.success);
  console.log('Render time:', result.renderTime, 'ms');
  if (result.error) {
    console.log('Error:', result.error);
  }
  if (result.html) {
    console.log('HTML:', result.html.slice(0, 200) + '...');
  }
}

test().catch(console.error);
