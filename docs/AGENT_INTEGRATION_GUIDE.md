# Agent Integration Guide

> **Status: Needs review.** Examples, tool names, and schedules may drift; validate against current MCP tool registry and CLI help.  
> **Last Reviewed:** February 17, 2026.

This guide explains how to integrate and use the Swing Screener Agent in different scenarios:
- AI Assistant Integration (Claude Desktop, etc.)
- Automation Scripts and Cron Jobs
- Custom Workflow Development
- Integration with Other Systems

## Table of Contents

1. [AI Assistant Integration](#ai-assistant-integration)
2. [Automation Scripts](#automation-scripts)
3. [Custom Workflow Development](#custom-workflow-development)
4. [Integration Patterns](#integration-patterns)
5. [Troubleshooting](#troubleshooting)

---

## AI Assistant Integration

### Claude Desktop Integration

The recommended way to use the agent with Claude Desktop is via the MCP server.

#### Setup

1. **Install the MCP server:**

```bash
cd /path/to/swing_screener
pip install -e ".[mcp]"
```

2. **Configure Claude Desktop:**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or  
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "swing-screener": {
      "command": "python",
      "args": ["-m", "mcp_server.main"],
      "cwd": "/path/to/swing_screener"
    }
  }
}
```

3. **Restart Claude Desktop**

#### Usage Examples

Once configured, you can interact with Swing Screener naturally in Claude:

**Example 1: Daily Screening**

```
User: "Run the daily screening on the mega_all universe and show me the top 5 candidates"

Claude: [Calls run_screener tool]
"I've screened the mega_all universe and found 5 candidates. Here are the top ones:

1. AAPL at $182.50 (stop: $178.20, momentum: 18.5%)
2. MSFT at $385.00 (stop: $378.50, momentum: 16.2%)
...

Would you like me to create orders for any of these candidates?"
```

**Example 2: Position Review**

```
User: "Review my open positions and suggest stop updates"

Claude: [Calls list_positions and suggest_position_stop]
"You have 5 open positions with a total P&L of $1,245.50. 
Two positions are ready for trailing stops:

- AAPL: Currently at 2.10R, suggest raising stop to $185
- NVDA: Currently at 1.75R, suggest raising stop to $312

Would you like me to update these stops?"
```

**Example 3: Order Management**

```
User: "Show me pending orders"

Claude: [Calls list_orders with status=pending]
"You have 2 pending orders:
1. AAPL - Entry order at $180.00
2. MSFT - Entry order at $380.00

Have you executed these at your broker yet? If so, I can mark them as filled."
```

### Using the Agent Programmatically

If you prefer to use the agent directly in Python (instead of through Claude):

```python
from agent import SwingScreenerAgent
import asyncio

async def main():
    # Initialize agent
    agent = SwingScreenerAgent()
    await agent.start()
    
    # Run workflows
    screening = await agent.daily_screening(universe="mega_all", top_n=5)
    positions = await agent.review_positions()
    
    # Process results
    for candidate in screening["candidates"]:
        print(f"Candidate: {candidate['ticker']}")
    
    await agent.stop()

asyncio.run(main())
```

---

## Automation Scripts

### Daily Cron Job

Create a script to run the agent daily after market close:

**`scripts/daily_screening.sh`**

```bash
#!/bin/bash
set -e

# Change to project directory
cd /path/to/swing_screener

# Activate virtual environment
source venv/bin/activate

# Run daily screening
python -m agent.cli screen \
    --universe mega_all \
    --top 10 \
    --output "out/screening_$(date +%Y%m%d).json"

# Run position review
python -m agent.cli positions review

echo "Daily screening complete"
```

**Cron schedule (example only; adjust for your timezone and local market close):**

```cron
30 22 * * 1-5 /path/to/scripts/daily_screening.sh >> /var/log/swing_screener.log 2>&1
```

### Email Notifications

Add email notifications to your automation:

```python
import asyncio
import smtplib
from email.mime.text import MIMEText
from agent import SwingScreenerAgent

async def daily_screening_with_email():
    agent = SwingScreenerAgent()
    await agent.start()
    
    # Run screening
    result = await agent.daily_screening(universe="mega_all", top_n=10)
    
    # Format results
    message = f"""
Daily Screening Results
=======================

Candidates found: {len(result['candidates'])}

Top 3:
"""
    for i, candidate in enumerate(result['candidates'][:3], 1):
        message += f"\n{i}. {candidate['ticker']} - Entry: ${candidate['entry_price']:.2f}"
    
    message += "\n\nInsights:\n" + "\n".join(result['insights'])
    
    # Send email
    msg = MIMEText(message)
    msg['Subject'] = 'Daily Swing Screener Results'
    msg['From'] = 'screening@example.com'
    msg['To'] = 'trader@example.com'
    
    with smtplib.SMTP('localhost') as server:
        server.send_message(msg)
    
    await agent.stop()

asyncio.run(daily_screening_with_email())
```

---

## Custom Workflow Development

### Creating Custom Workflows

Extend the `BaseWorkflow` class to create custom trading workflows:

```python
from agent.workflows import BaseWorkflow
from typing import Any

class CustomBacktestWorkflow(BaseWorkflow):
    """Custom workflow for running backtests."""
    
    async def execute(
        self,
        strategy: str,
        start_date: str,
        end_date: str
    ) -> dict[str, Any]:
        """Execute backtest workflow."""
        self.insights.clear()
        
        self.add_insight(f"Starting backtest for {strategy}")
        
        # Step 1: Get strategy configuration
        strategy_result = await self.client.call_tool("get_strategy", {
            "strategy_id": strategy
        })
        
        self.add_insight(f"Strategy loaded: {strategy_result['name']}")
        
        # Step 2: Run backtest (if tool available)
        # Note: Backtest tools are in config but not yet implemented
        # This is a placeholder for future functionality
        
        self.add_insight("Backtest completed")
        
        return {
            "strategy": strategy_result,
            "insights": self.get_insights()
        }
```

**Usage:**

```python
from agent import SwingScreenerAgent
from custom_workflows import CustomBacktestWorkflow

async def main():
    agent = SwingScreenerAgent()
    await agent.start()
    
    # Create custom workflow
    backtest_workflow = CustomBacktestWorkflow(agent.client)
    
    # Execute
    result = await backtest_workflow.execute(
        strategy="default",
        start_date="2023-01-01",
        end_date="2023-12-31"
    )
    
    await agent.stop()
```

### Adding New Agent Methods

Extend the `SwingScreenerAgent` class with custom methods:

```python
from agent import SwingScreenerAgent
from typing import Any

class ExtendedAgent(SwingScreenerAgent):
    """Extended agent with additional methods."""
    
    async def weekly_review(self) -> dict[str, Any]:
        """Generate a weekly performance review."""
        self._check_running()
        
        # Get all closed positions from this week
        # (In reality, you'd filter by date)
        positions = await self.client.call_tool("list_positions", {
            "status": "closed"
        })
        
        # Analyze performance
        total_pnl = sum(p.get("realized_pnl", 0) for p in positions["positions"])
        winners = sum(1 for p in positions["positions"] if p.get("realized_pnl", 0) > 0)
        total_trades = len(positions["positions"])
        
        win_rate = winners / total_trades if total_trades > 0 else 0
        
        return {
            "total_trades": total_trades,
            "total_pnl": total_pnl,
            "win_rate": win_rate,
            "winners": winners,
            "losers": total_trades - winners
        }
```

---

## Integration Patterns

### Pattern 1: Decision Support System

Use the agent to assist human decision-making:

```python
async def decision_support():
    """Provide trading decisions with explanations."""
    agent = SwingScreenerAgent()
    await agent.start()
    
    # Get candidates
    screening = await agent.daily_screening(top_n=10)
    
    # Review positions
    positions = await agent.review_positions()
    
    # Consolidate insights
    all_insights = screening['insights'] + positions['insights']
    
    # Present to user for decision
    print("Daily Trading Decisions:")
    print("\n".join(all_insights))
    
    # User makes final decision
    decision = input("Proceed with top candidate? (y/n): ")
    
    if decision.lower() == 'y':
        candidate = screening['candidates'][0]
        await agent.create_order_from_candidate(candidate)
        print("Order created")
    
    await agent.stop()
```

### Pattern 2: Monitoring and Alerts

Set up monitoring for position alerts:

```python
async def monitor_positions():
    """Monitor positions and send alerts."""
    agent = SwingScreenerAgent()
    await agent.start()
    
    # Get positions
    result = await agent.review_positions()
    
    # Check for alerts
    alerts = []
    
    for pos in result['positions']:
        r_multiple = pos.get('r_multiple', 0)
        
        if r_multiple >= 2.0:
            alerts.append(f"🎯 {pos['ticker']} at {r_multiple:.2f}R - Consider taking profits")
        elif r_multiple <= -0.8:
            alerts.append(f"⚠️ {pos['ticker']} at {r_multiple:.2f}R - Approaching stop")
    
    if alerts:
        print("Position Alerts:")
        for alert in alerts:
            print(alert)
            # Send notification (email, Slack, etc.)
    
    await agent.stop()
```

### Pattern 3: Batch Processing

Process multiple universes in parallel:

```python
import asyncio
from agent import SwingScreenerAgent

async def screen_universe(universe: str):
    """Screen a single universe."""
    agent = SwingScreenerAgent()
    await agent.start()
    
    result = await agent.daily_screening(universe=universe, top_n=5)
    
    await agent.stop()
    return result

async def batch_screening():
    """Screen multiple universes."""
    universes = ["mega_all", "sp500", "nasdaq100"]
    
    # Run screenings concurrently
    tasks = [screen_universe(u) for u in universes]
    results = await asyncio.gather(*tasks)
    
    # Consolidate results
    all_candidates = []
    for result in results:
        all_candidates.extend(result['candidates'])
    
    # Sort by rank score
    all_candidates.sort(key=lambda x: x.get('rank_score', 0), reverse=True)
    
    return all_candidates[:10]  # Top 10 across all universes
```

---

## Troubleshooting

### Common Issues

#### 1. Agent Won't Start

**Symptom:** `RuntimeError: Not connected to MCP server`

**Solution:**

```bash
# Verify MCP server works standalone
python -m mcp_server.main --validate-only

# Check MCP dependencies
pip install -e ".[mcp]"

# Enable debug logging
python -m agent.cli screen --log-level DEBUG
```

#### 2. Tool Not Found

**Symptom:** `ValueError: Tool not found: tool_name`

**Solution:**

```bash
# List available tools
python -m agent.cli tools

# Check MCP feature configuration
cat config/mcp_features.yaml

# Ensure feature is enabled
```

#### 3. Connection Timeout

**Symptom:** Server doesn't respond to requests

**Solution:**

```python
# Increase timeout in client (custom implementation)
# Or check server logs for errors

# Verify server is running
ps aux | grep mcp_server
```

#### 4. Permission Errors

**Symptom:** Cannot read/write data files

**Solution:**

```bash
# Check file permissions
ls -la data/

# Ensure writable
chmod 644 data/positions.json data/orders.json
```

### Debug Mode

Enable detailed logging:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logging.getLogger("agent").setLevel(logging.DEBUG)
logging.getLogger("mcp_server").setLevel(logging.DEBUG)
```

Or via CLI:

```bash
python -m agent.cli screen --log-level DEBUG
```

---

## Best Practices

1. **Always use `async/await`** - The agent is built on asyncio
2. **Handle errors gracefully** - Trading operations can fail
3. **Log important actions** - Keep audit trail of decisions
4. **Test in staging first** - Use `environment: "dev"` in config
5. **Monitor resource usage** - MCP server runs as subprocess
6. **Keep data backed up** - positions.json and orders.json are critical
7. **Validate inputs** - Check prices, dates, IDs before operations
8. **Use educational insights** - Learn from the agent's feedback

---

## Next Steps

- **Try the examples** - Run scripts in `agent/examples/`
- **Build custom workflows** - Extend `BaseWorkflow`
- **Integrate with Claude** - Set up Claude Desktop
- **Automate daily routine** - Create cron jobs
- **Share feedback** - Open issues for improvements

---

**Related Documentation:**
- [Agent README](../agent/README.md)
- [MCP Server Guide](../mcp_server/README.md)
- [Daily Usage Guide](DAILY_USAGE_GUIDE.md)
- [Operational Guide](OPERATIONAL_GUIDE.md)
