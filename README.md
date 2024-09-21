# aem-rum-visualizer
A simple heatmap overlay plugin to show RUM data on top of the current page

Setup
- Add the following import to the top of your scripts/scripts.js file
``` js
import { createRUMVisualizer } from "index.js";
```
- Add the following line to the end of the same file
``` js
createRUMVisualizer(siteName);
ex: createRUMVisualizer('https://www.adobe.com');
```
Add the following lines to config.json inside tools/sidekick
``` js
    {
      "id": "rum-visualizer",
      "title": "RUM Visualizer",
      "environments": [ "dev", "preview" ],
      "event": "visualizer"
    }
```
- Update the actualWebsiteName variable at the top of ndex.js to the URL of the site you are using
``` js
 const actualWebsiteName = 'https://main--wknd--hlxsites.hlx.page/';
```