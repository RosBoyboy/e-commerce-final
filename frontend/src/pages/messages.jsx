import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Send, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchConversations,
  fetchConversation,
  sendMessage as sendMessageApi,
  fetchAdminRiders,
  assignAdminOrderRider,
} from '@/services/api';
import { useMessageUnread } from '@/context/MessageUnreadContext';
import { useToast } from '@/components/ui/ToastProvider';
import AdminMessagesLayout from '@/components/layout/AdminMessagesLayout';
import CustomerShell from '@/components/layout/CustomerShell';
import styles from '@/styles/messages.module.scss';
import dashStyles from '@/styles/dashboard.module.scss';
import { getEcho, leaveEchoChannel } from '@/lib/echo';

/** Slower polling when Laravel Echo + Pusher is configured (NEXT_PUBLIC_PUSHER_APP_KEY). */
const LIST_POLL_MS = process.env.NEXT_PUBLIC_PUSHER_APP_KEY ? 12000 : 5000;
const THREAD_POLL_MS = process.env.NEXT_PUBLIC_PUSHER_APP_KEY ? 12000 : 2200;

const QUICK_REPLIES = [
  { emoji: '🚚', text: 'Order picked up!' },
  { emoji: '✅', text: 'Payment confirmed' },
  { emoji: '📍', text: 'Rider is near you' },
  { emoji: '👋', text: 'Thank you for shopping!' },
];

function avatarLetter(name) {
  const s = (name || '?').trim();
  return s.charAt(0).toUpperCase();
}

function formatChatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** For admin, outbound chat is stored under the store user id (conversation.seller_id), not the admin id. */
function isMessageFromViewerSide(message, user, conversation) {
  if (message == null || user == null) return false;
  if (user.role?.name === 'admin' && conversation?.seller_id != null) {
    return Number(message.user_id) === Number(conversation.seller_id);
  }
  return Number(message.user_id) === Number(user.id);
}

function isFetchCanceled(err) {
  return err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';
}

