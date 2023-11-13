/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 */

import {Children} from 'react';
import * as React from 'react';
import {SandpackProvider} from '@codesandbox/sandpack-react/unstyled';
import {SandpackLogLevel} from '@codesandbox/sandpack-client';
import {CustomPreset} from './CustomPreset';
import {createFileMap} from './createFileMap';
import {CustomTheme} from './Themes';

import {Sandpack} from '@codesandbox/sandpack-react';

import {
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
} from '@codesandbox/sandpack-react/unstyled';

import {memo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {useSandpack, useActiveCode} from '@codesandbox/sandpack-react/unstyled';
import cn from 'classnames';

import {IconChevron} from 'components/Icon/IconChevron';
import {NavigationBar} from './NavigationBar';
import {Preview} from './Preview';

import {useSandpackLint} from './useSandpackLint';

type SandpackProps = {
  children: React.ReactNode;
  autorun?: boolean;
  serverComponents?: boolean;
};

const sandboxStyle = `
* {
  box-sizing: border-box;
}

body {
  font-family: sans-serif;
  margin: 20px;
  padding: 0;
}

h1 {
  margin-top: 0;
  font-size: 22px;
}

h2 {
  margin-top: 0;
  font-size: 20px;
}

h3 {
  margin-top: 0;
  font-size: 18px;
}

h4 {
  margin-top: 0;
  font-size: 16px;
}

h5 {
  margin-top: 0;
  font-size: 14px;
}

h6 {
  margin-top: 0;
  font-size: 12px;
}

code {
  font-size: 1.2em;
}

ul {
  padding-inline-start: 20px;
}
`.trim();

const SCRIPT_CODE = `
// process.exit(2);

// TODO learn what this does.
const register = require('react-server-dom-webpack/node-register');
register();
const babelRegister = require('@babel/register');
babelRegister({
  ignore: [/[\\\/](build|server|node_modules)[\\\/]/],
  presets: [['@babel/preset-react', {runtime: 'automatic'}]],
  plugins: ['@babel/transform-modules-commonjs'],
});

const webpack = require("webpack");
const ReactServerWebpackPlugin = require("react-server-dom-webpack/plugin");
const path = require("path");
const React = require('react');
const ClientRoot = require('./App.js').default;


const {renderToPipeableStream} = require('react-server-dom-webpack/server.node');


async function build() {
  return new Promise((resolve, reject) => {
    webpack(
      {
        mode: "development",
        devtool: "cheap-module-source-map",
        entry: [path.resolve(__dirname, "./server.js")],
        output: {
          path: path.resolve(__dirname, "./build"),
          filename: "main.js",
        },
        module: {
          rules: [
            {
              test: /\.js$/,
              use: "babel-loader",
              exclude: /node_modules/,
            },
          ],
        },
        plugins: [
          new ReactServerWebpackPlugin({ isServer: false }),
        ],
      },
      (err, stats) => {
        if (err) {
          console.error(err.stack || err);
          if (err.details) {
            console.error(err.details);
          }
          reject();
        }
        if (stats?.hasErrors()) {
          console.log("Finished running webpack with errors.");
          const info = stats.toJson();
          info.errors.forEach((e) => console.error(e));
          reject();
        } else {
          console.log("Finished running webpack.");
          resolve();
        }
      }
    );
  });
}

async function serveIndex(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  const fileContents = await fs.readFile(path.resolve(__dirname, "./serverIndex.html"), 'utf8');
  res.end(fileContents)
}

async function serveScript(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/javascript');
  const fileContents = await fs.readFile(path.resolve(__dirname, "./build/main.js"), 'utf8');
  res.end(fileContents)
}

async function serveScriptClient0(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/javascript');
  const fileContents = await fs.readFile(path.resolve(__dirname, "./build/client0.main.js"), 'utf8');
  res.end(fileContents)
}

async function serveReact(req, res) {
  // TODO get props from the query.
  // const location = JSON.parse(req.query.location);
  // res.set('X-Location', JSON.stringify(location));
  const props = {};

  const manifest = await fs.readFile(
    path.resolve(__dirname, './build/react-client-manifest.json'),
    'utf8'
  );
  const moduleMap = JSON.parse(manifest);
  const {pipe} = renderToPipeableStream(
    React.createElement(ClientRoot, props),
    moduleMap
  );
  pipe(res);
}

const http = require('http');
const fs = require('fs').promises;

async function main() {
  await build();

  const hostname = '127.0.0.1';
  const port = 1234;

  const server = http.createServer(async (req, res) => {
    switch (req.url) {
      case '/':
        return serveIndex(req, res);
      case '/main.js':
        return serveScript(req, res);
      case '/client0.main.js':
        return serveScriptClient0(req, res);
     case '/react':
        return serveReact(req, res);
    }
  });

  server.listen(port, hostname);
}

main();
`;

const SERVER_CODE = `
console.log("server root module executed");

import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { Router } from "./router";

const root = createRoot(document.getElementById("root"));
root.render(<Root />);

function Root() {
  return (
    <ErrorBoundary FallbackComponent={Error}>
      <Router />
    </ErrorBoundary>
  );
}

function Error({ error }) {
  return (
    <div>
      <h1>Application Error</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>{error.stack}</pre>
    </div>
  );
}
`;

const ROUTER_CODE = `
"use client";

console.log("router module executed");

import {
  createContext,
  startTransition,
  useContext,
  useState,
  use,
} from "react";
import {
  createFromFetch,
  createFromReadableStream,
} from "react-server-dom-webpack/client";

const RouterContext = createContext();
const initialCache = new Map();

export function Router() {
  console.log("router was executed");

  const [cache, setCache] = useState(initialCache);
  // TODO remove app-specific attributes
  const [location, setLocation] = useState({
    selectedId: null,
    isEditing: false,
    searchText: "",
  });

  const locationKey = JSON.stringify(location);
  let content = cache.get(locationKey);
  if (!content) {
    content = createFromFetch(
      fetch("/react")
    );
    cache.set(locationKey, content);
  }

  function refresh(response) {
    startTransition(() => {
      const nextCache = new Map();
      if (response != null) {
        const locationKey = response.headers.get("X-Location");
        const nextLocation = JSON.parse(locationKey);
        const nextContent = createFromReadableStream(response.body);
        nextCache.set(locationKey, nextContent);
        navigate(nextLocation);
      }
      setCache(nextCache);
    });
  }

  function navigate(nextLocation) {
    startTransition(() => {
      setLocation((loc) => ({
        ...loc,
        ...nextLocation,
      }));
    });
  }

  return (
    <RouterContext.Provider value={{ location, navigate, refresh }}>
      <p>This is the router.</p>
      {use(content)}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

export function useMutation({ endpoint, method }) {
  const { refresh } = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [didError, setDidError] = useState(false);
  const [error, setError] = useState(null);
  if (didError) {
    // Let the nearest error boundary handle errors while saving.
    throw error;
  }

  async function performMutation(payload, requestedLocation) {
    setIsSaving(true);
    try {
      const response = await fetch(
        \`\${endpoint}?location=\${encodeURIComponent(
          JSON.stringify(requestedLocation)
        )}\`,
        {
          method,
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      refresh(response);
    } catch (e) {
      setDidError(true);
      setError(e);
    } finally {
      setIsSaving(false);
    }
  }

  return [isSaving, performMutation];
}`;

const HTML_CODE = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="description" content="React with Server Components demo">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="style.css" />
    <title>Demo</title>
    <script defer src="main.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script>
      // In development, we restart the server on every edit.
      // For the purposes of this demo, retry fetch automatically.
      let nativeFetch = window.fetch;
      window.fetch = async function fetchWithRetry(...args) {
        for (let i = 0; i < 4; i++) {
          try {
            return await nativeFetch(...args);
          } catch (e) {
            if (args[1] && args[1].method !== 'GET') {
              // Don't retry mutations to avoid confusion
              throw e;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        return nativeFetch(...args);
      }
    </script>
  </body>
</html>
`;

const CLIENT_ROOT = `
"use client";

console.log("ClientRoot module evaluated");

export default function ClientRoot({}) {
  return <p>This is a client component</p>;
}
`;



function SandpackRoot(props: SandpackProps) {
  let {children, autorun = true, serverComponents = false} = props;
  const codeSnippets = Children.toArray(children) as React.ReactElement[];
  const files = createFileMap(codeSnippets);

  files['/styles.css'] = {
    code: [sandboxStyle, files['/styles.css']?.code ?? ''].join('\n\n'),
    hidden: !files['/styles.css']?.visible,
  };

  if (serverComponents) {
    files['script.js'] = {
      code: SCRIPT_CODE,
      hidden: true,
    };
    files['server.js'] = {
      code: SERVER_CODE,
      hidden: true,
    };
    files['router.js'] = {
      code: ROUTER_CODE,
      hidden: true,
    };
    files['serverIndex.html'] = {
      code: HTML_CODE,
      hidden: true,
    };
    files['ClientRoot.js'] = {
      code: CLIENT_ROOT,
      hidden: true,
    };
    files['package.json'] = {
      code: JSON.stringify({
        dependencies: {
          '@babel/core': '7.21.3',
          '@babel/plugin-transform-modules-commonjs': '^7.21.2',
          '@babel/preset-react': '^7.18.6',
          '@babel/register': '^7.21.0',
          'acorn-jsx': '^5.3.2',
          'acorn-loose': '^8.3.0',
          'babel-loader': '8.3.0',
          'html-webpack-plugin': '5.5.0',
          react: '18.3.0-next-1308e49a6-20230330',
          'react-dom': '18.3.0-next-1308e49a6-20230330',
          'react-error-boundary': '^3.1.4',
          'react-server-dom-webpack': '18.3.0-next-1308e49a6-20230330',
          resolve: '1.22.1',
          rimraf: '^4.4.0',
          'sanitize-html': '^2.10.0',
          'server-only': '^0.0.1',
          webpack: '5.76.2',
        },
        "babel": {
          "presets": [
            [
              "@babel/preset-react",
              {
                "runtime": "automatic"
              }
            ]
          ]
        },
        // scripts: {start: 'node -C foo script.js'},
        scripts: {start: 'node script.js'},
        main: 'script.js',
      }),
      hidden: true,
    };
  }

  const baseOptions = {
    autorun,
    initMode: 'user-visible',
    initModeObserverOptions: {rootMargin: '1400px 0px'},
    // bundlerURL: "https://sandpack-bundler.pages.dev" ,
    // bundlerURL: 'https://1e4ad8f7.sandpack-bundler-4bw.pages.dev',
    // bundlerTimeOut: 5000,
    logLevel: SandpackLogLevel.None,
  };

  const options = serverComponents
    ? baseOptions
    : {
        ...baseOptions,
        bundlerURL: 'https://1e4ad8f7.sandpack-bundler-4bw.pages.dev',
      };
  const template = serverComponents ? undefined : 'react';

  const customSetup = serverComponents
    ? {
        entry: 'server.js',
        environment: 'node',
      }
    : undefined;

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      {/* <Sandpack 
      template={template}
      files={files}
      theme={CustomTheme}
      options={options}
      customSetup={customSetup} /> */}
       <SandpackProvider
        template={template}
        files={files}
        theme={CustomTheme}
        options={options}
        customSetup={customSetup}> 
        <Contents providedFiles={Object.keys(files)} />
        {/* <CustomPreset providedFiles={Object.keys(files)} /> */}
      </SandpackProvider> 
    </div>
  );
}

function Contents({providedFiles}) {
  const {lintErrors, lintExtensions} = useSandpackLint();
  const {sandpack} = useSandpack();
  const {code} = useActiveCode();
  const {activeFile} = sandpack;
  const lineCountRef = useRef<{[key: string]: number}>({});
  if (!lineCountRef.current[activeFile]) {
    lineCountRef.current[activeFile] = code.split('\n').length;
  }
  const lineCount = lineCountRef.current[activeFile];
  const isExpandable = lineCount > 16;

  return (
    <SandboxShell
      providedFiles={providedFiles}
      lintErrors={lintErrors}
      lintExtensions={lintExtensions}
      isExpandable={isExpandable}
    />
  );
}

function SandboxShell({
  providedFiles,
  lintErrors,
  lintExtensions,
  isExpandable,
}: {
  providedFiles: Array<string>;
  lintErrors: Array<any>;
  lintExtensions: Array<any>;
  isExpandable: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="shadow-lg dark:shadow-lg-dark rounded-lg"
      ref={containerRef}
      style={{
        contain: 'content',
      }}>
      <NavigationBar providedFiles={providedFiles} />
      <SandpackLayout
        className={cn(
          !(isExpandable || isExpanded) && 'rounded-b-lg overflow-hidden',
          isExpanded && 'sp-layout-expanded'
        )}>
        <Editor lintExtensions={lintExtensions} />
        {/* This preview is broken: */}
        {/* <Preview
          className="order-last xl:order-2"
          isExpanded={isExpanded}
          lintErrors={lintErrors}
        /> */}
        {/* this preview works: */}
        <SandpackPreview />
      </SandpackLayout>
    </div>
  );
}

const Editor = memo(function Editor({
  lintExtensions,
}: {
  lintExtensions: Array<any>;
}) {
  return (
    <SandpackCodeEditor
      showLineNumbers
      showInlineErrors
      showTabs={false}
      showRunButton={false}
      extensions={lintExtensions}
    />
  );
});

export default SandpackRoot;
