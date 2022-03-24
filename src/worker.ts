import { minify } from "terser";
import { rollup } from "rollup";
import { expose } from "comlink";
import { Plugin } from "rollup";
import path from "path";
// import virtual from "@rollup/plugin-virtual";

export type CompileResult = {
  input: string;
  code: string,
  size: number,
  gzipSize: number,
};

declare const CompressionStream: any;
const encoder = new TextEncoder();

async function compress(str: string): Promise<ArrayBuffer> {
  const cs = new CompressionStream("gzip");
  const buf = encoder.encode(str);
  const stream = new Response(buf).body!.pipeThrough(cs);
  return new Response(stream as any).arrayBuffer();
}


const api = {
  async compile(pkgName: string, imports: string[] | undefined): Promise<CompileResult> {
    const importsString = imports?.join(",");
    const input = imports?.length
      ? `import {${importsString}} from "${pkgName}";\nconsole.log(${importsString})`
      : `import * as x from "${pkgName}";console.log(x)`;

    const bundle = await rollup({
      input: 'entry.js',
      plugins: [
        {
          name: 'entry',
          resolveId(id, importer) {
            if (importer == null) {
              return 'entry.js';
            }
          },
          load(id) {
            if (id === 'entry.js') {
              return input;
            }
          }
        },
        httpResolve({
          // resolveIdFallback: (id, importer) => {}
        })
      ]
    }); 
    const generated = await bundle.generate({
      format: 'es',
    });
    const main = generated.output[0].code;
    const minified = await minify(main, { module: true });
    const gzipped = await compress(minified.code!);
    return {
      input,
      code: minified.code!,
      size: minified.code!.length - importsString!.length,
      gzipSize: gzipped.byteLength,
    };
  }
};

export type Api = typeof api;

expose(api);


function isHttpProtocol(id: string | undefined | null) {
  return id?.startsWith("https://");
}

const DEBUG = true;
const log = (...args: any) => DEBUG && console.log(...args);

type HttpResolveOptions = {
  cache?: any;
  fetcher?: (url: string) => Promise<string>;
  onRequest?: (url: string) => void;
  onUseCache?: (url: string) => void;
};
const defaultCache = new Map();

const httpResolve = function httpResolve_({
  cache = defaultCache,
  onRequest,
  onUseCache,
  fetcher,
}: HttpResolveOptions = {}) {
  return {
    name: "http-resolve",
    async resolveId(id: string, importer: string) {
      if (isHttpProtocol(id)) {
        return id;
      }
      log("[http-resolve:resolveId:enter]", id, "from", importer);
      // on network resolve
      if (importer && isHttpProtocol(importer)) {
        log("[http-resolve:resolveId:target]", id, "from", importer);

        if (id.startsWith("https://")) {
          log("[http-reslove:end] return with https", id);
          return id;
        }
        const { pathname, protocol, host } = new URL(importer);
        // for skypack
        if (id.startsWith("/")) {
          // pattern: /_/ in https://cdn.skypack.dev
          log(
            "[http-reslove:end] return with host root",
            `${protocol}//${host}${id}`
          );
          return `${protocol}//${host}${id}`;
        } else if (id.startsWith(".") || id === 'entry.js') {
          // pattern: ./xxx/yyy in https://esm.sh
          const resolvedPathname = path.join(path.dirname(pathname), id);
          const newId = `${protocol}//${host}${resolvedPathname}`;
          log("[http-resolve:end] return with relativePath", newId);
          return newId;
        }
      }
    },
    async load(id: string) {
      log("[http-resolve:load]", id);
      if (id === null) {
        return;
      }
      if (isHttpProtocol(id)) {
        const cached = await cache.get(id);
        if (cached) {
          onUseCache?.(id);
          return cached;
        }
        onRequest?.(id);
        if (fetcher) {
          const code = await fetcher(id);
          await cache.set(id, code);
          return code;
        } else {
          const res = await fetch(id);
          if (!res.ok) {
            throw res.statusText;
          }
          const code = await res.text();
          await cache.set(id, code);
          return code;
        }
      }
    },
  } as Plugin;
};