import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  FileAudio,
  FileText,
  Headphones,
  Mic,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

const MAX_TEXT_BYTES = 480 * 1024;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file, 'UTF-8');
  });
}

function isAudioFile(file) {
  return file.type.startsWith('audio') || /\.(mp3|wav|m4a|webm|ogg)$/i.test(file.name);
}

function isTextFile(file) {
  return file.type.startsWith('text/') || /\.(txt|md|csv|json|log|tsv)$/i.test(file.name);
}

async function fileToEntry(file, blobStore) {
  const id = crypto.randomUUID();
  const base = {
    id,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    addedAt: new Date().toISOString(),
  };

  if (isTextFile(file) && file.size <= MAX_TEXT_BYTES) {
    try {
      const textContent = await readTextFile(file);
      return { ...base, kind: 'text', textContent };
    } catch {
      return { ...base, kind: 'text' };
    }
  }

  if (isAudioFile(file)) {
    const url = URL.createObjectURL(file);
    blobStore.set(id, { url, file });
    return { ...base, kind: 'audio' };
  }

  return { ...base, kind: 'other' };
}

function canPreview(f, blobStore) {
  if (typeof f.textContent === 'string' && f.textContent.length > 0) return true;
  const audio =
    f.kind === 'audio' ||
    (!f.kind && (String(f.type || '').startsWith('audio') || /\.(mp3|wav|m4a|webm|ogg)$/i.test(f.name || '')));
  if (audio && blobStore.has(f.id)) return true;
  return false;
}

