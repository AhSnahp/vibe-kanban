import { useCallback, useEffect } from 'react';
import { useBrainstormStore } from '../model/stores/useBrainstormStore';
import {
  useBrainstormSessions,
  useBrainstormSession,
  useCreateBrainstormSession,
  useDeleteBrainstormSession,
} from '../model/hooks/useBrainstormSessions';
import { BrainstormSidebar } from './BrainstormSidebar';
import { BrainstormMessageList } from './BrainstormMessageList';
import { BrainstormInput } from './BrainstormInput';
import { BrainstormPlanReview } from './BrainstormPlanReview';

export function BrainstormTerminal() {
  const activeSessionId = useBrainstormStore((s) => s.activeSessionId);
  const setActiveSessionId = useBrainstormStore((s) => s.setActiveSessionId);
  const { data: sessions = [] } = useBrainstormSessions();
  const { data: sessionDetail } = useBrainstormSession(activeSessionId);
  const createSession = useCreateBrainstormSession();
  const deleteSession = useDeleteBrainstormSession();

  // Auto-select first session if none is active
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions, setActiveSessionId]);

  const handleCreateSession = useCallback(async () => {
    const session = await createSession.mutateAsync({
      title: null,
      system_prompt: null,
      project_id: null,
    });
    setActiveSessionId(session.id);
  }, [createSession, setActiveSessionId]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession.mutateAsync(id);
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    },
    [deleteSession, activeSessionId, setActiveSessionId]
  );

  return (
    <div className="flex h-full bg-primary">
      <BrainstormSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        context={sessionDetail?.context ?? []}
      />
      <div className="flex flex-1 flex-col min-w-0">
        {activeSessionId && sessionDetail ? (
          <>
            <BrainstormMessageList
              messages={sessionDetail.messages}
              sessionTitle={sessionDetail.session.title}
            />
            <BrainstormInput sessionId={activeSessionId} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-low">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-high mb-2">
                Brainstorm Terminal
              </h2>
              <p className="text-sm mb-4">
                Deep project planning with Claude. Brainstorm ideas, then push
                them to your kanban board.
              </p>
              <button
                onClick={handleCreateSession}
                className="px-4 py-2 bg-brand text-white rounded-md hover:opacity-90 transition-opacity"
              >
                Start New Session
              </button>
            </div>
          </div>
        )}
      </div>
      {activeSessionId && <BrainstormPlanReview sessionId={activeSessionId} />}
    </div>
  );
}
