/**
 * Connector tool definitions (OpenAI function-calling format)
 * and server-side executor that dispatches to /api/connectors/* routes.
 */

import { getAppUrl } from "@/lib/app-url";

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

export const CONNECTOR_TOOLS = [
  // Gmail
  {
    type: "function",
    function: {
      name: "gmail_search",
      description:
        "Search the user's Gmail inbox for emails matching a query. Returns a list of matching email summaries.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: 'Gmail search query, e.g. "from:boss@company.com subject:report"',
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (default 10, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gmail_read",
      description: "Read the full content of a specific Gmail message by its ID.",
      parameters: {
        type: "object",
        properties: {
          messageId: {
            type: "string",
            description: "The Gmail message ID (obtained from gmail_search results)",
          },
        },
        required: ["messageId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gmail_send",
      description: "Send an email on behalf of the user via Gmail.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body (plain text)" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },

  // Drive
  {
    type: "function",
    function: {
      name: "drive_list",
      description:
        "List files in the user's Google Drive. Optionally filter by name or MIME type.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: 'Drive query string, e.g. "name contains \'report\'"',
          },
          maxResults: { type: "number", description: "Max files to return (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "drive_read",
      description: "Export and read the text content of a Google Drive file (Docs, Sheets, etc.).",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "Google Drive file ID" },
        },
        required: ["fileId"],
      },
    },
  },

  // Calendar
  {
    type: "function",
    function: {
      name: "calendar_list_events",
      description: "List upcoming Google Calendar events for the user.",
      parameters: {
        type: "object",
        properties: {
          maxResults: { type: "number", description: "Max events to return (default 10)" },
          timeMin: {
            type: "string",
            description: "ISO 8601 start time filter (default: now)",
          },
          timeMax: {
            type: "string",
            description: "ISO 8601 end time filter (optional)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calendar_create_event",
      description: "Create a new event in the user's Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title" },
          description: { type: "string", description: "Event description (optional)" },
          startDateTime: {
            type: "string",
            description: "ISO 8601 start date-time, e.g. 2026-04-09T15:00:00",
          },
          endDateTime: {
            type: "string",
            description: "ISO 8601 end date-time (default: 1 hour after start)",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "List of attendee email addresses (optional)",
          },
        },
        required: ["summary", "startDateTime"],
      },
    },
  },

  // Docs
  {
    type: "function",
    function: {
      name: "docs_read",
      description: "Read the text content of a Google Doc by its document ID.",
      parameters: {
        type: "object",
        properties: {
          documentId: { type: "string", description: "Google Docs document ID" },
        },
        required: ["documentId"],
      },
    },
  },

  // Web Search
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information, recent events, or facts you may not know. Returns titles, snippets, and URLs with citation numbers. Always use when user asks about recent events or explicitly requests web search. For latest/news/current queries, request 8-10 results and prioritize newest official or reputable sources.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          limit: { type: "number", description: "Number of results to return (1-10, default 8)" },
        },
        required: ["query"],
      },
    },
  },

  // GitHub
  {
    type: "function",
    function: {
      name: "github_list_repos",
      description: "List the authenticated user's GitHub repositories.",
      parameters: {
        type: "object",
        properties: {
          maxResults: { type: "number", description: "Max repos to return (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_list_issues",
      description: "List open issues for a GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner (username or org)" },
          repo: { type: "string", description: "Repository name" },
          state: {
            type: "string",
            enum: ["open", "closed", "all"],
            description: "Filter by issue state (default: open)",
          },
        },
        required: ["owner", "repo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_create_issue",
      description: "Create a new issue in a GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner" },
          repo: { type: "string", description: "Repository name" },
          title: { type: "string", description: "Issue title" },
          body: { type: "string", description: "Issue body / description (optional)" },
          labels: {
            type: "array",
            items: { type: "string" },
            description: "Labels to apply (optional)",
          },
        },
        required: ["owner", "repo", "title"],
      },
    },
  },

  // Image Generation
  {
    type: "function",
    function: {
      name: "image_gen",
      description:
        "Generate an image from a text description using AI. Use when the user asks to create, draw, generate, or visualize an image.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image to generate",
          },
        },
        required: ["prompt"],
      },
    },
  },

  // Memory — persistent across conversations
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Save a fact about the user that should persist across conversations (like ChatGPT's memory feature). Use when the user explicitly says 'remember this', 'save this', or shares a stable preference/fact (e.g. 'I prefer dark mode', 'my dog's name is Rex', 'I work at Acme'). Don't save trivial one-off context.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Concise memory fact (one sentence, under 200 chars)",
          },
        },
        required: ["content"],
      },
    },
  },

  // Google Slides
  {
    type: "function",
    function: {
      name: "create_google_slides",
      description:
        "Generate a real Google Slides presentation in the user's Google Drive. Use when the user asks to create slides, a deck, a presentation, or a slideshow about any topic. Returns a shareable Google Slides link.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "What the presentation should be about" },
          slides: { type: "number", description: "Approximate number of slides (default 10, max 20)" },
        },
        required: ["topic"],
      },
    },
  },

  // Google Sheets
  {
    type: "function",
    function: {
      name: "create_google_sheets",
      description:
        "Generate a real Google Sheets spreadsheet in the user's Google Drive. Use when the user asks to create a sheet, spreadsheet, table, or data file with rows and columns about any topic. Returns a shareable Google Sheets link.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "What the sheet should contain" },
          rows: { type: "number", description: "How many data rows to populate (default 20, max 100)" },
        },
        required: ["topic"],
      },
    },
  },

  // Google Docs
  {
    type: "function",
    function: {
      name: "create_google_docs",
      description:
        "Generate a real Google Docs document in the user's Google Drive. Use when the user asks to write a document, report, essay, article, or doc about any topic. Returns a shareable Google Docs link.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "What the document should be about" },
          length: {
            type: "string",
            enum: ["short", "medium", "long"],
            description: "Document length (default medium)",
          },
          tone: { type: "string", description: "Writing tone (e.g. professional, casual, academic)" },
        },
        required: ["topic"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Route mapping
// ---------------------------------------------------------------------------

export const TOOL_METADATA = {
  web_search:             { path: "/api/connectors/search",        action: "search",       kind: "read",  requiresConfirmation: false },
  gmail_search:           { path: "/api/connectors/gmail",         action: "search",       kind: "read",  requiresConfirmation: false },
  gmail_read:             { path: "/api/connectors/gmail",         action: "read",         kind: "read",  requiresConfirmation: false },
  drive_list:             { path: "/api/connectors/drive",         action: "list",         kind: "read",  requiresConfirmation: false },
  drive_read:             { path: "/api/connectors/drive",         action: "read",         kind: "read",  requiresConfirmation: false },
  calendar_list_events:   { path: "/api/connectors/calendar",      action: "list_events",  kind: "read",  requiresConfirmation: false },
  docs_read:              { path: "/api/connectors/docs",          action: "read",         kind: "read",  requiresConfirmation: false },
  github_list_repos:      { path: "/api/connectors/github",        action: "list_repos",   kind: "read",  requiresConfirmation: false },
  github_list_issues:     { path: "/api/connectors/github",        action: "list_issues",  kind: "read",  requiresConfirmation: false },
  image_gen:              { path: "/api/image-gen",                action: "generate",     kind: "write", requiresConfirmation: true },
  save_memory:            { path: "/api/memory",                   action: "save",         kind: "write", requiresConfirmation: true },
  gmail_send:             { path: "/api/connectors/gmail",         action: "send",         kind: "write", requiresConfirmation: true },
  calendar_create_event:  { path: "/api/connectors/calendar",      action: "create_event", kind: "write", requiresConfirmation: true },
  github_create_issue:    { path: "/api/connectors/github",        action: "create_issue", kind: "write", requiresConfirmation: true },
  create_google_slides:   { path: "/api/connectors/google-slides", action: "create",       kind: "write", requiresConfirmation: true },
  create_google_sheets:   { path: "/api/connectors/google-sheets", action: "create",       kind: "write", requiresConfirmation: true },
  create_google_docs:     { path: "/api/connectors/google-docs",   action: "create",       kind: "write", requiresConfirmation: true },
} as const;

// ---------------------------------------------------------------------------
// Filtered tool sets
// ---------------------------------------------------------------------------

/** Only the web_search tool — added conditionally when enableWebSearch is true */
export const WEB_SEARCH_TOOLS = CONNECTOR_TOOLS.filter(
  (t) => t.function.name === "web_search"
);

/** All connector tools except web_search, image_gen, and always-on tools (memory) */
export const CONNECTOR_TOOLS_WITHOUT_SEARCH = CONNECTOR_TOOLS.filter(
  (t) =>
    TOOL_METADATA[t.function.name as keyof typeof TOOL_METADATA]?.kind === "read" &&
    t.function.name !== "web_search" &&
    t.function.name !== "image_gen"
);

/** Only the image_gen tool */
export const IMAGE_GEN_TOOLS = CONNECTOR_TOOLS.filter(
  (t) => t.function.name === "image_gen"
);

/** No write tools run automatically until the UI has explicit confirmation UX. */
export const ALWAYS_ON_TOOLS: typeof CONNECTOR_TOOLS = [];

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

/**
 * Execute a tool call server-side by forwarding to the matching connector route.
 * The `cookie` string from the original request is forwarded to maintain auth session.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  cookie: string
): Promise<string> {
  const route = TOOL_METADATA[toolName as keyof typeof TOOL_METADATA];
  if (!route) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
  if (route.requiresConfirmation) {
    return JSON.stringify({
      error: `Tool ${toolName} requires explicit user confirmation and cannot run automatically.`,
      code: "CONFIRMATION_REQUIRED",
    });
  }

  try {
    const res = await fetch(`${getAppUrl()}${route.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ action: route.action, ...toolInput }),
    });

    if (!res.ok) {
      const text = await res.text();
      return JSON.stringify({ error: `Connector error ${res.status}: ${text}` });
    }

    const data = await res.json();
    return JSON.stringify(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return JSON.stringify({ error: `Tool execution failed: ${msg}` });
  }
}
