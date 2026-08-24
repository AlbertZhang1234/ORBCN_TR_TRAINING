import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface TravelEntryListRow extends Record<string, unknown> {
  travelid: string;
  userid?: string;
  projectid?: string;
  destination?: string;
  fromdate?: string;
  todate?: string;
}

export async function listTravelEntries(): Promise<TravelEntryListRow[]> {
  return selectRows<TravelEntryListRow>(TABLES.travelEntry, {
    orderBy: { column: 'travelid', ascending: true },
  });
}
