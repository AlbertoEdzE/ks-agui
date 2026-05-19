"""Write-side tool definitions from Component 25 (KSquare.AgenticActions)."""

AGENTIC_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "draft_referral",
            "description": (
                "Stage a referral creation for the current submission. "
                "Returns a draft action for underwriter confirmation. "
                "Does NOT create the referral yet."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "submission_id": {"type": "string"},
                    "referral_reason": {"type": "string"},
                    "priority": {
                        "type": "string",
                        "enum": ["Normal", "High", "Urgent"],
                    },
                    "assigned_to_queue": {"type": "string"},
                },
                "required": ["submission_id", "referral_reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_draft_action",
            "description": (
                "Execute a previously staged draft action after the underwriter confirmed it. "
                "Should only be called after explicit user confirmation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "draft_id": {
                        "type": "string",
                        "description": "The draft action ID returned by a previous draft_* tool call",
                    }
                },
                "required": ["draft_id"],
            },
        },
    },
]
