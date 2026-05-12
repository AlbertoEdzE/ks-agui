/**
 * Represents an error encountered in the AG-UI system.
 * Used in AGUIProviderProps and error states.
 */
export interface AGUIError {
  /**
   * The specific error code determining the nature of the error.
   */
  code:
    | 'CONNECTION_FAILED'
    | 'MAX_RETRIES_EXCEEDED'
    | 'PARSE_ERROR'
    | 'TOOL_REJECTED'
    | 'RUN_ERROR'
    | 'INVALID_STATE_PATCH';
  /**
   * Optional human-readable message describing the error.
   */
  message?: string;
  /**
   * Optional reference to the underlying Event that triggered this error, if applicable.
   */
  originalEvent?: Event;
}
