import { Outlet, NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Offers', href: '/offers' },
  { name: 'Subscriptions', href: '/subscriptions' },
  { name: 'Customers', href: '/customers' },
  { name: 'Webhooks', href: '/webhooks' },
  { name: 'API Keys', href: '/api-keys' },
  { name: 'Settings', href: '/settings' },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <span className="text-xl font-bold text-gray-900">Relay</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md',
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* Environment indicator */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center px-3 py-2 text-sm text-gray-500 bg-yellow-50 rounded-md">
              <span className="w-2 h-2 mr-2 bg-yellow-400 rounded-full"></span>
              Test Mode
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