export default function SourcesStep({ project, onBack, onContinue, onPatch }) {
  const inputRef = useRef(null);
  const blobMapRef = useRef(new Map());
  const [roomConnected, setRoomConnected] = useState(false);
  const [copyRoom, setCopyRoom] = useState('idle');
  const [previewId, setPreviewId] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const files = useMemo(() => project.files ?? [], [project.files]);

  useEffect(() => {
    const map = blobMapRef.current;
    return () => {
      for (const { url } of map.values()) {
        URL.revokeObjectURL(url);
      }
      map.clear();
    };
  }, []);

  const revokeBlob = useCallback((id) => {
    const b = blobMapRef.current.get(id);
    if (b?.url) URL.revokeObjectURL(b.url);
    blobMapRef.current.delete(id);
  }, []);

  const addFiles = useCallback(
    async (list) => {
      const arr = Array.from(list);
      if (!arr.length) return;
      setUploadBusy(true);
      try {
        const built = [];
        for (const f of arr) {
          built.push(await fileToEntry(f, blobMapRef.current));
        }
        onPatch({ files: [...files, ...built] });
      } finally {
        setUploadBusy(false);
      }
    },
    [files, onPatch],
  );

  const removeFile = useCallback(
    (id) => {
      revokeBlob(id);
      onPatch({ files: files.filter((f) => f.id !== id) });
      setPreviewId((cur) => (cur === id ? null : cur));
    },
    [files, onPatch, revokeBlob],
  );

  const roomCode = useMemo(() => {
    const raw = project.id.replace(/-/g, '');
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`.toUpperCase();
  }, [project.id]);

  const copyRoomCode = useCallback(() => {
    void navigator.clipboard?.writeText(roomCode);
    setCopyRoom('copied');
    window.setTimeout(() => setCopyRoom('idle'), 2000);
  }, [roomCode]);

  const previewFile = previewId ? files.find((f) => f.id === previewId) : null;
  const previewBlob = previewFile ? blobMapRef.current.get(previewFile.id) : null;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setPreviewId(null);
    };
    if (previewId) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewId]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#0f172a' }}>
      <header
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid #334155',
          backgroundColor: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <ArrowLeft size={18} />
          Projelere dön
        </button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Aktif proje</div>
          <input
            value={project.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #334155',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              fontSize: 15,
              fontWeight: 600,
              outline: 'none',
            }}
          />
        </div>
        <button
          type="button"
          onClick={onContinue}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#10b981',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Diyagram tuvaline geç
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: 20,
            maxWidth: 1200,
            margin: '0 auto',
            alignItems: 'start',
          }}
        >
          <section
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
              Dosya yükleme
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
              Metin dosyaları (≈480 KB’a kadar) içerikleriyle birlikte saklanır; ses dosyalarında önizleme bu
              oturumda açık kalır. Diyagram adımında da kullanılır.
            </p>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".txt,.md,.mp3,.wav,.m4a,.json,.csv,.log,audio/*,text/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.length) void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={uploadBusy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
              }}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                border: '1px dashed #475569',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                cursor: uploadBusy ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 14,
                fontWeight: 500,
                opacity: uploadBusy ? 0.75 : 1,
              }}
            >
              <Upload size={20} color="#10b981" />
              {uploadBusy ? 'Dosyalar işleniyor…' : 'Dosya seç veya sürükleyip bırak (çoklu)'}
            </button>

            <h3 style={{ margin: '22px 0 12px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
              Yüklenen dosyalar
            </h3>
            {files.length === 0 ? (
              <div style={{ fontSize: 13, color: '#64748b', padding: '12px 0' }}>Henüz dosya yok.</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((f) => {
                  const isAudio = f.kind === 'audio' || isAudioFile({ type: f.type, name: f.name });
                  const Icon = isAudio ? FileAudio : FileText;
                  const openable = canPreview(f, blobMapRef.current);
                  return (
                    <li
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        backgroundColor: '#0f172a',
                        border: `1px solid ${openable ? 'rgba(16, 185, 129, 0.35)' : '#334155'}`,
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <button
                        type="button"
                        disabled={!openable}
                        onClick={() => openable && setPreviewId(f.id)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          cursor: openable ? 'pointer' : 'default',
                          textAlign: 'left',
                          color: 'inherit',
                        }}
                        title={openable ? 'Önizlemeyi aç' : 'Önizleme yok (metin çok büyük veya ses bu oturumda yüklenmedi)'}
                      >
                        <Icon size={18} color={isAudio ? '#c4b5fd' : '#94a3b8'} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: '#e2e8f0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: 500,
                            }}
                          >
                            {f.name}
                            {openable ? (
                              <span style={{ marginLeft: 8, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                                Aç
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {formatBytes(f.size)}
                            {f.kind === 'text' && typeof f.textContent === 'string'
                              ? ` · ${f.textContent.length.toLocaleString('tr-TR')} karakter`
                              : null}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label="Kaldır"
                        onClick={() => removeFile(f.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: 6,
                          borderRadius: 6,
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <LiveRoomPanel
            roomConnected={roomConnected}
            setRoomConnected={setRoomConnected}
            roomCode={roomCode}
            copyRoom={copyRoom}
            onCopyRoom={copyRoomCode}
          />
        </div>
      </div>

      {previewFile && previewId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-preview-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(2, 6, 23, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewId(null);
          }}
        >
          <div
            style={{
              width: 'min(720px, 100%)',
              maxHeight: 'min(85vh, 640px)',
              borderRadius: 14,
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div id="file-preview-title" style={{ fontWeight: 700, color: '#f8fafc', fontSize: 15 }}>
                  {previewFile.name}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{formatBytes(previewFile.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                aria-label="Kapat"
                style={{
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#94a3b8',
                  borderRadius: 8,
                  padding: 8,
                  cursor: 'pointer',
                  display: 'inline-flex',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {typeof previewFile.textContent === 'string' && previewFile.textContent.length > 0 ? (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: '#e2e8f0',
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {previewFile.textContent}
                </pre>
              ) : null}
              {previewBlob?.url ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                    }}
                  >
                    <Headphones size={28} color="#a78bfa" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>Ses önizleme</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        Bu oturumda yüklenen dosya için yerel oynatıcı
                      </div>
                    </div>
                  </div>
                  <audio controls src={previewBlob.url} style={{ width: '100%', borderRadius: 8 }}>
                    Tarayıcı ses etiketini desteklemiyor.
                  </audio>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LiveRoomPanel({ roomConnected, setRoomConnected, roomCode, copyRoom, onCopyRoom }) {
  return (
    <section
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 200px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>Canlı oda</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            Paylaşımlı oturum ve transkripsiyon buraya bağlanacak. Şimdilik yalnızca oda kodu ve bağlantı durumu
            gösteriliyor.
          </p>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 999,
            border: '1px solid #334155',
            color: roomConnected ? '#34d399' : '#94a3b8',
            backgroundColor: '#0f172a',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          {roomConnected ? 'Bağlı' : 'Kapalı'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 12 }}>
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Oda kodu</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <code
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 1.5,
                color: '#f8fafc',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {roomCode}
            </code>
            <button
              type="button"
              onClick={onCopyRoom}
              title="Kodu kopyala"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #334155',
                backgroundColor: copyRoom === 'copied' ? 'rgba(16, 185, 129, 0.12)' : '#0f172a',
                color: copyRoom === 'copied' ? '#6ee7b7' : '#e2e8f0',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {copyRoom === 'copied' ? <Check size={16} /> : <Copy size={16} />}
              {copyRoom === 'copied' ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: 10,
          border: '1px solid #334155',
          backgroundColor: '#0f172a',
          padding: 20,
          minHeight: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: 13,
          color: '#94a3b8',
          lineHeight: 1.5,
        }}
      >
        {roomConnected
          ? 'Oturum işaretlendi. Ses ve görüntü akışı entegrasyonu eklendiğinde bu alan güncellenecek.'
          : 'Bağlan dediğinizde oda hazır durumuna geçer; medya henüz aktarılmaz.'}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button
          type="button"
          onClick={() => setRoomConnected(true)}
          disabled={roomConnected}
          style={{
            flex: '1 1 140px',
            padding: '11px 14px',
            borderRadius: 8,
            border: '1px solid #10b981',
            backgroundColor: roomConnected ? '#0f172a' : '#059669',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: roomConnected ? 'default' : 'pointer',
            opacity: roomConnected ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Mic size={18} />
          Odaya bağlan
        </button>
        <button
          type="button"
          onClick={() => setRoomConnected(false)}
          disabled={!roomConnected}
          style={{
            flex: '1 1 140px',
            padding: '11px 14px',
            borderRadius: 8,
            border: '1px solid #334155',
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            fontWeight: 600,
            fontSize: 14,
            cursor: roomConnected ? 'pointer' : 'default',
            opacity: roomConnected ? 1 : 0.45,
          }}
        >
          Bağlantıyı kes
        </button>
      </div>
    </section>
  );
}
