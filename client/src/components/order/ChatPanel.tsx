import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '../common/Alert';
import { Button, Spinner } from '../common/Button';
import { ApiRequestError } from '../../services/apiClient';
import { chatService } from '../../services/chatService';
import type { ChatMessage } from '../../types';
import { formatDateTime } from '../../utils/format';

interface ChatPanelProps {
  orderId?: string;
  listingId?: string;
  threadId?: string;
  myRole: 'buyer' | 'farmer';
  /** Compact mode for listing detail */
  compact?: boolean;
}

export function ChatPanel({ orderId, listingId, threadId, myRole, compact = false }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setProblem('');
      try {
        if (threadId) {
          const data = await chatService.read(threadId);
          if (cancelled) return;
          setConversationId(data.thread.id);
          setMessages(data.messages);
        } else {
          const data = orderId
            ? await chatService.forOrder(orderId)
            : listingId
              ? await chatService.forListing(listingId)
              : null;
          if (!data) throw new Error('No conversation target');
          if (cancelled) return;
          setConversationId(data.conversation.id);
          setMessages(data.messages);
        }
        window.dispatchEvent(new Event('halal:messages-changed'));
      } catch (err) {
        if (!cancelled) setProblem(err instanceof ApiRequestError ? err.message : 'Could not load messages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [orderId, listingId, threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId) return;
    setSending(true);
    setProblem('');
    try {
      const message = await chatService.send(conversationId, body);
      setMessages((prev) => [...prev, message]);
      setDraft('');
      window.dispatchEvent(new Event('halal:messages-changed'));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'Message did not send.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="grid place-items-center py-8 text-brand-600"><Spinner className="size-6" /></div>;
  }

  return (
    <div className="space-y-4">
      {problem ? <Alert tone="error">{problem}</Alert> : null}

      <div className={`overflow-y-auto rounded-2xl bg-stone-50 p-4 ring-1 ring-inset ring-stone-200 ${compact ? 'max-h-72' : 'max-h-[26rem]'}`}>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">
            {myRole === 'buyer'
              ? 'Ask the farmer about availability, condition, delivery arrangements, or any other details before placing your order.'
              : 'Messages from the buyer will appear here.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => {
              const mine = message.senderRole === myRole;
              return (
                <li key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? 'bg-brand-700 text-white' : 'bg-white text-ink-800 ring-1 ring-stone-200'}`}>
                    {!mine ? <p className={`mb-1 text-[11px] font-semibold ${mine ? 'text-brand-100' : 'text-brand-700'}`}>{message.senderName ?? (message.senderRole === 'farmer' ? 'Farmer' : 'Buyer')}</p> : null}
                    <p className="whitespace-pre-line">{message.body}</p>
                    <p className={`mt-1.5 text-[11px] ${mine ? 'text-brand-100/80' : 'text-ink-400'}`}>{formatDateTime(message.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <label className="sr-only" htmlFor={`chat-${orderId ?? listingId}`}>Message</label>
        <textarea
          id={`chat-${orderId ?? listingId}`}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={myRole === 'buyer' ? 'Ask about availability, condition, delivery...' : 'Write a reply...'}
          className="min-h-[4.5rem] flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
          maxLength={2000}
        />
        <Button type="submit" isLoading={sending} disabled={!draft.trim()} className="self-end">
          Send
        </Button>
      </form>
    </div>
  );
}
