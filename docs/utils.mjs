export function decodeText() {
  const decoder = new TextDecoder();
  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(decoder.decode(chunk, {
        stream: true
      }));
    }
  });
}


export function iterateStream(stream) {
  // Get a lock on the stream:
  const reader = stream.getReader();

  return {
    next () {
      // Stream reads already resolve with {done, value}, so
      // we can just call read:
      return reader.read();
    },
    return () {
      // Release the lock if the iterator terminates.
      reader.releaseLock();
      return {};
    },
    // for-await calls this on whatever it's passed, so
    // iterators tend to return themselves.
    [Symbol.asyncIterator] () {
      return this;
    }
  };
}
