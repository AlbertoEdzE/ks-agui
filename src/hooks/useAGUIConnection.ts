import * as React from 'react';
import { HttpAgent } from '@ag-ui/client';

export const AGUIContext = React.createContext<HttpAgent | null>(null);

export function useAGUIConnection(): HttpAgent | null {
  return React.useContext(AGUIContext);
}
