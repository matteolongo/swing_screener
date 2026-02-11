# Troubleshooting Guide

Common issues and solutions for the Swing Screener system.

---

## API Errors

### 503 Service Temporarily Unavailable

**Symptom:**
```json
{
  "detail": "Resource temporarily unavailable - file lock timeout"
}
```

**Cause:**  
Another process is holding a lock on `positions.json` or `orders.json` for more than 5 seconds.

**Solutions:**
1. **Check for stuck processes:**
   ```bash
   # macOS/Linux
   lsof positions.json orders.json
   
   # Kill stuck process if found
   kill <PID>
   ```

2. **Check for CLI processes:**  
   If you have a CLI command running (especially during backtest or screener), it may be holding the lock.

3. **Wait and retry:**  
   The lock will be released when the other process finishes.

4. **Check file permissions:**
   ```bash
   ls -la positions.json orders.json
   # Should be readable/writable by current user
   ```

---

### 422 Unprocessable Entity (Validation Errors)

**Symptom:**
```json
{
  "detail": [
    {
      "loc": ["body", "entry_price"],
      "msg": "entry_price must be positive",
      "type": "value_error"
    }
  ]
}
```

**Common validation errors and fixes:**

#### **Price must be positive**
```json
{
  "entry_price": 150.0,  // ✅ Valid
  "entry_price": -10.0,  // ❌ Invalid
  "entry_price": 0.0     // ❌ Invalid
}
```

#### **Price must be finite**
```json
{
  "entry_price": 150.0,    // ✅ Valid
  "entry_price": Infinity, // ❌ Invalid (use a large number like 999999)
  "entry_price": NaN       // ❌ Invalid
}
```

#### **Price must be less than $1,000,000**
Protects against data entry errors.
```json
{
  "entry_price": 5000.0,    // ✅ Valid
  "entry_price": 2000000.0  // ❌ Invalid
}
```

#### **Ticker format**
```json
{
  "ticker": "AAPL",   // ✅ Valid (1-5 uppercase alphanumeric)
  "ticker": "aapl",   // ❌ Invalid (not uppercase)
  "ticker": "TOOLONG", // ❌ Invalid (> 5 characters)
  "ticker": "AA-BB"   // ❌ Invalid (hyphen not allowed)
}
```

**Fix:** Convert to uppercase before sending:
```javascript
ticker = ticker.toUpperCase();
```

#### **Quantity must be positive integer**
```json
{
  "quantity": 100,   // ✅ Valid
  "quantity": 0,     // ❌ Invalid
  "quantity": -50,   // ❌ Invalid
  "quantity": 10.5   // ❌ Invalid (not an integer)
}
```

#### **Risk percentage out of bounds**
```json
{
  "risk_pct": 0.01,   // ✅ Valid (1%)
  "risk_pct": 0.02,   // ✅ Valid (2%)
  "risk_pct": 0.15,   // ❌ Invalid (> 10%)
  "risk_pct": 0.0     // ❌ Invalid (must be > 0)
}
```

**Valid range:** 0.0001 to 0.10 (0.01% to 10%)

#### **Entry price must be greater than stop price (longs)**
```json
{
  "entry_price": 150.0,
  "stop_price": 145.0   // ✅ Valid (entry > stop)
}

{
  "entry_price": 150.0,
  "stop_price": 155.0   // ❌ Invalid (stop > entry for long)
}
```

#### **Trailing stop validation**
```json
// Current position: entry=100, stop=95
{
  "new_stop": 97.0  // ✅ Valid (97 > 95, trailing up)
}

{
  "new_stop": 94.0  // ❌ Invalid (94 < 95, can't trail down)
}

{
  "new_stop": 101.0  // ❌ Invalid (101 > entry, would trigger immediately)
}
```

**Rules:**
- New stop must be > old stop (trailing up only)
- New stop must be < entry price
- New stop must be <= current market price (checked against latest data)

---

### 400 Bad Request (Business Logic Errors)

**Symptom:**
```json
{
  "detail": "Position not found: AAPL"
}
```

**Common causes:**

#### **Position not found**
You're trying to update/close a position that doesn't exist in `positions.json`.

