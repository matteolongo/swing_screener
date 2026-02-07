#!/bin/bash
echo "========================================="
echo "BACKEND API COMPREHENSIVE TEST"
echo "========================================="
echo ""

# 1. Health Check
echo "1. Health Check"
curl -s http://localhost:8000/health | python -m json.tool
echo ""

# 2. Get Config
echo "2. Get Configuration"
curl -s http://localhost:8000/api/config | python -m json.tool | head -20
echo "..."
echo ""

# 3. List Universes
echo "3. List Available Universes"
curl -s http://localhost:8000/api/screener/universes | python -m json.tool
echo ""

# 4. Get Positions Summary
echo "4. Get Positions Summary"
POSITIONS=$(curl -s http://localhost:8000/api/portfolio/positions)
echo "$POSITIONS" | python -c "
import sys, json
data = json.load(sys.stdin)
positions = data.get('positions', [])
open_pos = [p for p in positions if p['status'] == 'open']
closed_pos = [p for p in positions if p['status'] == 'closed']
print(f'Total: {len(positions)}')
print(f'Open: {len(open_pos)}')
print(f'Closed: {len(closed_pos)}')
if open_pos:
    print('\nOpen Positions:')
    for p in open_pos:
        print(f\"  - {p['ticker']}: {p['shares']} shares @ \${p['entry_price']}, stop: \${p['stop_price']}\")
"
echo ""

# 5. Get Orders Summary
echo "5. Get Orders Summary"
ORDERS=$(curl -s http://localhost:8000/api/portfolio/orders)
echo "$ORDERS" | python -c "
import sys, json
data = json.load(sys.stdin)
orders = data.get('orders', [])
pending = [o for o in orders if o['status'] == 'pending']
filled = [o for o in orders if o['status'] == 'filled']
cancelled = [o for o in orders if o['status'] == 'cancelled']
print(f'Total: {len(orders)}')
print(f'Pending: {len(pending)}')
print(f'Filled: {len(filled)}')
print(f'Cancelled: {len(cancelled)}')
if pending:
    print('\nPending Orders:')
    for o in pending[:3]:
        print(f\"  - {o['ticker']}: {o['order_type']}, qty: {o['quantity']}\")
"
echo ""

# 6. Test Screener (small sample)
echo "6. Run Screener Test (mega universe, top 3)"
curl -s -X POST http://localhost:8000/api/screener/run \
  -H "Content-Type: application/json" \
  -d '{"universe": "mega", "top": 3}' | python -c "
import sys, json
data = json.load(sys.stdin)
candidates = data.get('candidates', [])
print(f'Returned {len(candidates)} candidates')
if candidates:
    print('\nTop Candidates:')
    for c in candidates:
        print(f\"  {c['rank']}. {c['ticker']}: Score {c['score']:.2f}\")
" 2>&1 | head -10
echo ""

echo "========================================="
echo "✅ ALL TESTS COMPLETED"
echo "========================================="
