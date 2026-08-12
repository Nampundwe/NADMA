# Nadma — Project & Verification Notes

React Native / Expo app (Expo SDK 57, RN 0.86). Firebase backend (Auth + Firestore + Storage).
Main data layer: `src/data/firebaseStorage.js`. Screens live in `src/screens/`.

## Always verify after every change

There is no test framework in this project. After modifying any JS file, run BOTH checks and make sure they pass before finishing:

### 1. Static check (syntax, import/export consistency, unused imports)

Run this Node script from the project root (requires `node`; uses the project's `@babel/parser`). Update the `files` array to include every file you touched.

```powershell
$script = @'
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const files = [
  "src/data/firebaseStorage.js",
  "src/screens/CommunityScreen.js",
  "src/screens/ProfileScreen.js",
  "src/screens/ServiceDetailScreen.js",
];

let failed = false;
const report = (ok, msg) => { console.log((ok ? "OK  " : "FAIL") + " " + msg); if (!ok) failed = true; };

for (const f of files) {
  try {
    parser.parse(fs.readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"] });
    report(true, f + " parses");
  } catch (e) {
    report(false, f + " parse error: " + (e.message || e).split("\n")[0]);
  }
}

function collectExports(file) {
  const ast = parser.parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  const exports = new Set();
  for (const n of ast.program.body) {
    if (n.type === "ExportNamedDeclaration") {
      if (n.declaration) {
        if (n.declaration.type === "VariableDeclaration") {
          for (const d of n.declaration.declarations) {
            if (d.id.type === "Identifier") exports.add(d.id.name);
            if (d.id.type === "ObjectPattern") for (const p of d.id.properties) exports.add(p.value.name);
          }
        }
        if (n.declaration.type === "FunctionDeclaration") exports.add(n.declaration.id.name);
        if (n.declaration.type === "ClassDeclaration") exports.add(n.declaration.id.name);
      }
    }
    if (n.type === "ExportSpecifier") exports.add(n.exported.name);
  }
  return exports;
}

const exportsByMod = {};
const resolveLocal = (imp, fromFile) => {
  if (!imp.startsWith(".") && !imp.startsWith("/")) return null;
  let p = path.resolve(path.dirname(fromFile), imp);
  if (!fs.existsSync(p)) p += ".js";
  if (!fs.existsSync(p)) p = path.join(p, "index.js");
  return fs.existsSync(p) ? p : null;
};

for (const f of files) {
  const ast = parser.parse(fs.readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  for (const n of ast.program.body) {
    if (n.type !== "ImportDeclaration") continue;
    const modPath = resolveLocal(n.source.value, f);
    if (!modPath) continue;
    if (!exportsByMod[modPath]) exportsByMod[modPath] = collectExports(modPath);
    for (const spec of n.specifiers) {
      if (spec.type !== "ImportSpecifier") continue;
      const name = spec.imported.name;
      if (!exportsByMod[modPath].has(name)) report(false, `${f}: "${name}" NOT exported by ${modPath}`);
    }
  }
}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
  const imported = [];
  for (const n of ast.program.body) {
    if (n.type !== "ImportDeclaration") continue;
    for (const spec of n.specifiers) {
      if (spec.type === "ImportSpecifier" || spec.type === "ImportDefaultSpecifier") imported.push(spec.local.name);
    }
  }
  for (const name of imported) {
    const re = new RegExp(`\\b${name}\\b`);
    const bodyWithoutImports = src.replace(/^import[\s\S]*?;$/gm, "");
    if (!re.test(bodyWithoutImports)) report(false, `${f}: unused import "${name}"`);
  }
}

console.log(failed ? "\n=== ERRORS FOUND ===" : "\n=== ALL STATIC CHECKS PASSED ===");
process.exit(failed ? 1 : 0);
'@; Set-Content -Path "check.js" -Value $script -Encoding UTF8; node check.js; $code = $LASTEXITCODE; Remove-Item -LiteralPath "check.js"; exit $code
```

### 2. Full bundle check (proves every import resolves and the app compiles)

```powershell
npx expo export --platform android --output-dir dist-check
# on success:  Remove-Item -Recurse -Force -LiteralPath "dist-check"
```

`expo export` fails if any module import can't be resolved or any file has a syntax error, so a clean export = the whole app compiles. Delete `dist-check/` afterward.

## Gotchas

- Uses `createStyleSheet` from `src/utils/responsive` (auto-scales pixel values). Don't add plain `StyleSheet.create` for new screens — follow existing screens' pattern (`const getStyles = (colors) => createStyleSheet({...})`).
- All data access goes through `src/data/firebaseStorage.js` (Firebase). `src/data/storage.js` is the legacy AsyncStorage layer — avoid extending it.
- New Firestore collections must be added to `COLLECTIONS` in `firebaseStorage.js`.
- Screens use `useToast()` and `useNetworkAction().run()` for user-facing actions — follow that pattern.
