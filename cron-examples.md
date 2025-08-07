# Vercel Cron Schedule Examples

## Current Schedule: Every 6 Hours
```json
"schedule": "0 */6 * * *"
```

## Common Alternatives:

### Every Hour
```json
"schedule": "0 * * * *"
```

### Every 12 Hours (Twice Daily)
```json
"schedule": "0 */12 * * *"
```

### Every Day at 2 AM
```json
"schedule": "0 2 * * *"
```

### Every Day at 9 AM and 6 PM
```json
"schedule": "0 9,18 * * *"
```

### Every Monday at 9 AM
```json
"schedule": "0 9 * * 1"
```

### Every 30 Minutes
```json
"schedule": "*/30 * * * *"
```

### Every 15 Minutes
```json
"schedule": "*/15 * * * *"
```

### Every 2 Hours
```json
"schedule": "0 */2 * * *"
```

### Every 4 Hours
```json
"schedule": "0 */4 * * *"
```

### Every 8 Hours
```json
"schedule": "0 */8 * * *"
```

## Cron Format: `minute hour day month day-of-week`

- `*` = every
- `*/n` = every n units
- `1,3,5` = specific values
- `1-5` = range

## Vercel Limitations:
- Minimum interval: 1 minute
- Maximum: No limit
- Free tier: 100 executions/day
- Pro tier: 1000 executions/day 