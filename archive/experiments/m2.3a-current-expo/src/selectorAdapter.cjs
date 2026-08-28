const ADAPTER_SYMBOL = Symbol.for('m23a.slimdom.selectorAdapterInstalled');

const splitTopLevel = (input, separatorChar) => {
  const parts = [];
  let current = '';
  let bracketDepth = 0;
  let parenDepth = 0;
  let quoteChar = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoteChar != null) {
      current += char;
      if (char === quoteChar && input[i - 1] !== '\\') {
        quoteChar = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quoteChar = char;
      current += char;
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      current += char;
      continue;
    }
    if (char === ']') {
      bracketDepth -= 1;
      current += char;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      current += char;
      continue;
    }
    if (char === ')') {
      parenDepth -= 1;
      current += char;
      continue;
    }

    if (char === separatorChar && bracketDepth === 0 && parenDepth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
};

const parseAttributeSelector = (input) => {
  const match =
    /^\[\s*([A-Za-z_][A-Za-z0-9:_-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/.exec(
      input
    );

  if (match == null) {
    return null;
  }

  const [, name, doubleQuotedValue, singleQuotedValue, unquotedValue] = match;
  const value = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? null;

  return {
    length: match[0].length,
    selector: { name, value },
  };
};

const parseNotPseudo = (input) => {
  if (!input.startsWith(':not(')) {
    return null;
  }
  const closeIndex = input.indexOf(')');
  if (closeIndex === -1) {
    throw new Error(`Unsupported selector: missing ')' in ${input}`);
  }

  const inner = input.slice(':not('.length, closeIndex).trim();
  const values = splitTopLevel(inner, ',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (values.some((value) => !/^[A-Za-z_][A-Za-z0-9:_-]*$/.test(value))) {
    throw new Error(`Unsupported :not selector list: ${inner}`);
  }

  return {
    length: closeIndex + 1,
    notTags: values.map((value) => value.toLowerCase()),
  };
};

const parseSimpleSelector = (selectorText) => {
  let cursor = selectorText.trim();
  if (cursor.length === 0) {
    throw new Error(`Unsupported selector (empty): "${selectorText}"`);
  }

  const parsed = {
    isScope: false,
    tagName: null,
    attributes: [],
    notTags: [],
  };

  if (cursor.startsWith(':scope')) {
    parsed.isScope = true;
    cursor = cursor.slice(':scope'.length).trim();
  }

  if (cursor.startsWith('*')) {
    parsed.tagName = '*';
    cursor = cursor.slice(1).trim();
  } else {
    const tagMatch = /^([A-Za-z_][A-Za-z0-9:_-]*)/.exec(cursor);
    if (tagMatch != null) {
      parsed.tagName = tagMatch[1].toLowerCase();
      cursor = cursor.slice(tagMatch[0].length).trim();
    }
  }

  while (cursor.startsWith('[')) {
    const attr = parseAttributeSelector(cursor);
    if (attr == null) {
      throw new Error(`Unsupported attribute selector segment: ${cursor}`);
    }
    parsed.attributes.push(attr.selector);
    cursor = cursor.slice(attr.length).trim();
  }

  if (cursor.startsWith(':not(')) {
    const notParsed = parseNotPseudo(cursor);
    parsed.notTags = notParsed.notTags;
    cursor = cursor.slice(notParsed.length).trim();
  }

  if (cursor.length > 0) {
    throw new Error(`Unsupported selector segment: "${cursor}"`);
  }

  if (parsed.tagName == null && !parsed.isScope) {
    throw new Error(`Unsupported selector without tag/scope: "${selectorText}"`);
  }

  return parsed;
};

const parseSelector = (selectorText) => {
  const rawParts = splitTopLevel(selectorText.trim(), '>');
  const parts = rawParts.map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Unsupported selector (empty): "${selectorText}"`);
  }

  return {
    raw: selectorText,
    steps: parts.map((part) => parseSimpleSelector(part)),
  };
};

const parseSelectorList = (selectorListText) => {
  const raw = splitTopLevel(selectorListText, ',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (raw.length === 0) {
    throw new Error(`Unsupported selector list (empty): "${selectorListText}"`);
  }
  return raw.map((selectorText) => parseSelector(selectorText));
};

const getElementChildren = (node) => {
  if (node?.children != null) {
    return Array.from(node.children);
  }
  if (node?.childNodes != null) {
    return Array.from(node.childNodes).filter((child) => child.nodeType === 1);
  }
  return [];
};

const isElement = (value) => value != null && value.nodeType === 1;

const walkElements = (root) => {
  const result = [];
  const stack = [];
  if (isElement(root)) {
    stack.push(root);
  } else if (root?.documentElement != null) {
    stack.push(root.documentElement);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    result.push(current);
    const children = getElementChildren(current);
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i]);
    }
  }

  return result;
};

const matchesSimpleSelector = (element, parsedSimpleSelector, scopeElement) => {
  if (!isElement(element)) {
    return false;
  }
  if (parsedSimpleSelector.isScope && scopeElement != null && element !== scopeElement) {
    return false;
  }
  if (parsedSimpleSelector.tagName != null && parsedSimpleSelector.tagName !== '*') {
    if (element.localName?.toLowerCase() !== parsedSimpleSelector.tagName) {
      return false;
    }
  }
  for (const attributeSelector of parsedSimpleSelector.attributes) {
    if (!element.hasAttribute(attributeSelector.name)) {
      return false;
    }
    if (
      attributeSelector.value != null &&
      element.getAttribute(attributeSelector.name) !== attributeSelector.value
    ) {
      return false;
    }
  }
  if (
    parsedSimpleSelector.notTags.length > 0 &&
    parsedSimpleSelector.notTags.includes((element.localName ?? '').toLowerCase())
  ) {
    return false;
  }
  return true;
};

const resolveInitialCandidates = (contextNode, firstStep) => {
  if (firstStep.isScope) {
    if (isElement(contextNode)) {
      return [contextNode];
    }
    if (contextNode?.documentElement != null) {
      return [contextNode.documentElement];
    }
    return [];
  }
  if (isElement(contextNode)) {
    return walkElements(contextNode).slice(1);
  }
  return walkElements(contextNode);
};

const evaluateSelector = (contextNode, parsedSelector) => {
  const [firstStep, ...remainingSteps] = parsedSelector.steps;
  const initialCandidates = resolveInitialCandidates(contextNode, firstStep);
  const scopeElement = isElement(contextNode)
    ? contextNode
    : contextNode?.documentElement ?? null;

  let current = initialCandidates.filter((element) =>
    matchesSimpleSelector(element, firstStep, scopeElement)
  );

  for (const step of remainingSteps) {
    const next = [];
    for (const parent of current) {
      const children = getElementChildren(parent);
      for (const child of children) {
        if (matchesSimpleSelector(child, step, scopeElement)) {
          next.push(child);
        }
      }
    }
    current = next;
  }

  return current;
};

const compareDocumentOrder = (contextNode, left, right) => {
  const all = walkElements(
    isElement(contextNode) ? contextNode.ownerDocument ?? contextNode : contextNode
  );
  const order = new Map(all.map((element, index) => [element, index]));
  return (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER);
};

const querySelectorAllFromContext = (contextNode, selectorText) => {
  const parsedSelectors = parseSelectorList(selectorText);
  const results = [];
  const seen = new Set();

  for (const parsedSelector of parsedSelectors) {
    const matched = evaluateSelector(contextNode, parsedSelector);
    for (const element of matched) {
      if (!seen.has(element)) {
        seen.add(element);
        results.push(element);
      }
    }
  }

  results.sort((left, right) => compareDocumentOrder(contextNode, left, right));
  return results;
};

const querySelectorFromContext = (contextNode, selectorText) => {
  const all = querySelectorAllFromContext(contextNode, selectorText);
  return all.length > 0 ? all[0] : null;
};

const matchesSelector = (element, selectorText) => {
  const parentContext = element.parentElement ?? element.ownerDocument;
  if (parentContext == null) {
    return false;
  }
  return querySelectorAllFromContext(parentContext, selectorText).includes(element);
};

const defineMethod = (target, methodName, implementation) => {
  Object.defineProperty(target, methodName, {
    configurable: true,
    writable: true,
    value: implementation,
  });
};

const installSlimdomSelectorAdapter = ({ ElementClass, DocumentClass }) => {
  if (ElementClass?.prototype == null || DocumentClass?.prototype == null) {
    throw new Error('installSlimdomSelectorAdapter requires Element and Document constructors');
  }

  if (ElementClass.prototype[ADAPTER_SYMBOL] === true) {
    return () => {};
  }

  const previousDescriptors = new Map();
  const remember = (target, name) => {
    previousDescriptors.set(
      `${target === ElementClass.prototype ? 'Element' : 'Document'}:${name}`,
      Object.getOwnPropertyDescriptor(target, name) ?? null
    );
  };

  remember(ElementClass.prototype, 'querySelectorAll');
  remember(ElementClass.prototype, 'querySelector');
  remember(ElementClass.prototype, 'matches');
  remember(DocumentClass.prototype, 'querySelectorAll');
  remember(DocumentClass.prototype, 'querySelector');

  defineMethod(ElementClass.prototype, 'querySelectorAll', function querySelectorAll(selectorText) {
    return querySelectorAllFromContext(this, selectorText);
  });
  defineMethod(ElementClass.prototype, 'querySelector', function querySelector(selectorText) {
    return querySelectorFromContext(this, selectorText);
  });
  defineMethod(ElementClass.prototype, 'matches', function matches(selectorText) {
    return matchesSelector(this, selectorText);
  });
  defineMethod(DocumentClass.prototype, 'querySelectorAll', function querySelectorAll(selectorText) {
    return querySelectorAllFromContext(this, selectorText);
  });
  defineMethod(DocumentClass.prototype, 'querySelector', function querySelector(selectorText) {
    return querySelectorFromContext(this, selectorText);
  });

  Object.defineProperty(ElementClass.prototype, ADAPTER_SYMBOL, {
    configurable: true,
    writable: true,
    value: true,
  });

  return () => {
    const restore = (target, methodName) => {
      const key = `${target === ElementClass.prototype ? 'Element' : 'Document'}:${methodName}`;
      const descriptor = previousDescriptors.get(key);
      if (descriptor == null) {
        delete target[methodName];
      } else {
        Object.defineProperty(target, methodName, descriptor);
      }
    };

    restore(ElementClass.prototype, 'querySelectorAll');
    restore(ElementClass.prototype, 'querySelector');
    restore(ElementClass.prototype, 'matches');
    restore(DocumentClass.prototype, 'querySelectorAll');
    restore(DocumentClass.prototype, 'querySelector');
    delete ElementClass.prototype[ADAPTER_SYMBOL];
  };
};

module.exports = {
  installSlimdomSelectorAdapter,
};
