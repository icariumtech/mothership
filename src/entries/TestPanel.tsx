import ReactDOM from 'react-dom/client';
import { Panel } from '@components/ui/Panel';

function TestApp() {
  return (
    <Panel title="TEST PANEL">
      <p>If you can see this, React is working!</p>
      <p style={{ marginTop: '10px', color: '#5a7a7a' }}>
        This panel component matches the existing terminal styling.
      </p>
      <p style={{ marginTop: '10px' }}>&gt; SYSTEM STATUS: NOMINAL</p>
      <p>&gt; REACTOR CORE: ONLINE</p>
      <p>&gt; LIFE SUPPORT: OPERATIONAL</p>
      <p>&gt; HULL INTEGRITY: 100%</p>
      <p>&gt; NAVIGATION: STANDBY</p>
      <p>&gt; COMMUNICATIONS: ACTIVE</p>
      <p>&gt; CARGO BAY: SEALED</p>
      <p>&gt; CREW QUARTERS: PRESSURIZED</p>
      <p>&gt; MEDICAL BAY: READY</p>
      <p>&gt; ARMORY: LOCKED</p>
      <p>&gt; ENGINE ROOM: NOMINAL</p>
      <p>&gt; BRIDGE: OPERATIONAL</p>
      <p style={{ marginTop: '10px', color: '#8b7355' }}>
        Scroll down to verify scrollbar styling...
      </p>
    </Panel>
  );
}

const root = document.getElementById('test-panel-root');
if (root) {
  ReactDOM.createRoot(root).render(<TestApp />);
}
