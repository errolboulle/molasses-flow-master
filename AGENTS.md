# Architecture rules

- Calculate the dashboard's cumulative outgoing stock with the pure `stock-out` helper, independently of monthly dam statistics, so its all-time scope remains testable.
- Calculate selectable per-dam periods through the pure `dam-period-totals` helper using the Johannesburg calendar and independent dam selections, so date boundaries and dam isolation remain testable.