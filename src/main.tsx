import type {Api, CompileResult} from "./worker";
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { wrap } from "comlink";

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const api = wrap<Api>(worker);

type Query = {
  pkg?: string,
  imports?: string
}

function Reporter(props: {query: Query}) {
  const [error, setError] = useState<{reason: string} | null>(null);
  const [result, setResult] = useState<CompileResult | null>(null);

  useEffect(() => {
    (async () => {
      const imports = props.query.imports ? props.query.imports.split(",") : undefined;
      try {
        const ret = await api.compile(
          `https://cdn.skypack.dev/${props.query.pkg}`,
          imports
        );  
        setResult(ret);  
      } catch (err) {
        setError({reason: 'compile error'});
      }
    })();
  }, [props.query]);

  if (error) {
    return <div>CompileError: {error.reason}</div>
  }
  if (!result) {
    return <div>...</div>
  }
  return <div>
    <h2>Input</h2>
    <div>Pkg: {props.query.pkg ?? '...'}</div>
    <div>imports: <strong>{props.query.imports?.length ? props.query.imports : '*'}</strong></div>
    <h2>Result</h2>
    <p>
      <div>
        size: {bytesToSize(result.size)}
      </div>
      <div>
        gzip: {bytesToSize(result.gzipSize)}
      </div>
    </p>
    <hr />
    <h3>Input</h3>
    <pre>
      <code>
        {result.input}
      </code>
    </pre>
    <hr />
    <h3>Output Detail</h3>
    <details>
      <summary>code</summary>
      <pre style={{width: '80vw', fontFamily: 'monaco', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>
        <code>
          {result.code}
        </code>
      </pre>
    </details>
  </div>
}

function App() {
  const [error, setError] = useState<{reason: string} | null>(null);
  const [isTop, setIsTop] = useState(false);
  const [query, setQuery] = useState<Query | null>(null);
  useEffect(() => {
    if (!location.search) {
      setIsTop(true);
      return
    }
    const query: Query = location.search.slice(1).split("&").reduce((acc, cur) => {
      const [key, val] = cur.split("=");
      return {...acc, [key]: val};
    }, {});
    if (query.pkg) {
      if (query.pkg && /[a-zA-Z@][a-zA-Z-_\d\/\@]+/.test(query.pkg)) {
        setQuery(query);
      } else {
        setError({reason: 'Invalid pkgName'});
      }  
    } else {
      setIsTop(true);
    }
  }, []);

  return <div>
    <h1>ShakerPhobia</h1>
    {query && <Reporter query={query} />}
    {isTop && <div>
      <p>
        <a href="https://bundlephobia.com/">BundlePhobia</a> with tree-shake
      </p>
      <h2>How it works</h2>
      <p>
        Download sources from <a href="https://cdn.skypack.dev">cdn.skpack.dev</a> and build with rollup and terser in your browser.
      </p>
      <h2>How to Use</h2>
      <p>
        <ul>
          <li>
            <a href={`${location.protocol}//${location.host}/?pkg=preact&imports=h,render`}>
              {location.protocol}//{location.host}/?pkg=preact&imports=h,render
            </a>
          </li>
          <li>
            <a href={`${location.protocol}//${location.host}/?pkg=react-dom@16.0.0&imports=render`}>
              {location.protocol}//{location.host}/?pkg=react-dom&imports=render
            </a>
          </li>
        </ul>
      </p>
      <hr />
      <a href="https://github.com/mizchi/shaker-phobia">GitHub</a>
    </div>}
  </div>
}

render(<App />, document.getElementById('app')!)

function bytesToSize(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}