import { JanusPanel } from '@/components/gm/JanusPanel';
import './JanusView.css';

interface JanusViewProps {
  channel: string;
  currentViewType: string;
  janusDialogOpen: boolean;
  onDialogToggle: () => void;
}

export function JanusView({ channel, currentViewType, janusDialogOpen, onDialogToggle }: JanusViewProps) {
  return (
    <div className="janus-view">
      <JanusPanel
        channel={channel}
        currentViewType={currentViewType}
        janusDialogOpen={janusDialogOpen}
        onDialogToggle={onDialogToggle}
      />
    </div>
  );
}
