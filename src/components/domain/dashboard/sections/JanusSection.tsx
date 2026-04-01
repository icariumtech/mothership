import { JanusTerminal } from '@/components/domain/janus/JanusTerminal';
import './Section.css';

interface JanusSectionProps {
  isVisible?: boolean;
}

export function JanusSection({ isVisible = true }: JanusSectionProps) {
  return (
    <div className="section-janus">
      <JanusTerminal isVisible={isVisible} />
    </div>
  );
}
