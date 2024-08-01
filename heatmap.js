import { fetchDateRange } from "../common/rum-bundler-client.js";
import { groupChunksByUrl } from "../common/aggregations.js";

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

export async function pageMetrics(startDate, endDate) {
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

  const allChunks = await fetchDateRange(hostname, startDate, endDate);
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