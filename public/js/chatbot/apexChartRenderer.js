(function () {
  'use strict';

  class ApexChartRenderer {
    constructor() {
      this.available = typeof window !== 'undefined' && !!window.ApexCharts;
    }

    render(targetElement, chartOptions) {
      if (!this.available) {
        console.warn('ApexCharts not loaded; cannot render chart.');
        return false;
      }
      if (!targetElement || !chartOptions) {
        return false;
      }

      const chartDiv = document.createElement('div');
      chartDiv.className = 'chat-apexchart';
      chartDiv.style.width = '100%';
      const height = (chartOptions.chart && chartOptions.chart.height) || 260;
      chartDiv.style.height = height + 'px';
      targetElement.appendChild(chartDiv);

      try {
        const chart = new window.ApexCharts(chartDiv, chartOptions);
        chart.render();
        return true;
      } catch (e) {
        console.error('Error rendering ApexChart', e);
        chartDiv.textContent = 'Failed to render chart.';
        return false;
      }
    }
  }

  window.ApexChartRenderer = ApexChartRenderer;
})();
