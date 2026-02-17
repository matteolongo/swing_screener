# Troubleshooting

> **Status: Current.**  
> **Last Reviewed:** February 17, 2026.

## Common Issues

1. **API not running**
- Start: `python -m uvicorn api.main:app --port 8000 --reload`

2. **Web UI not loading**
- Start: `cd web-ui && npm run dev`

3. **File lock errors**
- Caused by concurrent writes to JSON files.
- Retry after a few seconds or stop other processes.

4. **Provider failures (yfinance/Alpaca)**
- Check network, API keys, and rate limits.

## More
- `api/README.md`
- `web-ui/README.md`
