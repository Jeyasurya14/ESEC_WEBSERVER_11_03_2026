const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const failures = [];
let files = 0;
let components = 0;
const legacyDecorators = new Set([
  'Input',
  'Output',
  'ViewChild',
  'ViewChildren',
  'ContentChild',
  'ContentChildren',
  'HostListener',
]);

function checkTemplate(filename, text) {
  const position = text.indexOf('$any(');
  if (position < 0) return;
  const line = text.slice(0, position).split('\n').length;
  failures.push(`${filename}:${line}: Validate template values instead of using $any().`);
}

function checkFile(filename) {
  files++;
  const source = ts.createSourceFile(
    filename,
    fs.readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  checkTemplate(filename, source.text);
  const test =
    /\.(spec|testing)\.ts$/.test(filename) || filename.includes(`${path.sep}testing${path.sep}`);
  const transport = filename.endsWith(`${path.sep}api-request.ts`);
  const report = (node, message) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    failures.push(`${filename}:${line + 1}: ${message}`);
  };
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword)
      report(node, 'Use a concrete type or validate unknown data.');
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
      report(node, 'Narrow data or validate configuration with satisfies.');
    if (ts.isDecorator(node) && ts.isCallExpression(node.expression)) {
      const name = node.expression.expression.getText(source);
      if (legacyDecorators.has(name))
        report(node, 'Use signal inputs, outputs, queries or component host bindings.');
      if (name === 'Component') {
        components++;
        const metadata = node.expression.arguments[0];
        if (
          !metadata ||
          !ts.isObjectLiteralExpression(metadata) ||
          !metadata.properties.some(
            (property) =>
              property.name?.getText(source) === 'changeDetection' &&
              ts.isPropertyAssignment(property) &&
              property.initializer.getText(source) === 'ChangeDetectionStrategy.OnPush',
          )
        )
          report(node, 'Components must declare OnPush change detection.');
      }
    }
    if (
      !test &&
      ts.isImportSpecifier(node) &&
      ['BehaviorSubject', 'switchMap'].includes(node.name.text)
    )
      report(node, 'Use signals and resources for state and reads.');
    if (!test && ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'firstValueFrom' &&
        !transport
      )
        report(node, 'Keep Observable conversion in the cancellable HTTP adapter.');
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'subscribe'
      )
        report(node, 'Use a resource rather than a manual subscription.');
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        (node.expression.name.text === 'find' ||
          (node.expression.name.text === 'includes' &&
            ts.isArrayLiteralExpression(node.expression.expression)))
      ) {
        let parent = node.parent;
        while (parent && !ts.isSourceFile(parent)) {
          if (
            (ts.isCallExpression(parent) &&
              ts.isPropertyAccessExpression(parent.expression) &&
              ['map', 'filter', 'forEach', 'reduce'].includes(parent.expression.name.text)) ||
            ts.isForOfStatement(parent) ||
            ts.isForStatement(parent)
          ) {
            report(node, 'Index repeated collection lookups with a Set or Map.');
            break;
          }
          parent = parent.parent;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(filename);
    else if (filename.endsWith('.ts')) checkFile(filename);
    else if (filename.endsWith('.html')) checkTemplate(filename, fs.readFileSync(filename, 'utf8'));
  }
}

scan(path.resolve(__dirname, '../src'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Architecture checks passed: ${files} TypeScript files, ${components} OnPush components.`,
  );
