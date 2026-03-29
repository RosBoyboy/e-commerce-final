import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchConversationsUnreadCount } from '@/services/api';

const MessageUnreadContext = createContext(null);

export function MessageUnreadProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const role = user.role?.name;
    if (role !== 'customer' && role !== 'seller' && role !== 'admin') {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetchConversationsUnreadCount();
      setUnreadCount(res.data?.unread_count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const role = user.role?.name;
    if (role !== 'customer' && role !== 'seller') {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const tick = () => {
      fetchConversationsUnreadCount()
        .then((res) => {
          if (!cancelled) setUnreadCount(res.data?.unread_count ?? 0);
        })
        .catch(() => {});
    };

    tick();
    const id = setInterval(tick, 5000);

    const onFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        tick();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [user?.id, user?.role?.name]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnread }),
    [unreadCount, refreshUnread],
  );

  return (
    <MessageUnreadContext.Provider value={value}>
      {children}
    </MessageUnreadContext.Provider>
  );
}

export function useMessageUnread() {
  const ctx = useContext(MessageUnreadContext);
  if (!ctx) {
    throw new Error('useMessageUnread must be used within MessageUnreadProvider');
  }
  return ctx;
}
