import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  documentApi,
  isMediaFile,
  isVideoFile,
  type Document,
  type Query,
  type MediaQueryResponse,
  type AllQueryResponse,
  type AllQuerySource,
  type SummaryResponse,
  type TimestampResponse,
  type QueryCreate,
} from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt  = (d: string) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const kb   = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
const isPDF = (d: Document) => d.mime_type === 'application/pdf';

// ─── Chat Types ───────────────────────────────────────────────────────────────
type ChatEntry =
  | { kind: 'pdf';     data: Query }
  | { kind: 'media';   data: MediaQueryResponse }
  | { kind: 'all';     data: AllQueryResponse }
  | { kind: 'pending'; question: string };

type ViewMode = 'all' | 'single';
type Panel    = 'chat' | 'summary' | 'timestamps';

// ─── MediaPlayer ──────────────────────────────────────────────────────────────
const MediaPlayer: React.FC<{ url: string; isVideo: boolean; seekTo?: number }> = ({ url, isVideo, seekTo }) => {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    if (seekTo !== undefined && ref.current) {
      ref.current.currentTime = seekTo;
      ref.current.play().catch(() => {});
    }
  }, [seekTo]);

  return isVideo
    ? <video  ref={ref as any} src={url} controls className="media-el" style={{ maxHeight: 220 }} />
    : <audio  ref={ref as any} src={url} controls className="media-el" />;
};
// ─── InlineMiniPlayer ─────────────────────────────────────────────────────────
const InlineMiniPlayer: React.FC<{
  url: string;
  startTime: number;
  display: string;
  isVideo?: boolean;
}> = ({ url, startTime, display, isVideo }) => {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [expanded, setExpanded] = useState(false);

  const handlePlay = () => {
    setExpanded(true);
    // slight delay so the element mounts first
    setTimeout(() => {
      if (ref.current) {
        ref.current.currentTime = startTime;
        ref.current.play().catch(() => {});
      }
    }, 100);
  };

  return (
    <div className="mini-player">
      {!expanded ? (
        <button className="btn-play" onClick={handlePlay}>
          ▶ {display}
        </button>
      ) : (
        <div className="mini-player-wrap">
          {isVideo
            ? <video ref={ref as any} src={url} controls className="mini-media" />
            : <audio ref={ref as any} src={url} controls className="mini-media" />
          }
        </div>
      )}
    </div>
  );
};
// ─── Main ─────────────────────────────────────────────────────────────────────
const DocumentView: React.FC = () => {
  const [documents,   setDocuments]   = useState<Document[]>([]);
  const [selected,    setSelected]    = useState<Document | null>(null);
  const [viewMode,    setViewMode]    = useState<ViewMode>('all');
  const [panel,       setPanel]       = useState<Panel>('chat');
  const [chat,        setChat]        = useState<ChatEntry[]>([]);
  const [question,    setQuestion]    = useState('');
  const [topic,       setTopic]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [file,        setFile]        = useState<File | null>(null);
  const [title,       setTitle]       = useState('');
  const [summary,     setSummary]     = useState<SummaryResponse | null>(null);
  const [timestamps,  setTimestamps]  = useState<TimestampResponse | null>(null);
  const [seekTo,      setSeekTo]      = useState<number | undefined>();
  const [summarizing, setSummarizing] = useState(false);
  const [fetchingTS,  setFetchingTS]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

useEffect(() => { loadDocs().then(() => selectAll()); }, []);  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

  const loadDocs = async () => {
    try { setDocuments(await documentApi.getDocuments()); }
    catch { setError('Failed to load documents'); }
  };

  // ── Select doc ───────────────────────────────────────────────────────────
  const selectDoc = useCallback(async (doc: Document, autoSeek?: number) => {
    setSelected(doc);
    setViewMode('single');
    setPanel('chat');
    setSummary(null);
    setTimestamps(null);
    setSeekTo(undefined);
    setChat([]);
    try {
      const qs = await documentApi.getDocumentQueries(doc.id);
      // PDF history entries — media history would need separate endpoint
      setChat(qs.map(q => ({ kind: 'pdf' as const, data: q })));
    } catch { setChat([]); }
    if (autoSeek !== undefined) setTimeout(() => setSeekTo(autoSeek), 450);
  }, []);

  const selectAll = async () => {
    setSelected(null);
    setViewMode('all');
    setPanel('chat');
    setSeekTo(undefined);
    setChat([]);
    try {
      const qs = await documentApi.getAllDocsQueries();
      setChat(qs.map(q => ({ kind: 'all' as const, data: q })));
    } catch { setChat([]); }
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const AUDIO_EXT = ['.mp3','.wav','.m4a','.ogg','.flac','.webm'];
  const VIDEO_EXT = ['.mp4','.mov','.avi','.mkv'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Select a file first');
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    const isAV  = [...AUDIO_EXT, ...VIDEO_EXT].includes(ext);
    const isPdf = ext === '.pdf';
    if (!isPdf && !isAV) return setError('Unsupported file type');
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (title.trim()) fd.append('title', title);
      if (isPdf) {
        const doc = await documentApi.uploadDocument(fd);
        await loadDocs();
        selectDoc(doc as unknown as Document);
      } else {
        const res = await documentApi.uploadMedia(fd);
        await loadDocs();
        const doc = await documentApi.getDocument(res.id);
        selectDoc(doc);
      }
      setFile(null); setTitle('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  // ── Ask ───────────────────────────────────────────────────────────────────
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true); setError(null);
    setChat(prev => [...prev, { kind: 'pending', question }]);
    const q = question;
    setQuestion('');
    try {
      if (viewMode === 'all') {
        const res = await documentApi.askAllDocuments(q);
        setChat(prev => [...prev.filter(e => e.kind !== 'pending'), { kind: 'all', data: res }]);
      } else if (selected && isPDF(selected)) {
        const res = await documentApi.askQuestion({ question: q, document_id: selected.id });
        setChat(prev => [...prev.filter(e => e.kind !== 'pending'), { kind: 'pdf', data: res }]);
      } else if (selected && isMediaFile(selected)) {
        const res = await documentApi.askMediaQuestion(selected.id, q);
        setChat(prev => [...prev.filter(e => e.kind !== 'pending'), { kind: 'media', data: res }]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Question failed');
      setChat(prev => prev.filter(e => e.kind !== 'pending'));
    } finally { setLoading(false); }
  };

  // ── Summarize ────────────────────────────────────────────────────────────
  const handleSummarize = async () => {
    if (!selected) return;
    setSummarizing(true); setError(null);
    try {
      setSummary(await documentApi.summarize(selected.id));
      setPanel('summary');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Summarize failed');
    } finally { setSummarizing(false); }
  };

  // ── Timestamps ───────────────────────────────────────────────────────────
  const handleTimestamps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !topic.trim()) return;
    setFetchingTS(true); setError(null);
    try {
      setTimestamps(await documentApi.getTimestamps(selected.id, topic));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Timestamp fetch failed');
    } finally { setFetchingTS(false); }
  };

  // ── Doc icon ─────────────────────────────────────────────────────────────
  const docIcon = (doc: Document) => isPDF(doc) ? '📄' : isVideoFile(doc) ? '🎬' : '🎵';
  const mimeIcon = (mime: string) =>
    mime === 'application/pdf' ? '📄' : mime?.startsWith('video/') ? '🎬' : '🎵';

  // ── Render chat ───────────────────────────────────────────────────────────
  const renderChat = () => {
    if (chat.length === 0)
      return (
        <div className="empty-chat">
          <div className="empty-orb">✦</div>
          <p className="empty-text">
            {viewMode === 'all'
              ? 'Ask anything across all your documents'
              : `Ask anything about "${selected?.title}"`}
          </p>
          <p className="empty-sub">Powered by LLaMA 3.3 · Gemini Embeddings · Pinecone</p>
        </div>
      );

    return (
      <div className="chat-messages">
        {chat.map((entry, i) => {
          if (entry.kind === 'pending')
            return (
              <div key={i} className="msg-group">
                <div className="bubble-user">{entry.question}</div>
                <div className="bubble-ai typing">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              </div>
            );

          const q = entry.data.question;
          const a = entry.data.answer;
          const ts        = entry.kind === 'media' ? entry.data.timestamp : null;
          const sources   = entry.kind === 'all'   ? entry.data.sources   : null;

          return (
            <div key={i} className="msg-group">
              <div className="bubble-user">{q}</div>
              <div className="bubble-ai">
                <p className="ai-text">{a}</p>

                {/* Single media timestamp (individual doc Q&A) */}
                {ts && (
                  <div className="ts-chip">
                    <span className="ts-chip-time">⏱ {ts.display}</span>
                    <button className="btn-play" onClick={() => { setPanel('chat'); setSeekTo(ts.start); }}>
                      ▶ Play from here
                    </button>
                  </div>
                )}

                {/* Sources from query-all — show play button for media sources */}
                {sources && sources.length > 0 && (
                  <div className="sources-list">
                    <div className="sources-label">Sources</div>
                        {sources.slice(0, 1).map((s, j) => (  // ← just add .slice(0, 2)
                      <div key={j} className="source-row">
                        <div className="source-left">
                          <span className="source-icon">{mimeIcon(s.mime_type)}</span>
                          <div>
                            <div className="source-title">{s.document_title}</div>
                            <div className="source-score">{(s.relevance_score * 100).toFixed(0)}% match</div>
                          </div>
                        </div>
                        {s.timestamp && s.cloudinary_url && (
                          // <div className="source-play">
                          //   <span className="source-ts">⏱ {s.timestamp.display}</span>
                          //   <button
                          //     className="btn-play"
                          //     onClick={() => {
                          //       const doc = documents.find(d => d.id === s.document_id);
                          //       if (doc) selectDoc(doc, s.timestamp!.start);
                          //     }}
                          //   >
                          //     ▶ {s.timestamp.display}
                          //   </button>
                          // </div>
                          <InlineMiniPlayer
    url={s.cloudinary_url}
    startTime={s.timestamp.start}
    display={s.timestamp.display}
    isVideo={s.mime_type?.startsWith('video/')}
  />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render summary ────────────────────────────────────────────────────────
  const renderSummary = () => (
    <div className="panel-scroll">
      {summary ? (
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-icon">📋</span>
            <div>
              <div className="summary-title">{summary.title}</div>
              <div className="summary-sub">{summary.mime_type}</div>
            </div>
          </div>
          <p className="summary-body">{summary.summary}</p>
        </div>
      ) : (
        <div className="panel-hint">Click <strong>Summarize</strong> in the toolbar above.</div>
      )}
    </div>
  );

  // ── Render timestamps ─────────────────────────────────────────────────────
// ── Render timestamps ─────────────────────────────────────────────────────
const renderTimestamps = () => (
  <div className="panel-scroll">
    <div className="ts-panel-header">⏱ Timestamp Search</div>
    <form onSubmit={handleTimestamps} className="ts-search-form">
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder="Search a topic, e.g. introduction, revenue, demo…"
        className="ts-search-input"
        disabled={fetchingTS}
      />
      <button type="submit" className="btn-find" disabled={fetchingTS || !topic.trim()}>
        {fetchingTS ? '…' : 'Find'}
      </button>
    </form>

    {timestamps && (
      timestamps.timestamps.length === 0
        ? <div className="panel-hint">No segments found for "{timestamps.topic}".</div>
        : <div className="ts-results">
            {timestamps.timestamps.map((t, i) => (
              <div key={i} className="ts-result-row">
                <div className="ts-result-top">
                  <span className="ts-result-time">{t.display}</span>
                  <span className="ts-result-pct">{(t.relevance_score * 100).toFixed(0)}% match</span>
                </div>
                <p className="ts-result-text">{t.text}</p>
                {selected?.cloudinary_url && (
                  <InlineMiniPlayer
                    url={selected.cloudinary_url}
                    startTime={t.start}
                    display={t.display}
                    isVideo={selected ? isVideoFile(selected) : false}
                  />
                )}
              </div>
            ))}
          </div>
    )}
  </div>
);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

        :root {
          --bg:        #080a0f;
          --bg2:       #0d1017;
          --panel:     #111318;
          --card:      #161a22;
          --border:    rgba(255,255,255,0.07);
          --border2:   rgba(255,255,255,0.12);
          --gold:      #e8c97a;
          --gold2:     #f5dfa0;
          --teal:      #5ecfb1;
          --rose:      #e87a8c;
          --ink:       #e8eaf0;
          --ink2:      #9aa0b0;
          --ink3:      #5a6070;
          --ff-head:   'Playfair Display', Georgia, serif;
          --ff-body:   'Space Grotesk', sans-serif;
          --ff-mono:   'JetBrains Mono', monospace;
          --r:         12px;
          --r-sm:      8px;
          --shadow:    0 4px 24px rgba(0,0,0,0.5);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { background: var(--bg); color: var(--ink); font-family: var(--ff-body); font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }

        /* ── Layout ── */
        .app       { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .app-top   { display: flex; align-items: center; gap: 14px; padding: 14px 22px;
                     background: var(--panel); border-bottom: 1px solid var(--border);
                     flex-shrink: 0; position: relative; }
        .app-top::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:1px;
                          background: linear-gradient(90deg, var(--gold) 0%, transparent 60%); }
        .app-logo  { font-family: var(--ff-head); font-size: 1.35rem; color: var(--gold); letter-spacing: -.5px; }
        .app-logo em { font-style: italic; color: var(--gold2); }
        .app-tag   { font-size: .7rem; color: var(--ink3); letter-spacing: .08em; text-transform: uppercase; }
        .app-spacer{ flex: 1; }
        .app-count { font-family: var(--ff-mono); font-size: .75rem; color: var(--ink3);
                     background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 3px 10px; }

        .app-body  { display: flex; flex: 1; overflow: hidden; }

        /* ── Sidebar ── */
        .sidebar   { width: 260px; background: var(--panel); border-right: 1px solid var(--border);
                     display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; transition: width .2s; }
        .sidebar.collapsed { width: 0; }

        .sb-upload { padding: 16px; border-bottom: 1px solid var(--border); }
        .sb-upload-label { font-size: .65rem; font-weight: 600; letter-spacing: .1em;
                           text-transform: uppercase; color: var(--ink3); margin-bottom: 10px; }
        .upload-zone { border: 1px dashed var(--border2); border-radius: var(--r-sm);
                       padding: 12px; cursor: pointer; transition: .15s; margin-bottom: 8px; }
        .upload-zone:hover { border-color: var(--gold); background: rgba(232,201,122,.04); }
        .upload-zone input[type=file] { width: 100%; font-size: .75rem; color: var(--ink2); cursor: pointer; }
        .upload-zone input[type=file]::file-selector-button {
          background: var(--gold); color: #080a0f; border: none; border-radius: 5px;
          padding: 3px 10px; font-size: .72rem; font-weight: 600; cursor: pointer;
          margin-right: 8px; font-family: var(--ff-body); }
        .upload-title-inp { width: 100%; background: var(--card); border: 1px solid var(--border);
                            border-radius: var(--r-sm); padding: 7px 10px; font-size: .8rem;
                            color: var(--ink); outline: none; font-family: var(--ff-body); margin-bottom: 8px; }
        .upload-title-inp:focus { border-color: var(--gold); }
        .btn-upload { width: 100%; background: var(--gold); color: #080a0f;
                      border: none; border-radius: var(--r-sm); padding: 8px;
                      font-size: .8rem; font-weight: 700; cursor: pointer;
                      font-family: var(--ff-body); transition: .15s; letter-spacing: .03em; }
        .btn-upload:hover { background: var(--gold2); }
        .btn-upload:disabled { opacity: .4; cursor: not-allowed; }

        .sb-list   { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 4px; }

        .all-btn   { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px;
                     background: transparent; border: 1px solid transparent; border-radius: var(--r-sm);
                     cursor: pointer; color: var(--ink); text-align: left; transition: .15s; font-family: var(--ff-body); }
        .all-btn:hover, .all-btn.active { background: var(--card); border-color: var(--border); }
        .all-btn.active { border-color: var(--gold); }
        .all-btn-icon { font-size: 1.3rem; }
        .all-btn-name { font-size: .82rem; font-weight: 600; }
        .all-btn-sub  { font-size: .68rem; color: var(--ink3); }

        .doc-item  { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
                     border-radius: var(--r-sm); cursor: pointer; border: 1px solid transparent; transition: .15s; }
        .doc-item:hover  { background: var(--card); }
        .doc-item.active { background: var(--card); border-color: var(--gold); }
        .doc-item-icon { font-size: 1.25rem; flex-shrink: 0; margin-top: 1px; }
        .doc-item-name { font-size: .8rem; font-weight: 500; color: var(--ink); line-height: 1.35; }
        .doc-item-meta { font-size: .67rem; color: var(--ink3); margin-top: 2px; }

        /* ── Main ── */
        .main      { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

        .toolbar   { display: flex; align-items: center; gap: 8px; padding: 11px 20px;
                     background: var(--panel); border-bottom: 1px solid var(--border); flex-shrink: 0; flex-wrap: wrap; }
        .toolbar-title { font-family: var(--ff-head); font-size: .95rem; font-weight: 700; flex: 1;
                         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
        .tab       { background: transparent; border: 1px solid var(--border); color: var(--ink3);
                     border-radius: 20px; padding: 4px 14px; font-size: .75rem; cursor: pointer;
                     font-family: var(--ff-body); transition: .15s; }
        .tab:hover   { border-color: var(--gold); color: var(--ink); }
        .tab.active  { background: var(--gold); border-color: var(--gold); color: #080a0f; font-weight: 600; }
        .tab:disabled{ opacity: .35; cursor: not-allowed; }
        .open-link { font-size: .72rem; color: var(--teal); text-decoration: none; margin-left: 4px; }
        .open-link:hover { text-decoration: underline; }

        /* ── Player ── */
        .player-wrap { padding: 12px 20px 0; flex-shrink: 0; }
        .media-el    { width: 100%; border-radius: var(--r); box-shadow: var(--shadow);
                       background: var(--card); display: block; }

        /* ── Chat ── */
        .chat-area   { flex: 1; overflow-y: auto; padding: 24px 20px; }
        .chat-messages { display: flex; flex-direction: column; gap: 20px; }

        .empty-chat  { display: flex; flex-direction: column; align-items: center; justify-content: center;
                       height: 100%; gap: 12px; text-align: center; padding: 40px; }
        .empty-orb   { font-size: 3rem; animation: pulse 3s infinite; }
        @keyframes pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        .empty-text  { font-family: var(--ff-head); font-size: 1.1rem; color: var(--ink2); font-style: italic; }
        .empty-sub   { font-size: .7rem; color: var(--ink3); font-family: var(--ff-mono); }

        .msg-group   { display: flex; flex-direction: column; gap: 8px; }
        .bubble-user { align-self: flex-end; background: linear-gradient(135deg,var(--gold) 0%,#c8a84b 100%);
                       color: #080a0f; padding: 10px 16px; border-radius: 18px 18px 4px 18px;
                       max-width: 70%; font-size: .85rem; font-weight: 500; line-height: 1.5; box-shadow: var(--shadow); }
        .bubble-ai   { align-self: flex-start; background: var(--card); border: 1px solid var(--border);
                       padding: 14px 16px; border-radius: 4px 18px 18px 18px;
                       max-width: 82%; box-shadow: var(--shadow); }
        .bubble-ai.typing { padding: 16px; }

        .ai-text     { font-size: .85rem; line-height: 1.7; color: var(--ink); white-space: pre-line; margin: 0; }

        /* typing dots */
        .dot         { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
                       background: var(--gold); margin: 0 3px; animation: bop .9s infinite; }
        .dot:nth-child(2){ animation-delay:.15s; }
        .dot:nth-child(3){ animation-delay:.3s; }
        @keyframes bop { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-7px)} }

        /* ── Timestamp chip (single media) ── */
        .ts-chip     { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
                       background: rgba(94,207,177,.08); border: 1px solid rgba(94,207,177,.2);
                       border-radius: var(--r-sm); padding: 8px 12px; margin-top: 10px; }
        .ts-chip-time{ font-family: var(--ff-mono); font-size: .78rem; color: var(--teal); }

        /* ── Sources (query-all) ── */
        .sources-list  { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
        .sources-label { font-size: .65rem; font-weight: 600; letter-spacing: .1em;
                         text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
        .source-row    { display: flex; align-items: center; justify-content: space-between;
                         background: var(--panel); border: 1px solid var(--border);
                         border-radius: var(--r-sm); padding: 8px 12px; gap: 10px; flex-wrap: wrap; }
        .source-left   { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
        .source-icon   { font-size: 1.1rem; flex-shrink: 0; }
        .source-title  { font-size: .78rem; font-weight: 500; color: var(--ink); white-space: nowrap;
                         overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
        .source-score  { font-size: .68rem; color: var(--ink3); font-family: var(--ff-mono); }
        .source-play   { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .source-ts     { font-family: var(--ff-mono); font-size: .72rem; color: var(--teal); }

        /* ── Play button ── */
        .btn-play    { background: var(--teal); color: #080a0f; border: none; border-radius: 6px;
                       padding: 4px 12px; font-size: .74rem; font-weight: 700; cursor: pointer;
                       font-family: var(--ff-body); transition: .15s; white-space: nowrap; }
        .btn-play:hover { opacity: .85; transform: translateY(-1px); }

        /* ── Q bar ── */
        .q-bar       { padding: 12px 20px; background: var(--panel); border-top: 1px solid var(--border); flex-shrink: 0; }
        .q-form      { display: flex; gap: 8px; }
        .q-input     { flex: 1; background: var(--card); border: 1px solid var(--border);
                       border-radius: var(--r); padding: 11px 16px; font-size: .85rem;
                       color: var(--ink); outline: none; font-family: var(--ff-body); transition: .15s; }
        .q-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(232,201,122,.1); }
        .q-input::placeholder { color: var(--ink3); }
        .btn-ask     { background: var(--gold); color: #080a0f; border: none; border-radius: var(--r);
                       padding: 11px 24px; font-weight: 700; font-size: .85rem; cursor: pointer;
                       font-family: var(--ff-body); transition: .15s; letter-spacing: .03em; }
        .btn-ask:hover { background: var(--gold2); }
        .btn-ask:disabled { opacity: .4; cursor: not-allowed; }

        /* ── Panels ── */
        .panel-scroll { flex: 1; overflow-y: auto; padding: 24px; }
        .panel-hint   { font-size: .85rem; color: var(--ink3); margin-top: 8px; }

        .summary-card   { background: var(--card); border: 1px solid var(--border); border-radius: var(--r); padding: 24px; }
        .summary-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
        .summary-icon   { font-size: 2rem; }
        .summary-title  { font-family: var(--ff-head); font-size: 1rem; color: var(--ink); }
        .summary-sub    { font-size: .7rem; color: var(--ink3); font-family: var(--ff-mono); margin-top: 3px; }
        .summary-body   { font-size: .88rem; line-height: 1.8; color: var(--ink2); white-space: pre-line; }

        .ts-panel-header{ font-family: var(--ff-head); font-size: 1rem; color: var(--ink); margin-bottom: 16px; }
        .ts-search-form { display: flex; gap: 8px; margin-bottom: 18px; }
        .ts-search-input{ flex: 1; background: var(--card); border: 1px solid var(--border);
                          border-radius: var(--r-sm); padding: 9px 14px; font-size: .82rem;
                          color: var(--ink); outline: none; font-family: var(--ff-body); }
        .ts-search-input:focus { border-color: var(--gold); }
        .ts-search-input::placeholder { color: var(--ink3); }
        .btn-find       { background: var(--gold); color: #080a0f; border: none; border-radius: var(--r-sm);
                          padding: 9px 18px; font-size: .82rem; font-weight: 700; cursor: pointer;
                          font-family: var(--ff-body); }
        .btn-find:disabled { opacity: .4; cursor: not-allowed; }
        .ts-results     { display: flex; flex-direction: column; gap: 10px; }
        .ts-result-row  { background: var(--card); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 14px; }
        .ts-result-top  { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .ts-result-time { font-family: var(--ff-mono); font-size: .85rem; font-weight: 600; color: var(--gold); }
        .ts-result-pct  { font-size: .7rem; color: var(--ink3); flex: 1; }
        .ts-result-text { font-size: .8rem; color: var(--ink2); line-height: 1.6; }

        /* ── Error toast ── */
        .toast       { position: fixed; bottom: 22px; right: 22px; background: var(--rose);
                       color: #fff; padding: 12px 16px; border-radius: var(--r);
                       font-size: .82rem; display: flex; align-items: center; gap: 12px;
                       box-shadow: 0 8px 32px rgba(0,0,0,.5); z-index: 9999;
                       animation: slideUp .2s ease; }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        .toast-close { background: none; border: none; color: #fff; font-size: 1.1rem; cursor: pointer; padding: 0 2px; }
         .mini-player      { display: flex; flex-direction: column; gap: 6px; }
.mini-player-wrap { margin-top: 6px; }
.mini-media       { width: 260px; border-radius: 8px; background: var(--card); display: block; }
        /* ── Scrollbar ── */
        ::-webkit-scrollbar       { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 10px; }
      `}</style>

      <div className="app">
        {/* Header */}
        <header className="app-top">
          <div className="app-logo">Docu<em>Query</em></div>
          <div className="app-tag">PDF · Audio · Video</div>
          <div className="app-spacer" />
          <div className="app-count">{documents.length} doc{documents.length !== 1 ? 's' : ''}</div>
        </header>

        <div className="app-body">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sb-upload">
              <div className="sb-upload-label">Upload file</div>
              <form onSubmit={handleUpload}>
                <div className="upload-zone">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.mp3,.wav,.m4a,.ogg,.flac,.mp4,.mov,.avi,.mkv,.webm"
                    onChange={handleFileChange}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="upload-title-inp"
                />
                <button type="submit" disabled={uploading || !file} className="btn-upload">
                  {uploading ? 'Uploading…' : '↑ Upload'}
                </button>
              </form>
            </div>

            <div className="sb-list">
              <button
                className={`all-btn ${viewMode === 'all' ? 'active' : ''}`}
                onClick={selectAll}
              >
                <span className="all-btn-icon">📚</span>
                <div>
                  <div className="all-btn-name">All Documents</div>
                  <div className="all-btn-sub">Cross-document Q&amp;A</div>
                </div>
              </button>

              {documents.map(doc => (
                <div
                  key={doc.id}
                  className={`doc-item ${selected?.id === doc.id && viewMode === 'single' ? 'active' : ''}`}
                  onClick={() => selectDoc(doc)}
                >
                  <span className="doc-item-icon">{docIcon(doc)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="doc-item-name">{doc.title}</div>
                    <div className="doc-item-meta">{kb(doc.file_size)} · {fmt(doc.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Main */}
          <main className="main">
            {/* Toolbar */}
            <div className="toolbar">
              <div className="toolbar-title">
                {viewMode === 'all'
                  ? '📚 All Documents'
                  : `${docIcon(selected!)} ${selected?.title}`}
              </div>

              {viewMode === 'single' && selected && (
                <>
                  <button className={`tab ${panel === 'chat' ? 'active' : ''}`} onClick={() => setPanel('chat')}>Chat</button>
                  <button
                    className={`tab ${panel === 'summary' ? 'active' : ''}`}
                    onClick={() => { setPanel('summary'); if (!summary) handleSummarize(); }}
                    disabled={summarizing}
                  >
                    {summarizing ? 'Summarizing…' : 'Summarize'}
                  </button>
                  {isMediaFile(selected) && (
                    <button className={`tab ${panel === 'timestamps' ? 'active' : ''}`} onClick={() => setPanel('timestamps')}>
                      Timestamps
                    </button>
                  )}
                  {selected.cloudinary_url && (
                    <a href={selected.cloudinary_url} target="_blank" rel="noopener noreferrer" className="open-link">
                      ↗ Original
                    </a>
                  )}
                </>
              )}
            </div>

            {/* Media player */}
            {viewMode === 'single' && selected && isMediaFile(selected) && panel === 'chat' && (
              <div className="player-wrap">
                <MediaPlayer url={selected.cloudinary_url} isVideo={isVideoFile(selected)} seekTo={seekTo} />
              </div>
            )}

            {/* Content */}
            {panel === 'chat' && (
              <>
                <div ref={chatRef} className="chat-area">
                  {renderChat()}
                </div>
                <div className="q-bar">
                  <form onSubmit={handleAsk} className="q-form">
                    <input
                      className="q-input"
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      placeholder={viewMode === 'all' ? 'Ask across all documents…' : `Ask about "${selected?.title}"…`}
                      disabled={loading}
                    />
                    <button className="btn-ask" type="submit" disabled={loading || !question.trim()}>
                      {loading ? '…' : 'Ask'}
                    </button>
                  </form>
                </div>
              </>
            )}

            {panel === 'summary'    && renderSummary()}
            {panel === 'timestamps' && renderTimestamps()}
          </main>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="toast">
          {error}
          <button className="toast-close" onClick={() => setError(null)}>×</button>
        </div>
      )}
    </>
  );
};

export default DocumentView;