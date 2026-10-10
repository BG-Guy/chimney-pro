// iPhone Safari can't loop over a ReadableStream with `for await (... of stream)` yet, and
// PDF.js does exactly that (collecting page text, decompressing the file). Teach streams how,
// so the company report PDF can be read there. Loaded in the page and in the PDF worker.
const proto = ReadableStream.prototype as unknown as {
  [Symbol.asyncIterator]?: () => AsyncGenerator<unknown>;
};

if (typeof proto[Symbol.asyncIterator] !== "function") {
  proto[Symbol.asyncIterator] = async function* (this: ReadableStream<unknown>) {
    const reader = this.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

export {};
