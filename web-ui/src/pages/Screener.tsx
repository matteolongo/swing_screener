import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PlayCircle, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { API_ENDPOINTS, apiUrl } from '../lib/api';
import { 
  ScreenerRequest, 
  ScreenerResponseAPI,
  UniversesResponse,
  transformScreenerResponse 
} from '../types/screener';
import { useConfigStore } from '../stores/configStore';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function Screener() {
  const { config } = useConfigStore();
  const [selectedUniverse, setSelectedUniverse] = useState<string>('mega');
  const [topN, setTopN] = useState<number>(20);

  // Fetch available universes
  const { data: universesData } = useQuery<UniversesResponse>({
    queryKey: ['universes'],
    queryFn: async () => {
      const res = await fetch(apiUrl(API_ENDPOINTS.screenerUniverses));
      if (!res.ok) throw new Error('Failed to fetch universes');
      return res.json();
    },
  });

  // Run screener mutation
  const screenerMutation = useMutation({
    mutationFn: async (request: ScreenerRequest) => {
      const res = await fetch(apiUrl(API_ENDPOINTS.screenerRun), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to run screener');
      }
      const apiResponse: ScreenerResponseAPI = await res.json();
      return transformScreenerResponse(apiResponse);
    },
  });

  const handleRunScreener = () => {
    screenerMutation.mutate({
      universe: selectedUniverse,
      top: topN,
    });
  };

  const candidates = screenerMutation.data?.candidates || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Screener</h1>
        <p className="mt-2 text-gray-600">
          Find swing trade candidates based on momentum and relative strength
        </p>
      </div>

      {/* Controls */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Universe selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Universe
            </label>
            <select
              value={selectedUniverse}
              onChange={(e) => setSelectedUniverse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
            >
              {universesData?.universes.map((universe) => (
                <option key={universe} value={universe}>
                  {universe}
                </option>
              ))}
            </select>
          </div>

          {/* Top N */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Top Candidates
            </label>
            <input
              type="number"
              value={topN}
              onChange={(e) => setTopN(parseInt(e.target.value) || 20)}
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
            />
          </div>

          {/* Account info */}
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <div>Account: {formatCurrency(config.risk.accountSize)}</div>
              <div>Risk/trade: {formatPercent(config.risk.riskPct)}</div>
            </div>
          </div>

          {/* Run button */}
          <div className="flex items-end">
            <Button
              onClick={handleRunScreener}
              disabled={screenerMutation.isPending}
              className="w-full"
            >
              {screenerMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Run Screener
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Info banner */}
        {!screenerMutation.isPending && !screenerMutation.data && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Note:</strong> The screener downloads market data and may take 10-30 seconds to complete.
            </div>
          </div>
        )}

        {/* Error */}
        {screenerMutation.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              Error: {screenerMutation.error.message}
            </p>
          </div>
        )}
      </Card>

      {/* Results */}
      {screenerMutation.data && (
        <>
          {/* Summary */}
          <Card variant="bordered">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="w-6 h-6 text-green-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Screener completed</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {candidates.length} candidates from {screenerMutation.data.totalScreened} stocks
                  </p>
                  <p className="text-xs text-gray-500">
                    As of: {screenerMutation.data.asofDate}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunScreener}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </Card>

          {/* Candidates table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ticker</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Close</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">ATR</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Mom 6M</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Mom 12M</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">RS</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Score</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-500">
                        No candidates found
                      </td>
                    </tr>
                  ) : (
                    candidates.map((candidate) => (
                      <tr key={candidate.ticker} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                          #{candidate.rank}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-blue-600">
                            {candidate.ticker}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {formatCurrency(candidate.close)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-600">
                          {candidate.atr.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={candidate.momentum6m >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercent(candidate.momentum6m)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={candidate.momentum12m >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercent(candidate.momentum12m)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={candidate.relStrength >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercent(candidate.relStrength)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                          {(candidate.score * 100).toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              // TODO: Open order creation modal
                              console.log('Create order for', candidate.ticker);
                            }}
                          >
                            Create Order
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
