// The PDF.js worker, with the stream fallback loaded first so it also works on iPhone Safari.
import "./streamIterator";
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
