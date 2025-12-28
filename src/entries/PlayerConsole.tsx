import { createRoot } from 'react-dom/client';
import { MessageList } from '@/components/domain/messages';

// CSS animations for the terminal (muted teal/amber theme)
const styles = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideIn {
    from {
      transform: translateX(100px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .blink {
    animation: blink 1s step-start infinite;
  }
`;

function PlayerConsole() {
  return (
    <>
      <style>{styles}</style>
      <MessageList pollInterval={3000} />
    </>
  );
}

// Mount the React app
const container = document.getElementById('player-console-root');
if (container) {
  const root = createRoot(container);
  root.render(<PlayerConsole />);
}
