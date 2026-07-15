// Dashboard model — pure functions (spec §4 rule). Phase 11 test: dashboard
// aggregates must match calcPL output for the same data, so this delegates all
// math to aggregate.ts and only assembles the view model.
import {
  calcPL,
  calcPLByProperty,
  thisYearRange,
  type PL,
  type PropertyPL,
} from './aggregate';
import { buildTimeline, type TimelineEntry } from './timeline';
import type { Expense, Income, Property } from '@/types';

/** How many recent transactions the dashboard shows. */
export const RECENT_COUNT = 5;

export interface DashboardModel {
  /** Portfolio P&L for the current calendar year. */
  yearPL: PL;
  /** This-year mini P&L per active (non-archived) property. */
  propertyCards: PropertyPL[];
  /** The five most recent transactions across all properties. */
  recent: TimelineEntry[];
}

export function buildDashboardModel(
  properties: Property[],
  expenses: Expense[],
  income: Income[],
  todayIso: string
): DashboardModel {
  const range = thisYearRange(todayIso);
  const activeProperties = properties.filter((p) => !p.is_archived);
  return {
    yearPL: calcPL(expenses, income, range),
    propertyCards: calcPLByProperty(activeProperties, expenses, income, range),
    recent: buildTimeline(expenses, income).slice(0, RECENT_COUNT),
  };
}
