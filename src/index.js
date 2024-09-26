import { fetchSpecificBundles }  from "./rum-bundler-client.js";
import { groupChunksByUrl, sliceChunksWithEnter, sliceChunksWithClickAndSource } from "./aggregations.js";

let actualWebsiteName = '';
const backgroundColorLow = 'rgba(255, 0, 0, 0.5)'; // Red
const backgroundColorMedium = 'rgba(0, 213, 255, 0.5)'; // Blue
const backgroundColorHigh = 'rgba(0, 255, 65, 0.5)'; // Green
const mappingColor = 'rgba(128, 128, 128, 0.5)'; // gray
const textColor = 'white'; // Overlay percentage text color

// Connects to Sidekick and enables/disables the visualizer; first function to be called, placed inside scripts.js
export default async function createRUMVisualizer(siteAddress, defaultSelector) {
  let bar = null;
  let on = false;
  actualWebsiteName = siteAddress.endsWith('/') ? siteAddress.slice(0, -1) : siteAddress;
  window.defaultSelector = {
    selector: defaultSelector,
    count:0
  };
  const visualizer = async ({ }) => {
    if (on) {
      on = false;
      bar.remove();
      bar = null;
    }
    else {
      on = true;
      const overlay = getOverlay();
      bar = await decorateVisualizer(overlay);
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
}

// Intializes visualization bar HTML and adds it to the overlay 
export async function decorateVisualizer(overlay) {
  const bar = createVisualizationBar(
    [
      `Start Date: <input type="date" id="aem-rum-visualization-start-date">`,
      `End Date: <input type="date" id="aem-rum-visualization-end-date">`,
      `Variable: <select id="aem-rum-visualization-class-dropdown">
        <optgroup label="Percentages">
          <option value="CTR">CTR</option>
          <option value="CVR">CVR</option>
          <option value="FSR">Form Submit Rate</option>
          <option value="cc">Custom Convert</option>
        <optgroup label="Numbers">
          <option value="click">Clicks</option>
          <option value="conversions">Conversions</option>
          <option value="forms">Form Submits</option>
        <optgroup label="Viewed">
          <option value="views">Blocks</option>
      </select>`,
      `Domain Key: <input type="password" id="aem-rum-visualization-domain-key" class="aem-rum-visualization-input-password">`,
      `Device: <select id="aem-rum-visualization-device-dropdown">
        <option value="all-devices">All</option>
        <option value="desktop">Desktop</option>
        <option value="mobile">Mobile</option>`,
      `Views: <span id="aem-rum-visualization-views">0</span>`,
    ],
    [
      `Click <a href="https://example.com" target="_blank" id="aem-rum-visualization-rum-link">here</a> to access RUM Explorer`,
      `Please paste custom convert details below from RUM Explorer`,
      `<textarea name="cc-input" id="aem-rum-visualization-cc-input" rows="4" class="aem-rum-visualization-textarea-cc-input"></textarea>`,
    ]
  );
  overlay.append(bar);
  return bar;
}

// Creates the visualization bar with the given HTML items, adds in click event listeners 
function createVisualizationBar(items, ccDisplay) {
  const bar = document.createElement('div');
  const submit = createButton('Submit');
  const close = createButton('X');
  const cc = createButton('^');
  const ccSubmit = createButton('Submit');
  const popup = createPopupDialog("Custom Converts", ccDisplay);
  popup.append(ccSubmit);
  bar.className = 'aem-rum-visualization-actionbar';
  submit.className = 'aem-rum-visualization-submit';
  close.className = 'aem-rum-visualization-close';
  cc.className = 'aem-rum-visualization-cc';
  ccSubmit.className = 'aem-rum-visualization-cc-submit';

  // Creates bar elements
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'aem-rum-visualization-bar-element';
    div.innerHTML = item;
    if (div.querySelector('#aem-rum-visualization-class-dropdown')) {
      cc.innerHTML += '<span class="hlx-open"></span>';
      div.append(cc);
    }
    bar.append(div);
    bar.append(popup);
  });
  bar.append(submit, close);

  // Add event listeners to bar elements
  submit.addEventListener('click', (event) => {
    const overlay = getOverlay();
    const startDate = overlay.querySelector('#aem-rum-visualization-start-date').value;
    const endDate = overlay.querySelector('#aem-rum-visualization-end-date').value;
    const variable = overlay.querySelector('#aem-rum-visualization-class-dropdown').value;
    const domainKey = overlay.querySelector('#aem-rum-visualization-domain-key').value;
    const device = overlay.querySelector('#aem-rum-visualization-device-dropdown').value;

    updatePageMetrics(startDate, endDate, variable, domainKey, device);
  });

  close.addEventListener('click', (event) => {
    const barItems = bar.querySelectorAll(':not(.aem-rum-visualization-close):not(.aem-rum-visualization-cc-submit):not(.hlx-popup):not(.hlx-popup *)');
    barItems.forEach(item => {
      item.style.display = item.style.display == 'none' ? 'inline-block' : 'none';
    });
    if (bar.classList.contains('collapsed')) {
      bar.classList.remove('collapsed');
      close.innerHTML = 'X';
    } else {
      bar.classList.add('collapsed');
      close.innerHTML = '+';
    }
    if (!popup.classList.contains('hlx-hidden')) {
      popup.classList.toggle('hlx-hidden'); // Toggle hidden if popup is currently visible
    }
  });

  const classDropdown = bar.querySelector('#aem-rum-visualization-class-dropdown');
  classDropdown.addEventListener('change', (event) => {
    if (event.target.value == 'cc') {
      cc.style.visibility = 'visible'; // Make the cc button visible
      generateRumExplorerUrl();
      popup.classList.toggle('hlx-hidden');
    } else {
      cc.style.visibility = 'hidden'; // Keep the cc button invisible for other dropdown options
      if (!popup.classList.contains('hlx-hidden')) {
        popup.classList.toggle('hlx-hidden'); // Toggle hidden if popup is currently visible
      }
    }
  });

  cc.addEventListener('click', (event) => {
    popup.classList.toggle('hlx-hidden');
    generateRumExplorerUrl();
  });

  ccSubmit.addEventListener('click', (event) => {
    const overlay = getOverlay();
    const startDate = overlay.querySelector('#aem-rum-visualization-start-date').value;
    const endDate = overlay.querySelector('#aem-rum-visualization-end-date').value;
    const domainKey = overlay.querySelector('#aem-rum-visualization-domain-key').value;
    const ccInput = overlay.querySelector('#aem-rum-visualization-cc-input').value;

    // Reads ccInput string and converts it to an array
    const ccInputLines = ccInput.split('\n');
    const ccInputObj = {};
    ccInputLines.forEach(line => {
      const [key, ...rest] = line.split(':').map(item => item.trim());
      const value = rest.join(':'); // Join the rest of the parts back with ':'
      if (ccInputObj.hasOwnProperty(key)) {
        ccInputObj[key] += `, ${value}`;
      } else {
        ccInputObj[key] = value;
      }
    });

    updateCCPageMetrics(startDate, endDate, domainKey, ccInputObj);
  });
  return bar;
}

