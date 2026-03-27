'use client';
import { Widget } from '../../../services/agentApi';
import { TextBlock } from './TextBlock';
import { MetricCards } from './MetricCards';
import { TableWidget } from './TableWidget';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { Timeline } from './Timeline';
import { ActionButtons } from './ActionButtons';

interface WidgetRendererProps {
  widget: Widget;
  runId?: string;
  onAction?: (action: string, payload: Record<string, any>) => Promise<void>;
  onTableAction?: (action: string, payload: Record<string, any>) => void;
}

export function WidgetRenderer({ widget, runId, onAction, onTableAction }: WidgetRendererProps) {
  switch (widget.type) {
    case 'text_block':
      return <TextBlock content={widget.content ?? ''} />;

    case 'metric_cards':
      return <MetricCards cards={widget.cards ?? []} />;

    case 'table':
      return (
        <TableWidget
          title={widget.title}
          columns={widget.columns ?? []}
          rows={widget.rows ?? []}
          actions={widget.actions}
          onAction={onTableAction}
        />
      );

    case 'bar_chart':
      return <BarChart title={widget.title} data={widget.data ?? []} />;

    case 'donut_chart':
      return <DonutChart title={widget.title} data={widget.data ?? []} />;

    case 'timeline':
      return <Timeline title={widget.title} items={widget.items ?? []} />;

    case 'action_buttons':
      if (!onAction || !runId) return null;
      return (
        <ActionButtons
          title={widget.title}
          items={widget.items ?? []}
          runId={runId}
          onAction={onAction}
        />
      );

    default:
      return <TextBlock content={`Unknown widget type: ${widget.type}`} />;
  }
}
