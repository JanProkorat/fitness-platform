import { HubConnectionBuilder, HubConnection, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuthStore } from '../stores/auth';

// `EXPO_PUBLIC_API_BASE_URL` lets QA dev builds point at the compose-exposed
// API without rebuilding — same precedence as client.ts.
// iOS NSURLSession strips the Authorization header on HTTP→HTTPS redirects, so
// dev MUST hit the HTTPS port directly.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (__DEV__
    ? 'https://localhost:5001'
    : 'https://api.gfplatform.com');

let connection: HubConnection | null = null;

// All event names the server may send — registered as no-ops at creation
// to suppress "No client method" warnings. Real handlers add via onEvent().
const KNOWN_EVENTS = [
  'newmessage',
  'invitationreceived',
  'invitationcancelled',
  'clientrequestaccepted',
  'clientrequestrejected',
  'personalrecordachieved',
  'questionnaireassigned',
  'nutritionplanpublished',
  'nutritionplanupdated',
  'trainingplanpublished',
  'typing',
  'userpresence',
  'conversationunarchived',
  // Weekly check-in: fires when client responds or trainer marks reviewed.
  // Payload: { id: string, respondedAt?: string, reviewedAt?: string, dismissedAt?: string }
  'weeklycheckinupdated',
  // Plan photo uploaded: fires when a PlanPhoto record is finalized.
  // Payload: { planId: string, photoId: string }
  'planphotouploaded',
  // Photo diary submitted: fires when a diary request transitions to Completed
  // (either via client submit OR the server-side auto-finalize scheduler on day N+1).
  // Payload: { diaryRequestId: string }
  'photodiarysubmitted',
  // Photo diary requested: fires on the client's connection when a trainer
  // creates a new diary request for them. The Today screen listens to this so
  // the pending banner appears without requiring a manual refresh.
  // Payload: { requestId: string, professionalName, professionalRole, durationDays, planId?, createdAt }
  'photodiaryrequested',
  // Sent to the trainer when the client accepts, dismisses, or uploads a
  // photo. Mobile is a client-only surface today, but registering no-ops
  // here keeps the connection warning-free if the server ever broadcasts to
  // the wrong group.
  'photodiaryaccepted',
  'photodiarydismissed',
  'photodiaryphotouploaded',
  // Session edit-lock state change: fires when a training session lock is
  // acquired or released (Stable→Editing→Live and back to Stable).
  // Payload: { planId: string, sessionId: string, state: 'Stable'|'Editing'|'Live', holder: 'Coach'|'Client' }
  'sessioneditlockchanged',
  // #548: questionnaire lifecycle events missing from KNOWN_EVENTS
  'questionnairecancelled',
  // #548: email verification realtime event
  'emailverified',
  // #548: training plan content update (distinct from trainingplanpublished)
  'trainingplanupdated',
  // Weekly check-in requested: fires on the client's connection when the
  // scheduler (or a trainer/nutritionist action) creates a new weekly
  // check-in for them. The Today screen listens to this so the pending
  // banner appears without requiring a manual refresh.
  // Payload: { weeklyCheckInId: string, profession: string, professionalName: string }
  'weeklycheckinrequested',
]

function createConnection(): HubConnection {
  const conn = new HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/notifications`, {
      accessTokenFactory: () => {
        const token = useAuthStore.getState().accessToken;
        return token ?? '';
      },
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();

  // Pre-register no-ops so SignalR doesn't warn before real handlers attach
  for (const event of KNOWN_EVENTS) {
    conn.on(event, () => {});
  }

  return conn;
}

export function getConnection(): HubConnection {
  if (!connection) {
    connection = createConnection();
  }
  return connection;
}

export async function connect(): Promise<void> {
  // If there's no auth token yet, don't attempt connection
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    console.log('[SignalR] No auth token, skipping connection');
    return;
  }

  let conn = getConnection();

  // If previous connection is in a broken state, recreate it
  if (conn.state !== HubConnectionState.Disconnected && conn.state !== HubConnectionState.Connected) {
    try { await conn.stop(); } catch { /* ignore */ }
    connection = null;
    conn = getConnection();
  }

  if (conn.state === HubConnectionState.Connected) return;

  try {
    await conn.start();
    console.log('[SignalR] Connected');
  } catch (err) {
    console.warn('[SignalR] Connection failed, retrying in 3s...', err);
    connection = null; // Reset so next attempt creates a fresh connection
    setTimeout(() => {
      connect().catch(() => {});
    }, 3000);
  }
}

export async function disconnect(): Promise<void> {
  if (connection) {
    try {
      await connection.stop();
    } catch { /* ignore */ }
    connection = null;
  }
}

export function onEvent(eventType: string, callback: (payload: unknown) => void): () => void {
  const conn = getConnection();
  const key = eventType.toLowerCase();
  conn.on(key, callback);
  return () => conn.off(key, callback);
}