function applyOverlay(element, count, total, percentTrigger, backgroundColor) {
  if (element.querySelector(".heat-overlay")) {
    console.log("Element already has an overlay:", element);
    return;
  }
  const overlay = createHeatOverlay(count, total, percentTrigger, backgroundColor);

  if (window.getComputedStyle(element).position == "static") {
    element.style.position = "relative";
  }
  overlay.classList.add("heat-overlay");
  element.style.overflow = "visible"; // Allow text to overflow
  element.append(overlay);
}

// Creates visualization/heatmap based on user input
async function updatePageMetrics(startDate, endDate, variable, domainKey, device) {
  try {
    const allData = await pageMetrics(startDate, endDate, domainKey, device);
    const overlay = getOverlay();
    const viewsElement = overlay.querySelector('#aem-rum-visualization-views');
    viewsElement.textContent = allData.views;
    viewsElement.style.fontWeight = 'normal'; // Make text not bold
    if (allData == undefined) {
      console.error("Error fetching page metrics");
      return;
    }
    let curCounts;
    if (variable != "views") {
      const allMetrics = allData.metrics;
      curCounts = findVariable(variable, allMetrics);
    }
    else {
      curCounts = allData.viewedblocks;
    }

    // removes previous overlays
    document.querySelectorAll('.heat-overlay').forEach(overlay => overlay.remove());

    let percentTrigger = false;
    if (variable == "CTR" || variable == "CVR" || variable == "FSR" || variable == "views") {
      percentTrigger = true;
    }

    Object.entries(curCounts).forEach(([selector, count]) => {
      if (!isValidSelector(selector)) {
        return;
      }
      const elements = document.querySelectorAll(selector);
      if (elements.length == 0) {
        // attribute this to defaultSelector if available
        if (window.defaultSelector) {
          window.defaultSelector.count += count;
        }
        return;
      }
      console.log({ elements, count, selector }, "elements, count, selector")
      elements.forEach(element => {
        applyOverlay(element, count, allData.views, percentTrigger);
      });
    });
    // render the overlay for defaultSelector if any
    if (window.defaultSelector?.count > 0) {
      const dSelector = document.querySelector(window.defaultSelector.selector);
      if (dSelector) {
        applyOverlay(dSelector, window.defaultSelector.count, allData.views, percentTrigger, mappingColor);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

// Obtains RUM bundles and organizes them accordingly 
export async function pageMetrics(startDate, endDate, domainKey, device) {
  let data = {
    views: null,
    viewedblocks: {},
    metrics: {}
  };
  if (!startDate || !endDate) {
    console.error("Start date and end date must be provided.");
    return;
  }

  const url = window.location.href;
  const websiteName = actualWebsiteName;
  let updatedUrl = url.replace(/^(?:https?:\/\/)?(?:localhost(:\d+)?)/, websiteName);
  updatedUrl = updatedUrl.endsWith(".html") ? updatedUrl : updatedUrl + ".html";
  const hostname = getMainWebsiteName(updatedUrl);

  const allChunks = await fetchSpecificBundles(
    hostname,
    startDate,
    endDate,
    domainKey,
    ['click', 'convert', 'formsubmit', 'viewblock', 'enter'],
    updatedUrl,
  );
  if (allChunks == undefined) {
    console.error("Invalid dates, please try again");
    return;
  }
  const chunkURL = groupChunksByUrl(allChunks, 0);
  const curChunk = chunkURL[updatedUrl];
  if (curChunk == undefined) {
    console.error("This page is undefined/not enough data");
    return;
  }
  data.views = chunkURL[updatedUrl].pageview;

  curChunk.chunks.forEach((chunk) => {
    const uniqueEvents = new Set(); // Track unique event-source combinations, makes sure there are no dupes
    const weight = chunk.weight;
    chunk.events.forEach((event) => {
      const eventSourceCombo = `${event.checkpoint}:${event.source}`;
      if (!uniqueEvents.has(eventSourceCombo)) {
        uniqueEvents.add(eventSourceCombo); // Mark this event-source combo as seen
        if (device == 'all-devices' || chunk.userAgent.includes(device)) {
          if (event.checkpoint == 'click' || event.checkpoint == 'convert' || event.checkpoint == 'formsubmit') {
            if (data.metrics[event.source] == undefined) {
              data.metrics[event.source] = { "clicks": 0, "converts": 0, "formsubmits": 0, "targets": {} };
              updateChunk(event, data.metrics[event.source], weight);
            } else {
              updateChunk(event, data.metrics[event.source], weight);
            }
          } else if (event.checkpoint == 'viewblock') {
            if (data.viewedblocks[event.source] == undefined) {
              data.viewedblocks[event.source] = weight;
            } else {
              data.viewedblocks[event.source] += weight;
            }
          }
        }
      }
    });
  });
  console.log(data, "Final Data/Schema");
  return data;
}

async function updateCCPageMetrics(startDate, endDate, domainKey, ccInput) {
  try {
    const data = await ccPageMetrics(startDate, endDate, domainKey, ccInput);
    const overlay = getOverlay();
    const viewsElement = overlay.querySelector('#aem-rum-visualization-views');
    viewsElement.textContent = data.views;
    viewsElement.style.fontWeight = 'normal'; // Make text not bold
    if (data == undefined) {
      console.error("Error fetching page metrics");
      return;
    }
    let curCounts;
    // this will not account for other stuff thats not clicks or viewblocks
    const checkpoint = ccInput.checkpoint;
    const variable = checkpoint.includes('click') ? 'click' : checkpoint.includes('viewblock') ? 'viewblock' : null;
    if (variable != "viewblock") {
      const allMetrics = data.metrics;
      curCounts = findVariable(variable, allMetrics);
    }
    else {
      curCounts = data.viewedblocks;
    }
    // removes old ones
    document.querySelectorAll('.heat-overlay').forEach(overlay => overlay.remove());

    let percentTrigger = true;

    Object.entries(curCounts).forEach(([selector, count]) => {
      if (!isValidSelector(selector)) {
        return;
      }
      const elements = document.querySelectorAll(selector);
      if (elements.length == 0) {
        return;
      }
      elements.forEach(element => {
        applyOverlay(element, count, data.views, percentTrigger);
      });
    });
  }
  catch (error) {
    console.error(error);
  }
}
export async function ccPageMetrics(startDate, endDate, domainKey, ccInputObj) {
  let data = {
    views: null,
    viewedblocks: {},
    metrics: {}
  };

  if (!startDate || !endDate) {
    console.error("Start date and end date must be provided.");
    return;
  }
  
  const url = window.location.href;
  const websiteName = actualWebsiteName;
  const updatedUrl = url.replace(/^(?:https?:\/\/)?(?:localhost(:\d+)?)/, websiteName);
  const hostname = getMainWebsiteName(updatedUrl);

  const allChunks = await fetchSpecificBundles(hostname, startDate, endDate, domainKey);
  if (allChunks == undefined) {
    console.error("Invalid dates, please try again");
    return;
  }

  const chunkURL = groupChunksByUrl(allChunks, 0);
  const curChunk = chunkURL[updatedUrl];
  if (curChunk == undefined) {
    console.error("This page is undefined/not enough data");
    return;
  }
  data.views = chunkURL[updatedUrl].pageview;

  let enterSources = [];
  let otherSources = [];

  // Check if ccInputObj contains two or more sources
  const sourceKeys = Object.keys(ccInputObj).filter(key => key.includes('source'));

  // If there are two or more sources, split the sources into enterSources and otherSources
  if (sourceKeys.length >= 2) {
    enterSources = sourceKeys
      .filter(key => key.includes('enter'))
      .map(key => ccInputObj[key]);

    otherSources = sourceKeys
      .filter(key => key.includes('click') || key.includes('viewblock'))
      .map(key => ccInputObj[key]);

    const enterChunks = sliceChunksWithEnter(curChunk.chunks, enterSources);
    const otherChunks = sliceChunksWithClickAndSource(enterChunks, otherSources);

    // ccInputObj contains the source keys and values, we turn into it into an array to turn in from one value into many
    const sourceArray = Object.values(otherSources)
      .flatMap(source => source.split(',').map(s => s.trim()));

    otherChunks.forEach((chunk) => {
      const uniqueEvents = new Set(); // Track unique event-source combinations
      const weight = chunk.weight;
      const userAgent = chunk.userAgent;

      let matchesUserAgent = true;
      let matchesTarget = true;
      let matchesCheckpoint = true;
      let matchesSource = true;
      for (let i = 0; i < chunk.events.length; i++) {
        const event = chunk.events[i];
        const eventSourceCombo = `${event.checkpoint}:${event.source}`;
        if (!uniqueEvents.has(eventSourceCombo)) {
          uniqueEvents.add(eventSourceCombo); // Mark this event-source combo as seen
          matchesUserAgent = true;
          matchesCheckpoint = true;
          matchesSource = true;
          matchesTarget = true;

          // Check if the ccInput variables are present and set match flags accordingly
          if ('userAgent' in ccInputObj) {
            matchesUserAgent = userAgent.includes(ccInputObj.userAgent);
          }
          if ('checkpoint' in ccInputObj && (event.checkpoint == 'click' || event.checkpoint == 'viewblock')) {
            matchesCheckpoint = ccInputObj.checkpoint.includes(event.checkpoint);
          }
          else {
            matchesCheckpoint = false;
          }
          const sourceKey = Object.keys(ccInputObj).find(key => key.includes('source'));
          if (sourceKey) {
            matchesSource = sourceArray.includes(event.source);
          }

          const targetKey = Object.keys(ccInputObj).find(key => key.includes('target'));
          if (targetKey) {
            matchesTarget = event.target == ccInputObj[targetKey];
          }
          // Process the event if it matches all the criteria that are present
          if (matchesUserAgent && matchesTarget && matchesCheckpoint && matchesSource) {
            if (event.checkpoint == 'click' || event.checkpoint == 'convert' || event.checkpoint == 'formsubmit') {
              if (data.metrics[event.source] == undefined) {
                data.metrics[event.source] = { "clicks": 0, "converts": 0, "formsubmits": 0, "targets": {} };
                updateChunk(event, data.metrics[event.source], weight);
              } else {
                updateChunk(event, data.metrics[event.source], weight);
              }
            } else if (event.checkpoint == 'viewblock') {
              if (data.viewedblocks[event.source] == undefined) {
                data.viewedblocks[event.source] = weight;
              } else {
                data.viewedblocks[event.source] += weight;
              }
            }
          }
        }
      }
    });
  }
  if (sourceKeys.length <= 1) {
    otherSources = sourceKeys
      .filter(key => key.includes('click') || key.includes('viewblock'))
      .map(key => ccInputObj[key]);
    const sourceArray = Object.values(otherSources)
      .flatMap(source => source.split(',').map(s => s.trim()));
    if (sourceArray.length >= 2) {
      otherSources = sourceKeys
        .filter(key => key.includes('click') || key.includes('viewblock'))
        .map(key => ccInputObj[key]);

      const otherChunks = sliceChunksWithClickAndSource(curChunk.chunks, otherSources);

      // ccInputObj contains the source keys and values, we turn into it into an array to turn in from one value into many
      otherChunks.forEach((chunk) => {
        const uniqueEvents = new Set(); // Track unique event-source combinations
        const weight = chunk.weight;
        const userAgent = chunk.userAgent;

        let matchesUserAgent = true;
        let matchesTarget = true;
        let matchesCheckpoint = true;
        let matchesSource = true;
        for (let i = 0; i < chunk.events.length; i++) {
          const event = chunk.events[i];
          const eventSourceCombo = `${event.checkpoint}:${event.source}`;
          if (!uniqueEvents.has(eventSourceCombo)) {
            uniqueEvents.add(eventSourceCombo); // Mark this event-source combo as seen
            matchesUserAgent = true;
            matchesCheckpoint = true;
            matchesSource = true;
            matchesTarget = true;

            // Check if the ccInput variables are present and set match flags accordingly
            if ('userAgent' in ccInputObj) {
              matchesUserAgent = userAgent.includes(ccInputObj.userAgent);
            }
            if ('checkpoint' in ccInputObj && (event.checkpoint == 'click' || event.checkpoint == 'viewblock')) {
              matchesCheckpoint = ccInputObj.checkpoint.includes(event.checkpoint);
            }
            else {
              matchesCheckpoint = false;
            }
            const sourceKey = Object.keys(ccInputObj).find(key => key.includes('source'));
            if (sourceKey) {
              matchesSource = sourceArray.includes(event.source);
            }

            const targetKey = Object.keys(ccInputObj).find(key => key.includes('target'));
            if (targetKey) {
              matchesTarget = event.target == ccInputObj[targetKey];
            }
            // Process the event if it matches all the criteria that are present
            if (matchesUserAgent && matchesTarget && matchesCheckpoint && matchesSource) {
              if (event.checkpoint == 'click' || event.checkpoint == 'convert' || event.checkpoint == 'formsubmit') {
                if (data.metrics[event.source] == undefined) {
                  data.metrics[event.source] = { "clicks": 0, "converts": 0, "formsubmits": 0, "targets": {} };
                  updateChunk(event, data.metrics[event.source], weight);
                } else {
                  updateChunk(event, data.metrics[event.source], weight);
                }
              } else if (event.checkpoint == 'viewblock') {
                if (data.viewedblocks[event.source] == undefined) {
                  data.viewedblocks[event.source] = weight;
                } else {
                  data.viewedblocks[event.source] += weight;
                }
              }
            }
          }
        }
      });
    }
    else {
      curChunk.chunks.forEach((chunk) => {
        const uniqueEvents = new Set(); // Track unique event-source combinations
        const weight = chunk.weight;
        const userAgent = chunk.userAgent;

        let matchesUserAgent = true;
        let matchesCheckpoint = true;
        let matchesSource = true;
        let matchesTarget = true;
        for (let i = 0; i < chunk.events.length; i++) {
          const event = chunk.events[i];
          const eventSourceCombo = `${event.checkpoint}:${event.source}`;
          if (!uniqueEvents.has(eventSourceCombo)) {
            uniqueEvents.add(eventSourceCombo); // Mark this event-source combo as seen
            matchesUserAgent = true;
            matchesCheckpoint = true;
            matchesSource = true;
            matchesTarget = true;

            // Check if the ccInput variables are present and set match flags accordingly
            if ('userAgent' in ccInputObj) {
              matchesUserAgent = userAgent.includes(ccInputObj.userAgent);
            }
            if ('checkpoint' in ccInputObj && (event.checkpoint == 'click' || event.checkpoint == 'viewblock')) {
              matchesCheckpoint = ccInputObj.checkpoint.includes(event.checkpoint);
            }
            const sourceKey = Object.keys(ccInputObj).find(key => key.includes('source'));
            if (sourceKey) {
              matchesSource = event.source == ccInputObj[sourceKey];
            }

            // Check for any key containing "target" and compare
            const targetKey = Object.keys(ccInputObj).find(key => key.includes('target'));
            if (targetKey) {
              matchesTarget = event.target == ccInputObj[targetKey];
            }

            if (matchesUserAgent && matchesCheckpoint && matchesSource && matchesTarget) {
              if (event.checkpoint == 'click' || event.checkpoint == 'convert' || event.checkpoint == 'formsubmit') {
                if (data.metrics[event.source] == undefined) {
                  data.metrics[event.source] = { "clicks": 0, "converts": 0, "formsubmits": 0, "targets": {} };
                  updateChunk(event, data.metrics[event.source], weight);
                } else {
                  updateChunk(event, data.metrics[event.source], weight);
                }
              } else if (event.checkpoint == 'viewblock') {
                if (data.viewedblocks[event.source] == undefined) {
                  data.viewedblocks[event.source] = weight;
                } else {
                  data.viewedblocks[event.source] += weight;
                }
              }
            }
          }
        }
      });
    }
  }
  console.log(data, "Final Data/Schema");
  return data;
}

function createHeatOverlay(count, total, percentTrigger, backgroundColor) {
  const overlay = document.createElement('div');

  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.pointerEvents = 'none';
  overlay.style.fontSize = '42px';
  overlay.style.color = textColor;
  overlay.style.fontWeight = 'normal';
  overlay.style.textShadow = '1px 1px 2px black';
  overlay.style.zIndex = '2';

  const percentage = ((count / total) * 100).toPrecision(3);
  if (percentage < 1) {
    overlay.style.backgroundColor = backgroundColorLow;
  } else if (percentage >= 1 && percentage <= 5) {
    overlay.style.backgroundColor = backgroundColorMedium;
  } else {
    overlay.style.backgroundColor = backgroundColorHigh;
  }
  if (backgroundColor) {
    overlay.style.backgroundColor = backgroundColor;
  }
  if (percentTrigger) {
    overlay.textContent = `${percentage} %`;
  }
  else {
    overlay.textContent = count;
  }
  return overlay;
}

function findVariable(variable, allMetrics) {
  const clickCounts = {};
  const convertCounts = {};
  const formCounts = {};
  Object.keys(allMetrics).forEach(key => {
    const metric = allMetrics[key];
    if (metric.clicks > 0) {
      clickCounts[key] = metric.clicks;
    }
    if (metric.converts > 0) {
      convertCounts[key] = metric.converts;
    }
    if (metric.forms > 0) {
      formCounts[key] = metric.forms;
    }
  });

  if (variable == "click" || variable == "CTR") {
    return clickCounts;
  }
  else if (variable == "conversions" || variable == "CVR") {
    return convertCounts;
  }
  else if (variable == "forms" || variable == "FSR") {
    return formCounts;
  }
}

function isValidSelector(selector) {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function getMainWebsiteName(url) {
  const urlObject = new URL(url); // Create a URL object
  return urlObject.hostname; // Return the hostname property
}

function checkTarget(tl, target, weight) {
  if (tl[target] == undefined) {
    tl[target] = weight;
  }
  else {
    tl[target] += weight;
  }
}

function updateChunk(event, source, weight) {
  if (event.checkpoint == 'click') {
    source.clicks += weight;
  }
  else if (event.checkpoint == 'convert') {
    source.converts += weight;
  }
  else if (event.checkpoint == 'formsubmit') {
    source.formsubmits += weight;
  }
  checkTarget(source.targets, event.target, weight);
}

function generateRumExplorerUrl() {
  const url = window.location.href;
  const websiteName = actualWebsiteName
  const simpleWebsiteName = websiteName.replace(/^https?:\/\//, '');
  const updatedUrl = url.replace(/^(?:https?:\/\/)?(?:localhost(:\d+)?)/, websiteName);
  let encodedUrl = updatedUrl;
  const replacements = { ':': '%3A', '/': '%2F' };
  for (const [key, value] of Object.entries(replacements)) {
    encodedUrl = encodedUrl.split(key).join(value);
  }
  const overlay = getOverlay();
  const rumExplorer = 'https://www.aem.live/tools/oversight/explorer.html?domain=' +
    simpleWebsiteName + '&url=' + encodedUrl + '&domainkey=' + overlay.querySelector('#aem-rum-visualization-domain-key').value;
  const rumLinkElement = overlay.querySelector('#aem-rum-visualization-rum-link');
  rumLinkElement.href = rumExplorer;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Default element creation functions
function createButton(label) {
  const button = document.createElement('button');
  const text = document.createElement('span');
  text.innerHTML = label;
  button.append(text);
  return button;
}

function createPopupDialog(header, items = []) {
  const actions = typeof header === 'object'
    ? (header.actions || []).map((action) => (action.href
      ? `<div class="hlx-button"><a href="${action.href}">${action.label}</a></div>`
      : `<div class="hlx-button"><a href="#">${action.label}</a></div>`))
    : [];
  const popup = document.createElement('div');
  popup.className = 'hlx-popup hlx-hidden';
  popup.innerHTML = `
    <div class="hlx-popup-header">
      <h5 class="hlx-popup-header-label">${typeof header === 'object' ? header.label : header}</h5>
      ${header.description ? `<div class="hlx-popup-header-description">${header.description}</div>` : ''}
      ${actions.length ? `<div class="hlx-popup-header-actions">${actions}</div>` : ''}
    </div>
    <div class="hlx-popup-items"></div>`;
  const list = popup.querySelector('.hlx-popup-items');
  items.forEach((item) => {
    list.append(createPopupItem(item));
  });
  const buttons = [...popup.querySelectorAll('.hlx-popup-header-actions .hlx-button a')];
  header.actions?.forEach((action, index) => {
    if (action.onclick) {
      buttons[index].addEventListener('click', action.onclick);
    }
  });
  return popup;
}

function createPopupItem(item) {
  const actions = typeof item === 'object'
    ? item.actions.map((action) => (action.href
      ? `<div class="hlx-button"><a href="${action.href}">${action.label}</a></div>`
      : `<div class="hlx-button"><a href="#">${action.label}</a></div>`))
    : [];
  const div = document.createElement('div');
  div.className = `hlx-popup-item${item.isSelected ? ' is-selected' : ''}`;
  div.innerHTML = `
    <h5 class="hlx-popup-item-label">${typeof item === 'object' ? item.label : item}</h5>
    ${item.description ? `<div class="hlx-popup-item-description">${item.description}</div>` : ''}
    ${actions.length ? `<div class="hlx-popup-item-actions">${actions}</div>` : ''}`;
  const buttons = [...div.querySelectorAll('.hlx-button a')];
  item.actions?.forEach((action, index) => {
    if (action.onclick) {
      buttons[index].addEventListener('click', action.onclick);
    }
  });
  return div;
}

class AemVisualizationBar extends HTMLElement {
  connectedCallback() {
    // Create a shadow root
    const shadow = this.attachShadow({ mode: 'open' });

    const cssPath = new URL(new Error().stack.split('\n')[2].match(/[a-z]+?:\/\/.*?\/[^:]+/)[0]).pathname.replace('index.js', 'index.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssPath;
    link.onload = () => {
      shadow.querySelector('.hlx-preview-overlay').removeAttribute('hidden');
    };
    shadow.append(link);

    const el = document.createElement('div');
    el.className = 'hlx-preview-overlay';
    el.setAttribute('hidden', true);
    shadow.append(el);
  }
}
customElements.define('aem-visualization-bar', AemVisualizationBar);

function createPreviewOverlay() {
  const overlay = document.createElement('aem-visualization-bar');
  return overlay;
}

export function getOverlay() {
  let overlay = document.querySelector('aem-visualization-bar')?.shadowRoot.children[1];
  if (!overlay) {
    const el = createPreviewOverlay();
    document.body.append(el);
    [, overlay] = el.shadowRoot.children;
  }
  return overlay;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////