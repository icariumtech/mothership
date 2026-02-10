import { CharonTerminal } from '@/components/domain/charon/CharonTerminal';
import './Section.css';

interface CharonSectionProps {
  isVisible?: boolean;
}

export function CharonSection({ isVisible = true }: CharonSectionProps) {
  return (
    <div className="section-charon">
      <CharonTerminal isVisible={isVisible} />
    </div>
  );
}