export default function Messages() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendText, setSendText] = useState('');
  const [sending, setSending] = useState(false);
  const [fleetRiders, setFleetRiders] = useState([]);
  const [assigningRider, setAssigningRider] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedIdRef = useRef(null);
  const conversationFetchAbortRef = useRef(null);
  const lastScrolledConvIdRef = useRef(null);
  const prevSelectedRef = useRef(null);
  const { refreshUnread } = useMessageUnread();

  const loadConversations = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true;
      if (!silent) setLoading(true);
      try {
        const res = await fetchConversations();
        const list = res.data.conversations || [];
        setConversations(list);
        const fromQuery = router.query.conversation ? Number(router.query.conversation) : null;
        if (fromQuery && list.some((c) => c.id === fromQuery)) {
          setSelectedId(fromQuery);
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [router.query.conversation],
  );

  const isAdmin = user?.role?.name === 'admin';

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminRiders()
      .then((res) => setFleetRiders(res.data.riders || []))
      .catch(() => setFleetRiders([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!user) {
      if (!authLoading) router.push('/auth/login');
      return;
    }
    const bootstrap = async () => {
      await loadConversations();
      await refreshUnread();
    };
    bootstrap();
    const listPoll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadConversations({ silent: true }).then(() => refreshUnread());
    }, LIST_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        loadConversations({ silent: true }).then(() => refreshUnread());
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      clearInterval(listPoll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [user?.id, user?.role?.name, authLoading, refreshUnread, loadConversations]);

  const conversationIdFromQuery = router.query.conversation ? Number(router.query.conversation) : null;
  useEffect(() => {
    if (conversationIdFromQuery && !loading) {
      setSelectedId(conversationIdFromQuery);
    }
  }, [conversationIdFromQuery, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = useCallback(
    async (id, opts = {}) => {
      const silent = opts.silent === true;
      conversationFetchAbortRef.current?.abort();
      const ac = new AbortController();
      conversationFetchAbortRef.current = ac;

      if (!silent) setMessagesLoading(true);
      try {
        const res = await fetchConversation(id, { signal: ac.signal });
        if (id !== selectedIdRef.current) return;

        setConversation(res.data.conversation || null);
        const nextMessages = res.data.messages || [];
        setActiveOrder(res.data.active_order ?? null);

        if (silent) {
          setMessages((prev) => {
            const prevLast = prev[prev.length - 1]?.id;
            const nextLast = nextMessages[nextMessages.length - 1]?.id;
            const grew =
              nextMessages.length > prev.length || (nextLast != null && nextLast !== prevLast);
            if (grew) {
              setTimeout(() => scrollToBottom(), 50);
            }
            return nextMessages;
          });
        } else {
          setMessages(nextMessages);
          if (lastScrolledConvIdRef.current !== id) {
            lastScrolledConvIdRef.current = id;
            setTimeout(scrollToBottom, 100);
          }
        }
      } catch (err) {
        if (isFetchCanceled(err)) return;
        console.error('Failed to load conversation:', err);
      } finally {
        if (!silent && id === selectedIdRef.current && !ac.signal.aborted) {
          setMessagesLoading(false);
        }
        if (!ac.signal.aborted) refreshUnread();
      }
    },
    [refreshUnread],
  );

  useEffect(() => {
    if (!selectedId) {
      prevSelectedRef.current = null;
      setConversation(null);
      setMessages([]);
      setActiveOrder(null);
      return undefined;
    }
    if (prevSelectedRef.current !== selectedId) {
      prevSelectedRef.current = selectedId;
      setMessages([]);
      setConversation(null);
      setActiveOrder(null);
    }
    lastScrolledConvIdRef.current = null;

    let intervalId = null;
    let cancelled = false;
    const pollMs = THREAD_POLL_MS;
    const onVisOrFocus = () => {
      if (cancelled || document.visibilityState !== 'visible' || !selectedIdRef.current) return;
      loadConversation(selectedIdRef.current, { silent: true });
    };

    (async () => {
      await loadConversation(selectedId);
      if (cancelled) return;
      intervalId = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        loadConversation(selectedId, { silent: true });
      }, pollMs);
      document.addEventListener('visibilitychange', onVisOrFocus);
      window.addEventListener('focus', onVisOrFocus);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisOrFocus);
      window.removeEventListener('focus', onVisOrFocus);
      conversationFetchAbortRef.current?.abort();
    };
  }, [selectedId, loadConversation]);

  useEffect(() => {
    if (!selectedId || !user) return undefined;
    const echo = getEcho();
    if (!echo) return undefined;

    const channel = echo.private(`conversation.${selectedId}`);
    channel.listen('.message.sent', (payload) => {
      const m = payload?.message;
      if (!m || Number(m.conversation_id) !== Number(selectedId)) return;
      setMessages((prev) => {
        if (prev.some((x) => Number(x.id) === Number(m.id))) return prev;
        return [...prev, m];
      });
      setTimeout(() => scrollToBottom(), 50);
      loadConversations({ silent: true });
      refreshUnread();
    });

    return () => {
      leaveEchoChannel(selectedId);
    };
  }, [selectedId, user?.id, loadConversations, refreshUnread]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = sendText.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      await sendMessageApi(selectedId, text);
      setSendText('');
      await loadConversation(selectedId, { silent: true });
      scrollToBottom();
    } catch (err) {
      console.error('Send failed:', err);
      showToast({ message: err.response?.data?.message || 'Could not send message.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const sendTextMessage = async (text) => {
    const t = text.trim();
    if (!t || !selectedId || sending) return;
    setSending(true);
    try {
      await sendMessageApi(selectedId, t);
      await loadConversation(selectedId, { silent: true });
      scrollToBottom();
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Could not send message.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text) => {
    sendTextMessage(text);
  };

  const handleAssignRider = async (e) => {
    const riderId = e.target.value ? Number(e.target.value) : null;
    if (!riderId || !activeOrder?.id || !selectedId) return;
    const rider = fleetRiders.find((r) => r.id === riderId);
    const name = rider?.name || 'Rider';
    setAssigningRider(true);
    try {
      await assignAdminOrderRider(activeOrder.id, riderId);
      await sendMessageApi(selectedId, `Rider ${name} has been assigned to your order!`);
      await loadConversation(selectedId, { silent: true });
      showToast({ message: 'Rider assigned.', type: 'success' });
    } catch (err) {
      showToast({
        message: err.response?.data?.message || 'Could not assign rider.',
        type: 'error',
      });
    } finally {
      setAssigningRider(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const canMessage =
    user.role?.name === 'admin' || user.role?.name === 'customer';
  const isCustomerViewer = user.role?.name === 'customer';
  const showListOnMobile = !selectedId;
  const showThreadOnMobile = !!selectedId;

  const threadMain = !canMessage ? (
    <div className={styles.empty}>
      <p>Messaging is available for customers and administrators only.</p>
    </div>
  ) : (
    <div
      className={`${styles.layout} ${user.role?.name === 'customer' ? styles.layoutEmbedded : styles.layoutPro}`}
    >
      <aside className={`${styles.sidebar} ${showThreadOnMobile ? styles.sidebarHidden : ''}`}>
        {loading ? (
          <p className={styles.muted}>Loading conversations...</p>
        ) : conversations.length === 0 ? (
          <p className={styles.muted}>
            No conversations yet.{' '}
            {user.role?.name === 'customer' && 'Start one from a product page or checkout (Message seller).'}
          </p>
        ) : (
          <>
            <div className={styles.sidebarHeader}>Messages</div>
            <ul className={styles.conversationList}>
              {conversations.map((c) => {
                const other = c.other_user;
                return (
                  <li
                    key={c.id}
                    className={`${styles.conversationItem} ${selectedId === c.id ? styles.active : ''}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className={styles.convRow}>
                      <div className={styles.avatarWrap}>
                        {isCustomerViewer ? (
                          <span className={styles.storeAvatarList} aria-hidden>
                            <Store size={18} strokeWidth={1.75} />
                          </span>
                        ) : (
                          <span className={styles.avatarCircle}>{avatarLetter(other?.name)}</span>
                        )}
                        <span className={styles.onlineDot} title="Active" aria-hidden />
                      </div>
                      <div className={styles.convMain}>
                        <div className={styles.convHeader}>
                          <span className={styles.otherName}>{other?.name || 'Unknown'}</span>
                          {c.unread_count > 0 && (
                            <span className={styles.unreadBadge}>{c.unread_count}</span>
                          )}
                        </div>
                        {c.last_message && (
                          <p className={styles.lastPreview}>
                            {c.last_message.is_mine ? 'You: ' : ''}
                            {c.last_message.body}
                          </p>
                        )}
                        {c.product && (
                          <p className={styles.productLabel}>Re: {c.product.name}</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </aside>

      <main
        className={`${styles.main} ${showListOnMobile && !conversations.length ? styles.mainFull : ''} ${
          showThreadOnMobile ? styles.mainActive : ''
        }`}
      >
        {!selectedId ? (
          <div className={styles.empty}>
            <p>Select a conversation to open the chat.</p>
            <p className={styles.mutedSmall}>
              Or start from a product page using &quot;Message seller&quot;.
            </p>
          </div>
        ) : (
          <>
            {conversation && (
              <div className={styles.threadHeader}>
                <button
                  type="button"
                  className={styles.backBtn}
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to conversations"
                >
                  ← Back
                </button>
                <div className={styles.threadHeaderLead}>
                  <div className={styles.threadAvatarWrap}>
                    {isCustomerViewer ? (
                      <span className={styles.storeAvatarHeader} aria-hidden>
                        <Store size={22} strokeWidth={1.75} />
                      </span>
                    ) : (
                      <span className={styles.avatarCircleLarge}>
                        {avatarLetter(conversation.other_user?.name)}
                      </span>
                    )}
                    <span className={styles.onlineDot} title="Active" aria-hidden />
                  </div>
                  <div className={styles.threadHeaderContent}>
                    <div className={styles.chattingWithTitle}>
                      <span className={styles.chattingWithLabel}>Chatting with:</span>{' '}
                      <span className={styles.chattingWithName}>
                        {conversation.other_user?.name || 'Store'}
                      </span>
                      {isCustomerViewer && (
                        <span className={styles.verifiedBadge}>
                          <BadgeCheck size={13} strokeWidth={2.5} aria-hidden />
                          Verified
                        </span>
                      )}
                    </div>
                    {conversation.product && (
                      <p className={styles.threadProduct}>Re: {conversation.product.name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isAdmin && activeOrder && (
              <div className={styles.orderInfoBar} role="region" aria-label="Order info">
                <div className={styles.orderInfoMain}>
                  <span className={styles.orderInfoLabel}>Order</span>
                  <span className={styles.orderInfoNumber}>#{activeOrder.order_number || activeOrder.id}</span>
                  <span className={styles.orderMetaMuted}>·</span>
                  <span className={styles.orderMetaMuted}>{(activeOrder.status || '').toUpperCase()}</span>
                  {activeOrder.rider?.name && (
                    <>
                      <span className={styles.orderMetaMuted}>·</span>
                      <span className={styles.orderMetaMuted}>Rider: {activeOrder.rider.name}</span>
                    </>
                  )}
                </div>
                <div className={styles.orderInfoActions}>
                  <label htmlFor="assign-rider-chat" className={styles.assignLabel}>
                    Assign rider
                  </label>
                  <select
                    id="assign-rider-chat"
                    className={styles.riderSelect}
                    value={activeOrder.rider_id ? String(activeOrder.rider_id) : ''}
                    onChange={handleAssignRider}
                    disabled={
                      assigningRider ||
                      (activeOrder.status || '').toLowerCase() !== 'shipped' ||
                      fleetRiders.length === 0
                    }
                  >
                    <option value="">
                      {(activeOrder.status || '').toLowerCase() === 'shipped'
                        ? 'Select rider…'
                        : 'Ship order first'}
                    </option>
                    {fleetRiders.map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.name}
                        {r.status === 'busy' ? ' (busy)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className={styles.messagesArea}>
              {messagesLoading ? (
                <p className={styles.muted}>Loading...</p>
              ) : (
                <>
                  {messages.map((m) => {
                    const mine = isMessageFromViewerSide(m, user, conversation);
                    return (
                      <div
                        key={m.id}
                        className={`${styles.messageRow} ${mine ? styles.rowMine : styles.rowTheirs}`}
                      >
                        {!mine && (
                          <div className={styles.bubbleAvatar} aria-hidden>
                            {isCustomerViewer ? (
                              <span className={styles.storeAvatarBubble}>
                                <Store size={16} strokeWidth={1.75} />
                              </span>
                            ) : (
                              <span className={styles.avatarCircleSmall}>
                                {avatarLetter(conversation?.other_user?.name)}
                              </span>
                            )}
                          </div>
                        )}
                        <div
                          className={`${styles.bubbleColumn} ${mine ? styles.bubbleColumnMine : styles.bubbleColumnTheirs}`}
                        >
                          <div
                            className={`${styles.messageBubble} ${
                              mine ? styles.bubbleMine : styles.bubbleTheirs
                            }`}
                          >
                            <p className={styles.messageBody}>{m.body}</p>
                          </div>
                          <time className={styles.messageTimeUnder} dateTime={m.created_at}>
                            {formatChatTime(m.created_at)}
                          </time>
                        </div>
                        {mine && (
                          <div className={styles.bubbleAvatar} aria-hidden>
                            <span className={styles.avatarCircleSmall}>
                              {avatarLetter(user?.name)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {isAdmin && selectedId && (
              <div className={styles.quickReplies}>
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q.text}
                    type="button"
                    className={styles.quickChip}
                    onClick={() => handleQuickReply(`${q.emoji} ${q.text}`)}
                    disabled={sending}
                  >
                    <span aria-hidden>{q.emoji}</span> {q.text}
                  </button>
                ))}
              </div>
            )}

            <form className={styles.sendForm} onSubmit={handleSend}>
              <input
                type="text"
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                placeholder="Type a message…"
                className={styles.sendInput}
                disabled={sending}
                aria-label="Message"
              />
              <button
                type="submit"
                className={styles.sendBtnIcon}
                disabled={sending || !sendText.trim()}
                aria-label="Send message"
              >
                <Send size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );

  if (user.role?.name === 'customer') {
    return (
      <>
        <Head>
          <title>Messages - urbanNxt</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <CustomerShell activeKey="messages">
          <div className={dashStyles.customerPageHeading}>
            <h1>Messages</h1>
            <p className={dashStyles.subtitle}>
              Chat with sellers about your orders — refined layout, same account.
            </p>
          </div>
          <div className={dashStyles.customerMessagesPanel}>{threadMain}</div>
        </CustomerShell>
      </>
    );
  }

  if (user.role?.name === 'admin') {
    return (
      <AdminMessagesLayout>
        <Head>
          <title>Messages - urbanNxt</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className={styles.sellerPageWrap}>
          <h1 className={styles.pageTitle}>Messages</h1>
          <p className={styles.pageSubtitle}>Customer conversations, logistics, and quick replies.</p>
          {threadMain}
        </div>
      </AdminMessagesLayout>
    );
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>Messages - urbanNxt</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Messages</h1>
        <p className={styles.pageSubtitle}>Messaging is available for customers and administrators.</p>
        {threadMain}
      </div>
    </div>
  );
}
