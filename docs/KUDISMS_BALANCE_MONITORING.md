# KudiSMS Balance Monitoring Guide

## Overview

The PIN system automatically tracks your KudiSMS account balance and logs all SMS sends. This guide shows you how to monitor and manage your SMS balance.

## Automatic Balance Tracking

The system automatically:
1. **Captures balance** from every successful KudiSMS API response
2. **Stores balance** in the `kudi_sms_balance` table
3. **Logs timestamp** of last update
4. **Records cost** of each SMS send in logs

## Check Balance via API

### Frontend JavaScript
```javascript
// Get current balance
const response = await fetch('/api/kudi-sms/balance');
const data = await response.json();

console.log('Current Balance:', data.formattedBalance);
console.log('Balance Amount:', data.balance);
console.log('Last Updated:', data.lastUpdated);
```

### Example Response
```json
{
  "balance": 450.50,
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "formattedBalance": "₦450.50"
}
```

### React Component Example
```tsx
import { useState, useEffect } from 'react';

export function BalanceDisplay() {
  const [balance, setBalance] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/kudi-sms/balance');
        const data = await response.json();
        setBalance(data.formattedBalance);
        setLastUpdated(new Date(data.lastUpdated).toLocaleString());
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    fetchBalance();
    // Refresh every 5 minutes
    const interval = setInterval(fetchBalance, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-blue-50 rounded-lg border">
      <div className="flex justify-between items-center">
        <span className="text-gray-700">KudiSMS Balance</span>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{balance || '—'}</div>
          {lastUpdated && (
            <div className="text-xs text-gray-500">Updated: {lastUpdated}</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Check Balance via Database

### Query Current Balance
```sql
-- Get latest balance
SELECT balance, last_updated 
FROM kudi_sms_balance 
ORDER BY last_updated DESC 
LIMIT 1;
```

### Balance History
```sql
-- See balance changes over time
SELECT balance, last_updated 
FROM kudi_sms_balance 
ORDER BY last_updated DESC 
LIMIT 10;
```

## Monitor SMS Usage

### Total SMS Sent (Today)
```sql
SELECT 
  COUNT(*) as total_sent,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM kudi_sms_logs
WHERE DATE(created_at) = CURRENT_DATE;
```

### Cost per Business
```sql
SELECT 
  business_id,
  COUNT(*) as sms_sent,
  ROUND(COUNT(*) * 5.95, 2) as estimated_cost
FROM kudi_sms_logs
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY business_id
ORDER BY sms_sent DESC;
```

### SMS by Purpose (Today)
```sql
SELECT 
  purpose,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful
FROM kudi_sms_logs
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY purpose;
```

### Failed SMS Sends
```sql
-- Recent failed sends
SELECT 
  created_at,
  phone_number,
  purpose,
  error_code,
  error_message
FROM kudi_sms_logs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

## Balance Alerts

### Low Balance Alert
```sql
-- Alert if balance is below ₦100
SELECT 
  CASE 
    WHEN balance < 100 THEN 'CRITICAL'
    WHEN balance < 500 THEN 'WARNING'
    ELSE 'OK'
  END as status,
  balance,
  last_updated
FROM kudi_sms_balance
ORDER BY last_updated DESC
LIMIT 1;
```

### React Component with Alert
```tsx
import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export function BalanceAlert() {
  const [status, setStatus] = useState<'ok' | 'warning' | 'critical'>('ok');
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    const checkBalance = async () => {
      const response = await fetch('/api/kudi-sms/balance');
      const data = await response.json();
      
      setBalance(data.balance);
      
      if (data.balance < 100) {
        setStatus('critical');
      } else if (data.balance < 500) {
        setStatus('warning');
      } else {
        setStatus('ok');
      }
    };

    checkBalance();
    const interval = setInterval(checkBalance, 10 * 60 * 1000); // Check every 10 min
    return () => clearInterval(interval);
  }, []);

  if (status === 'ok') return null;

  const bgColor = status === 'critical' ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = status === 'critical' ? 'border-red-200' : 'border-yellow-200';
  const textColor = status === 'critical' ? 'text-red-700' : 'text-yellow-700';
  const message = status === 'critical' 
    ? `Critical: SMS balance is ₦${balance.toFixed(2)}. Recharge immediately!`
    : `Warning: SMS balance is ₦${balance.toFixed(2)}. Consider recharging soon.`;

  return (
    <div className={`p-3 rounded-lg border ${bgColor} ${borderColor}`}>
      <div className="flex gap-2 items-start">
        <AlertCircle className={`w-5 h-5 ${textColor} flex-shrink-0 mt-0.5`} />
        <p className={`text-sm ${textColor}`}>{message}</p>
      </div>
    </div>
  );
}
```

