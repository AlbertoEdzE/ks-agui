import * as React from 'react';
import type { AGUIProviderProps } from '../types/index';
import { HttpAgent } from '@ag-ui/client';
import { AGUIContext } from '../hooks/useAGUIConnection';

export function AGUIProvider({ endpoint, headers, threadId, onError, children }: AGUIProviderProps) {
  const [agent, setAgent] = React.useState<HttpAgent | null>(null);
  const reconnectTimeoutRef = React.useRef<any>(null);
  const isMountedRef = React.useRef(true);
  const retryCountRef = React.useRef(0);
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

      fetch(endpoint, { method: 'GET', headers: headers as HeadersInit })
        .then(() => {
          retryCountRef.current = 0;
        })
        .catch((err) => {
          if (retryCountRef.current === 0 && onError) {
            onError({ code: 'CONNECTION_FAILED', message: err?.message || 'Connection failed' });
          }
          handleDisconnect();
        });
    };

    const handleDisconnect = () => {
      if (!isMountedRef.current) return;

      retryCountRef.current++;

      if (retryCountRef.current > 5) {
        if (onError) {
          onError({ code: 'MAX_RETRIES_EXCEEDED', message: 'Maximum reconnect retries exceeded' });
        }
        return;
      }

      const backoff = Math.min(Math.pow(2, retryCountRef.current - 1) * 1000, 30000);
      reconnectTimeoutRef.current = setTimeout(connect, backoff);
    };

    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (agentRef.current) agentRef.current.abortRun();
    };
  }, [endpoint, headers, threadId, onError]);

  return <AGUIContext.Provider value={agent}>{children}</AGUIContext.Provider>;
}
