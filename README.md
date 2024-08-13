# aem-rum-visualizer
A simple heatmap overlay plugin to show RUM data on top of the current page

Setup
- Add the following import to the top of your scripts/scripts.js file
``` js
import { decorateVisualizerPill, getOverlay } from "index.js";
```
- Add the following lines to the end of the same file before the final "loadpage()"
``` js
let pill = null;
let on = false;
const visualizer = async ({}) => {
  if (on) {
    on = false;
    const overlay = getOverlay();
    pill.remove(); 
    pill = null;
  }
  else {
    on = true;
    const overlay = getOverlay();
    pill = await decorateVisualizerPill(overlay);
  }
};

const sk = document.querySelector('helix-sidekick');
if (sk) {
  // sidekick already loaded
  sk.addEventListener('custom:visualizer', visualizer);
} else {
  // wait for sidekick to be loaded
  document.addEventListener('sidekick-ready', () => {
    document.querySelector('helix-sidekick')
      .addEventListener('custom:visualizer', visualizer);
  }, { once: true });
}
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
- Update the actualWebsiteName variable inside pageMetrics() in index.js to the URL of the site you are using
``` js
 const actualWebsiteName = 'https://www.petplace.com';
```