**Fix:**  
Check current positions:
```bash
curl http://localhost:8000/api/portfolio/positions
```

#### **Order not found**
```bash
curl http://localhost:8000/api/portfolio/orders
```

#### **Invalid order type / missing required fields**
For `LIMIT` orders, `limit_price` is required:
```json
{
  "order_type": "LIMIT",
  "limit_price": 149.50  // ✅ Required for LIMIT
}

{
  "order_type": "MARKET"  // ✅ limit_price not needed
}
```

---

### 500 Internal Server Error

**Symptom:**
```json
{
  "detail": "Internal server error"
}
```

**Cause:**  
Unexpected error in the API. Details are logged server-side.

**Solutions:**
1. **Check API logs:**  
   Look for stack traces in the server console or log files.

2. **Check data file integrity:**
   ```bash
   python -m json.tool positions.json  # Should parse without error
   python -m json.tool orders.json
   ```

   If invalid:
   ```bash
   # Backup corrupted file
   cp positions.json positions.json.backup
   
   # Reset to empty array
   echo "[]" > positions.json
   ```

3. **Check data directory:**
   ```bash
   ls -la data/
   # Ensure directory exists and is writable
   mkdir -p data
   ```

4. **Restart the API:**  
   Sometimes a fresh start resolves transient issues.

---

## Data Issues

### Corrupted positions.json or orders.json

**Symptom:**  
API fails to start or returns 500 errors on all position/order endpoints.

**Diagnosis:**
```bash
python -m json.tool positions.json
# Error: "Expecting value: line 1 column 1 (char 0)"
```

**Fix:**
```bash
# Option 1: Restore from backup (if available)
cp positions.json.backup positions.json

# Option 2: Reset to empty (loses all positions)
echo "[]" > positions.json
echo "[]" > orders.json
```

**Prevention:**  
The API now uses file locking to prevent corruption from concurrent writes.

---

### Market data not loading

**Symptom:**
```json
{
  "detail": "Failed to load market data for AAPL"
}
```

**Causes:**
1. **yfinance API is down**  
   Check https://finance.yahoo.com/ is accessible.

2. **Invalid ticker symbol**  
   Verify ticker exists: https://finance.yahoo.com/quote/AAPL

3. **Network issues**  
   Check internet connection.

4. **Rate limiting**  
   Too many requests to yfinance in short time.

**Solutions:**
1. **Retry after a few minutes**

2. **Check ticker symbol:**
   ```bash
   curl http://localhost:8000/api/screener/preview
   # See if universe loads correctly
   ```

3. **Check data cache:**
   ```bash
   ls -la data/
   # If cache exists, API should use it
   ```

---

## Web UI Issues

### "Failed to connect to API"

**Symptom:**  
Web UI shows connection error banner.

**Causes:**
1. **API not running**
2. **CORS configuration**
3. **Wrong API URL**

**Solutions:**

1. **Check API is running:**
   ```bash
   curl http://localhost:8000/health
   # Should return 200 OK
   ```

2. **Check CORS headers:**
   ```bash
   curl -i -X OPTIONS http://localhost:8000/api/config \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET"
   
   # Should see:
   # Access-Control-Allow-Origin: http://localhost:5173
   # Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
   ```

3. **Check web UI API URL:**  
   Should be `http://localhost:8000` (default)

4. **Check browser console:**  
   Open DevTools → Console tab for detailed errors

---

### Validation errors not shown in UI

**Symptom:**  
Form submits but nothing happens, no error message.

**Cause:**  
Frontend validation may be out of sync with backend.

**Fix:**
1. **Check browser console** for errors
2. **Check API response:**
   ```bash
   # Copy the request from Network tab
   curl -X POST http://localhost:8000/api/portfolio/orders \
     -H "Content-Type: application/json" \
     -d '{ ... }'
   ```
3. **Update frontend validation** to match backend rules (see Validation section above)

---

## Performance Issues

### Slow screener execution

**Symptom:**  
`/api/screener/run` takes > 30 seconds.

**Causes:**
1. **Large universe** (> 1000 tickers)
2. **Network latency** (downloading market data)
3. **First run** (no cache)

