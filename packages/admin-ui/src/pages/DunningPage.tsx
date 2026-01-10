import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type {
  DunningConfig,
  InvoiceInDunning,
  DunningEmailTemplate,
  DunningEmailType,
} from "../lib/types";

const EMAIL_TYPE_LABELS: Record<DunningEmailType, string> = {
  payment_failed: "Payment Failed",
  payment_reminder: "Payment Reminder",
  final_warning: "Final Warning",
  subscription_suspended: "Subscription Suspended",
  subscription_canceled: "Subscription Canceled",
  payment_recovered: "Payment Recovered",
};

const EMAIL_TYPE_DESCRIPTIONS: Record<DunningEmailType, string> = {
  payment_failed: "Sent when the initial payment fails",
  payment_reminder: "Sent on subsequent retry attempts",
  final_warning: "Sent before the final retry attempt",
  subscription_suspended: "Sent when subscription is suspended",
  subscription_canceled: "Sent when subscription is canceled",
  payment_recovered: "Sent when payment succeeds after failures",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function DunningPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DunningEmailType | null>(null);
  const [templateForm, setTemplateForm] = useState<Partial<DunningEmailTemplate>>({});

  // Fetch dunning stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dunning", "stats"],
    queryFn: () => api.dunning.getStats(),
  });

  // Fetch dunning config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["dunning", "config"],
    queryFn: () => api.dunning.getConfig(),
  });

  // Fetch invoices in dunning
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["dunning", "invoices"],
    queryFn: () => api.dunning.listInvoicesInDunning({ limit: 20 }),
  });

  // Fetch email templates
  const { data: emailTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ["dunning", "email-templates"],
    queryFn: () => api.dunning.listEmailTemplates(),
  });

  // Config form state
  const [configForm, setConfigForm] = useState<Partial<DunningConfig>>({});

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<DunningConfig>) => api.dunning.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "config"] });
      setIsEditingConfig(false);
    },
  });

  // Retry invoice mutation
  const retryMutation = useMutation({
    mutationFn: (invoiceId: string) => api.dunning.retryInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning"] });
    },
  });

  // Update email template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: ({
      type,
      data,
    }: {
      type: DunningEmailType;
      data: Partial<DunningEmailTemplate>;
    }) => api.dunning.updateEmailTemplate(type, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "email-templates"] });
      setEditingTemplate(null);
    },
  });

  // Reset email template mutation
  const resetTemplateMutation = useMutation({
    mutationFn: (type: DunningEmailType) => api.dunning.resetEmailTemplate(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "email-templates"] });
    },
  });

  const handleEditConfig = () => {
    if (config) {
      setConfigForm({
        retrySchedule: config.retrySchedule,
        maxAttempts: config.maxAttempts,
        finalAction: config.finalAction,
        gracePeriodDays: config.gracePeriodDays,
        emailsEnabled: config.emailsEnabled,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyToEmail: config.replyToEmail,
      });
    }
    setIsEditingConfig(true);
  };

  const handleSaveConfig = () => {
    updateConfigMutation.mutate(configForm);
  };

  const handleEditTemplate = (template: DunningEmailTemplate) => {
    setTemplateForm({
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText ?? "",
      enabled: template.enabled,
    });
    setEditingTemplate(template.type);
  };

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        type: editingTemplate,
        data: templateForm,
      });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dunning Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage payment recovery for failed invoices
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <dt className="text-sm font-medium text-gray-500">Invoices in Dunning</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">
            {statsLoading ? "..." : stats?.invoicesInDunning ?? 0}
          </dd>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <dt className="text-sm font-medium text-gray-500">Amount at Risk</dt>
          <dd className="mt-1 text-3xl font-semibold text-red-600">
            {statsLoading
              ? "..."
              : stats
                ? formatCurrency(stats.totalAmountAtRisk, stats.currency || "usd")
                : "$0.00"}
          </dd>
          {stats?.amountsByCurrency && stats.amountsByCurrency.length > 1 && (
            <dd className="mt-1 text-xs text-gray-500">
              {stats.amountsByCurrency.map((a) => (
                <span key={a.currency} className="mr-2">
                  {formatCurrency(a.amount, a.currency)}
                </span>
              ))}
            </dd>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <dt className="text-sm font-medium text-gray-500">Recovery Rate</dt>
          <dd className="mt-1 text-3xl font-semibold text-green-600">
            {statsLoading ? "..." : `${stats?.recoveryRate ?? 0}%`}
          </dd>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <dt className="text-sm font-medium text-gray-500">Pending Attempts</dt>
          <dd className="mt-1 text-3xl font-semibold text-yellow-600">
            {statsLoading ? "..." : stats?.attemptsByStatus.pending ?? 0}
          </dd>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Dunning Configuration</h2>
          {!isEditingConfig && (
            <button
              onClick={handleEditConfig}
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Edit Configuration
            </button>
          )}
        </div>
        <div className="p-6">
          {configLoading ? (
            <div className="text-gray-500">Loading configuration...</div>
          ) : isEditingConfig ? (
            <div className="space-y-6">
              {/* Retry Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Retry Schedule (days after failure)
                </label>
                <input
                  type="text"
                  value={configForm.retrySchedule?.join(", ") ?? ""}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      retrySchedule: e.target.value
                        .split(",")
                        .map((s) => parseInt(s.trim(), 10))
                        .filter((n) => !isNaN(n)),
                    })
                  }
                  placeholder="1, 3, 5, 7"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Comma-separated days when retry attempts will be made
                </p>
              </div>

              {/* Max Attempts */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Maximum Attempts
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={configForm.maxAttempts ?? 4}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      maxAttempts: parseInt(e.target.value, 10),
                    })
                  }
                  className="mt-1 block w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Final Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Final Action (after all retries fail)
                </label>
                <select
                  value={configForm.finalAction ?? "suspend"}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      finalAction: e.target.value as "suspend" | "cancel",
                    })
                  }
                  className="mt-1 block w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="suspend">Suspend Subscription</option>
                  <option value="cancel">Cancel Subscription</option>
                </select>
              </div>

              {/* Grace Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Grace Period (days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={configForm.gracePeriodDays ?? 0}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      gracePeriodDays: parseInt(e.target.value, 10),
                    })
                  }
                  className="mt-1 block w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Days to wait before starting dunning after payment failure
                </p>
              </div>

              {/* Email Settings */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="emailsEnabled"
                    checked={configForm.emailsEnabled ?? false}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        emailsEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="emailsEnabled" className="ml-2 block text-sm font-medium text-gray-700">
                    Enable email notifications
                  </label>
                </div>

                {configForm.emailsEnabled && (
                  <div className="space-y-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">From Email</label>
                      <input
                        type="email"
                        value={configForm.fromEmail ?? ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, fromEmail: e.target.value })
                        }
                        placeholder="billing@example.com"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">From Name</label>
                      <input
                        type="text"
                        value={configForm.fromName ?? ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, fromName: e.target.value })
                        }
                        placeholder="Billing Team"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Reply-To Email</label>
                      <input
                        type="email"
                        value={configForm.replyToEmail ?? ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, replyToEmail: e.target.value })
                        }
                        placeholder="support@example.com"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setIsEditingConfig(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                </button>
              </div>

              {updateConfigMutation.isError && (
                <p className="text-red-500 text-sm">
                  Error: {(updateConfigMutation.error as Error).message}
                </p>
              )}
            </div>
          ) : (
            <dl className="grid grid-cols-3 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Retry Schedule</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {config?.retrySchedule?.join(", ")} days
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Max Attempts</dt>
                <dd className="mt-1 text-sm text-gray-900">{config?.maxAttempts}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Final Action</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">
                  {config?.finalAction} subscription
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Grace Period</dt>
                <dd className="mt-1 text-sm text-gray-900">{config?.gracePeriodDays} days</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email Notifications</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {config?.emailsEnabled ? (
                    <span className="text-green-600">Enabled</span>
                  ) : (
                    <span className="text-gray-500">Disabled</span>
                  )}
                </dd>
              </div>
              {config?.emailsEnabled && config?.fromEmail && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">From Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{config.fromEmail}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* Email Templates Section */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
          <p className="mt-1 text-sm text-gray-500">
            Customize the emails sent during the dunning process
          </p>
        </div>
        <div className="p-6">
          {templatesLoading ? (
            <div className="text-gray-500">Loading templates...</div>
          ) : editingTemplate ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Edit: {EMAIL_TYPE_LABELS[editingTemplate]}
                </h3>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  &times; Close
                </button>
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="templateEnabled"
                  checked={templateForm.enabled ?? true}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, enabled: e.target.checked })
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="templateEnabled" className="ml-2 text-sm font-medium text-gray-700">
                  Enable this email
                </label>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  value={templateForm.subject ?? ""}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* HTML Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700">HTML Body</label>
                <textarea
                  value={templateForm.bodyHtml ?? ""}
                  onChange={(e) => setTemplateForm({ ...templateForm, bodyHtml: e.target.value })}
                  rows={12}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Variables: {"{{customerName}}, {{invoiceAmount}}, {{invoiceNumber}}, {{updatePaymentUrl}}, {{companyName}}, {{supportEmail}}"}
                </p>
              </div>

              {/* Plain Text Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Plain Text Body</label>
                <textarea
                  value={templateForm.bodyText ?? ""}
                  onChange={(e) => setTemplateForm({ ...templateForm, bodyText: e.target.value })}
                  rows={8}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={updateTemplateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </button>
              </div>

              {updateTemplateMutation.isError && (
                <p className="text-red-500 text-sm">
                  Error: {(updateTemplateMutation.error as Error).message}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {emailTemplates?.map((template) => (
                <div
                  key={template.type}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">
                        {EMAIL_TYPE_LABELS[template.type]}
                      </h3>
                      {template.isDefault ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          Default
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                          Customized
                        </span>
                      )}
                      {!template.enabled && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {EMAIL_TYPE_DESCRIPTIONS[template.type]}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 truncate max-w-lg">
                      Subject: {template.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!template.isDefault && (
                      <button
                        onClick={() => resetTemplateMutation.mutate(template.type)}
                        disabled={resetTemplateMutation.isPending}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invoices in Dunning Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Invoices in Dunning</h2>
        </div>
        {invoicesLoading ? (
          <div className="p-6 text-gray-500">Loading invoices...</div>
        ) : !invoicesData?.data?.length ? (
          <div className="p-6 text-center text-gray-500">
            <p className="text-lg font-medium">No invoices in dunning</p>
            <p className="mt-1 text-sm">
              When payment failures occur, invoices will appear here for recovery.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attempts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Attempt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoicesData.data.map((invoice: InvoiceInDunning) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.customer.name || invoice.customer.email}
                    </div>
                    <div className="text-sm text-gray-500">{invoice.customer.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.amountDue, invoice.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invoice.dunningAttemptCount >= (config?.maxAttempts ?? 4)
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {invoice.dunningAttemptCount} / {config?.maxAttempts ?? 4}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {invoice.nextDunningAttemptAt
                      ? new Date(invoice.nextDunningAttemptAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(invoice.dunningStartedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        retryMutation.mutate(invoice.id);
                      }}
                      disabled={retryMutation.isPending}
                      className="text-primary-600 hover:text-primary-900 font-medium"
                    >
                      Retry Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
