import {
  restoreDemoSession,
  toPersistedDemoSession,
  type DemoSession,
  type PersistedDemoSession,
} from "./App";

const inMemoryUploadSession = {
  screen: 4,
  mode: "upload",
  selectedTaskId: null,
  customPrompt: "",
  uploadedCode: "print('sensitive upload')\n",
  uploadMeta: null,
  selectedScans: ["injection"],
  selectedStrategies: ["vulnerability_specific_v1"],
  runId: "run_00000000000000000000000000000000",
  liveRequested: true,
} as const satisfies DemoSession;

const persistedSession = toPersistedDemoSession(inMemoryUploadSession);
const persistedContract: PersistedDemoSession = persistedSession;

const invalidPersistedSession: PersistedDemoSession = {
  ...persistedSession,
  // @ts-expect-error Uploaded source must never enter browser-persisted session state.
  uploadedCode: "print('sensitive upload')\n",
};

const legacySession = {
  ...persistedSession,
  uploadedCode: "print('legacy sensitive upload')\n",
};
const restoredSession = restoreDemoSession(legacySession);
const ignoredLegacySource: "" = restoredSession.uploadedCode;

void [persistedContract, invalidPersistedSession, ignoredLegacySource];
