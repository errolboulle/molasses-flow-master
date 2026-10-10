# Architecture rules

- Calculate the dashboard's cumulative outgoing stock with the pure `stock-out` helper, independently of monthly dam statistics, so its all-time scope remains testable.