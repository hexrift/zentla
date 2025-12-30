import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

type DiscountType = 'percent' | 'fixed_amount' | 'free_trial_days';

export function PromotionNewPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    discountType: 'percent' as DiscountType,
    discountValue: '',
    currency: 'GBP',
    maxRedemptions: '',
    validFrom: '',
    validUntil: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const config: Record<string, unknown> = {
        discountType: data.discountType,
        discountValue:
          data.discountType === 'fixed_amount'
            ? Math.round(parseFloat(data.discountValue) * 100)
            : parseInt(data.discountValue, 10),
      };

      if (data.discountType === 'fixed_amount') {
        config.currency = data.currency.toLowerCase();
      }

      if (data.maxRedemptions) {
        config.maxRedemptions = parseInt(data.maxRedemptions, 10);
      }

      if (data.validFrom) {
        config.validFrom = new Date(data.validFrom).toISOString();
      }

      if (data.validUntil) {
        config.validUntil = new Date(data.validUntil).toISOString();
      }

      return api.promotions.create({
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || undefined,
        config,
      });
    },
    onSuccess: (result) => {
      navigate(`/promotions/${(result as { id: string }).id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getValueLabel = () => {
    switch (formData.discountType) {
      case 'percent':
        return 'Discount Percentage';
      case 'fixed_amount':
        return 'Discount Amount';
      case 'free_trial_days':
        return 'Trial Days';
    }
  };

  const getValuePlaceholder = () => {
    switch (formData.discountType) {
      case 'percent':
        return 'e.g., 20 for 20% off';
      case 'fixed_amount':
        return 'e.g., 10.00';
      case 'free_trial_days':
        return 'e.g., 14';
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Create Promotion</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Summer Sale 2025"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Code
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value.toUpperCase() })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="e.g., SUMMER25"
            />
            <p className="mt-1 text-sm text-gray-500">
              Customers will enter this code at checkout
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Internal notes about this promotion"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Discount</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Type
            </label>
            <select
              value={formData.discountType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  discountType: e.target.value as DiscountType,
                  discountValue: '',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="percent">Percentage off</option>
              <option value="fixed_amount">Fixed amount off</option>
              <option value="free_trial_days">Extended free trial</option>
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getValueLabel()}
              </label>
              <input
                type="number"
                required
                min="1"
                step={formData.discountType === 'fixed_amount' ? '0.01' : '1'}
                max={formData.discountType === 'percent' ? '100' : undefined}
                value={formData.discountValue}
                onChange={(e) =>
                  setFormData({ ...formData, discountValue: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={getValuePlaceholder()}
              />
            </div>

            {formData.discountType === 'fixed_amount' && (
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Limits (optional)</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Redemptions
            </label>
            <input
              type="number"
              min="1"
              value={formData.maxRedemptions}
              onChange={(e) =>
                setFormData({ ...formData, maxRedemptions: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leave empty for unlimited"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid From
              </label>
              <input
                type="datetime-local"
                value={formData.validFrom}
                onChange={(e) =>
                  setFormData({ ...formData, validFrom: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until
              </label>
              <input
                type="datetime-local"
                value={formData.validUntil}
                onChange={(e) =>
                  setFormData({ ...formData, validUntil: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {createMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            {(createMutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Promotion'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/promotions')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
