import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useAGUIConnection, AGUIClearContext } from './useAGUIConnection';
import * as jsonpatch from 'fast-json-patch';

export function useAGUISharedState() {
  const agent = useAGUIConnection();
  const { version: clearVersion } = React.useContext(AGUIClearContext);
  const [state, setStateValue] = useState<Record<string, any>>({});

  // Reset to {} whenever clearMessages is called
  useEffect(() => {
    setStateValue({});
  }, [clearVersion]);

  useEffect(() => {
    if (!agent) return;

    const sub = agent.subscribe({
      onStateSnapshotEvent: ({ event }) => {
        setStateValue(event.snapshot as Record<string, any>);
      },
      onStateDeltaEvent: ({ event }) => {
        setStateValue(prev => {
          try {
            return jsonpatch.applyPatch(JSON.parse(JSON.stringify(prev)), event.delta as any).newDocument;
          } catch(e) {
            console.warn('INVALID_STATE_PATCH', e);
            return prev;
          }
        });
      }
    });

    return () => sub.unsubscribe();
  }, [agent]);

  const setState = useCallback((newState: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
    if (!agent) return;
    setStateValue(prev => {
      const updated = typeof newState === 'function' ? newState(prev) : newState;
      
      agent.addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        type: 'StateSnapshot',
        state: updated
      } as any);
      
      agent.runAgent();
      return updated;
    });
  }, [agent]);

  return { state, setState };
}
