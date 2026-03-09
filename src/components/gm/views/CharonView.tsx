import { CharonPanel } from '@/components/gm/CharonPanel';
import './CharonView.css';

interface CharonViewProps {
  channel: string;
  currentViewType: string;
  charonDialogOpen: boolean;
  onDialogToggle: () => void;
}

export function CharonView({ channel, currentViewType, charonDialogOpen, onDialogToggle }: CharonViewProps) {
  return (
    <div className="charon-view">
      <CharonPanel
        channel={channel}
        currentViewType={currentViewType}
        charonDialogOpen={charonDialogOpen}
        onDialogToggle={onDialogToggle}
      />
    </div>
  );
}
