import { decodeText, iterateStream } from "./utils.mjs";

const glitch = document.querySelector('.glitch');
//const wiki = document.querySelector('.wiki');

async function fetchPage(htmlUrl, cssUrl) {
  console.log('Requesting HTML');
  const response = await fetch(htmlUrl);
  console.log('Got response for HTML');

  const watchFor = '<link rel="stylesheet"';
  let seenLink = false;
  let length = 0;
  let buffer = ''
  let start;

  const stream = response.body.pipeThrough(decodeText());

  for await (const chunk of iterateStream(stream)) {
    length += chunk.length;

    if (!start) {
      start = Date.now();
      console.log('Got first HTML chunk');
    }

    if (!seenLink) {
      buffer += chunk;
      if (buffer.includes(watchFor)) {
        buffer = '';
        seenLink = true;
        console.log('Seen stylesheet reference');
        fetchCss(cssUrl).then(() => {
          const now = Date.now();
          console.log('HTML bps so far:', length / ((now - start) / 1000));
        });
      }
      buffer = buffer.slice(-(watchFor.length - 1));
    }
  }

  const end = Date.now();
  console.log('Got all HTML. bps:', length / ((end - start) / 1000));
}

async function fetchCss(cssUrl) {
  console.log('Requesting CSS');
  const response = await fetch(cssUrl);
  console.log('Got response for CSS');

  let length = 0;
  let start;

  const stream = response.body;

  for await (const chunk of iterateStream(stream)) {
    length += chunk.length;

    if (!start) {
      start = Date.now();
      console.log('Got first CSS chunk');
    }
  }

  const end = Date.now();
  console.log('Got all CSS. bps:', length / ((end - start) / 1000));
}

/*wiki.addEventListener('click', () => {
  fetchPage(
    'https://en.m.wikipedia.org/wiki/Barack_Obama',
    'https://en.m.wikipedia.org/w/load.php?debug=false&amp;lang=en&amp;modules=ext.cite.styles%7Cmediawiki.hlist%7Cmediawiki.ui.button%2Cicon%7Cskins.minerva.base.reset%2Cstyles%7Cskins.minerva.content.styles%7Cskins.minerva.content.styles.images%7Cskins.minerva.icons.images%7Cskins.minerva.tablet.styles&amp;only=styles&amp;skin=minerva',
  );
});*/

glitch.addEventListener('click', () => {
  fetchPage(
    'https://large-html-css-test.glitch.me',
    'https://large-html-css-test.glitch.me/all.css',
  );
});
