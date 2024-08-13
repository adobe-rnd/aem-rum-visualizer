import { fetchDateRange } from "rum-bundler-client.js";
import { groupChunksByUrl } from "aggregations.js";

const backgroundColorLow = 'rgba(255, 0, 0, 0.5)'; // Red
const backgroundColorMedium = 'rgba(0, 213, 255, 0.5)'; // Blue
const backgroundColorHigh = 'rgba(0, 255, 65, 0.5)'; // Green
const textColor = 'white'; // Overlay percentage text color

export async function decorateVisualizerPill(overlay) { //options, context not necessary?
  const submit = createButton('Submit');
  const close = createButton('X');
  const pill = createVisualizationBar(
    [
      `Start Date: <input type="date" name="start-date" id="start-date">`,
      `End Date: <input type="date" name="end-date" id="end-date">`,
      `Variable: <select name="class-dropdown" id="class-dropdown" class="dropup">
        <optgroup label="Percentages">
          <option value="CTR">CTR</option>
          <option value="CVR">CVR</option>
          <option value="FSR">Form Submit Rate</option>
        <optgroup label="Numbers">
          <option value="click">Clicks</option>
          <option value="conversions">Conversions</option>
          <option value="forms">Form Submits</option>
        <optgroup label="Viewed">
          <option value="views">Blocks</option>
      </select>`,
      `Domain Key: <input type="text" name="domain-key" id="domain-key" style="width: 100px;">`,
      `Device: <select name="device-dropdown" id="device-dropdown" class="dropup">
        <option value="all-devices">All</option>
        <option value="desktop">Desktop</option>
        <option value="mobile">Mobile</option>`,
      `Views: <span id="views">0</span>`,
    ],
    submit,
    close
  );
  overlay.append(pill);
  return pill; 
}

function createVisualizationBar(items, submit, close) {
  // const button = createButton(label);
  // const popup = createPopupDialog(header, items);
  const bar = document.createElement('div');
  bar.style.position = 'fixed';
  bar.style.bottom = '0';
  bar.style.width = '100%';
 // bar.style.height = '10%';
  bar.style.backgroundColor = '#ffffff'; // White background color
  bar.style.borderTop = '1px solid #ccc'; // Light grey border on top
  bar.style.border = '4px solid #800080'; // Thicker dark purple border around the bar
  bar.style.padding = '20px'; // Padding for better spacing
  bar.style.boxShadow = '0 -2px 5px rgba(128, 0, 128, 0.3)'; // Reduced purple shadow for a subtle effect
  bar.style.zIndex = '1000'; // Ensure it stays on top of other elements
  bar.style.margin = '0'; // No margin
  bar.style.boxSizing = 'border-box'; // Ensure padding and border are included in the element's total width and height
  bar.style.display = 'flex'; // Use flexbox for layout
  bar.style.justifyContent = 'space-around'; // Space out elements evenly
  bar.style.alignItems = 'center'; // Center elements vertically
  bar.style.paddingLeft = '40px'; // Padding on the left
  bar.style.paddingRight = '40px'; // Padding on the right
  
  items.forEach(item => {
    const div = document.createElement('div');
    div.innerHTML = item;
    div.style.display = 'inline-block';
    div.style.marginRight = '10px'; // Reduced margin between items
    div.style.color = '#800080'; // Dark purple text color for contrast
    div.style.fontSize = '18px'; // Slightly larger text size
    div.style.fontWeight = 'bold'; // Bold text for emphasis
    div.style.fontFamily = 'Roboto, sans-serif'; // Modern font
    bar.appendChild(div);
  });
  submit.style.marginRight = '10px'; 
  bar.appendChild(submit);
  close.className = 'close';
  close.style.width = `25px`;
  close.style.height = `21.5px`;
  bar.appendChild(close);

  // button.innerHTML += '<span class="hlx-open"></span>';
  bar.addEventListener('click', (event) => {
    var isClickInsideSubmit = submit.contains(event.target);
  //  var isClickInsideClose = closeButton.contains(event.target);
    if (isClickInsideSubmit) {
      const overlay = getOverlay();
      const startDate = overlay.querySelector('#start-date').value;
      const endDate = overlay.querySelector('#end-date').value;
      const variable = overlay.querySelector('#class-dropdown').value;
      const domainKey = overlay.querySelector('#domain-key').value;
      const device = overlay.querySelector('#device-dropdown').value;

      const allData = {
        startDate,
        endDate,
        variable,
        domainKey,
        device
      };
      console.log(allData); // data inputted by user
      updatePageMetrics(startDate, endDate, variable, domainKey, device);

      console.log("updated page metrics");
    }
    else if (close.contains(event.target)) {
      const barItems = bar.querySelectorAll(':not(.close)');
      barItems.forEach(item => {
        item.style.display = item.style.display === 'none' ? 'inline-block' : 'none';
      });
      if (bar.style.width == '100%') {
        bar.style.width = '30px' // Set width to the button's width
        bar.style.margin = '0px'; // Remove margin
        bar.style.padding = '0px'; // Remove padding
        bar.style.border = 'none'; // Remove border
        close.innerHTML = '+';
        console.log("close")
      } else {
        bar.style.width = '100%';
        bar.style.padding = '20px'; // Padding for better spacing
        bar.style.paddingLeft = '40px'; // Padding on the left
        bar.style.paddingRight = '40px'; // Padding on the right
        bar.style.border = '4px solid #800080';
        close.innerHTML = 'X';
        console.log("open")
      }
    }
    else {
      //  error out?
    }
  });
  //bar.append(popup);
  //popup.append(submit);
  return bar;
}

