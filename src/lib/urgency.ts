/**
 * SYGMA HOUSE — Urgency Scoring Module
 */

export type Timeline = 'asap' | '1_2_weeks' | '1_month' | '3_months' | 'exploring';
export type Location = 'home' | 'hospital' | 'rehab' | 'facility' | 'other';
export type PaymentType = 'private_pay' | 'medicaid_waiver' | 'unsure';

export function calculateUrgency(
  timeline: Timeline,
  location: Location,
  payment: PaymentType
): number {
  const timelineScore: Record<Timeline, number> = {
    asap: 5,
    '1_2_weeks': 4,
    '1_month': 3,
    '3_months': 2,
    exploring: 1,
  };
  let score = timelineScore[timeline] ?? 1;
  if (location === 'hospital') score = Math.min(5, score + 2);
  if (location === 'rehab') score = Math.min(5, score + 1);
  if (payment === 'private_pay') score = Math.min(5, score + 1);
  return score;
}

export function urgencyLabel(score: number): { label: string; level: 'high' | 'medium' | 'low' } {
  if (score >= 4) return { label: 'Urgent', level: 'high' };
  if (score >= 2) return { label: 'Medium', level: 'medium' };
  return { label: 'Low', level: 'low' };
}
