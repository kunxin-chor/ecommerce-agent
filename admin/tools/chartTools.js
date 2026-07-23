const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

const generateApexChartTool = tool(
  async ({ type, title, series, categories, xaxisTitle, yaxisTitle }) => {
    const chartType = type || 'bar';
    const safeCategories = categories || [];
    const safeSeries = series || [];
    const safeTitle = title || 'Chart';

    let chartConfig;

    if (chartType === 'pie' || chartType === 'donut') {
      // ApexCharts pie/donut series must be a flat array of numbers with labels
      let values = safeSeries;
      if (safeSeries.length > 0 && typeof safeSeries[0] === 'object' && safeSeries[0] !== null) {
        values = safeSeries[0].data || [];
      }
      values = values.filter(v => typeof v === 'number');
      const labels = safeCategories.length > 0 ? safeCategories : safeSeries.map(s => s.name || '');

      chartConfig = {
        chart: { type: chartType, height: 320 },
        title: { text: safeTitle, align: 'center' },
        series: values,
        labels: labels,
      };
    } else {
      chartConfig = {
        chart: { type: chartType, height: 320 },
        title: { text: safeTitle, align: 'center' },
        series: safeSeries,
        xaxis: { categories: safeCategories, title: { text: xaxisTitle } },
        yaxis: { title: { text: yaxisTitle } }
      };
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