import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Node, Project, SyntaxKind, Type, TypeFormatFlags, ts } from 'ts-morph';
import type { RequirementRecord, StaticArtifact, UsageKind } from './types.js';
import {
  classifyCategories,
  experimentRoot,
  outDir,
  readJson,
  relativeToExperiment,
  walkFiles,
  writeJson,
} from './utils.js';

interface XPathSourceMetadata {
  mode: 'vendored-source' | 'bundled-dist-only';
}

const require = createRequire(import.meta.url);
const engineEntryPath = require.resolve('@getodk/xforms-engine');
const engineRoot = path.resolve(path.dirname(engineEntryPath), '..');
const enginePackagePath = path.join(engineRoot, 'package.json');
const engineManifest = JSON.parse(fs.readFileSync(enginePackagePath, 'utf8')) as { version: string };

const vendoredXPathRoot = path.join(experimentRoot, 'vendor', 'xpath');
const xpathMetadataPath = path.join(outDir, 'xpath-source.json');
const staticOutPath = path.join(outDir, 'static-dom-usage.json');

interface WorkingRecord {
  categories: Set<string>;
  usageKinds: Set<UsageKind>;
  sourcePackages: Set<string>;
  sources: Set<string>;
}

const usageMap = new Map<string, WorkingRecord>();

const ALLOWED_INTERFACE_NAMES = new Set<string>([
  'Attr',
  'CDATASection',
  'CharacterData',
  'ChildNode',
  'Comment',
  'Document',
  'DocumentFragment',
  'DocumentType',
  'DOMParser',
  'Element',
  'HTMLElement',
  'NamedNodeMap',
  'Node',
  'NodeList',
  'ParentNode',
  'ProcessingInstruction',
  'Text',
  'XMLDocument',
  'XMLSerializer',
  'XPathEvaluator',
  'XPathExpression',
  'XPathNSResolver',
  'XPathResult',
]);

const DOM_CONSTRUCTOR_IDENTIFIERS = new Set<string>([
  'Attr',
  'CDATASection',
  'CharacterData',
  'Comment',
  'Document',
  'DocumentFragment',
  'DocumentType',
  'DOMParser',
  'Element',
  'HTMLElement',
  'NamedNodeMap',
  'Node',
  'NodeList',
  'ProcessingInstruction',
  'Text',
  'XMLDocument',
  'XMLSerializer',
  'XPathEvaluator',
  'XPathExpression',
  'XPathResult',
]);

const getMapKey = (interfaceName: string, memberName: string): string => {
  return `${interfaceName}::${memberName}`;
};

const readXPathMode = (): 'vendored-source' | 'bundled-dist-only' => {
  if (!fs.existsSync(xpathMetadataPath)) {
    return fs.existsSync(vendoredXPathRoot) ? 'vendored-source' : 'bundled-dist-only';
  }

  const metadata = readJson<XPathSourceMetadata>(xpathMetadataPath);
  return metadata.mode;
};

const resolveSourcePackage = (filePath: string): string => {
  const normalized = filePath.replaceAll(path.sep, '/');
  if (normalized.includes('/vendor/xpath/')) {
    return 'xpath';
  }
  if (normalized.includes('/@getodk/xforms-engine/')) {
    return 'xforms-engine';
  }
  return 'unknown';
};

const getSourceRef = (node: Node): string => {
  const sourceFile = node.getSourceFile();
  const line = sourceFile.getLineAndColumnAtPos(node.getStart()).line;
  return `${relativeToExperiment(sourceFile.getFilePath())}:${line}`;
};

const isDomDeclarationPath = (filePath: string): boolean => {
  const normalized = filePath.replaceAll(path.sep, '/');
  return normalized.endsWith('/lib.dom.d.ts') || normalized.includes('/typescript/lib/lib.dom.d.ts');
};