## SMS Cost Estimation

### Cost per SMS: ₦5.95

KudiSMS charges ₦5.95 per SMS. Use this to estimate costs:

```javascript
function estimateSmsCost(numberOfMessages: number): number {
  const costPerSMS = 5.95;
  return numberOfMessages * costPerSMS;
}

// Example
console.log(estimateSmsCost(100)); // ₦595
console.log(estimateSmsCost(1000)); // ₦5,950
```

### Daily Cost Estimate
```sql
-- Estimate daily cost based on sends
SELECT 
  DATE(created_at) as date,
  COUNT(*) * 5.95 as estimated_cost
FROM kudi_sms_logs
WHERE status = 'sent'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

## Weekly/Monthly Reports

### Weekly Summary
```sql
SELECT 
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(*) as total_sms,
  COUNT(*) * 5.95 as cost,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM kudi_sms_logs
WHERE created_at >= NOW() - INTERVAL '8 weeks'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;
```

### Monthly Summary
```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_sms,
  ROUND(COUNT(*) * 5.95::numeric, 2) as cost,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM kudi_sms_logs
WHERE created_at >= NOW() - INTERVAL '1 year'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

## Error Code Reference

### Common KudiSMS Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `000` | Success | No action needed |
| `109` | No balance | Recharge account immediately |
| `101` | Invalid API key | Verify `KUDISMS_TOKEN` |
| `102` | Invalid sender ID | Must be "FoodBase" |
| `103` | Invalid recipient | Check phone number format |
| `104` | Message too long | SMS max 160 characters |
| `105` | Rate limited | Wait and retry |

### Check Error Breakdown
```sql
SELECT 
  error_code,
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM kudi_sms_logs WHERE status = 'failed') as percentage
FROM kudi_sms_logs
WHERE status = 'failed'
GROUP BY error_code
ORDER BY count DESC;
```

## Dashboard Integration

Create a simple dashboard to monitor SMS health:

```tsx
export function SmsDashboard() {
  const [stats, setStats] = useState({
    balance: 0,
    todaysSends: 0,
    successRate: 0,
    estimatedCost: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch from your endpoints
      const balanceRes = await fetch('/api/kudi-sms/balance');
      const balanceData = await balanceRes.json();

      const logsRes = await fetch('/api/kudi-sms/logs?limit=1000');
      const logsData = await logsRes.json();

      const todaysSends = logsData.logs.filter(
        (log: any) => new Date(log.created_at).toDateString() === new Date().toDateString()
      ).length;

      const successful = logsData.logs.filter(
        (log: any) => log.status === 'sent'
      ).length;

      setStats({
        balance: balanceData.balance,
        todaysSends,
        successRate: (successful / logsData.logs.length) * 100,
        estimatedCost: todaysSends * 5.95,
      });
    };

    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Balance" value={`₦${stats.balance.toFixed(2)}`} />
      <StatCard label="Today's SMS" value={stats.todaysSends.toString()} />
      <StatCard label="Success Rate" value={`${stats.successRate.toFixed(1)}%`} />
      <StatCard label="Today's Cost" value={`₦${stats.estimatedCost.toFixed(2)}`} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-white rounded-lg border">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
```

## Recommendations

1. **Check Balance Weekly**: Avoid running out of credit
2. **Set SMS Budget**: Calculate expected monthly usage
3. **Monitor Error Rates**: High failure rates may indicate issues
4. **Clean Old Logs**: Archive logs after 90 days if needed
5. **Alert Setup**: Add low balance alerts to your dashboard
6. **Track per Business**: Monitor which businesses use most SMS

## Troubleshooting Balance Issues

### Balance Not Updating
1. Check if SMS sends are succeeding
2. Query latest log: `SELECT * FROM kudi_sms_logs ORDER BY created_at DESC LIMIT 1;`
3. Verify `KUDISMS_TOKEN` is correct
4. Check KudiSMS account directly

### Wrong Balance Shown
1. May lag by a few minutes
2. Refresh page to get latest
3. Check SMS response in logs
4. Contact KudiSMS support if discrepancy

### Can't Send SMS (Error 109)
1. Recharge KudiSMS account
2. Verify balance: Visit KudiSMS dashboard
3. Wait for balance update (1-2 minutes)
4. Retry PIN request

## Related Documentation

- **Setup Guide**: See `PIN_SYSTEM_SETUP.md`
- **Quick Start**: See `PIN_QUICK_START.md`
- **API Reference**: See `/api/kudi-sms/balance` and `/api/kudi-sms/logs`
