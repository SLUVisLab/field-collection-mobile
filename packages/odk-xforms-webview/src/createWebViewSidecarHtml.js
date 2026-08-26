export const DEFAULT_SIDE_CAR_ENGINE_URL =
  'https://cdn.jsdelivr.net/npm/@getodk/xforms-engine@1.0.3/dist/index.js';

export const DEFAULT_BRIDGE_VERSION = 'odk-xforms-webview-bridge-v1';

export const createWebViewSidecarHtml = ({
  engineUrl = DEFAULT_SIDE_CAR_ENGINE_URL,
  bridgeVersion = DEFAULT_BRIDGE_VERSION,
} = {}) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>ODK Headless XForms Sidecar</title>
  </head>
  <body>
    <script type="module">
      const BRIDGE_VERSION = ${JSON.stringify(bridgeVersion)};
      const ENGINE_URL = ${JSON.stringify(engineUrl)};

      const state = {
        loadForm: null,
        currentLoadResult: null,
        currentInstance: null,
        root: null,
        initialized: false,
        latestSnapshot: null,
        cryptoPatched: false,
      };

      const stableStringify = (value) => {
        const normalize = (input) => {
          if (Array.isArray(input)) {
            return input.map((item) => normalize(item));
          }
          if (input != null && typeof input === "object") {
            const keys = Object.keys(input).sort();
            const output = {};
            for (const key of keys) {
              output[key] = normalize(input[key]);
            }
            return output;
          }
          return input;
        };
        return JSON.stringify(normalize(value));
      };

      const postMessage = (message) => {
        const transport = globalThis.ReactNativeWebView;
        if (transport == null || typeof transport.postMessage !== "function") {
          return;
        }
        transport.postMessage(stableStringify(message));
      };

      const toError = (error) => {
        const resolved = error instanceof Error ? error : new Error(String(error));
        return {
          name: resolved.name,
          message: resolved.message,
          stack: resolved.stack ?? null,
        };
      };

      const serializeValue = (value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        if (Array.isArray(value)) {
          return value.map((item) => serializeValue(item));
        }
        if (
          value == null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return value;
        }
        return String(value);
      };

      const serializeChoices = (choicesLike) => {
        if (!Array.isArray(choicesLike)) {
          return [];
        }
        return choicesLike.map((choice) => {
          if (choice == null || typeof choice !== "object") {
            return {
              label: serializeValue(choice),
              value: serializeValue(choice),
            };
          }
          const label = choice.label?.asString ?? choice.currentState?.label?.asString ?? choice.name ?? null;
          const value = choice.value ?? choice.currentState?.value ?? choice.name ?? null;
          return {
            label: serializeValue(label),
            value: serializeValue(value),
          };
        });
      };

      const flattenNodes = (rootNode) => {
        const nodes = [];
        const visit = (node) => {
          nodes.push(node);
          const children = node.currentState?.children;
          if (Array.isArray(children)) {
            for (const child of children) {
              visit(child);
            }
          }
        };
        visit(rootNode);
        return nodes;
      };

      const findByReference = (rootNode, reference) => {
        return flattenNodes(rootNode).find((node) => node.currentState?.reference === reference) ?? null;
      };

      const getConstraintValid = (node) => {
        const validationState = node?.validationState;
        if (validationState != null && typeof validationState === "object" && "constraint" in validationState) {
          return validationState.constraint?.valid ?? null;
        }
        return null;
      };

      const buildSnapshot = (rootNode) => {
        const nodesByReference = {};
        const allNodes = flattenNodes(rootNode);
        for (const node of allNodes) {
          const reference = node.currentState?.reference;
          if (typeof reference !== "string") {
            continue;
          }
          nodesByReference[reference] = {
            reference,
            value: serializeValue(node.currentState?.value ?? null),
            valueType: typeof node.valueType === "string" ? node.valueType : null,
            instanceValue:
              typeof node.currentState?.instanceValue === "string" ? node.currentState.instanceValue : null,
            relevant: node.currentState?.relevant ?? null,
            required: node.currentState?.required ?? null,
            readonly: node.currentState?.readonly ?? null,
            choices: serializeChoices(node.currentState?.valueOptions),
            constraintValid: getConstraintValid(node),
          };
        }
        return {
          generatedAt: new Date().toISOString(),
          nodeCount: Object.keys(nodesByReference).length,
          nodesByReference,
        };
      };

      const diffSnapshots = (before, after) => {
        const changed = [];
        const references = new Set([
          ...Object.keys(before?.nodesByReference ?? {}),
          ...Object.keys(after?.nodesByReference ?? {}),
        ]);
        for (const reference of references) {
          const beforeValue = before?.nodesByReference?.[reference] ?? null;
          const afterValue = after?.nodesByReference?.[reference] ?? null;
          if (stableStringify(beforeValue) !== stableStringify(afterValue)) {
            changed.push(reference);
          }
        }
        return changed;
      };

      const emitEvent = (type, payload) => {
        postMessage({
          type: "event",
          eventType: type,
          payload,
          emittedAt: Date.now(),
        });
      };

      const ensureInitialized = async () => {
        if (state.initialized) {
          return {
            webAssemblyAvailable: typeof WebAssembly !== "undefined",
            engineUrl: ENGINE_URL,
            cryptoPatched: state.cryptoPatched,
          };
        }
        const ensureRandomUUID = () => {
          const cryptoObject = globalThis.crypto;
          if (typeof cryptoObject !== "object" || cryptoObject == null) {
            return false;
          }
          if (typeof cryptoObject.randomUUID === "function") {
            return true;
          }
          if (typeof cryptoObject.getRandomValues !== "function") {
            return false;
          }
          cryptoObject.randomUUID = () => {
            const bytes = new Uint8Array(16);
            cryptoObject.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
            return [
              hex.slice(0, 8),
              hex.slice(8, 12),
              hex.slice(12, 16),
              hex.slice(16, 20),
              hex.slice(20)
            ].join("-");
          };
          state.cryptoPatched = true;
          return true;
        };
        const hasCryptoUUID = ensureRandomUUID();
        const engineModule = await import(ENGINE_URL);
        if (typeof engineModule.loadForm !== "function") {
          throw new Error("Engine module loaded but loadForm export was not found");
        }
        state.loadForm = engineModule.loadForm;
        state.initialized = true;
        return {
          webAssemblyAvailable: typeof WebAssembly !== "undefined",
          hasCryptoUUID,
          engineUrl: ENGINE_URL,
          cryptoPatched: state.cryptoPatched,
          exportedKeys: Object.keys(engineModule).sort(),
        };
      };

      const setNodeValue = (node, value) => {
        if (node == null) {
          throw new Error("Node not found");
        }
        if (typeof node.selectValues === "function" && Array.isArray(value)) {
          node.selectValues(value.map((item) => String(item)));
          return;
        }
        if (typeof node.selectValue === "function") {
          node.selectValue(value == null ? null : String(value));
          return;
        }
        if (typeof node.setValue !== "function") {
          throw new Error("Node does not support setValue/selectValue");
        }
        if (value == null) {
          node.setValue("");
        } else if (typeof value === "string") {
          node.setValue(value);
        } else if (typeof value === "number" || typeof value === "boolean") {
          node.setValue(String(value));
        } else {
          node.setValue(JSON.stringify(value));
        }
      };

      const handlers = {
        async initialize() {
          return ensureInitialized();
        },
        async loadForm(payload) {
          await ensureInitialized();
          const xml = payload?.xml;
          if (typeof xml !== "string" || xml.trim().length === 0) {
            throw new Error("loadForm requires non-empty xml string payload");
          }
          const loadResult = await state.loadForm(xml);
          if (loadResult.status === "failure") {
            const failure = loadResult.error;
            if (failure instanceof Error) {
              throw failure;
            }
            throw new Error(
              typeof failure?.message === "string" && failure.message.length > 0
                ? failure.message
                : "loadForm returned failure"
            );
          }
          const instance = await loadResult.createInstance();
          state.currentLoadResult = loadResult;
          state.currentInstance = instance;
          state.root = instance.root;
          const snapshot = buildSnapshot(state.root);
          state.latestSnapshot = snapshot;
          return {
            loadStatus: loadResult.status,
            snapshot,
          };
        },
        async getSnapshot() {
          if (state.root == null) {
            throw new Error("No form loaded");
          }
          const snapshot = buildSnapshot(state.root);
          state.latestSnapshot = snapshot;
          return snapshot;
        },
        async setValue(payload) {
          if (state.root == null) {
            throw new Error("No form loaded");
          }
          const nodeId = payload?.nodeId;
          if (typeof nodeId !== "string" || nodeId.length === 0) {
            throw new Error("setValue requires payload.nodeId");
          }
          const before = state.latestSnapshot ?? buildSnapshot(state.root);
          const node = findByReference(state.root, nodeId);
          setNodeValue(node, payload?.value ?? null);
          const after = buildSnapshot(state.root);
          state.latestSnapshot = after;
          const changed = diffSnapshots(before, after);
          emitEvent("stateChanged", {
            changed,
            changedCount: changed.length,
          });
          return {
            changed,
            snapshot: after,
          };
        },
        async addRepeat(payload) {
          if (state.root == null) {
            throw new Error("No form loaded");
          }
          const repeatId = payload?.repeatId;
          if (typeof repeatId !== "string" || repeatId.length === 0) {
            throw new Error("addRepeat requires payload.repeatId");
          }
          const repeatNode = findByReference(state.root, repeatId);
          if (repeatNode == null) {
            throw new Error("Repeat node not found");
          }
          if (typeof repeatNode.addInstances === "function") {
            repeatNode.addInstances();
          } else if (typeof repeatNode.addInstance === "function") {
            repeatNode.addInstance();
          } else {
            throw new Error("Repeat node does not support addInstances");
          }
          const snapshot = buildSnapshot(state.root);
          state.latestSnapshot = snapshot;
          return { snapshot };
        },
        async removeRepeat(payload) {
          if (state.root == null) {
            throw new Error("No form loaded");
          }
          const repeatId = payload?.repeatId;
          const instanceId = payload?.instanceId ?? null;
          if (typeof repeatId !== "string" || repeatId.length === 0) {
            throw new Error("removeRepeat requires payload.repeatId");
          }
          const repeatNode = findByReference(state.root, repeatId);
          if (repeatNode == null) {
            throw new Error("Repeat node not found");
          }
          if (typeof repeatNode.removeInstances === "function") {
            const fallbackIndex = Math.max((repeatNode.currentState?.children?.length ?? 1) - 1, 0);
            repeatNode.removeInstances(instanceId == null ? fallbackIndex : instanceId, 1);
          } else if (typeof repeatNode.removeInstance === "function") {
            repeatNode.removeInstance(instanceId ?? 0);
          } else {
            throw new Error("Repeat node does not support removeInstances");
          }
          const snapshot = buildSnapshot(state.root);
          state.latestSnapshot = snapshot;
          return { snapshot };
        },
        async serialize() {
          if (state.root == null) {
            throw new Error("No form loaded");
          }
          const payload = await state.root.prepareInstancePayload();
          const instanceFile = payload.data[0].get("xml_submission_file");
          const xml = await instanceFile.text();
          return {
            status: payload.status,
            violationCount: payload.violations == null ? 0 : payload.violations.length,
            xml,
          };
        },
        async inspectMediaSeam() {
          if (state.root == null) {
            throw new Error("No form loaded");
          }
          const binaryLikeReferences = flattenNodes(state.root)
            .filter((node) => {
              const valueType = node.currentState?.valueType;
              return typeof valueType === "string" && /image|audio|video|file|binary/i.test(valueType);
            })
            .map((node) => node.currentState.reference)
            .filter(Boolean);
          return {
            binaryLikeReferences,
            note:
              "XForms state in this sidecar is text/value oriented. Native app can keep file bytes and send only filename/reference strings to XForms nodes.",
            example: {
              field: "flower_photo",
              valueStoredInForm: "IMG_1234.jpg",
            },
          };
        },
        async dispose() {
          state.currentLoadResult = null;
          state.currentInstance = null;
          state.root = null;
          state.latestSnapshot = null;
          return { disposed: true };
        },
      };

      const handleRequest = async (request) => {
        const startedAt = Date.now();
        const requestId = request?.id ?? null;
        const requestType = request?.type;
        try {
          if (typeof requestType !== "string" || requestType.length === 0) {
            throw new Error("Request type is required");
          }
          const handler = handlers[requestType];
          if (typeof handler !== "function") {
            throw new Error("Unsupported request type: " + requestType);
          }
          const payload = await handler(request.payload ?? null);
          postMessage({
            id: requestId,
            type: "response",
            ok: true,
            requestType,
            payload,
            startedAt,
            finishedAt: Date.now(),
            latencyMs: Date.now() - startedAt,
          });
        } catch (error) {
          postMessage({
            id: requestId,
            type: "response",
            ok: false,
            requestType: requestType ?? null,
            error: toError(error),
            startedAt,
            finishedAt: Date.now(),
            latencyMs: Date.now() - startedAt,
          });
        }
      };

      globalThis.__xformsSidecarReceive = (request) => {
        Promise.resolve().then(() => handleRequest(request));
      };

      globalThis.addEventListener("unhandledrejection", (event) => {
        postMessage({
          type: "event",
          eventType: "log",
          payload: {
            level: "error",
            source: "unhandledrejection",
            error: toError(event.reason),
          },
          emittedAt: Date.now(),
        });
      });

      postMessage({
        type: "ready",
        payload: {
          bridgeVersion: BRIDGE_VERSION,
          webAssemblyAvailable: typeof WebAssembly !== "undefined",
          hasCryptoObject: typeof globalThis.crypto === "object" && globalThis.crypto != null,
          hasCryptoRandomUUID: typeof globalThis.crypto?.randomUUID === "function",
          hasCryptoGetRandomValues: typeof globalThis.crypto?.getRandomValues === "function",
          userAgent: navigator.userAgent,
        },
        emittedAt: Date.now(),
      });
    </script>
  </body>
</html>`;
