const { Transform } = require('stream');
const tls = require('tls');
const http2 = require('http2');
const zlib = require('zlib');

// Create the HTTP/2 connection.
const client = http2.connect('https://large-html-css-test.glitch.me');
client.on('error', (err) => console.error(err));
client.on('connect', () => console.log('Connection established'));

async function requestHTML() {
  const req = client.request({
    ':path': '/',
    'Accept-Encoding': 'gzip',
  }, {
    // weight/parent can be set here, but it seems to have no impact
  });

  console.log('Requesting HTML');

  const headers = await new Promise((resolve) => {
    req.on('response', (headers) => {
      console.log('Got response for HTML');
      resolve(headers);
    });
  });

  let seenChunk = false;
  let seenLink = false;
  const watchFor = '<link rel="stylesheet"';
  let buffer = '';
  let length = 0;
  let start;

  let stream = req.pipe(new Transform({
    transform(chunk, encoding, callback) {
      length += chunk.length;
      this.push(chunk, encoding);
      callback();
    }
  }));

  if (headers['content-encoding']) {
    stream = stream.pipe(zlib.createGunzip());
  }

  stream.on('data', (chunk) => {
    if (!seenChunk) {
      start = Date.now();
      console.log('Got first HTML chunk');
      seenChunk = true;
    }

    if (!seenLink) {
      buffer += chunk;
      if (buffer.includes(watchFor)) {
        buffer = '';
        seenLink = true;
        console.log('Seen stylesheet reference');
        requestCSS(req.id, (cssStream) => {
          // Adjust priority based on the CSS stream.
          // This seems to have no impact on performance.
          //req.priority({ parent: cssStream.id, weight: 1 });
        }).then(() => {
          const now = Date.now();
          console.log('HTML bps so far:', length / ((now - start) / 1000));
        });
      }
      buffer = buffer.slice(-(watchFor.length - 1));
    }
  });

  stream.on('end', () => {
    const end = Date.now();
    console.log('Got all HTML. bps:', length / ((end - start) / 1000));
  });
  req.end();
}

function requestCSS(parent, readyCallback) {
  return new Promise(async (resolve) => {
    console.log('Requesting CSS');
    const req = client.request({
      ':path': '/all.css',
      'Accept-Encoding': 'gzip',
    }, {
      // Setting the HTML as the parent seems to slow the CSS delivery considerably
      //parent,
      // This doesn't seem to have an impact
      //exclusive: true,
      // A weight of 256 seems to make the CSS arrive earlier
      weight: 256
    });

    readyCallback(req);

    let length = 0;
    let start;

    const headers = await new Promise((resolve) => {
      req.on('response', (headers) => {
        console.log('Got response for HTML');
        resolve(headers);
      });
    });

    let seenChunk = false;
    let stream = req.pipe(new Transform({
      transform(chunk, encoding, callback) {
        length += chunk.length;
        this.push(chunk, encoding);
        callback();
      }
    }));

    if (headers['content-encoding']) {
      stream = stream.pipe(zlib.createGunzip());
    }

    stream.on('data', (chunk) => {
      if (!seenChunk) {
        start = Date.now();
        console.log('Got first CSS chunk');
        seenChunk = true;
      }
    });

    stream.on('end', () => {
      const end = Date.now();
      console.log('Got all CSS. bps', length / ((end - start) / 1000));
      resolve();
    });
    req.end();
  });
}

requestHTML();
