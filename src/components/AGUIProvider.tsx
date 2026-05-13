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
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = React.useRef(0);
  const pingAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    isMountedRef.current = true;

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

    const connect = () => {
      if (!isMountedRef.current) return;

      // Abort any previous ping before creating a new connection
      if (pingAbortRef.current) pingAbortRef.current.abort();

      const config: any = { url: endpoint };
      if (headers) config.headers = headers;
      if (threadId) config.threadId = threadId;
      const currentAgent = new HttpAgent(config);

      // Wrap subscribe to catch parse errors and SDK failures
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
        },
        onStateDeltaEvent: ({ event }) => {
          // Validate RFC 6902 operations before the SDK attempts to apply them
          const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
          if (Array.isArray(event.delta)) {
            for (const op of event.delta as any[]) {
              if (!op.op || !validOps.includes(op.op)) {
                console.warn('INVALID_STATE_PATCH', new Error(`Invalid JSON Patch operation: "${op.op}"`));
                break;
              }
            }
          }
        }
      });

      agentRef.current = currentAgent;
      setAgent(currentAgent);

      // Long-lived SSE probe: reads the body to detect mid-stream connection drops.
      // Properly aborted on unmount or reconnect via pingAbortRef.
      const abortController = new AbortController();
      pingAbortRef.current = abortController;

      fetch(endpoint, { method: 'GET', headers: headers as HeadersInit, signal: abortController.signal })
        .then(async (response) => {
          retryCountRef.current = 0;
          if (!response.body) return;
          const reader = response.body.getReader();
          try {
            for (;;) {
              const { done } = await reader.read();
              if (done) break;
            }
            // Stream ended normally (server closed connection) — reconnect
            if (isMountedRef.current && !abortController.signal.aborted) {
              handleDisconnect();
            }
          } catch (_) {
            if (!isMountedRef.current || abortController.signal.aborted) return;
            handleDisconnect();
          } finally {
            reader.releaseLock();
          }
        })
        .catch((err) => {
          if (!isMountedRef.current || (err as Error)?.name === 'AbortError') return;
          if (retryCountRef.current === 0 && onError) {
            onError({ code: 'CONNECTION_FAILED', message: (err as Error)?.message || 'Connection failed' });
          }
          handleDisconnect();
        });
    };

    connect();

    return () => {
      isMountedRef.current = false;
      if (pingAbortRef.current) pingAbortRef.current.abort();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (agentRef.current) agentRef.current.abortRun();
    };
  }, [endpoint, headers, threadId, onError]);

  return (
    <AGUIClearContext.Provider value={{ version: clearVersion, bump: bumpClear }}>
      <AGUIContext.Provider value={agent}>{children}</AGUIContext.Provider>
    </AGUIClearContext.Provider>
  );
}
