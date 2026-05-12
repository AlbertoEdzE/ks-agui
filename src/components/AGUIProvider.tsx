import * as React from 'react';
import type { AGUIProviderProps } from '../types/index';
import { HttpAgent } from '@ag-ui/client';

export const AGUIContext = React.createContext<HttpAgent | null>(null);

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
      agentRef.current = currentAgent;
      setAgent(currentAgent);

      currentAgent.connectAgent({}).then(() => {
        handleDisconnect();
      }).catch(() => {
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
