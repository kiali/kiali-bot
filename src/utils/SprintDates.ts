import moment from 'moment';

// Last day of Kiali Sprint #14
const baseDate = moment('2018-11-30T21:00:00Z');

export function getCurrentSprintStartDate(): moment.Moment {
  const now = moment();
  const weeksFromBase = now.diff(baseDate, 'weeks');
  const sprintsFromBase = Math.trunc(weeksFromBase / 3.0);

  const startDate = baseDate.clone();
  startDate.add(sprintsFromBase * 3, 'weeks');

  return startDate;
}

export function getCurrentSprintEndDate(): moment.Moment {
  return getCurrentSprintStartDate().add(3, 'weeks');
}
