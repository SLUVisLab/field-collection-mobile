import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

// Basic calls into every first-party workspace package, exercised on-device to
// prove the Expo 57 shell builds, bundles and runs the packages in Hermes.
import {
  XFORMS_EVENT_TYPES,
  XFORMS_HOST_ERROR_CODES,
  XFormsHost,
  createXFormsHostError,
  isXFormsEvent,
} from 'odk-xforms-host';
import {
  DEFAULT_BRIDGE_VERSION,
  WebViewXFormsHost,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';
import {
  OdkCentralClient,
  ODK_CENTRAL_ERROR_CODES,
  codeForHttpStatus,
  createAppUserAuth,
  createEndpoints,
  normalizeConfig,
  parseFormList,
} from 'odk-central-client';
import { XFORMS_REACT_PHASES, XFormsProvider, useXForm } from 'odk-xforms-react';

const SAMPLE_FORMLIST = `<?xml version="1.0" encoding="UTF-8"?>
<xforms xmlns="http://openrosa.org/xforms/xformsList">
  <xform>
    <formID>smoke</formID><name>Smoke</name><version>1</version>
    <hash>md5:abc</hash><downloadUrl>https://example.org/smoke.xml</downloadUrl>
  </xform>
</xforms>`;

function runChecks() {
  const results = [];
  const check = (pkg, name, fn) => {
    try {
      const detail = fn();
      results.push({ pkg, name, ok: true, detail: String(detail ?? 'ok') });
    } catch (e) {
      results.push({ pkg, name, ok: false, detail: e && e.message ? e.message : String(e) });
    }
  };

  // --- odk-xforms-host ---
  check('odk-xforms-host', 'event types', () => {
    const n = Object.keys(XFORMS_EVENT_TYPES).length;
    if (n !== 3) throw new Error(`expected 3, got ${n}`);
    return `${n} types`;
  });
  check('odk-xforms-host', 'error factory', () => {
    const err = createXFormsHostError('boom');
    if (err.code !== XFORMS_HOST_ERROR_CODES.GENERIC) throw new Error(`bad code ${err.code}`);
    return err.code;
  });
  check('odk-xforms-host', 'isXFormsEvent', () => {
    if (!isXFormsEvent({ type: 'log', payload: 1 })) throw new Error('should be event');
    if (isXFormsEvent({})) throw new Error('should not be event');
    return 'true / false';
  });
  check('odk-xforms-host', 'abstract host guards', () => {
    const host = new XFormsHost();
    try {
      host.subscribe(() => {});
    } catch (e) {
      return e.code;
    }
    throw new Error('expected notImplemented throw');
  });

  // --- odk-xforms-webview ---
  check('odk-xforms-webview', 'sidecar html', () => {
    const html = createWebViewSidecarHtml();
    if (typeof html !== 'string' || !html.includes('<!doctype html>')) throw new Error('bad html');
    if (!html.includes(DEFAULT_BRIDGE_VERSION)) throw new Error('missing bridge version');
    return `${html.length} chars`;
  });
  check('odk-xforms-webview', 'host class', () => {
    if (typeof WebViewXFormsHost !== 'function') throw new Error('not a constructor');
    return 'constructor ok';
  });

  // --- odk-central-client ---
  check('odk-central-client', 'normalizeConfig', () => {
    const cfg = normalizeConfig({ baseUrl: 'https://example.org/', projectId: 1 });
    if (cfg.baseUrl !== 'https://example.org') throw new Error(cfg.baseUrl);
    return cfg.baseUrl;
  });
  check('odk-central-client', 'endpoints', () => {
    const cfg = normalizeConfig({ baseUrl: 'https://example.org', projectId: 7 });
    const url = createEndpoints(cfg).formList();
    if (!url.endsWith('/v1/projects/7/formList')) throw new Error(url);
    return '…/projects/7/formList';
  });
  check('odk-central-client', 'app-user auth', () => {
    const auth = createAppUserAuth('tok123');
    if (!auth || typeof auth !== 'object') throw new Error('no auth object');
    return 'auth object';
  });
  check('odk-central-client', 'parseFormList', () => {
    const forms = parseFormList(SAMPLE_FORMLIST);
    if (forms.length !== 1 || forms[0].formId !== 'smoke') throw new Error(JSON.stringify(forms));
    return `${forms.length} form (${forms[0].formId})`;
  });
  check('odk-central-client', 'client + http status', () => {
    // eslint-disable-next-line no-new
    new OdkCentralClient({
      baseUrl: 'https://example.org',
      projectId: 1,
      auth: createAppUserAuth('t'),
    });
    const code = codeForHttpStatus(404);
    if (code !== ODK_CENTRAL_ERROR_CODES.NOT_FOUND) throw new Error(code);
    return code;
  });

  // --- odk-xforms-react ---
  check('odk-xforms-react', 'exports', () => {
    if (typeof XFormsProvider !== 'function') throw new Error('no provider');
    if (typeof useXForm !== 'function') throw new Error('no hook');
    if (!XFORMS_REACT_PHASES) throw new Error('no phases');
    return 'provider + hook + phases';
  });

  return results;
}

export default function App() {
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const watchdog = setTimeout(() => {
      console.log('SHELL_SMOKE_HANG::' + JSON.stringify({ platform: Platform.OS }));
    }, 15000);
    try {
      const r = runChecks();
      setResults(r);
      const passed = r.filter((x) => x.ok).length;
      const failed = r.length - passed;
      const s = { platform: Platform.OS, total: r.length, passed, failed, ok: failed === 0 };
      setSummary(s);
      console.log('SHELL_SMOKE_RESULT::' + JSON.stringify({ ...s, results: r }));
    } catch (e) {
      console.log(
        'SHELL_SMOKE_CRASH::' +
          JSON.stringify({ platform: Platform.OS, error: e && e.message ? e.message : String(e) })
      );
    } finally {
      clearTimeout(watchdog);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gather</Text>
      <Text style={styles.subtitle}>Package smoke — {Platform.OS}</Text>
      {summary && (
        <Text style={[styles.badge, summary.ok ? styles.badgeOk : styles.badgeFail]}>
          {summary.ok ? 'PASS' : 'FAIL'} · {summary.passed}/{summary.total}
        </Text>
      )}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {results.map((r, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.mark, r.ok ? styles.ok : styles.fail]}>{r.ok ? '✓' : '✗'}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>
                {r.pkg} · {r.name}
              </Text>
              <Text style={styles.rowDetail}>{r.detail}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingTop: 64, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1b1b1f' },
  subtitle: { marginTop: 2, fontSize: 14, color: '#5a5a63' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  badgeOk: { backgroundColor: '#1a7f37' },
  badgeFail: { backgroundColor: '#cf222e' },
  scroll: { marginTop: 16, flex: 1 },
  scrollContent: { paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  mark: { width: 22, fontSize: 16, fontWeight: '700' },
  ok: { color: '#1a7f37' },
  fail: { color: '#cf222e' },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, color: '#1b1b1f' },
  rowDetail: { fontSize: 12, color: '#8a8a92' },
});
