import type OpenAI from 'openai';

/**
 * 15 read-only tools for the CloudFuze Manage AI agent.
 * Format: OpenAI function-calling (tool_choice: auto)
 * All tools query the PostgreSQL mirror — never MongoDB directly.
 */
export const TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_org_stats',
      description:
        "Get a high-level overview of the organisation's SaaS portfolio. Returns total app count, total spend, shadow IT count, unused licence count, and upcoming renewals. Use for 'executive summary' or 'what should I focus on today' questions.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_discovered_apps',
      description:
        'List all approved/integrated SaaS applications in the organisation. These are apps that have been onboarded and approved — each app has active_users and inactive_users counts showing user engagement. For unapproved/shadow IT apps use get_shadow_it instead. Use this for app inventory, category breakdown, and usage queries.',
      parameters: {
        type: 'object',
        properties: {
          with_users_only: {
            type: 'boolean',
            description: 'If true, return only apps that have at least 1 user. Default: false (return all).',
          },
          risk_level: {
            type: 'string',
            enum: ['HIGH', 'MEDIUM', 'LOW'],
            description: 'Filter by risk level.',
          },
          category: {
            type: 'string',
            description: 'Filter by app category (e.g. "communication", "productivity").',
          },
          limit: { type: 'number', description: 'Max results. Default 50.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_app_usage',
      description:
        'Get usage statistics for a specific SaaS app — active users, total assigned users, activity breakdown. Use when asked how an app is being used.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Name of the app (e.g. "Figma", "Slack").' },
        },
        required: ['app_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_licenses',
      description:
        'Get licence subscription details for all apps or a specific app. Returns seat counts, cost, renewal dates, utilisation. Use for licence overview queries.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Filter to a specific app. Omit for all.' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'all'],
            description: 'Filter by licence status.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_unused_licenses',
      description:
        "Find users with unused or inactive SaaS licences — people who have a seat but haven't used the app. Returns user details, app name, cost-per-seat. Use for cost optimisation and licence reclamation queries.",
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Filter to a specific app. Omit for all apps.' },
          inactive_days: {
            type: 'number',
            description: 'Consider a licence unused if not accessed in this many days. Default: 60.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_apps',
      description:
        'List all SaaS apps a specific user has access to, or list users in a department with their app counts. Use for user access audits and over-provisioning queries.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Filter by user email address.' },
          department: { type: 'string', description: 'Filter by department name.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spend_summary',
      description:
        'Get SaaS spend totals for the organisation. Can group by app, vendor, or department. Returns spend amounts, active/inactive user counts, potential savings. Use for cost/budget questions.',
      parameters: {
        type: 'object',
        properties: {
          group_by: {
            type: 'string',
            enum: ['app', 'vendor', 'department'],
            description: 'Dimension to group spend by. Default: app.',
          },
          limit: { type: 'number', description: 'Max results. Default: 20.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spend_anomalies',
      description:
        "Identify apps where spend is high relative to active users, or where potential savings are significant. Use for 'which apps are wasting money' queries.",
      parameters: {
        type: 'object',
        properties: {
          min_saving: {
            type: 'number',
            description: 'Minimum potential saving threshold in dollars. Default: 100.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_renewal_forecast',
      description:
        "List upcoming contract and licence renewals sorted by date. Use for 'what renews soon' or renewal planning queries.",
      parameters: {
        type: 'object',
        properties: {
          days_ahead: { type: 'number', description: 'How many days ahead to look. Default: 90.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_shadow_it',
      description:
        'List unauthorised or unapproved SaaS apps discovered via OAuth or browser extension. Includes risk level and user count. Use for shadow IT / compliance queries.',
      parameters: {
        type: 'object',
        properties: {
          risk_level: {
            type: 'string',
            enum: ['HIGH', 'MEDIUM', 'LOW', 'all'],
            description: 'Filter by risk level. Default: all.',
          },
          limit: { type: 'number', description: 'Max results. Default: 50.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_compliance_summary',
      description:
        'Get a compliance posture summary — apps without approved contracts, high-risk shadow IT, over-privileged users. Use for compliance and SOC2 gap queries.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_duplicate_tools',
      description:
        'Identify overlapping SaaS tools that serve the same function (e.g. two project management tools). Use for tool consolidation and cost reduction queries.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter to a category (e.g. "project management").' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contract_details',
      description:
        'Get full contract and renewal details for a specific app or all apps. Includes contract value, renewal date, auto-renew status.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'App or vendor name. Omit for all.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_apps',
      description:
        'Full-text search across all apps, vendors, and categories. Use when the user mentions an app name and you need to find it.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term — app name, vendor, or category.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_groups',
      description:
        'List SaaS groups and teams synced from CFGroup. Shows vendor, group name, member count. Use for questions about teams, groups, Microsoft Teams channels, Google groups, Slack channels.',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string', description: 'Filter by vendor (e.g. "MICROSOFT", "GOOGLE", "SLACK"). Omit for all.' },
          min_members: { type: 'number', description: 'Minimum member count filter. Default: 1.' },
          limit: { type: 'number', description: 'Max results. Default: 50.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workflows',
      description:
        'List all onboarding and offboarding workflows created in the organisation. Returns workflow names, types, status, and connected vendors.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['onboard', 'offboard', 'all'],
            description: 'Filter by workflow type. Default: all.',
          },
        },
        required: [],
      },
    },
  },
];
