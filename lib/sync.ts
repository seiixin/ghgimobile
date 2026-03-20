/**
 * Offline sync: uploads pending drafts to the server when online.
 */
import * as Network from 'expo-network';
import api from './api';
import { getPendingDrafts, markSynced } from './db';

export async function syncPendingDrafts(): Promise<{ synced: number; failed: number }> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || !state.isInternetReachable) {
    return { synced: 0, failed: 0 };
  }

  const drafts = await getPendingDrafts();
  let synced = 0;
  let failed = 0;

  for (const draft of drafts) {
    try {
      await api.post('/submissions', draft.form_data);
      await markSynced(draft.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