**Solutions:**

1. **Reduce universe size:**
   ```json
   {
     "universe_size": 100  // Instead of 500
   }
   ```

2. **Wait for cache to populate:**  
   Subsequent runs will be much faster.

3. **Check data directory:**
   ```bash
   du -sh data/
   # Should see cached data files
   ```

4. **Use `preview` first:**
   ```bash
   curl http://localhost:8000/api/screener/preview
   # Faster, returns ranked universe without full analysis
   ```

---

### Lock contention (frequent 503 errors)

**Symptom:**  
`/metrics` shows high `lock_contention_total`.

**Cause:**  
Too many concurrent requests to position/order endpoints.

**Solutions:**

1. **Reduce polling frequency** in web UI  
   (if auto-refresh is enabled)

2. **Batch requests:**  
   Instead of fetching positions/orders separately:
   ```bash
   # Good: Single request
   curl http://localhost:8000/api/portfolio/snapshot
   
   # Avoid: Multiple concurrent requests
   curl http://localhost:8000/api/portfolio/positions &
   curl http://localhost:8000/api/portfolio/orders &
   ```

3. **Check for stuck processes:**  
   See "503 Service Temporarily Unavailable" section above.

---

## CLI Issues

### CLI and API conflict

**Symptom:**  
CLI command hangs or returns `Resource temporarily unavailable`.

**Cause:**  
API is holding a lock on `positions.json` or `orders.json`.

**Solution:**  
Wait for API request to complete, or stop the API server temporarily:
```bash
# Stop API
Ctrl+C (in API terminal)

# Run CLI command
poetry run swing-screener manage --apply

# Restart API
poetry run uvicorn api.main:app --reload
```

**Note:**  
The CLI and API both use file locking, so they're safe to run concurrently. However, long-running CLI commands (backtest, screener) may hold locks for extended periods.

---

## Health Check Failures

### `/health` returns 503 (unhealthy)

**Symptom:**
```json
{
  "status": "unhealthy",
  "checks": {
    "files": {
      "status": "unhealthy",
      "issues": ["positions.json: permission denied"]
    }
  }
}
```

**Solutions:**

#### **Permission denied**
```bash
# Fix file permissions
chmod 644 positions.json orders.json

# Fix directory permissions
chmod 755 .
```

#### **Data directory not writable**
```bash
chmod 755 data/
```

#### **Corrupted JSON files**
See "Corrupted positions.json" section above.

---

## Getting Help

If none of these solutions work:

1. **Check API logs** for detailed stack traces
2. **Run health check:**
   ```bash
   curl http://localhost:8000/health
   ```
3. **Check metrics:**
   ```bash
   curl http://localhost:8000/metrics
   ```
4. **File an issue** with:
   - Error message (sanitize any sensitive data)
   - Steps to reproduce
   - API logs
   - Output of `/health` and `/metrics`
   - OS and Python version

---

## Reference: Validation Rules Summary

| Field | Type | Valid Range | Notes |
|-------|------|-------------|-------|
| `ticker` | string | 1-5 uppercase alphanumeric | Example: `AAPL`, `SPY` |
| `entry_price` | float | > 0, < 1,000,000, finite | Positive, reasonable |
| `stop_price` | float | > 0, < 1,000,000, finite | Must be < entry (longs) |
| `limit_price` | float | > 0, < 1,000,000, finite | Required for LIMIT orders |
| `quantity` | int | 1 to 1,000,000 | Positive integers only |
| `risk_pct` | float | 0.0001 to 0.10 | 0.01% to 10% |
| `account_size` | float | > 0, < 1,000,000,000 | Max $1B |
| `direction` | enum | `"long"` or `"short"` | Currently only long supported |
| `order_type` | enum | `"MARKET"` or `"LIMIT"` | LIMIT requires limit_price |

**Cross-field validations:**
- `entry_price > stop_price` (for long positions)
- `new_stop > old_stop` (trailing stops only)
- `new_stop < entry_price`
- `limit_price` required when `order_type="LIMIT"`

---

_Last updated: February 2026_
