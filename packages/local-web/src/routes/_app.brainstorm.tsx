import { createFileRoute } from '@tanstack/react-router';
import { BrainstormTerminal } from '@/features/brainstorm/ui/BrainstormTerminal';

export const Route = createFileRoute('/_app/brainstorm')({
  component: BrainstormTerminal,
});
