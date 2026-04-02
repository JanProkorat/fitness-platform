import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useAuthStore } from '../stores/auth';

const API_BASE_URL = __DEV__
  ? 'http://localhost:5000'
  : 'https://api.gfplatform.com';

let connection: HubConnection | null = null;

export function getConnection(): HubConnection {
  if (connection) return connection;

  connection = new HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/notifications`, {
      accessTokenFactory: () => {
        const token = useAuthStore.getState().accessToken;
        return token ?? '';
      },
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();

  return connection;
}

export async function connect(): Promise<void> {
  const conn = getConnection();
  if (conn.state === 'Disconnected') {
    await conn.start();
  }
}

export async function disconnect(): Promise<void> {
  if (connection && connection.state !== 'Disconnected') {
    await connection.stop();
  }
}

export function onEvent(eventType: string, callback: (payload: unknown) => void): () => void {
  const conn = getConnection();
  conn.on(eventType, callback);
  return () => conn.off(eventType, callback);
}
