# aem-rum-visualizer
A simple heatmap overlay plugin to show RUM data on top of the current page

Edited Files 
- preview.js inside plugins/experiments/src (adds new pill and does heatmap visualization)
- heatmap.js inside rum-insights/src/commands (new file, creates schema and obtain all relevant data for particular page)
- rum-bundler-client.js inside rum-insights/src/common (added new functions that gather rum data for specific range of dates)
