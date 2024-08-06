import { fetchDateRange } from "rum-bundler-client.js";
import { groupChunksByUrl } from "aggregations.js";

const DOMAIN_KEY_NAME = 'aem-domainkey';

const backgroundColorLow = 'rgba(255, 0, 0, 0.5)'; // Red
const backgroundColorMedium = 'rgba(0, 213, 255, 0.5)'; // Blue
const backgroundColorHigh = 'rgba(0, 255, 65, 0.5)'; // Green
const textColor = 'white'; // Overlay percentage text color

function createHeatOverlay(count, total) {
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
  overlay.textContent = `${percentage} %`;
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

  if (variable == "click") {
    return clickCounts;
  }
  else if (variable == "conversions") {
    return convertCounts;
  }
  else if (variable == "forms") {
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

async function updatePageMetrics(startDate, endDate, variable, domainKey) {
  try {
    const allData = await pageMetrics(startDate, endDate, domainKey);
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
    //
    console.log(curCounts, "curCounts", variable)
    //

    // removes old ones
    document.querySelectorAll('.heat-overlay').forEach(overlay => overlay.remove());

    Object.entries(curCounts).forEach(([selector, count]) => {
      if (!isValidSelector(selector)) {
        console.log('Invalid selector:', selector);
        return;
      }
      const elements = document.querySelectorAll(selector);
      if (elements.length == 0) {
        console.log('No elements found for selector:', selector);
        return;
      }
      console.log({elements, count, selector}, "elements, count, selector")
      elements.forEach(element => {
        if (element.querySelector('.heat-overlay')) {
          console.log('Element already has an overlay:', element);
          return;
        }
        const overlay = createHeatOverlay(count, allData.views);
        console.log(overlay.textContent, allData.views, "overlay")
        
        if (window.getComputedStyle(element).position == 'static') {
          element.style.position = 'relative';
        }
        overlay.classList.add('heat-overlay');
        element.style.overflow = 'visible'; // Allow text to overflow
        element.appendChild(overlay);

        const rect = overlay.getBoundingClientRect();
        console.log(`Overlay details - Width: ${rect.width}, Height: ${rect.height}, Top: ${rect.top}, Left: ${rect.left}`);
      });
    });
  } catch (error) {
    console.error('Error fetching page metrics:', error);
  }
}

function createVisualizationButton(label, header, items, submit) {
  const button = createButton(label);
  const popup = createPopupDialog(header, items);
  button.innerHTML += '<span class="hlx-open"></span>';
  button.addEventListener('click', (event) => {
    var isClickInsidePopup = popup.contains(event.target);
    var isClickInsideButton = button.contains(event.target);
    var isClickInsideSubmit = submit.contains(event.target);
    if (!isClickInsidePopup && isClickInsideButton && !isClickInsideSubmit) {
      popup.classList.toggle('hlx-hidden');
    }
    else if (isClickInsideSubmit) {
      const overlay = getOverlay();
      const startDate = overlay.querySelector('#start-date').value;
      const endDate = overlay.querySelector('#end-date').value;
      const variable = overlay.querySelector('#class-dropdown').value;
      const domainKey = overlay.querySelector('#domain-key').value;

      const allData = {
        startDate,
        endDate,
        variable,
        domainKey
      };
      console.log(allData); // data inputted by user
      updatePageMetrics(startDate, endDate, variable, domainKey);
    }
    else {
      //  error out?
    }
  });
  button.append(popup);
  popup.append(submit);
  return button;
}

function getMainWebsiteName(url) {
  const urlObject = new URL(url); // Create a URL object
  return urlObject.hostname; // Return the hostname property
}

function checkTarget(tl, target) {
  // if (target != undefined) {
     if (tl[target] == undefined) {
       tl[target] = 1;
     }
     else {
       tl[target] += 1;
     }
 //  }
}  

function updateChunk(event, source, weight) {
  if (event.checkpoint == 'click'){
    source.clicks += weight;
  }
  else if (event.checkpoint == 'convert') {
    source.converts += weight;
  }
  else if (event.checkpoint == 'formsubmit') {
    source.formsubmits += weight;
  }
  checkTarget(source.targets, event.target);
}

export async function pageMetrics(startDate, endDate, domainKey) {
  let data = {
    views: null,
    viewedblocks: {}, 
    metrics: {} 
  };

  // INSERT CURRENT URL FUNCTION HERE
  const url = window.location.href;

  // Replace "localhost" with the actual website name
  const actualWebsiteName = 'https://www.petplace.com';
  // ERROR CHECK FOR LOCAL HOST (remove later?)
  const updatedUrl = url.replace(/^(?:https?:\/\/)?(?:localhost(:\d+)?)/, actualWebsiteName);

  console.log(updatedUrl, "updatedUrl");

  const hostname = getMainWebsiteName(updatedUrl);
  console.log(hostname, "hostname");

  const allChunks = await fetchDateRange(hostname, startDate, endDate, domainKey);
  if (allChunks == undefined) {
    console.error("Invalid dates, please try again");
    return;
  }

  const chunkURL = groupChunksByUrl(allChunks, 0);

  console.log(chunkURL, "chunks by URL (all chunks)");

  const curChunk = chunkURL[updatedUrl];
  if (curChunk == undefined) {
    console.error("This page is undefined/not enough data");
    return;
  }
  data.views = chunkURL[updatedUrl].pageview;

  console.log(curChunk, "curChunk");
  console.log(data.views, "views");

  curChunk.chunks.forEach((chunk) => {
    const uniqueEvents = new Set(); // Track unique event-source combinations
    const weight = chunk.weight;
    chunk.events.forEach((event) => {
      const eventSourceCombo = `${event.checkpoint}:${event.source}`;
      if (!uniqueEvents.has(eventSourceCombo)) {
        uniqueEvents.add(eventSourceCombo); // Mark this event-source combo as seen
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
    });
  });
  // Sort data.viewedblocks from greatest to least
  const sortedViewedBlocks = Object.entries(data.viewedblocks)
    .sort(([, a], [, b]) => b - a)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  data.viewedblocks = sortedViewedBlocks;

  console.log(data, "final data");
  return data; 
}
//
function createButton(label) {
  const button = document.createElement('button');
  button.className = 'hlx-badge';
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

function getOverlay() {
  let overlay = document.querySelector('aem-experimentation-bar')?.shadowRoot.children[1];
  if (!overlay) {
    const el = createPreviewOverlay();
    document.body.append(el);
    [, overlay] = el.shadowRoot.children;
  }
  return overlay;
}
//
export async function decorateVisualizerPill(overlay, options, context) {
  const submit = createButton('Submit');
  const pill = createVisualizationButton(
    `Visualizer`,
    {
      label: 'Visualization'
    },
    [
      `Start Date: <input type="date" name="start-date" id="start-date">`,
      `End Date: <input type="date" name="end-date" id="end-date">`,
      `Variable: <select name="class-dropdown" id="class-dropdown">
        <option value="click">Clicks</option>
        <option value="conversions">Conversions</option>
        <option value="forms">Form Submits</option>
        <option value="views">Viewed Blocks</option>
      </select>`,
      `Domain Key: <input type="text" name="domain-key" id="domain-key">`,
    ],
    submit
  );
  overlay.append(pill);
}