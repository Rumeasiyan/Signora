'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// Modern PDF.js uses these decoders for scanned PDFs. Resolve only known,
// package-owned assets so PDF content cannot select an arbitrary fetch URL.
class PdfBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    let url: URL;
    if (kind === 'wasmUrl' && filename === 'openjpeg.wasm') {
      url = new URL('pdfjs-dist/wasm/openjpeg.wasm', import.meta.url);
    } else if (kind === 'wasmUrl' && filename === 'jbig2.wasm') {
      url = new URL('pdfjs-dist/wasm/jbig2.wasm', import.meta.url);
    } else {
      throw new Error('Unsupported PDF resource');
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not load PDF image decoder');
    return new Uint8Array(await response.arrayBuffer());
  }
}

interface PdfViewerProps {
  pdfUrl?: string;
  pdfData?: ArrayBuffer | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPagesLoaded?: (total: number) => void;
  onPageDimensionsChanged?: (dimensions: { width: number; height: number }) => void;
  children?: React.ReactNode;
}

export default function PdfViewer({
  pdfUrl,
  pdfData,
  currentPage,
  onPageChange,
  onTotalPagesLoaded,
  onPageDimensionsChanged,
  children,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

  // Load Document
  useEffect(() => {
    let isCancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    async function loadDocument() {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      try {
        // Import only in the browser. Bundle the worker from the same pinned package
        // as the API, rather than executing a third-party CDN script.
        const pdfjs = await import('pdfjs-dist');
        if (isCancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const options = {
          // Canvas rendering only: never enable XFA or execute PDF actions.
          enableXfa: false,
          useWorkerFetch: false,
          BinaryDataFactory: PdfBinaryDataFactory,
        };

        if (pdfData) {
          const originalBytes = new Uint8Array(pdfData);
          const copiedBytes = Uint8Array.from(originalBytes);

          loadingTask = pdfjs.getDocument({
            ...options,
            data: copiedBytes,
          });
        } else if (pdfUrl) {
          loadingTask = pdfjs.getDocument({ ...options, url: pdfUrl });
        } else {
          return;
        }
        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        if (onTotalPagesLoaded) onTotalPagesLoaded(doc.numPages);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err);
          setError('Could not load PDF document. Please verify the file.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadDocument();
    return () => {
      isCancelled = true;
      // Releases the document and worker, including an in-flight download.
      void loadingTask?.destroy();
    };
  }, [pdfUrl, pdfData, onTotalPagesLoaded]);

  // Render current page onto canvas
  useEffect(() => {
    let renderTask: RenderTask | null = null;
    let isCancelled = false;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const pageNum = Math.min(Math.max(1, currentPage), totalPages);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        setDimensions({ width: viewport.width, height: viewport.height });
        if (onPageDimensionsChanged) {
          onPageDimensionsChanged({ width: viewport.width, height: viewport.height });
        }

        const renderContext = {
          canvas,
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.error('Page render error:', err);
        }
      }
    }

    renderPage();
    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale, totalPages, onPageDimensionsChanged]);

  return (
    <div className="pdf-stage-wrapper">
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn sm secondary"
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous Page"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn sm secondary"
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next Page"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn sm secondary"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            aria-label="Zoom Out"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: 13, minWidth: 45, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            className="btn sm secondary"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            aria-label="Zoom In"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            className="btn sm ghost"
            style={{ color: '#cbd5e1' }}
            onClick={() => setScale(1.2)}
            title="Reset Zoom"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {loading && <p style={{ color: 'white', margin: '40px 0' }}>Loading PDF document...</p>}
      {error && <p className="error">{error}</p>}

      {/* Canvas and Overlay Container */}
      <div
        ref={containerRef}
        className="pdf-page-container"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          display: loading || error ? 'none' : 'block',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* Overlay for signature boxes or interaction */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
