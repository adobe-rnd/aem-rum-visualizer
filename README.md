# aem-rum-visualizer
A simple heatmap overlay plugin to show RUM data on top of the current page

Setup
- Add the following line to your decoratePreviewMode() function inside experimentation/src/preview.js
``` js
await decorateVisualizerPill(overlay, options, context);
```
- Add the following import to the top of the same file
``` js
import { decorateVisualizerPill } from "index.js";
```
- Comment out the following lines in scripts/scripts.js (lines 112-114/allows visualizer overlay to appear even without experiment)
``` js
condition: () => getMetadata('experiment')
    || Object.keys(getAllMetadata('campaign')).length
    || Object.keys(getAllMetadata('audience')).length,
```