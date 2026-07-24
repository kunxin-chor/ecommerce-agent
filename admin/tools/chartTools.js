const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

// Charts generated during a run, keyed by chat session. The model never sees
// the config itself, so it cannot echo it into its reply text.
const chartStore = new Map();

const generateApexChartTool = tool(
  async ({ type, title, series, categories, xaxisTitle, yaxisTitle }, config) => {
    const isRadial = type === 'pie' || type === 'donut';

    const chartConfig = {
      chart: { type: type || 'bar', height: 320 },
      title: { text: title || 'Chart', align: 'center' },
      series: isRadial
        ? (series || []).map(s => (typeof s === 'number' ? s : (s.data?.[0] || 0)))
        : series || [],
    };

    if (isRadial) {
      chartConfig.labels = categories || [];
      chartConfig.legend = { position: 'bottom' };
    } else {
      chartConfig.xaxis = { categories: categories || [], title: { text: xaxisTitle } };
      chartConfig.yaxis = { title: { text: yaxisTitle } };
    }

    // The second argument is the run's config, which carries the sessionId
    // that runAgent passes in via configurable
    const sessionId = config?.configurable?.sessionId;
    if (sessionId != null) {
      chartStore.set(String(sessionId), chartConfig);
    }

    return JSON.stringify({
      success: true,
      message: 'Chart generated successfully. It will be rendered automatically in the chat. Do not include any chart data or configuration in your reply.'
    });
  },
  {
    name: 'generate_apex_chart',
    description: 'Generate an ApexCharts configuration for data visualization. Use this when the user asks for a chart, graph, or visual representation of data.\n\nExpected shapes by chart type:\n- bar / line: series = [{ name: string, data: number[] }]; categories = string[] (x-axis labels).\n- pie / donut: series = number[] (one value per slice); categories = string[] (slice labels).',
    schema: z.object({
      type: z.enum(['bar', 'line', 'pie', 'donut']).describe('Chart type'),
      title: z.string().describe('Chart title'),
      series: z.union([
        z.array(z.object({ name: z.string(), data: z.array(z.number()) })).describe('Bar/line data series'),
        z.array(z.number()).describe('Pie/donut data values (one per slice)')
      ]).describe('Data series'),
      categories: z.array(z.string()).describe('X-axis labels for bar/line charts, or slice labels for pie/donut charts'),
      xaxisTitle: z.string().optional().describe('X-axis title (for bar/line charts)'),
      yaxisTitle: z.string().optional().describe('Y-axis title (for bar/line charts)'),
    }),
  }
);

// Read and remove the chart for a session, so a stale chart never leaks
// into the session's next run
function takeChartConfig(sessionId) {
  const chart = chartStore.get(String(sessionId));
  chartStore.delete(String(sessionId));
  return chart || null;
}

module.exports = { generateApexChartTool, takeChartConfig };