export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your store and WhatsApp configuration</p>
      </div>

      {/* Store Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Store Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
            <input
              type="text"
              defaultValue="My Food Store"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store URL Slug</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
              <span className="bg-gray-50 px-3 py-2 text-sm text-gray-500 border-r border-gray-300">
                orderflow.app/order/
              </span>
              <input
                type="text"
                defaultValue="my-food-store"
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">WhatsApp Integration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Business Number</label>
            <input
              type="tel"
              placeholder="+234 800 000 0000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
            <input
              type="password"
              placeholder="WhatsApp Business API token"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
            <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
            WhatsApp webhook is active and receiving messages
          </div>
        </div>
      </div>

      <button className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        Save Changes
      </button>
    </div>
  );
}