async function updatePageMetrics(startDate, endDate, variable, domainKey, device) {
  try {
    const allData = await pageMetrics(startDate, endDate, domainKey, device);
    const overlay = getOverlay();
    const viewsElement = overlay.querySelector('#views');
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
    //
    console.log(curCounts, "curCounts", variable)
    //

    // removes old ones
    document.querySelectorAll('.heat-overlay').forEach(overlay => overlay.remove());

    let percentTrigger = false;
    if (variable == "CTR" || variable == "CVR" || variable == "FSR" || variable == "views") {
      percentTrigger = true;
    }

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
      console.log({ elements, count, selector }, "elements, count, selector")
      elements.forEach(element => {
        if (element.querySelector('.heat-overlay')) {
          console.log('Element already has an overlay:', element);
          return;
        }
        const overlay = createHeatOverlay(count, allData.views, percentTrigger);
        console.log(overlay.textContent, allData.views, "overlay")

        if (window.getComputedStyle(element).position == 'static') {
          element.style.position = 'relative';
        }
        overlay.classList.add('heat-overlay');
        element.style.overflow = 'visible'; // Allow text to overflow
        element.appendChild(overlay);
        const children = element.children;
        // Iterate over the children and print each one
        for (let i = 0; i < children.length; i++) {
          console.log(children[i], "child");
        }
        console.log("end of cur child")
        //
        const rect = overlay.getBoundingClientRect();
        console.log(`Overlay details - Width: ${rect.width}, Height: ${rect.height}, Top: ${rect.top}, Left: ${rect.left}`);
        //
      });
    });
  //  console.log("my overlay is here and later deleted :(")
  } catch (error) {
    console.error('Error fetching page metrics:', error);
  }
}

export async function pageMetrics(startDate, endDate, domainKey, device) {
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
  console.log(data, "final data");
  return data;
}


function createHeatOverlay(count, total, percentTrigger) {
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
  if (event.checkpoint == 'click') {
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

//
function createButton(label) {
  const button = document.createElement('button');
  //  button.className = 'hlx-badge';
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

    const cssPath = new URL(new Error().stack.split('\n')[2].match(/[a-z]+?:\/\/.*?\/[^:]+/)[0]).pathname.replace('heatmap.js', 'index.css');
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
//