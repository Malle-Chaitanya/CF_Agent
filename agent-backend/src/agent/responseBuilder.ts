/**
 * Extracts structured widget JSON from the agent's text response.
 * The agent is instructed to embed a ```json block with { widgets, follow_up }.
 * Falls back gracefully to a text_block if parsing fails.
 */

export interface Widget {
  type: 'table' | 'metric_cards' | 'bar_chart' | 'donut_chart' | 'timeline' | 'action_buttons' | 'text_block';
  [key: string]: any;
}

export interface ParsedResponse {
  text: string;
  widgets: Widget[];
  followUp: string[];
}

export function extractWidgets(raw: string): ParsedResponse {
  // Find ```json ... ``` block
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);

  if (!jsonMatch) {
    const fallbackWidgets: Widget[] = [{ type: 'text_block', content: raw.trim() }];
    return {
      text: raw.trim(),
      widgets: fallbackWidgets,
      followUp: generateFallbackFollowUps(fallbackWidgets),
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[1].trim());
  } catch {
    const fallbackWidgets: Widget[] = [{ type: 'text_block', content: 'Unable to render structured data. ' + raw.replace(/```json[\s\S]*?```/g, '').trim() }];
    return {
      text: raw.replace(/```json[\s\S]*?```/g, '').trim(),
      widgets: fallbackWidgets,
      followUp: generateFallbackFollowUps(fallbackWidgets),
    };
  }

  // Validate widgets array
  const widgets: Widget[] = [];
  if (Array.isArray(parsed.widgets)) {
    for (const w of parsed.widgets) {
      const validated = validateWidget(w);
      if (validated) widgets.push(validated);
    }
  }

  if (widgets.length === 0) {
    widgets.push({ type: 'text_block', content: raw.replace(/```json[\s\S]*?```/g, '').trim() });
  }

  const followUp = Array.isArray(parsed.follow_up) && parsed.follow_up.length > 0
    ? parsed.follow_up.slice(0, 3).map(String)
    : generateFallbackFollowUps(widgets);

  // Text is everything before the json block
  const text = raw.slice(0, jsonMatch.index ?? 0).trim();

  return { text, widgets, followUp };
}

const FALLBACK_POOL: Record<string, string[]> = {
  table: [
    'Can you break this down by department?',
    'Show me the top 10 by cost',
    'Which of these have the lowest utilisation?',
  ],
  metric_cards: [
    'How does this compare to last month?',
    'Which apps contribute most to these numbers?',
    'Show me a trend over the past 6 months',
  ],
  bar_chart: [
    'Show me the underlying data in a table',
    'Which category is growing the fastest?',
    'Are there any outliers I should look into?',
  ],
  donut_chart: [
    'What makes up the largest segment?',
    'Show me the unused licences in detail',
    'How can we optimise this distribution?',
  ],
  timeline: [
    'Which upcoming renewals are high risk?',
    'Show me contracts expiring in the next 30 days',
    'What is the total value of upcoming renewals?',
  ],
  action_buttons: [
    'Show me more details before I proceed',
    'What other actions are available?',
    'Give me a summary of the current status',
  ],
  default: [
    'Give me an overview of our SaaS portfolio',
    'Show me unused licences across all apps',
    'What is our total SaaS spend this month?',
  ],
};

function generateFallbackFollowUps(widgets: Widget[]): string[] {
  const widgetTypes = widgets.map((w) => w.type).filter((t) => t !== 'text_block');
  const primaryType = widgetTypes[0] || 'default';
  return FALLBACK_POOL[primaryType] ?? FALLBACK_POOL.default;
}

function validateWidget(w: any): Widget | null {
  if (!w || typeof w !== 'object') return null;

  const VALID_TYPES = ['table', 'metric_cards', 'bar_chart', 'donut_chart', 'timeline', 'action_buttons', 'text_block'];
  if (!VALID_TYPES.includes(w.type)) {
    return { type: 'text_block', content: JSON.stringify(w) };
  }

  switch (w.type) {
    case 'table':
      if (!Array.isArray(w.columns) || !Array.isArray(w.rows)) {
        return { type: 'text_block', content: 'Malformed table data' };
      }
      return w;

    case 'metric_cards':
      if (!Array.isArray(w.cards)) {
        return { type: 'text_block', content: 'Malformed metric cards' };
      }
      return w;

    case 'bar_chart':
    case 'donut_chart':
      if (!Array.isArray(w.data)) {
        return { type: 'text_block', content: `Malformed ${w.type}` };
      }
      return w;

    case 'timeline':
      if (!Array.isArray(w.items)) {
        return { type: 'text_block', content: 'Malformed timeline' };
      }
      return w;

    case 'action_buttons':
      if (!Array.isArray(w.items)) {
        return { type: 'text_block', content: 'Malformed action buttons' };
      }
      return w;

    case 'text_block':
      if (typeof w.content !== 'string') {
        return { type: 'text_block', content: JSON.stringify(w) };
      }
      return w;

    default:
      return w;
  }
}
