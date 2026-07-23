const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

// Charts generated during a run, keyed by chat session. The model never sees
// the config itself, so it cannot echo it into its reply text.
const chartStore = new Map();

const generateApexChartTool = tool(
  async ({ type, title, series, categories, xaxisTitle, yaxisTitle }, config) => {
    const chartConfig = {
      chart: { type: type || 'bar', height: 320 },
      title: { text: title || 'Chart', align: 'center' },
      series: series || [],
      xaxis: { categories: categories || [], title: { text: xaxisTitle } },
      yaxis: { title: { text: yaxisTitle } }
    };

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
    description: 'Generate an ApexCharts configuration for data visualization. Use this when the user asks for a chart, graph, or visual representation of data.',
    schema: z.object({
      type: z.enum(['bar', 'line', 'pie', 'donut']).describe('Chart type'),
      title: z.string().describe('Chart title'),
      series: z.array(z.object({ name: z.string(), data: z.array(z.number()) })).describe('Data series'),
      categories: z.array(z.string()).describe('X-axis category labels'),
      xaxisTitle: z.string().optional().describe('X-axis title'),
      yaxisTitle: z.string().optional().describe('Y-axis title'),
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