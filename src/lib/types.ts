export interface ParsedTransaction {
  date: string;
  gameName: string;
  appId: number | null;
  type: string;
  currency: string;
  amount: number;
}

export interface SubmissionPayload {
  steam_id: string;
  transactions: Array<{
    date: string;
    game_name: string;
    app_id: number | null;
    type: string;
    currency: string;
    amount: number;
  }>;
  parser_version: string;
}

export interface SubmissionResponse {
  data: {
    records_saved: number;
    records_submitted: number;
    records_parsed: number;
    parse_errors: number;
    prices_recorded: number;
    date_range: {
      start: string | null;
      end: string | null;
    };
  };
}

export interface TokenData {
  token: string;
  expires_in: number;
  acquired_at: number;
}

export type ExtensionState = 'unlinked' | 'linked' | 'exporting' | 'done' | 'error';
