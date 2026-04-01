import type { ParsedTransaction, SubmissionResponse } from './types';

export interface SubmitHistoryMessage {
  type: 'SUBMIT_HISTORY';
  steamId: string;
  transactions: ParsedTransaction[];
}

export interface SubmitHistoryResponse {
  success: boolean;
  data?: SubmissionResponse['data'];
  error?: string;
}

export interface SelfUninstallMessage {
  type: 'SELF_UNINSTALL';
}

export interface SelfUninstallResponse {
  success: boolean;
  fallback?: string;
}

export type ExtensionMessage = SubmitHistoryMessage | SelfUninstallMessage;
