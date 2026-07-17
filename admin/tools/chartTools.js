const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

const generateApexChartTool = tool(
  async ({ type, title, series, categories, xaxisTitle, yaxisTitle }) => {
    const chartType = type || 'bar';
    const chartConfig = {
      chart: { type: chartType, height: 320 },
      title: { text: title || 'Chart', align: 'center' },
      series: series || [],
    };

    if (chartType === 'pie' || chartType === 'donut') {
      // ApexCharts pie/donut expects a flat numeric series and labels.
      const firstSeries = (series && series[0]) || { data: [] };
      chartConfig.series = firstSeries.data || [];
      chartConfig.labels = categories || [];
      chartConfig.legend = { position: 'bottom' };
    } else {
      chartConfig.xaxis = { categories: categories || [], title: { text: xaxisTitle } };
      chartConfig.yaxis = { title: { text: yaxisTitle } };
    }

    return JSON.stringify({ chartConfig, message: 'Chart generated successfully' });
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

module.exports = { generateApexChartTool };