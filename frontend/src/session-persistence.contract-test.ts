import {
  clearDemoSession,
  DEMO_SESSION_KEY,
  loadDemoSession,
  restoreDemoSession,
  saveDemoSession,
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

// Verify sessionStorage contract and privacy
const mockStorageMap = new Map<string, string>();
const mockStorage: Storage = {
  getItem: (key: string) => mockStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mockStorageMap.set(key, value);
  },
  removeItem: (key: string) => {
    mockStorageMap.delete(key);
  },
  clear: () => {
    mockStorageMap.clear();
  },
  key: (index: number) => Array.from(mockStorageMap.keys())[index] ?? null,
  get length() {
    return mockStorageMap.size;
  },
};

// 1. Fresh tab / after browser close: empty storage must load a clean initial session
const initialCleanSession = loadDemoSession(mockStorage);
if (
  initialCleanSession.screen !== 0 ||
  initialCleanSession.runId !== null ||
  initialCleanSession.liveRequested !== false
) {
  throw new Error("Clean session expected when session storage is empty.");
}

// 2. Saving an upload session must not persist sensitive code into session storage
saveDemoSession(inMemoryUploadSession, mockStorage);
const rawPersisted = mockStorage.getItem(DEMO_SESSION_KEY);
if (!rawPersisted || rawPersisted.includes("sensitive upload")) {
  throw new Error("Uploaded source must never enter browser storage.");
}

// 3. Restoring session must always have empty uploadedCode
const restoredFromStorage = loadDemoSession(mockStorage);
if (restoredFromStorage.uploadedCode !== "") {
  throw new Error("Restored uploadedCode must always be empty.");
}

// 4. Clearing session must remove the storage key
clearDemoSession(mockStorage);
if (mockStorage.getItem(DEMO_SESSION_KEY) !== null) {
  throw new Error("Session key was not cleared from storage.");
}

void [
  persistedContract,
  invalidPersistedSession,
  ignoredLegacySource,
  initialCleanSession,
  restoredFromStorage,
];
