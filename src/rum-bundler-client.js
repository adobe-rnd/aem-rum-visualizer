async function fetchDomainKey(domain) {
  try {
    const auth = process.env.RUM_BUNDLER_TOKEN;
    const resp = await fetch(`https://rum.fastly-aem.page/domainkey/${domain}`, {
      headers: {
        authorization: `Bearer ${auth}`,
      },
    });
    const json = await resp.json();
    return (json.domainkey);
  } catch {
    return '';
  }
}

async function fetchBundles(domain, interval, checkpoints) {
  const BATCH_SIZE = 10;
  const HOURS = 24;

  const domainKey = 1; // insert petplace domain key here
  const chunks = [];
  const urls = [];

  const today = new Date();
  for (let i = 0; i < interval; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    for (let hour = 0; hour < HOURS; hour++) {
      urls.push(`https://rum.fastly-aem.page/bundles/${domain}/${year}/${month}/${day}/${hour}?domainkey=${domainKey}`);
    }
  }
  for (let start = 0; start < urls.length; start += BATCH_SIZE) {
    const batch = urls.slice(start, start + BATCH_SIZE);
    const promises = [];
    let error = false;
    let batchBundles = [];
    try {
      for (const url of batch) {
        promises.push(fetch(url));
      }
      const responses = await Promise.all(promises);
      batchBundles = await Promise.all(responses.map((response) => response.json()));
    } catch (e) {
      error = true;
      console.error('error while fetching RUM bundles..',  e);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.info("retrying the batch");
      start -= BATCH_SIZE;
    }
    if (!error) {
      if(checkpoints) {
        for (const bundle of batchBundles) {
          // filter the events inside the bundle.rumBundles based on the checkpoints and return the updated rumBundles
          bundle.rumBundles = bundle.rumBundles.map((rumBundle) => {
            rumBundle.events = rumBundle.events.filter((event) => checkpoints.includes(event.checkpoint));
            return rumBundle;
          });
        }
      }
      chunks.push(...batchBundles);
    }
  }
  return chunks.flatMap((chunk) => chunk.rumBundles);
}

async function fetchLastMonth(domain, checkpoints) {
  return fetchBundles(domain,31, checkpoints);
}

/////
/////
async function fetchSpecificBundles(domain, startDate, endDate, domainKey, checkpoints, url)  {
  // Date range calculations
  const start = new Date(startDate);
  const end = new Date(endDate);
  const currentDate = new Date();

  if (start > currentDate) {
    console.error("Start date cannot be in the future.");
    return;
  }
  if (end > currentDate) {
    console.error("End date cannot be in the future.");
    return;
  }

  // Check if start date is at least one day before end date
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  if ((end - start) < millisecondsPerDay) {
    console.error("Start date must be at least one day before end date.");
    return;
  }

  const change = end - start;
  const range = change / millisecondsPerDay;

  //
  // RUM bundle fetching done here
  const BATCH_SIZE = 10;
  const HOURS = 24;
  const chunks = [];
  const urls = [];

  const date = new Date(endDate);
  // THE DATE IS OFF SINCE IT IS LOCKED TO UTC 0, 7 HOUR DELAY

  const today = date;
  ////
  // console.log(today, "today's date");
  // console.log(range, "date range");
  ////

  for (let i = 0; i < range; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    for (let hour = 0; hour < HOURS; hour++) {
      urls.push(`https://rum.fastly-aem.page/bundles/${domain}/${year}/${month}/${day}/${hour}?domainkey=${domainKey}`);
    }
  }
  for (let start = 0; start < urls.length; start += BATCH_SIZE) {
    const batch = urls.slice(start, start + BATCH_SIZE);
    const promises = [];
    let error = false;
    let batchBundles = [];
    try {
      for (const url of batch) {
        promises.push(fetch(url));
      }
      const responses = await Promise.all(promises);
      batchBundles = await Promise.all(responses.map((response) => response.json()));
    } catch (e) {
      error = true;
      console.error('error while fetching RUM bundles..',  e);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.info("retrying the batch");
      start -= BATCH_SIZE;
    }
    if (!error) {
      for (const bundle of batchBundles) {
        // filter the events inside the bundle.rumBundles based on the checkpoints and return the updated rumBundles
        if (url) {
          bundle.rumBundles = bundle.rumBundles.filter((rumBundle) =>
            rumBundle.url.includes(url)
          );
        }
        if (checkpoints) {
          bundle.rumBundles = bundle.rumBundles.map((rumBundle) => {
            rumBundle.events = rumBundle.events.filter((event) =>
              checkpoints.includes(event.checkpoint)
            );
            return rumBundle;
          });
        }
      }
      chunks.push(...batchBundles);
    }
  }
  console.log("fetched all bundles");
  return chunks.flatMap((chunk) => chunk.rumBundles);
}

export {
  fetchLastMonth,
  fetchBundles,
  fetchSpecificBundles,
}
