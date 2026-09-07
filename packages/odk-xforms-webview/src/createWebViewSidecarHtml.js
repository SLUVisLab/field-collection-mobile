import { WEBVIEW_ENGINE_MODULE_URL } from '@getodk/xforms-engine/webview';

export const DEFAULT_SIDE_CAR_ENGINE_URL = WEBVIEW_ENGINE_MODULE_URL;

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
        resolveEntityEffects: null,
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

      // Read an engine TextRange (label/hint/item-label) as a plain string.
      // The engine owns the text: language resolution, output substitution and
      // itext lookups have already happened. We only project .asString.
      const textRangeToString = (textRange) => {
        if (textRange == null) {
          return null;
        }
        const asString = textRange.asString;
        return typeof asString === "string" ? asString : null;
      };

      const jrUrlToString = (jrUrl) => {
        if (jrUrl == null) {
          return null;
        }
        if (typeof jrUrl === "string") {
          return jrUrl;
        }
        if (typeof jrUrl.href === "string") {
          return jrUrl.href;
        }
        const asString = String(jrUrl);
        return asString.length > 0 ? asString : null;
      };

      const textRangeMedia = (textRange) => {
        if (textRange == null) {
          return null;
        }
        const image = jrUrlToString(textRange.imageSource);
        const audio = jrUrlToString(textRange.audioSource);
        const video = jrUrlToString(textRange.videoSource);
        if (image == null && audio == null && video == null) {
          return null;
        }
        return { image, audio, video };
      };

      // Project the engine's parsed appearance token list (a set-like,
      // iterable TokenList) into an ordered array of strings. We never parse the
      // appearance attribute ourselves — this reads what the engine produced.
      const readAppearances = (node) => {
        const appearances = node?.appearances;
        if (appearances == null) {
          return [];
        }
        try {
          if (typeof appearances[Symbol.iterator] === "function") {
            return Array.from(appearances, (token) => String(token));
          }
        } catch (error) {
          // fall through to record-shaped handling
        }
        if (typeof appearances === "object") {
          return Object.keys(appearances).filter((key) => appearances[key] === true);
        }
        return [];
      };

      // Gather's own XForm extension namespace. Metadata that XForms has no
      // concept of — which resource supplies a composition, where an output
      // lands, whether a working asset survives — rides namespaced body/bind
      // attributes, the mechanism XLSForm provides for exactly this and the
      // engine's own Entity support already uses for entities:saveto.
      //
      // It has to be read HERE: the engine definition is a live object graph
      // and cannot cross the RPC seam, so the render model carries the resolved
      // strings instead. See docs/composition-binding-reassessment.md.
      const GATHER_NAMESPACE_URI = "http://gather.slu.edu/xforms";

      const attributeNS = (element, localName) => {
        if (element == null || typeof element.getAttributeNS !== "function") {
          return null;
        }
        const value = element.getAttributeNS(GATHER_NAMESPACE_URI, localName);
        return typeof value === "string" && value.length > 0 ? value : null;
      };

      const readGatherAttributes = (node) => {
        const definition = node?.definition ?? null;
        const bodyElement = definition?.bodyElement?.element ?? null;
        const bindElement = definition?.bind?.bindElement ?? null;
        return {
          composition: attributeNS(bodyElement, "composition"),
          output: attributeNS(bindElement, "output"),
          retention: attributeNS(bindElement, "retention"),
        };
      };

      // Build the engine-derived, ordered render model. The node array is in
      // engine document order (depth-first pre-order); depth + parentReference
      // convey the structural sequence/hierarchy. This preserves engine
      // authority: every field is read from the live node objects, not parsed
      // from the XForm definition into an app schema.
      const buildRenderModel = (rootNode) => {
        const nodes = [];
        const visit = (node, depth, parentReference) => {
          const currentState = node.currentState ?? {};
          const reference = typeof currentState.reference === "string" ? currentState.reference : null;
          const children = Array.isArray(currentState.children) ? currentState.children : null;
          const label = currentState.label ?? null;
          nodes.push({
            nodeId: typeof node.nodeId === "string" ? node.nodeId : String(node.nodeId ?? ""),
            reference,
            nodeType: typeof node.nodeType === "string" ? node.nodeType : null,
            label: textRangeToString(label),
            hint: textRangeToString(currentState.hint ?? null),
            labelMedia: textRangeMedia(label),
            appearances: readAppearances(node),
            // A bound model node with no presentation control is NOT a binding
            // destination: the XForms spec allows it, and another ODK client
            // could neither see nor fill it. Composition binding filters on
            // this, so the cross-client degradation guarantee is structural.
            bodyBacked: node?.definition?.bodyElement != null,
            gather: readGatherAttributes(node),
            selectType: typeof node.selectType === "string" ? node.selectType : null,
            valueType: typeof node.valueType === "string" ? node.valueType : null,
            mediaType: typeof node.nodeOptions?.media?.type === "string" ? node.nodeOptions.media.type : null,
            mediaAccept: typeof node.nodeOptions?.media?.accept === "string" ? node.nodeOptions.media.accept : null,
            choices: serializeChoices(currentState.valueOptions),
            readonly: currentState.readonly ?? null,
            required: currentState.required ?? null,
            depth,
            parentReference,
            childCount: children == null ? null : children.length,
          });
          if (children != null) {
            for (const child of children) {
              visit(child, depth + 1, reference);
            }
          }
        };
        visit(rootNode, 0, null);
        const languagesSource = rootNode.languages;
        const languages = Array.isArray(languagesSource)
          ? languagesSource
              .map((language) =>
                typeof language === "string" ? language : language?.language ?? null
              )
              .filter((language) => typeof language === "string")
          : [];
        const activeLanguageSource = rootNode.currentState?.activeLanguage ?? null;
        const activeLanguage =
          activeLanguageSource == null
            ? null
            : typeof activeLanguageSource === "string"
              ? activeLanguageSource
              : activeLanguageSource.language ?? null;
        return {
          generatedAt: new Date().toISOString(),
          activeLanguage,
          languages,
          nodeCount: nodes.length,
          nodes,
        };
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
        if (typeof engineModule.resolveEntityEffects !== "function") {
          throw new Error("Engine module loaded but resolveEntityEffects export was not found");
        }
        state.loadForm = engineModule.loadForm;
        state.resolveEntityEffects = engineModule.resolveEntityEffects;
        state.initialized = true;
        return {
          webAssemblyAvailable: typeof WebAssembly !== "undefined",
          hasCryptoUUID,
          engineUrl: ENGINE_URL.startsWith("data:") ? "embedded:@getodk/xforms-engine@1.0.3-gather.1" : ENGINE_URL,
          cryptoPatched: state.cryptoPatched,
          exportedKeys: Object.keys(engineModule).sort(),
        };
      };

      const setNodeValue = (node, value) => {
        if (node == null) {
          throw new Error("Node not found");
        }
        if (node.nodeType === "upload") {
          if (value == null || value === "") {
            node.setValue(null);
            return;
          }
          if (
            typeof value !== "string" ||
            !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ||
            typeof File !== "function"
          ) {
            throw new Error("Upload values must be a safe filename");
          }
          // The native app owns the durable Expo File. The sidecar only needs a
          // same-named web File to let the engine validate and serialize its XML
          // filename; the app passes the native file body to OpenRosa separately.
          node.setValue(new File([], value, { type: "application/octet-stream" }));
          return;
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

      const base64ToBytes = (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      };

      // Generic external-resource seam. The stock engine calls
      // fetchFormAttachment(url) for each jr: URL a form references (e.g.
      // jr://file-csv/plants.csv, jr://images/logo.png). We resolve it from an
      // in-memory map keyed by filename (the jr: URL's trailing segment) and
      // return a standard Response. This is deliberately generic — any CSV
      // (including an Entity List), media, or other external form resource works;
      // there is no Entity-specific logic here.
      const buildLoadFormOptions = (attachments) => {
        if (!Array.isArray(attachments) || attachments.length === 0) {
          return undefined;
        }
        const byFilename = new Map();
        for (const attachment of attachments) {
          if (attachment && typeof attachment.filename === "string") {
            byFilename.set(attachment.filename, attachment);
          }
        }
        const fetchFormAttachment = async (resourceUrl) => {
          const href =
            typeof resourceUrl === "string"
              ? resourceUrl
              : resourceUrl?.href ?? String(resourceUrl);
          const filename = decodeURIComponent(href.split("/").pop() ?? "");
          const found = byFilename.get(filename);
          if (found == null) {
            return new Response(null, { status: 404, statusText: "Not Found" });
          }
          const contentType = found.contentType ?? "application/octet-stream";
          if (typeof found.text === "string") {
            return new Response(found.text, {
              status: 200,
              headers: { "content-type": contentType },
            });
          }
          if (typeof found.base64 === "string") {
            return new Response(base64ToBytes(found.base64), {
              status: 200,
              headers: { "content-type": contentType },
            });
          }
          return new Response(null, { status: 404, statusText: "Empty attachment" });
        };
        return { fetchFormAttachment };
      };

      // The engine's INSTANCE_FILE_NAME constant. A serialized instance is
      // restored by handing the engine an InstanceData (a FormData) whose
      // xml_submission_file entry is the previously serialized primary-instance
      // XML — the same shape serialize() reads out of prepareInstancePayload().
      const INSTANCE_FILE_NAME = "xml_submission_file";
      const INSTANCE_FILE_TYPE = "text/xml";

      const buildInstanceData = (instanceXml) => {
        if (typeof instanceXml !== "string" || instanceXml.trim().length === 0) {
          throw new Error("loadInstance requires a non-empty instanceXml string payload");
        }
        if (typeof FormData !== "function" || typeof File !== "function") {
          throw new Error("Environment lacks FormData/File required to restore an instance");
        }
        const formData = new FormData();
        const file = new File([instanceXml], INSTANCE_FILE_NAME, { type: INSTANCE_FILE_TYPE });
        formData.set(INSTANCE_FILE_NAME, file);
        return formData;
      };

      const assertInstantiable = (loadResult) => {
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
          const options = buildLoadFormOptions(payload?.attachments);
          const loadResult = await state.loadForm(xml, options);
          assertInstantiable(loadResult);
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
        // Restore a previously serialized instance via the engine's
        // restoreInstance entrypoint (an odk-instance-load / "subsequent load").
        // This is the correct way to reopen saved answers — NOT replaying
        // setValue calls, which would re-run first-load computations and cannot
        // faithfully reproduce engine-managed state.
        async loadInstance(payload) {
          await ensureInitialized();
          const xml = payload?.xml;
          if (typeof xml !== "string" || xml.trim().length === 0) {
            throw new Error("loadInstance requires non-empty xml string payload");
          }
          const instanceData = buildInstanceData(payload?.instanceXml);
          const options = buildLoadFormOptions(payload?.attachments);
          const loadResult = await state.loadForm(xml, options);
          assertInstantiable(loadResult);
          if (typeof loadResult.restoreInstance !== "function") {
            throw new Error("Engine loadResult does not support restoreInstance");
          }
          const instance = await loadResult.restoreInstance({ data: [instanceData] });
          state.currentLoadResult = loadResult;
          state.currentInstance = instance;
          state.root = instance.root;
          const snapshot = buildSnapshot(state.root);
          state.latestSnapshot = snapshot;
          return {
            loadStatus: loadResult.status,
            mode: typeof instance.mode === "string" ? instance.mode : "restore",
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
        async getRenderModel() {
          if (state.root == null) {
            throw new Error("No form loaded");
          }
          return buildRenderModel(state.root);
        },
        async getEntityEffects() {
          if (state.root == null || state.resolveEntityEffects == null) {
            throw new Error("No form loaded");
          }
          return state.resolveEntityEffects(state.root);
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
          state.resolveEntityEffects = null;
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
