/**
 * Vendor name normalisation — maps human-readable names to CloudFuze enum values.
 * Ported and expanded from the original Python vendor_utils.py.
 */

const VENDOR_MAP: Record<string, string> = {
  'slack': 'SLACK',
  'google workspace': 'GOOGLE_WORKSPACE',
  'google_workspace': 'GOOGLE_WORKSPACE',
  'gsuite': 'GOOGLE_WORKSPACE',
  'g suite': 'GOOGLE_WORKSPACE',
  'google': 'GOOGLE_WORKSPACE',
  'github': 'GITHUB',
  'github enterprise': 'GITHUB',
  'jira': 'JIRA',
  'jira software': 'JIRA',
  'confluence': 'CONFLUENCE',
  'zoom': 'ZOOM',
  'figma': 'FIGMA',
  'notion': 'NOTION',
  'salesforce': 'SALESFORCE',
  'hubspot': 'HUBSPOT',
  'okta': 'OKTA',
  'azure ad': 'AZURE_AD',
  'azure active directory': 'AZURE_AD',
  'microsoft 365': 'MICROSOFT_365',
  'm365': 'MICROSOFT_365',
  'office 365': 'MICROSOFT_365',
  'microsoft office': 'MICROSOFT_365',
  'dropbox': 'DROPBOX',
  'box': 'BOX',
  'docusign': 'DOCUSIGN',
  'articulate 360': 'ARTICULATE_360',
  'articulate360': 'ARTICULATE_360',
  'articulate': 'ARTICULATE_360',
  'zendesk': 'ZENDESK',
  'intercom': 'INTERCOM',
  'asana': 'ASANA',
  'monday': 'MONDAY',
  'monday.com': 'MONDAY',
  'linear': 'LINEAR',
  'trello': 'TRELLO',
  'miro': 'MIRO',
  'loom': 'LOOM',
  'grammarly': 'GRAMMARLY',
  'webex': 'WEBEX',
  'cisco webex': 'WEBEX',
  'teams': 'MICROSOFT_TEAMS',
  'microsoft teams': 'MICROSOFT_TEAMS',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'gcp': 'GOOGLE_CLOUD',
  'google cloud': 'GOOGLE_CLOUD',
  'azure': 'AZURE',
  'microsoft azure': 'AZURE',
  'stripe': 'STRIPE',
  'twilio': 'TWILIO',
  'sendgrid': 'SENDGRID',
  'datadog': 'DATADOG',
  'pagerduty': 'PAGERDUTY',
  'sentry': 'SENTRY',
  'splunk': 'SPLUNK',
  'tableau': 'TABLEAU',
  'looker': 'LOOKER',
  'dbt': 'DBT',
  'snowflake': 'SNOWFLAKE',
  'airtable': 'AIRTABLE',
  'clickup': 'CLICKUP',
  'basecamp': 'BASECAMP',
  'harvest': 'HARVEST',
  'bamboohr': 'BAMBOOHR',
  'workday': 'WORKDAY',
  'rippling': 'RIPPLING',
  'gusto': 'GUSTO',
};

export function normalizeVendor(name: string): string {
  if (!name) return '';
  const key = name.trim().toLowerCase();
  return VENDOR_MAP[key] ?? name.trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * Coerce various input formats into a list of vendor strings.
 * Accepts: "Slack", ["Slack", "Figma"], [{vendor: "Slack"}]
 */
export function normalizeVendors(input: any): string[] {
  if (!input) return [];

  if (typeof input === 'string') {
    return input.split(',').map((v) => normalizeVendor(v.trim())).filter(Boolean);
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => {
      if (typeof item === 'string') return [normalizeVendor(item)];
      if (item?.vendor) return [normalizeVendor(item.vendor)];
      return [];
    });
  }

  return [];
}

/**
 * Coerce user input into a list of email strings.
 * Accepts: "user@example.com", ["a@b.com", "c@d.com"], [{email: "a@b.com"}]
 */
export function normalizeUsers(input: any): string[] {
  if (!input) return [];

  if (typeof input === 'string') {
    return input.split(',').map((e) => e.trim()).filter(Boolean);
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => {
      if (typeof item === 'string') return [item.trim()];
      if (item?.email) return [item.email.trim()];
      return [];
    });
  }

  return [];
}
