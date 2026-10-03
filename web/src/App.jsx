import { useEffect, useRef, useState } from 'react';
import { createJob, jobStatus, previewLine } from './api.js';
import { renderFace } from './browser-render.js';
import { isPreviewable, lineAt, lineStart, replaceInLine, reportProblems } from './decklist.js';

/**
 * The frontend (T-C2, D27; Requirements 3.1.2, 3.2.6, 3.6.2, 10.2): decklist
 * input, a live preview of the line the cursor is on (rendered in the
 * browser), generation with progress, the unmatched-name report, the zip/PDF
 * download and the Fan Content notice. Batches render on the server; the UI
 * shows no thumbnails of them.
 */

const EXAMPLE = `4 Lightning Bolt
2 Delver of Secrets
1 Jace, the Mind Sculptor (WWK)
1 Forest`;
const STORAGE_KEY = 'fannable.decklist';
const PREVIEW_DELAY_MS = 300;
const POLL_MS = 1000;

/** The last decklist typed, kept in this browser only. */
function storedDecklist() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? EXAMPLE;
  } catch {
    return EXAMPLE;
  }
}

export function App() {
  const [decklist, setDecklist] = useState(storedDecklist);
  const [cursor, setCursor] = useState({ index: 0, text: '' });
  const editor = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, decklist);
    } catch {
      // Storage blocked: the decklist just isn't remembered.
    }
  }, [decklist]);

  /** Tracks the line under the caret, for the preview. */
  function updateCursor() {
    const el = editor.current;
    if (el) setCursor(lineAt(el.value, el.selectionStart));
  }

  /** Puts the caret at the start of a line (from a report entry) and shows it. */
  function goToLine(lineNumber) {
    const el = editor.current;
    const offset = lineStart(el.value, lineNumber);
    el.focus();
    el.setSelectionRange(offset, offset);
    updateCursor();
  }

  /** Replaces a misspelt name with a suggestion. */
  function applySuggestion(index, name, suggestion) {
    const next = replaceInLine(decklist, index, name, suggestion);
    setDecklist(next);
    const lines = next.split('\n');
    setCursor({ index, text: lines[index] });
  }

  return (
    <div className="page">
      <header>
        <h1>MTG Fannable Cards</h1>
        <p>Cards with the stats in a bar down the left edge, so you can read a fanned hand.</p>
      </header>

      <main>
        <section className="deck">
          <label htmlFor="decklist">Decklist</label>
          <p className="hint">
            One card per line, like <code>4 Lightning Bolt</code>. Add a set and number to pick a
            printing: <code>Lightning Bolt (M10) 146</code>.
          </p>
          <textarea
            id="decklist"
            ref={editor}
            value={decklist}
            spellCheck={false}
            onChange={(e) => {
              setDecklist(e.target.value);
              setCursor(lineAt(e.target.value, e.target.selectionStart));
            }}
            onSelect={updateCursor}
            onKeyUp={updateCursor}
            onClick={updateCursor}
          />
          <Generate decklist={decklist} onLine={goToLine} />
        </section>

        <section className="preview" aria-live="polite">
          <h2>Preview</h2>
          <Preview
            line={cursor.text}
            onSuggestion={(name, suggestion) => applySuggestion(cursor.index, name, suggestion)}
          />
        </section>
      </main>

      <footer>
        <p>
          MTG Fannable Cards is unofficial Fan Content permitted under the{' '}
          <a href="https://company.wizards.com/en/legal/fancontentpolicy">Fan Content Policy</a>.
          Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards
          of the Coast. ©Wizards of the Coast LLC.
        </p>
        <p>
          Free and non-commercial: generated cards are for personal use and playtesting; don&apos;t
          sell them. Card data and images from <a href="https://scryfall.com">Scryfall</a>.
        </p>
      </footer>
    </div>
  );
}

