// First-run gate. Pure so the dashboard's redirect effect can be tested without
// react-query. An empty list only counts once the fetch has settled: a stale
// cached [] that is being refetched must not bounce the user back to the chooser.
import type { Property } from '@/types';

export function shouldOnboard(properties: Property[] | undefined, isFetching: boolean): boolean {
  return properties !== undefined && properties.length === 0 && !isFetching;
}
