'use client';
import { useEffect, useState, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, ArrowRight, UserCheck } from 'lucide-react';
import Nav from '@/components/Nav';
import WorkflowStepper from '@/components/WorkflowStepper';
import PdfViewer from '@/components/PdfViewer';
import { api, API_URL, getError } from '@/lib/api';

interface Signer {
  id: string;
  name: string;
  email: string;
}

interface Box {
  id?: string;
  signerId?: string | null;
  signerName?: string;
  signerEmail?: string;
  page: number;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage
  height: number; // percentage
}

export default function PreparePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const docId = resolvedParams.id;

  const [docTitle, setDocTitle] = useState('');
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pdfPagesLoaded, setPdfPagesLoaded] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  // Dragging / Resizing interaction state
  const dragRef = useRef<{
    action: 'move' | 'resize';
    boxIndex: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Load document, PDF arraybuffer, signers, and existing boxes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    async function loadAll() {
      try {
        setLoading(true);
        const [pdfRes, signersRes, boxesRes, docsRes] = await Promise.all([
          api.get(`/api/documents/${docId}/view`, { responseType: 'arraybuffer' }),
          api.get(`/api/documents/${docId}/signers`),
          api.get(`/api/documents/${docId}/boxes`),
          api.get('/api/documents'),
        ]);

        setPdfData(pdfRes.data);
        const loadedSigners: Signer[] = signersRes.data.signers || [];
        const loadedBoxes: Box[] = boxesRes.data.boxes || [];
        // Complete the existing "Add New Signer" round trip. Only assign a
        // known signer from this document to an existing box.
        const query = new URLSearchParams(window.location.search);
        const requestedBox = query.get('assignBox');
        const requestedSigner = query.get('signerId');
        const boxIndex = requestedBox !== null && /^\d+$/.test(requestedBox)
          ? Number(requestedBox)
          : -1;
        const canAssign = Number.isSafeInteger(boxIndex) && boxIndex >= 0 &&
          boxIndex < loadedBoxes.length &&
          loadedSigners.some((signer) => signer.id === requestedSigner);
        setSigners(loadedSigners);
        setBoxes(canAssign
          ? loadedBoxes.map((box, index) => index === boxIndex
            ? { ...box, signerId: requestedSigner }
            : box)
          : loadedBoxes);
        if (canAssign) {
          setSelectedBoxIndex(boxIndex);
          setCurrentPage(loadedBoxes[boxIndex].page);
          setMessage({ text: 'Signer assigned. Save boxes to keep this assignment.', type: 'success' });
        }

        const currentDoc = (docsRes.data.documents || []).find((d: any) => d.id === docId);
        if (currentDoc) setDocTitle(currentDoc.title);
      } catch (err) {
        setMessage({ text: getError(err), type: 'error' });
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [docId, router]);

  const handleTotalPagesLoaded = useCallback((total: number) => {
    setTotalPages(total);
    setPdfPagesLoaded(true);
  }, []);

  // Add a new signature box to the current page
  function addBox() {
    const defaultSigner = signers.length > 0 ? signers[0].id : null;
    const newBox: Box = {
      page: currentPage,
      x: 35, // centered horizontally
      y: 40 + (boxes.filter((b) => b.page === currentPage).length * 8) % 40,
      width: 28, // 28% of page width
      height: 9, // 9% of page height
      signerId: defaultSigner,
    };
    setBoxes((prev) => [...prev, newBox]);
    setSelectedBoxIndex(boxes.length);
    setMessage({ text: 'Added new signature box. Drag to position and resize.', type: 'success' });
  }

  // Delete a box
  function deleteBox(index: number) {
    setBoxes((prev) => prev.filter((_, i) => i !== index));
    if (selectedBoxIndex === index) setSelectedBoxIndex(null);
  }

  // Assign box to signer
  function assignSigner(index: number, signerId: string | null) {
    setBoxes((prev) =>
      prev.map((box, i) => (i === index ? { ...box, signerId: signerId || null } : box))
    );
  }

  // Save boxes to backend
  async function addSignerFromBox(index: number) {
  if (!pdfPagesLoaded) return;

  if (boxes.some((b) =>
    b.page < 1 || b.page > totalPages ||
    ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
    b.width <= 0 || b.height <= 0 ||
    b.x < 0 || b.y < 0 ||
    b.x + b.width > 100 || b.y + b.height > 100
  )) {
    setMessage({
      text: 'Please correct invalid signature boxes first.',
      type: 'error',
    });
    return;
  }

  try {
    setSaving(true);

    await api.post(`/api/documents/${docId}/boxes`, {
      boxes: boxes.map((b) => ({
        signerId: b.signerId || null,
        page: b.page,
        x: Math.round(b.x * 100) / 100,
        y: Math.round(b.y * 100) / 100,
        width: Math.round(b.width * 100) / 100,
        height: Math.round(b.height * 100) / 100,
      })),
    });

    router.push(`/documents/${docId}/signers?returnBox=${index}`);
  } catch (err) {
    setMessage({ text: getError(err), type: 'error' });
  } finally {
    setSaving(false);
  }
}
  async function saveBoxes() {
    if (!pdfPagesLoaded) {
      setMessage({ text: 'Wait for the PDF pages to finish loading before saving boxes.', type: 'error' });
      return;
    }
    if (boxes.some((box) => !Number.isInteger(box.page) || box.page < 1 || box.page > totalPages)) {
      setMessage({ text: 'Every signature box must be placed on an existing PDF page.', type: 'error' });
      return;
    }
    try {
      setSaving(true);
      setMessage(null);
      await api.post(`/api/documents/${docId}/boxes`, {
        boxes: boxes.map((b) => ({
          signerId: b.signerId,
          page: b.page,
          x: Math.round(b.x * 100) / 100,
          y: Math.round(b.y * 100) / 100,
          width: Math.round(b.width * 100) / 100,
          height: Math.round(b.height * 100) / 100,
        })),
      });
      setMessage({ text: 'Signature boxes saved successfully!', type: 'success' });
    } catch (err) {
      setMessage({ text: getError(err), type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // Mouse / Touch handlers for Move & Resize
  function handleStartAction(
    e: React.MouseEvent | React.TouchEvent,
    index: number,
    action: 'move' | 'resize'
  ) {
    e.stopPropagation();
    setSelectedBoxIndex(index);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const box = boxes[index];
    dragRef.current = {
      action,
      boxIndex: index,
      startX: clientX,
      startY: clientY,
      origX: box.x,
      origY: box.y,
      origW: box.width,
      origH: box.height,
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
    window.addEventListener('touchmove', handleWindowMove, { passive: false });
    window.addEventListener('touchend', handleWindowUp);
  }

  function handleWindowMove(e: MouseEvent | TouchEvent) {
    if (!dragRef.current || !pageDimensions.width || !pageDimensions.height) return;
    if ('touches' in e) e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = ((clientX - dragRef.current.startX) / pageDimensions.width) * 100;
    const deltaY = ((clientY - dragRef.current.startY) / pageDimensions.height) * 100;

    const { action, boxIndex, origX, origY, origW, origH } = dragRef.current;

    setBoxes((prev) => {
      const next = [...prev];
      const target = { ...next[boxIndex] };

      if (action === 'move') {
        let newX = origX + deltaX;
        let newY = origY + deltaY;
        // Keep within page boundaries
        newX = Math.max(0, Math.min(100 - target.width, newX));
        newY = Math.max(0, Math.min(100 - target.height, newY));
        target.x = newX;
        target.y = newY;
      } else if (action === 'resize') {
        let newW = Math.max(12, origW + deltaX);
        let newH = Math.max(5, origH + deltaY);
        // Bound to page
        if (target.x + newW > 100) newW = 100 - target.x;
        if (target.y + newH > 100) newH = 100 - target.y;
        target.width = newW;
        target.height = newH;
      }

      next[boxIndex] = target;
      return next;
    });
  }

  function handleWindowUp() {
    dragRef.current = null;
    window.removeEventListener('mousemove', handleWindowMove);
    window.removeEventListener('mouseup', handleWindowUp);
    window.removeEventListener('touchmove', handleWindowMove);
    window.removeEventListener('touchend', handleWindowUp);
  }

  const currentPageBoxes = boxes
    .map((b, idx) => ({ ...b, originalIndex: idx }))
    .filter((b) => b.page === currentPage);
  const invalidBoxes = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) =>
      !Number.isInteger(box.page) || box.page < 1 || box.page > totalPages ||
      ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
      box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 ||
      box.x + box.width > 100 || box.y + box.height > 100
    );

  return (
    <>
      <Nav />
      <main className="shell">
        <div className="row" style={{ marginBottom: 14 }}>
          <div>
            <h1 className="title">Place Signature Boxes</h1>
            <p className="muted" style={{ margin: 0 }}>
              {docTitle ? `Document: ${docTitle}` : 'Position signature fields on the PDF pages.'}
            </p>
          </div>
          <div className="actions">
            <button className="btn secondary" onClick={addBox} disabled={loading || !pdfPagesLoaded}>
              <Plus size={16} /> Add Signature Box
            </button>
            <button className="btn" onClick={saveBoxes} disabled={saving || loading || !pdfPagesLoaded}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Boxes'}
            </button>
            <button
              className="btn success"
              onClick={() => router.push(`/documents/${docId}/signers`)}
            >
              Next: Signers <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <WorkflowStepper docId={docId} currentStep="prepare" />

        {message && (
          <div className={message.type} style={{ marginBottom: 14 }}>
            {message.text}
          </div>
        )}

        {pdfPagesLoaded && invalidBoxes.length > 0 && (
          <div className="error" style={{ marginBottom: 14 }}>
            <strong>Some saved signature boxes are outside the PDF page bounds.</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {invalidBoxes.map(({ box, index }) => (
                <button key={index} className="btn sm danger" onClick={() => deleteBox(index)}>
                  Remove invalid box on page {box.page}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Box Inspector Toolbar */}
        {selectedBoxIndex !== null && boxes[selectedBoxIndex] && (
          <div
            className="card"
            style={{
              padding: '12px 18px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8faff',
              borderColor: '#c7d2fe',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4338ca' }}>
                Selected Box #{selectedBoxIndex + 1} (Page {boxes[selectedBoxIndex].page}):
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserCheck size={15} color="#4f46e5" />
                <label style={{ fontSize: 13, fontWeight: 600 }}>Assign Signer:</label>
                <select
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #c7d2fe',
                    fontSize: 13,
                  }}
                  value={boxes[selectedBoxIndex].signerId || ''}
                  onChange={(e) => assignSigner(selectedBoxIndex, e.target.value || null)}
                >
                  <option value="">-- Unassigned --</option>
                  {signers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn sm danger"
                onClick={() => deleteBox(selectedBoxIndex)}
                title="Delete signature box"
              >
                <Trash2 size={14} /> Remove Box
              </button>
            </div>
          </div>
        )}

        {/* PDF Viewer with interactive boxes overlay */}
        <PdfViewer
          pdfData={pdfData}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onTotalPagesLoaded={handleTotalPagesLoaded}
          onPageDimensionsChanged={setPageDimensions}
        >
          {currentPageBoxes.map((box) => {
            const isSelected = selectedBoxIndex === box.originalIndex;
            const assignedSigner = signers.find((s) => s.id === box.signerId);

            return (
              <div
                key={box.originalIndex}
                className={`sig-box ${isSelected ? 'selected' : ''}`}
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
                onMouseDown={(e) => handleStartAction(e, box.originalIndex, 'move')}
                onTouchStart={(e) => handleStartAction(e, box.originalIndex, 'move')}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBoxIndex(box.originalIndex);
                }}
              >
               <div className="sig-box-header">
  <select
    aria-label="Assign signer to signature box"
    value={box.signerId || ''}
    onChange={(e) => {
      const value = e.target.value;

      if (value === '__add_signer__') {
        void addSignerFromBox(box.originalIndex);
      } else {
        assignSigner(box.originalIndex, value || null);
      }
    }}
    onMouseDown={(e) => e.stopPropagation()}
    onTouchStart={(e) => e.stopPropagation()}
    onClick={(e) => e.stopPropagation()}
    style={{
      maxWidth: '85%',
      fontSize: 12,
      padding: '3px 5px',
      borderRadius: 5,
      border: '1px solid #a5b4fc',
      background: '#ffffff',
      color: '#312e81',
      cursor: 'pointer',
    }}
  >
    <option value="">Unassigned</option>
    {signers.map((signer) => (
      <option key={signer.id} value={signer.id}>
        {signer.name}
      </option>
    ))}
    <option value="__add_signer__">+ Add New Signer</option>
  </select>

  <button
    className="sig-box-del"
    onClick={(e) => {
      e.stopPropagation();
      deleteBox(box.originalIndex);
    }}
    title="Delete box"
  >
    ×
  </button>
</div>
                  

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    fontSize: 11,
                    color: '#4f46e5',
                    fontWeight: 600,
                  }}
                >
                  Sign Here
                </div>

                {/* Resize Handle */}
                <div
                  className="sig-box-handle"
                  onMouseDown={(e) => handleStartAction(e, box.originalIndex, 'resize')}
                  onTouchStart={(e) => handleStartAction(e, box.originalIndex, 'resize')}
                  title="Drag to resize"
                />
              </div>
            );
          })}
        </PdfViewer>
      </main>
    </>
  );
}
