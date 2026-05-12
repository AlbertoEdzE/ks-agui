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

/**
 * Represents a single message in the AG-UI conversation.
 */
export interface AGUIMessage {
  /**
   * Unique identifier for the message.
   */
  id: string;
  /**
   * The role of the entity that sent the message.
   */
  role: 'assistant' | 'user';
  /**
   * The text content of the message.
   */
  content: string;
  /**
   * The current streaming status of the message.
   */
  status: 'streaming' | 'complete';
  /**
   * Unix timestamp in milliseconds indicating when the message was created.
   */
  createdAt: number;
}

/**
 * Represents a tool call in the AG-UI conversation.
 */
export interface AGUIToolCall {
  /**
   * Unique identifier for the tool call.
   */
  id: string;
  /**
   * Name of the tool being called.
   */
  name: string;
  /**
   * Arguments passed to the tool.
   */
  args: Record<string, unknown>;
  /**
   * The current status of the tool call.
   */
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'complete';
  /**
   * Optional result returned by the tool execution.
   */
  result?: unknown;
}
