import * as React from 'react';
import type { AGUIProviderProps } from '../types/index';
import { HttpAgent } from '@ag-ui/client';
import { AGUIContext, AGUIClearContext } from '../hooks/useAGUIConnection';

export function AGUIProvider({ endpoint, headers, threadId, onError, children }: AGUIProviderProps) {
  const [agent, setAgent] = React.useState<HttpAgent | null>(null);
  const [clearVersion, setClearVersion] = React.useState(0);
  const bumpClear = React.useCallback(() => setClearVersion(v => v + 1), []);
  const isMountedRef = React.useRef(true);
  const agentRef = React.useRef<HttpAgent | null>(null);

  React.useEffect(() => {
    isMountedRef.current = true;

    const connect = () => {
      if (!isMountedRef.current) return;

      const config: any = { url: endpoint };
      if (headers) config.headers = headers;
      if (threadId) config.threadId = threadId;
      const currentAgent = new HttpAgent(config);

      // Wrap subscribe to catch parse errors and other SDK failures
      const originalSubscribe = currentAgent.subscribe.bind(currentAgent);
      currentAgent.subscribe = (subscriber: any) => {
        const wrappedSubscriber = {
          ...subscriber,
          onRunFailed: async (params: any) => {
            const msg = params.error?.message?.toLowerCase() || '';
            if (msg.includes('parse') || msg.includes('json') || msg.includes('syntax') || msg.includes('invalid_type') || msg.includes('required')) {
              console.warn('PARSE_ERROR', params.error);
            } else if (msg.includes('patch') || msg.includes('operation') || msg.includes('apply') || msg.includes('state')) {
              console.warn('INVALID_STATE_PATCH', params.error);
            }
            return subscriber.onRunFailed?.(params);
          }
        };
        return originalSubscribe(wrappedSubscriber);
      };

      currentAgent.subscribe({
        onRunErrorEvent: ({ event }) => {
          if (onError) {
            const code = (event as any).code === 'TOOL_REJECTED' ? 'TOOL_REJECTED' : 'RUN_ERROR';
            onError({ code, message: (event as any).message || 'Run error', originalEvent: event as any });
          }
        }
      });

      agentRef.current = currentAgent;
      setAgent(currentAgent);
    };

    connect();

    return () => {
      isMountedRef.current = false;
      if (agentRef.current) agentRef.current.abortRun();
    };
  }, [endpoint, headers, threadId, onError]);

  return (
    <AGUIClearContext.Provider value={{ version: clearVersion, bump: bumpClear }}>
      <AGUIContext.Provider value={agent}>{children}</AGUIContext.Provider>
    </AGUIClearContext.Provider>
  );
}
