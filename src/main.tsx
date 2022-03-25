import type { Api, CompileResult } from "./worker";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { wrap } from "comlink";

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
const api = wrap<Api>(worker);

type Query = {
  pkg?: string;
  imports?: string;
};

function Reporter(props: { query: Query }) {
  const [error, setError] = useState<{ reason: string } | null>(null);
  const [result, setResult] = useState<CompileResult | null>(null);

  useEffect(() => {
    (async () => {
      const imports = props.query.imports
        ? props.query.imports.split(",")
        : undefined;
      try {
        const ret = await api.compile(
          `https://cdn.skypack.dev/${props.query.pkg}`,
          imports,
        );
        if (!ret.error && ret.code.includes("[Package Error]")) {
          setError({ reason: ret.code });
        }
        setResult(ret);
      } catch (err) {
        setError({ reason: "compile error" });
      }
    })();
  }, [props.query]);

  if (error) {
    return <div>
      BundleError
      <pre style={{wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}>
        <code>
          {error.reason}
        </code>
      </pre>
    </div>;
  }
  if (!result) {
    return <div>bundling...</div>;
  }
  if (result.error) {
    return <div>CompileError: {result.reason}</div>;
  }
  return (
    <div style={{width: '100%'}}>
      <p style={{ display: 'grid', placeItems: 'start', fontSize: '3rem' }}>
          {bytesToSize(result.size)} - gzip: {bytesToSize(result.gzipSize)}
      </p>
      <div style={{maxWidth: '100%', overflow: 'none'}}>
        <details>
          <summary>Output</summary>
          <pre
            style={{
              width: "100%",
              fontFamily: "monaco",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            <code>
              {result.code}
            </code>
          </pre>
        </details>
      </div>
    </div>
  );
}

function SearchForm(props: { pkg: string, imports: string, onChangePkg: (pkg: string) => void, onChangeImports: (imports: string) => void }) {
  return (
    <div>
      <form
        method="get"
        action="/"
        style={{ display: "flex", height: "3.5rem" }}
      >
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          import {'{'}
        </div>
        <div
          style={{
            display: "inline-flex",
            height: "100%",
            paddingLeft: "0.4rem",
            paddingRight: "0.4rem",
          }}
        >
          <input
            type="text"
            id="imports"
            name="imports"
            value={props.imports}
            onChange={(e: any) => props.onChangeImports(e.target.value)}
            placeholder="a,b,c..."
          />
        </div>
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          {'}'}
          &nbsp;
          from
        </div>
        <div
          style={{
            display: "inline-flex",
            height: "100%",
            paddingLeft: "0.4rem",
          }}
        >
          <input
            type="text"
            id="pkg"
            name="pkg"
            value={props.pkg} placeholder="pkg@version"
            onChange={(e: any) => props.onChangePkg(e.target.value)}
          />
        </div>
        <div style={{ display: "inline-flex" }}>
          <input type="submit" value="Bundle"></input>
        </div>
      </form>
    </div>
  );
}

function TopPage() {
  return (
    <div>
      <h2>What's this</h2>
      <p>
        This is a tool to check bundle size with treeshake. It downloads sources
        from <a href="https://cdn.skypack.dev">cdn.skpack.dev</a>{" "}
        and build with rollup and terser <strong>in your browser</strong>.
      </p>
      <p>
        Open to bundle:{" "}
        <code style={{ fontSize: "1rem" }}>
          {`https://shakerphobia.netlify.com/?pkg=<name(@version)>&imports=<a,b,c>`}
        </code>.
      </p>
      <h2>Examples</h2>
      <p>
        <ul>
          {[
            {
              pkg: "preact",
              imports: ["render", "h"],
            },
            {
              pkg: "react-dom@18.0.0",
              imports: ["hydrate"],
            },
            {
              pkg: "@mizchi/mints",
              imports: ["transformSync"],
            },
          ].map((t) => {
            const url = `${location.protocol}//${location.host}/?pkg=${t.pkg}${
              t.imports ? `&imports=${t.imports.join(",")}` : ""
            }`;
            return (
              <li>
                <a href={url}>
                  {url}
                </a>
              </li>
            );
          })}
        </ul>
      </p>
    </div>
  );
}

function App() {
  const [error, setError] = useState<{ reason: string } | null>(null);
  const [isTop, setIsTop] = useState(false);
  const [query, setQuery] = useState<Query | null>(null);
  useEffect(() => {
    if (!location.search) {
      setIsTop(true);
      return;
    }
    const query: Query = location.search.slice(1).split("&").reduce(
      (acc, cur) => {
        const [key, val] = cur.split("=");
        return { ...acc, [decodeURIComponent(key)]: decodeURIComponent(val) };
      },
      {},
    );
    // console.log(query);

    if (query.pkg) {
      if (query.pkg && /[a-zA-Z@][a-zA-Z-_\d\/\@]+/.test(query.pkg)) {
        setQuery(query);
        const pkg = document.querySelector("[name=pkg]") as HTMLInputElement;
        if (pkg) {
          pkg.value = query.pkg;
        }
        const imports = document.querySelector("[name=imports]") as HTMLInputElement;
        if (imports) {
          imports.value = query.imports ?? '';
        }
      } else {
        setError({ reason: "Invalid pkgName" });
      }
    } else {
      setIsTop(true);
    }
  }, []);
  return (
    <div>
      <header>
        <h1>
          <a href="/" style={{}}>
            Shakerphobia
          </a>
        </h1>
        <p>
          bundle size after treeshake &nbsp;|&nbsp;
          <a href="https://github.com/mizchi/shaker-phobia">GitHub</a>
          &nbsp;|&nbsp; author: <a href="https://twitter.com/mizchi">@mizchi</a>
        </p>
        <SearchForm
          pkg={query?.pkg ?? 'preact@10.6.6'}
          imports={query?.imports ?? 'render,h'}
          onChangePkg={(pkg) => setQuery({ ...query, pkg })}
          onChangeImports={(imports) => setQuery({ ...query, imports: imports.replace(/ /g, "") })}
        />
        <hr />
      </header>
      <main>
        <div style={{paddingTop: '1rem'}}>
          {query && <Reporter query={query} />}
        </div>
      </main>
      {error && (
        <div>
          {error.reason}
        </div>
      )}
      {isTop && <TopPage />}
    </div>
  );
}

render(<App />, document.getElementById("app")!);

function bytesToSize(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["bytes", "kb", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