const getDomInterfaceNames = (type: Type): string[] => {
  const names = new Set<string>();
  const queue: Type[] = [type];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.pop();
    if (current == null) {
      continue;
    }

    const key = `${current.getFlags()}::${current.getText(
      undefined,
      TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
    )}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const symbol = current.getSymbol() ?? current.getAliasSymbol();
    if (symbol != null) {
      const declarations = symbol.getDeclarations();
      if (declarations.some((declaration) => isDomDeclarationPath(declaration.getSourceFile().getFilePath()))) {
        names.add(symbol.getName());
      }
    }

    for (const unionType of current.getUnionTypes()) {
      queue.push(unionType);
    }
    for (const intersectionType of current.getIntersectionTypes()) {
      queue.push(intersectionType);
    }

    const apparentType = current.getApparentType();
    if (apparentType !== current) {
      queue.push(apparentType);
    }

    const literalBaseType = current.getBaseTypeOfLiteralType();
    if (literalBaseType !== current) {
      queue.push(literalBaseType);
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
};

const isInTypeOnlyPosition = (node: Node): boolean => {
  const typeAncestor = node.getFirstAncestor((ancestor) => Node.isTypeNode(ancestor));
  if (typeAncestor != null) {
    return true;
  }

  return (
    node.getFirstAncestor((ancestor) => {
      return (
        Node.isImportDeclaration(ancestor) ||
        Node.isImportSpecifier(ancestor) ||
        Node.isImportClause(ancestor) ||
        Node.isExportSpecifier(ancestor)
      );
    }) != null
  );
};

const pushRequirement = (
  interfaceName: string,
  memberName: string,
  usageKind: UsageKind,
  sourcePackage: string,
  sourceRef: string
): void => {
  const key = getMapKey(interfaceName, memberName);
  const current = usageMap.get(key);
  const categories = classifyCategories(interfaceName, memberName);

  if (current != null) {
    current.usageKinds.add(usageKind);
    current.sourcePackages.add(sourcePackage);
    current.sources.add(sourceRef);
    for (const category of categories) {
      current.categories.add(category);
    }
    return;
  }

  usageMap.set(key, {
    categories: new Set(categories),
    usageKinds: new Set([usageKind]),
    sourcePackages: new Set([sourcePackage]),
    sources: new Set([sourceRef]),
  });
};

const resolveExpressionIdentifier = (expression: Node): string | null => {
  if (Node.isIdentifier(expression)) {
    return expression.getText();
  }
  if (Node.isPropertyAccessExpression(expression)) {
    return expression.getName();
  }
  return null;
};

const normalizeInterfaceNames = (
  interfaceNames: string[],
  expression?: Node
): string[] => {
  const normalized = new Set<string>();

  for (const interfaceName of interfaceNames) {
    if (interfaceName !== '__type') {
      normalized.add(interfaceName);
    }
  }

  if (expression != null) {
    const identifier = resolveExpressionIdentifier(expression);
    if (identifier != null && DOM_CONSTRUCTOR_IDENTIFIERS.has(identifier)) {
      normalized.add(identifier);
    }
  }

  return Array.from(normalized).filter((name) => ALLOWED_INTERFACE_NAMES.has(name));
};

const getPropertyUsageKind = (node: Node): UsageKind => {
  const parent = node.getParentIfKind(SyntaxKind.CallExpression);
  if (parent?.getExpression() === node) {
    return 'call';
  }

  const binaryParent = node.getParentIfKind(SyntaxKind.BinaryExpression);
  if (binaryParent != null) {
    const operatorKind = binaryParent.getOperatorToken().getKind();
    if (binaryParent.getLeft() === node && operatorKind === SyntaxKind.EqualsToken) {
      return 'set';
    }
  }

  return 'get';
};

const scanFile = (sourceFilePath: string, project: Project): void => {
  const sourceFile = project.getSourceFileOrThrow(sourceFilePath);
  const sourcePackage = resolveSourcePackage(sourceFilePath);

  sourceFile.forEachDescendant((node) => {
    if (isInTypeOnlyPosition(node)) {
      return;
    }

    if (Node.isPropertyAccessExpression(node)) {
      const interfaceNames = normalizeInterfaceNames(
        getDomInterfaceNames(node.getExpression().getType()),
        node.getExpression()
      );
      if (interfaceNames.length === 0) {
        return;
      }

      const member = node.getName();
      const usageKind = getPropertyUsageKind(node);
      const sourceRef = getSourceRef(node);
      for (const interfaceName of interfaceNames) {
        pushRequirement(interfaceName, member, usageKind, sourcePackage, sourceRef);
      }
      return;
    }

    if (Node.isElementAccessExpression(node)) {
      const argument = node.getArgumentExpression();
      if (argument == null || !Node.isStringLiteral(argument)) {
        return;
      }

      const interfaceNames = normalizeInterfaceNames(
        getDomInterfaceNames(node.getExpression().getType()),
        node.getExpression()
      );
      if (interfaceNames.length === 0) {
        return;
      }

      const member = argument.getLiteralText();
      const usageKind = getPropertyUsageKind(node);
      const sourceRef = getSourceRef(node);
      for (const interfaceName of interfaceNames) {
        pushRequirement(interfaceName, member, usageKind, sourcePackage, sourceRef);
      }
      return;
    }

    if (Node.isNewExpression(node)) {
      const expression = node.getExpression();
      if (expression == null) {
        return;
      }

      let interfaceNames = normalizeInterfaceNames(getDomInterfaceNames(expression.getType()), expression);
      if (interfaceNames.length === 0 && Node.isIdentifier(expression)) {
        const symbol = expression.getSymbol();
        const declarations = symbol?.getDeclarations() ?? [];
        if (
          declarations.some((declaration) => isDomDeclarationPath(declaration.getSourceFile().getFilePath()))
        ) {
          interfaceNames = normalizeInterfaceNames([expression.getText()], expression);
        }
      }

      if (interfaceNames.length === 0) {
        return;
      }

      const sourceRef = getSourceRef(node);
      for (const interfaceName of interfaceNames) {
        pushRequirement(interfaceName, '<constructor>', 'new', sourcePackage, sourceRef);
      }
      return;
    }

    if (!Node.isBinaryExpression(node)) {
      return;
    }

    if (node.getOperatorToken().getKind() !== SyntaxKind.InstanceOfKeyword) {
      return;
    }

    const interfaceNames = normalizeInterfaceNames(
      getDomInterfaceNames(node.getRight().getType()),
      node.getRight()
    );
    if (interfaceNames.length === 0) {
      return;
    }

    const sourceRef = getSourceRef(node);
    for (const interfaceName of interfaceNames) {
      pushRequirement(interfaceName, '<instanceof>', 'instanceof', sourcePackage, sourceRef);
    }
  });
};

const buildRequirementRecords = (): RequirementRecord[] => {
  const records: RequirementRecord[] = [];

  for (const [mapKey, value] of usageMap.entries()) {
    const [interfaceName, memberName] = mapKey.split('::');
    records.push({
      interface: interfaceName,
      member: memberName,
      categories: Array.from(value.categories).sort((a, b) => a.localeCompare(b)),
      usageKinds: Array.from(value.usageKinds).sort((a, b) => a.localeCompare(b)) as UsageKind[],
      sourcePackages: Array.from(value.sourcePackages).sort((a, b) => a.localeCompare(b)),
      sources: Array.from(value.sources).sort((a, b) => a.localeCompare(b)),
    });
  }

  records.sort((a, b) => {
    const interfaceOrder = a.interface.localeCompare(b.interface);
    if (interfaceOrder !== 0) {
      return interfaceOrder;
    }
    return a.member.localeCompare(b.member);
  });

  return records;
};

const main = (): void => {
  const xpathMode = readXPathMode();

  const files = [
    ...walkFiles(path.join(engineRoot, 'src'), new Set(['.ts'])),
    ...walkFiles(path.join(engineRoot, 'dist'), new Set(['.d.ts'])),
  ];

  if (xpathMode === 'vendored-source') {
    files.push(...walkFiles(path.join(vendoredXPathRoot, 'src'), new Set(['.ts', '.d.ts'])));
  }

  const uniqueFiles = Array.from(new Set(files)).sort((a, b) => a.localeCompare(b));

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      skipLibCheck: true,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
      allowJs: false,
      noEmit: true,
    },
  });

  project.addSourceFilesAtPaths(uniqueFiles);

  for (const filePath of uniqueFiles) {
    scanFile(filePath, project);
  }

  const artifact: StaticArtifact = {
    metadata: {
      generatedAt: new Date().toISOString(),
      engineVersion: engineManifest.version,
      engineRoot: relativeToExperiment(engineRoot),
      xpathMode,
      filesScanned: uniqueFiles.length,
      scanner: 'ts-morph',
    },
    requirements: buildRequirementRecords(),
  };

  writeJson(staticOutPath, artifact);

  console.log(`Static DOM scan complete: ${artifact.requirements.length} requirements from ${artifact.metadata.filesScanned} files`);
};

main();