/** The card on the current line, rendered in the browser (D27). */
function Preview({ line, onSuggestion }) {
  // Preview data by line text.
  const [results, setResults] = useState({});
  // The last failed request; not cached, so the line is tried again when revisited.
  const [failed, setFailed] = useState(null);
  // The last line whose result arrived, shown dimmed while the next one loads.
  const [shown, setShown] = useState(null);
  const wanted = line.trim();
  const previewable = isPreviewable(wanted);
  const known = previewable && Object.hasOwn(results, wanted);

  useEffect(() => {
    if (!previewable || known) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await previewLine(wanted, controller.signal);
        setResults((r) => ({ ...r, [wanted]: data }));
        setShown(wanted);
      } catch (error) {
        if (error.name !== 'AbortError') setFailed({ line: wanted, message: error.message });
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [wanted, previewable, known]);

  if (!previewable) {
    return <p className="muted">Put the cursor on a card in the decklist to preview it.</p>;
  }
  const current = known ? results[wanted] : null;
  if (!current && failed?.line === wanted) return <p className="problem">{failed.message}</p>;
  // Only cards stay up while the next line loads; an old warning would mislead.
  const stale = !current && results[shown]?.status === 'ok' ? results[shown] : null;
  if (!current && !stale) return <p className="muted">Loading…</p>;
  const state = { data: current ?? stale, loading: !current };
  const { data } = state;
  if (data.status === 'unmatched') {
    return (
      <div className="problem">
        <p>No card named “{data.name}”.</p>
        {data.suggestions.length > 0 && (
          <p>
            Did you mean{' '}
            {data.suggestions.map((s, i) => (
              <span key={s}>
                {i > 0 && ', '}
                <button type="button" className="link" onClick={() => onSuggestion(data.name, s)}>
                  {s}
                </button>
              </span>
            ))}
            ?
          </p>
        )}
      </div>
    );
  }
  if (data.status !== 'ok') return <p className="problem">{data.message}</p>;
  return (
    <div className={state.loading ? 'faces stale' : 'faces'}>
      {data.warning && <p className="problem">{data.warning}</p>}
      <div className="cards">
        {data.faces.map((face) => (
          <CardCanvas
            key={`${face.model.name}-${face.model.setCode}-${face.model.collectorNumber}`}
            face={face}
          />
        ))}
      </div>
      {data.quantity > 1 && <p className="muted">× {data.quantity} copies</p>}
    </div>
  );
}

/**
 * The card's text alternative (10.3, T-S7): name, type line and stats, and the
 * rules text, so a screen reader gets what the picture shows.
 */
function cardLabel(model) {
  const stats =
    model.power !== null
      ? `${model.power}/${model.toughness}`
      : model.loyalty !== null
        ? `Loyalty ${model.loyalty}`
        : model.defense !== null
          ? `Defense ${model.defense}`
          : null;
  return [model.name, model.typeLine, stats, model.oracleText].filter(Boolean).join('. ');
}

/** One face, drawn with src/render/ onto a canvas. */
function CardCanvas({ face }) {
  const canvas = useRef(null);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    renderFace(canvas.current, face).then(
      (w) => current && (setWarnings(w), setError(null)),
      (e) => current && setError(e.message),
    );
    return () => {
      current = false;
    };
  }, [face]);

  return (
    <figure>
      <canvas ref={canvas} className="card" role="img" aria-label={cardLabel(face.model)} />
      {error && <figcaption className="problem">Couldn&apos;t draw this card: {error}</figcaption>}
      {warnings.map((w) => (
        <figcaption key={w} className="muted">
          {w}
        </figcaption>
      ))}
    </figure>
  );
}

/** Format choice, the job's progress and report, and the download (3.5.3, 3.6.1). */
function Generate({ decklist, onLine }) {
  const [format, setFormat] = useState('zip');
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const active = job && (job.status === 'queued' || job.status === 'running');

  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(async () => {
      try {
        setJob(await jobStatus(job.id));
      } catch (e) {
        setError(
          e.status === 404 ? 'The job expired or the server restarted; generate again.' : e.message,
        );
        setJob(null);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, job?.id]);

  async function start() {
    setStarting(true);
    setError(null);
    setJob(null);
    try {
      setJob(await createJob(decklist, format));
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="generate">
      <fieldset>
        <legend>Download as</legend>
        <label>
          <input
            type="radio"
            name="format"
            checked={format === 'zip'}
            onChange={() => setFormat('zip')}
          />
          PNG images in cards.zip
        </label>
        <label>
          <input
            type="radio"
            name="format"
            checked={format === 'pdf'}
            onChange={() => setFormat('pdf')}
          />
          cards.pdf: A4 sheets, 9 cards each, to print and cut
        </label>
      </fieldset>
      <button type="button" className="primary" onClick={start} disabled={starting || active}>
        {active ? 'Generating…' : 'Generate cards'}
      </button>
      {error && (
        <p className="problem" role="alert">
          {error}
        </p>
      )}
      {job && <JobStatus job={job} onLine={onLine} />}
    </div>
  );
}

function JobStatus({ job, onLine }) {
  const problems = reportProblems(job);
  return (
    // Announced to screen readers as it changes: queue, progress, done (10.3, T-S7).
    <div className="job" role="status">
      {job.status === 'queued' && (
        <p>
          Waiting for {job.queuePosition > 0 ? `${job.queuePosition} other job(s)` : 'a free slot'}…
        </p>
      )}
      {job.status === 'running' && (
        <>
          <progress max={job.total || 1} value={job.done} />
          <p>{job.total ? `${job.done} of ${job.total} cards` : 'Starting…'}</p>
        </>
      )}
      {job.status === 'done' && (
        <p>
          <a className="button primary" href={job.downloadUrl} download={`cards.${job.format}`}>
            Download cards.{job.format}
          </a>{' '}
          <span className="muted">
            {job.done} cards. Kept until {new Date(job.expiresAt).toLocaleTimeString()}.
          </span>
        </p>
      )}
      {job.status === 'failed' && (
        <p className="problem" role="alert">
          {job.error}
        </p>
      )}
      {problems.length > 0 && (
        <div className="report">
          <h3>
            {problems.length} problem{problems.length === 1 ? '' : 's'}
          </h3>
          <ul>
            {problems.map((p, i) => (
              <li key={i}>
                {p.lineNumber !== null && (
                  <button type="button" className="link" onClick={() => onLine(p.lineNumber)}>
                    Line {p.lineNumber}
                  </button>
                )}{' '}
                {p.message}
                {p.suggestions?.length > 0 && `. Did you mean: ${p.suggestions.join(', ')}?`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
