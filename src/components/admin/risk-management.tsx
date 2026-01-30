'use client';

import { useState } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Settings,
  Eye,
  DollarSign,
  Percent,
  Clock,
  Users,
  BarChart3
} from 'lucide-react';

interface RiskParameter {
  id: string;
  name: string;
  currentValue: number;
  recommendedValue: number;
  unit: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  lastUpdated: Date;
}

interface RiskAlert {
  id: string;
  type: 'liquidation' | 'concentration' | 'volatility' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedUsers: number;
  timestamp: Date;
  status: 'active' | 'acknowledged' | 'resolved';
}

// Mock risk data
const mockRiskParameters: RiskParameter[] = [
  {
    id: 'collateral_ratio',
    name: 'Minimum Collateral Ratio',
    currentValue: 150,
    recommendedValue: 160,
    unit: '%',
    description: 'Minimum collateral required for loans',
    riskLevel: 'medium',
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'liquidation_threshold',
    name: 'Liquidation Threshold',
    currentValue: 120,
    recommendedValue: 125,
    unit: '%',
    description: 'Health factor threshold for liquidation',
    riskLevel: 'high',
    lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: 'max_loan_amount',
    name: 'Maximum Loan Amount',
    currentValue: 1000000,
    recommendedValue: 800000,
    unit: 'CSPR',
    description: 'Maximum loan amount per user',
    riskLevel: 'medium',
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'interest_rate_buffer',
    name: 'Interest Rate Buffer',
    currentValue: 2.5,
    recommendedValue: 3.0,
    unit: '%',
    description: 'Buffer added to base interest rates',
    riskLevel: 'low',
    lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
];

const mockRiskAlerts: RiskAlert[] = [
  {
    id: 'alert_1',
    type: 'liquidation',
    severity: 'critical',
    title: 'Multiple Positions at Risk',
    description: '15 loan positions have health factors below 1.3',
    affectedUsers: 15,
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    status: 'active',
  },
  {
    id: 'alert_2',
    type: 'concentration',
    severity: 'high',
    title: 'Asset Concentration Risk',
    description: 'Real estate assets represent 65% of total collateral',
    affectedUsers: 89,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'acknowledged',
  },
  {
    id: 'alert_3',
    type: 'volatility',
    severity: 'medium',
    title: 'High Price Volatility',
    description: 'CSPR price volatility increased by 25% in last 24h',
    affectedUsers: 234,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: 'active',
  },
  {
    id: 'alert_4',
    type: 'system',
    severity: 'low',
    title: 'External Wallet Balance Low',
    description: 'Staking wallet balance below recommended threshold',
    affectedUsers: 0,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    status: 'resolved',
  },
];

export function RiskManagement() {
  const [parameters, setParameters] = useState<RiskParameter[]>(mockRiskParameters);
  const [alerts, setAlerts] = useState<RiskAlert[]>(mockRiskAlerts);
  const [editingParameter, setEditingParameter] = useState<string | null>(null);
  const [newValue, setNewValue] = useState<number>(0);

  const formatNumber = (num: number, unit: string) => {
    if (unit === 'CSPR') {
      return `${num.toLocaleString()} ${unit}`;
    }
    return `${num}${unit}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-green-400 bg-green-500/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'high':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-500/20';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'critical':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5" />;
      case 'high':
        return <TrendingUp className="w-5 h-5" />;
      case 'medium':
        return <Eye className="w-5 h-5" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  };

  const handleParameterUpdate = (parameterId: string) => {
    setParameters(prev => 
      prev.map(param => 
        param.id === parameterId 
          ? { ...param, currentValue: newValue, lastUpdated: new Date() }
          : param
      )
    );
    setEditingParameter(null);
    setNewValue(0);
  };

  const handleAlertAction = (alertId: string, action: 'acknowledge' | 'resolve') => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: action === 'acknowledge' ? 'acknowledged' : 'resolved' }
          : alert
      )
    );
  };

  const activeAlerts = alerts.filter(alert => alert.status === 'active');
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <span className="text-red-400 text-sm font-medium">Critical</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{criticalAlerts.length}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Critical Alerts</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Eye className="h-5 w-5 text-yellow-400" />
            </div>
            <span className="text-yellow-400 text-sm font-medium">Active</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{activeAlerts.length}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Alerts</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-blue-400 text-sm font-medium">Affected</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {activeAlerts.reduce((sum, alert) => sum + alert.affectedUsers, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Users at Risk</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <BarChart3 className="h-5 w-5 text-green-400" />
            </div>
            <span className="text-green-400 text-sm font-medium">Score</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">7.2/10</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Risk Score</p>
          </div>
        </div>
      </div>

      {/* Risk Parameters */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Parameters</h3>
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors">
            Update All
          </button>
        </div>

        <div className="space-y-4">
          {parameters.map((param) => (
            <div key={param.id} className="p-4 bg-gray-100 dark:bg-gray-800/30 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="text-gray-900 dark:text-white font-medium">{param.name}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getRiskLevelColor(param.riskLevel)}`}>
                    {param.riskLevel}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">
                    Updated {formatDate(param.lastUpdated)}
                  </span>
                  <button
                    onClick={() => {
                      setEditingParameter(param.id);
                      setNewValue(param.currentValue);
                    }}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{param.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Current Value</p>
                  {editingParameter === param.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={newValue}
                        onChange={(e) => setNewValue(Number(e.target.value))}
                        className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-900 dark:text-white text-sm"
                      />
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{param.unit}</span>
                      <button
                        onClick={() => handleParameterUpdate(param.id)}
                        className="px-2 py-1 bg-green-500 hover:bg-green-600 text-gray-900 dark:text-white text-xs rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingParameter(null)}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-gray-900 dark:text-white text-xs rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-white font-semibold">
                      {formatNumber(param.currentValue, param.unit)}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Recommended</p>
                  <p className="text-blue-400 font-semibold">
                    {formatNumber(param.recommendedValue, param.unit)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Difference</p>
                  <div className="flex items-center space-x-1">
                    {param.currentValue > param.recommendedValue ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : param.currentValue < param.recommendedValue ? (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    ) : null}
                    <p className={`font-semibold ${
                      param.currentValue > param.recommendedValue ? 'text-green-400' :
                      param.currentValue < param.recommendedValue ? 'text-red-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {Math.abs(param.currentValue - param.recommendedValue)}{param.unit}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Risk Alerts */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Risk Alerts</h3>

        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-4 border rounded-xl ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(alert.severity)}
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">{alert.title}</h4>
                    <p className="text-gray-300 text-sm mt-1">{alert.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                    alert.status === 'active' ? 'bg-red-500/20 text-red-400' :
                    alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{alert.affectedUsers} users</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(alert.timestamp)}</span>
                  </div>
                </div>

                {alert.status === 'active' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                      className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm rounded-lg transition-colors"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => handleAlertAction(alert.id, 'resolve')}
                      className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm rounded-lg transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}