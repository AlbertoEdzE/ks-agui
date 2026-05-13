import * as React from 'react';
import { HttpAgent } from '@ag-ui/client';

export const AGUIContext = React.createContext<HttpAgent | null>(null);

/** @internal Clear signal shared between useAGUIMessages and useAGUISharedState. */
export interface AGUIClearSignal {
  version: number;
  bump: () => void;
}

export const AGUIClearContext = React.createContext<AGUIClearSignal>({
  version: 0,
  bump: () => {},
});

/** Returns the HttpAgent from the nearest AGUIProvider. */
export function useAGUIConnection(): HttpAgent | null {
  return React.useContext(AGUIContext);
}
