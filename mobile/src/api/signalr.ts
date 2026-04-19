import { HubConnectionBuilder, HubConnection, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuthStore } from '../stores/auth';

const API_BASE_URL = __DEV__
  ? 'http://localhost:5000'
  : 'https://api.gfplatform.com';

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
