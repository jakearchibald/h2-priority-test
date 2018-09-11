const { Throttle } = require('stream-throttle');
const { Duplex } = require('stream');
const tls = require('tls');
const http2 = require('http2');

// Create the HTTP/2 connection.
const client = http2.connect('https://large-html-css-test.glitch.me', {
  // This is where I throttle the connection.
  // Only reading is throttled.
  createConnection(authority) {
    const connection = tls.connect(443, authority.hostname, {
      allowHalfOpen: true,
      ALPNProtocols: ['h2'],
      servername: authority.hostname,
    });

    const throttledRead = connection.pipe(new Throttle({rate: 20 * 1024}));

    const throttledConnection = new Duplex({
      read(size) {
        throttledRead.read(size);
        throttledRead.once('data', (chunk) => {
          this.push(chunk);
        });
      },
      write(chunk, encoding, callback) {
        connection.write(chunk, encoding, callback);
      }
    });
    return throttledConnection;
  }
});
client.on('error', (err) => console.error(err));
client.on('connect', () => console.log('Connection established'));

function requestHTML() {
  const req = client.request({ ':path': '/' }, {
    // weight/parent can be set here, but it seems to have no impact
  });

  console.log('Requesting HTML');
  req.on('response', () => {
    console.log('Got response for HTML');
  });

  let seenChunk = false;
  let seenLink = false;
  const watchFor = '<link rel="stylesheet"';
  req.setEncoding('utf8');
  let buffer = '';
  let length = 0;
  let start;

  req.on('data', (chunk) => {
    length += chunk.length;
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

  req.on('end', () => {
    const end = Date.now();
    console.log('Got all HTML. bps:', length / ((end - start) / 1000));
  });
  req.end();
}

function requestCSS(parent, readyCallback) {
  return new Promise((resolve) => {
    console.log('Requesting CSS');
    const req = client.request({ ':path': '/all.css' }, {
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

    req.on('response', () => {
      console.log('Got response for CSS');
    });

    let seenChunk = false;
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      length += chunk.length;
      if (!seenChunk) {
        start = Date.now();
        console.log('Got first CSS chunk');
        seenChunk = true;
      }
    });

    req.on('end', () => {
      const end = Date.now();
      console.log('Got all CSS. bps', length / ((end - start) / 1000));
      resolve();
    });
    req.end();
  });
}

requestHTML();
