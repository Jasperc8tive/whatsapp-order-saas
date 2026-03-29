let notifyTimeout: any = null;
export function useSyncOfflineOrders() {
  useEffect(() => {
    if (!navigator.onLine) return;
    let syncing = false;
    async function sync() {
      if (syncing) return;
      syncing = true;
      const orders = await offlineDB.getOrders();
      let synced = false;
      for (const order of orders) {
        if (order.offline) {
          try {
            await createManualOrder(order);
            await offlineDB.clearOrders();
            synced = true;
          } catch {}
        }
      }
      if (synced) {
        const el = document.createElement('div');
        el.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded shadow-lg';
        el.textContent = 'Offline orders synced!';
        document.body.appendChild(el);
        clearTimeout(notifyTimeout);
        notifyTimeout = setTimeout(() => {
          el.remove();
        }, 3000);
      }
      syncing = false;
    }
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, []);
}
