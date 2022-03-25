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
        setResult(ret);
      } catch (err) {
        setError({ reason: "compile error" });
      }
    })();
  }, [props.query]);

  if (error) {
    return <div>CompileError: {error.reason}</div>;
  }
  if (!result) {
    return <div>compiling...</div>;
  }
  if (result.error) {
    return <div>CompileError: {result.reason}</div>;
  }

  const pkgName = props.query.pkg?.match(/^(@?[^@]+)(@\w*)?/)?.[1].replace(
    /-/g,
    "_",
  );
  const code = props.query.imports
    ? `{ ` + props.query.imports.split(",").join(", ") + ` }`
    : `defaults`;
  return (
    <div>
      <pre>
        <code style={{ fontSize: "1rem", fontFamily: "menlo" }}>
          import {code} from "{pkgName}";{"\n"}
        </code>
      </pre>
      <p style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <strong style={{ fontSize: "3rem" }}>
          {bytesToSize(result.size)}
          &nbsp; | gzip: {bytesToSize(result.gzipSize)}
        </strong>
      </p>
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
  );
}

function SearchForm() {
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
            placeholder="render,h"
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
          <input type="text" id="pkg" name="pkg" placeholder="preact@10.6.6" />
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
              pkg: "react@16.0.0",
              imports: undefined,
            },
            {
              pkg: "@mizchi/mints",
              imports: ["transformSync"],
            },
            {
              pkg: "lodash",
              imports: ["isEqual", "get", "flatten"],
            },
            {
              pkg: "lodash-es",
              imports: ["chain"],
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
        return { ...acc, [key]: val };
      },
      {},
    );
    if (query.pkg) {
      if (query.pkg && /[a-zA-Z@][a-zA-Z-_\d\/\@]+/.test(query.pkg)) {
        setQuery(query);
        const pkg = document.querySelector("[name=pkg]") as HTMLInputElement;
        if (pkg) {
          pkg.value = decodeURIComponent(query.pkg);
        }
        const imports = document.querySelector("[name=imports]") as HTMLInputElement;
        if (pkg) {
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
        <SearchForm />
        <div style={{paddingTop: '2rem'}}>
          {query && <Reporter query={query} />}
        </div>
      </header>
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
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
