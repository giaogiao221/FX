import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexCss = fs.readFileSync(path.join(here, "..", "src", "index.css"), "utf8");
const appCss = fs.readFileSync(path.join(here, "..", "src", "App.css"), "utf8");
const app = fs.readFileSync(path.join(here, "..", "src", "App.jsx"), "utf8");

test("application root has a full-width block layout", () => {
  assert.match(indexCss, /html,\s*body,\s*#root/);
  assert.match(indexCss, /width:\s*100%/);
  assert.match(indexCss, /body\s*\{[^}]*display:\s*block/s);
  assert.doesNotMatch(indexCss, /display:\s*flex/);
  assert.doesNotMatch(appCss, /max-width:\s*1280px/);
  assert.match(appCss, /max-width:\s*none/);
});

test("application shell does not cap desktop content at 1680 pixels", () => {
  assert.doesNotMatch(app, /maxWidth:\s*1680/);
  assert.match(app, /<div style=\{\{ width: "100%", maxWidth: "none", margin: "0 auto", padding: 20/);
});
