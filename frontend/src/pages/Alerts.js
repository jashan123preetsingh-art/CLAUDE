import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { alertsAPI } from '../utils/api';
import { formatCurrency, timeAgo } from '../utils/format';
import toast from 'react-hot-toast';

const ALERT_TYPES = [
  { value: 'price_above', label: 'Price Above' },
  { value: 'price_below', label: 'Price Below' },
  { value: 'change_above', label: 'Change % Above' },
  { value: 'change_below', label: 'Change % Below' },
  { value: 'volume_above', label: 'Volume Above' },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ stockSymbol: '', alertType: 'price_above', value: '' });

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await alertsAPI.list();
      setAlerts(res.data || []);
    } catch {
      setAlerts(demoAlerts);
    }
  };

  const createAlert = async () => {
    if (!formData.stockSymbol || !formData.value) {
      toast.error('Fill all fields');
      return;
    }
    try {
      await alertsAPI.create({
        stockSymbol: formData.stockSymbol.toUpperCase(),
        alertType: formData.alertType,
        condition: { value: parseFloat(formData.value) },
      });
      toast.success('Alert created!');
      setShowForm(false);
      setFormData({ stockSymbol: '', alertType: 'price_above', value: '' });
      loadAlerts();
    } catch {
      toast.error('Failed to create alert');
    }
  };

  const deleteAlert = async (id) => {
    try {
      await alertsAPI.delete(id);
      setAlerts(alerts.filter(a => a.id !== id));
      toast.success('Alert deleted');
    } catch {
      toast.error('Failed to delete alert');
    }
  };

  const toggleAlert = async (id) => {
    try {
      await alertsAPI.toggle(id);
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_active: !a.is_active } : a));
    } catch {
      toast.error('Failed to toggle alert');
    }
  };

  const displayAlerts = alerts.length > 0 ? alerts : demoAlerts;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-dark-400 text-sm mt-1">Set price alerts and scanner conditions — notified via Telegram & Web</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + New Alert
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Create New Alert</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-dark-500 mb-1 block">Stock Symbol</label>
              <input
                type="text"
                placeholder="e.g. RELIANCE"
                value={formData.stockSymbol}
                onChange={(e) => setFormData({ ...formData, stockSymbol: e.target.value })}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="text-xs text-dark-500 mb-1 block">Alert Type</label>
              <select
                value={formData.alertType}
                onChange={(e) => setFormData({ ...formData, alertType: e.target.value })}
                className="input-dark w-full"
              >
                {ALERT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-dark-500 mb-1 block">Value</label>
              <input
                type="number"
                placeholder="e.g. 1500"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="input-dark w-full"
              />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={createAlert} className="btn-primary flex-1">Create</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        {displayAlerts.map((alert, i) => (
          <motion.div
            key={alert.id || i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`glass-card p-4 flex items-center justify-between ${!alert.is_active ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${alert.is_active ? 'bg-accent-green animate-pulse' : 'bg-dark-600'}`} />
              <div>
                <p className="text-sm font-medium text-white">{alert.symbol || alert.stockSymbol}</p>
                <p className="text-xs text-dark-500">
                  {ALERT_TYPES.find(t => t.value === alert.alert_type)?.label || alert.alert_type}: {
                    typeof alert.condition === 'string' ? JSON.parse(alert.condition).value : alert.condition?.value
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {alert.triggered_at && (
                <span className="badge-green text-xs">Triggered {timeAgo(alert.triggered_at)}</span>
              )}
              <button
                onClick={() => toggleAlert(alert.id)}
                className={`px-3 py-1 rounded text-xs ${alert.is_active ? 'bg-accent-green/20 text-accent-green' : 'bg-dark-700 text-dark-500'}`}
              >
                {alert.is_active ? 'Active' : 'Paused'}
              </button>
              <button onClick={() => deleteAlert(alert.id)} className="text-dark-500 hover:text-accent-red transition-colors text-sm">
                ✕
              </button>
            </div>
          </motion.div>
        ))}

        {displayAlerts.length === 0 && (
          <div className="glass-card p-12 text-center">
            <p className="text-dark-500 text-sm">No alerts set. Create one to get notified on price movements.</p>
          </div>
        )}
      </div>

      {/* Notification Settings */}
      <div className="glass-card p-5 mt-6">
        <h3 className="text-sm font-semibold text-white mb-4">Notification Channels</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-dark-850 border border-dark-700/50">
            <div className="flex items-center gap-3">
              <span className="text-lg">💬</span>
              <div>
                <p className="text-sm text-white">Telegram</p>
                <p className="text-xs text-dark-500">Get alerts on your Telegram</p>
              </div>
            </div>
            <button className="btn-secondary text-xs">Connect</button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-dark-850 border border-dark-700/50">
            <div className="flex items-center gap-3">
              <span className="text-lg">🌐</span>
              <div>
                <p className="text-sm text-white">Web Notifications</p>
                <p className="text-xs text-dark-500">Browser push notifications</p>
              </div>
            </div>
            <button className="btn-secondary text-xs">Enable</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const demoAlerts = [
  { id: 1, symbol: 'RELIANCE', alert_type: 'price_above', condition: { value: 1500 }, is_active: true },
  { id: 2, symbol: 'TCS', alert_type: 'price_below', condition: { value: 3800 }, is_active: true },
  { id: 3, symbol: 'HDFCBANK', alert_type: 'change_above', condition: { value: 3 }, is_active: false },
  { id: 4, symbol: 'INFY', alert_type: 'price_above', condition: { value: 1600 }, is_active: true },
];
