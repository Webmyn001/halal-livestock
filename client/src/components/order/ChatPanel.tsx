import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FaPaperPlane } from 'react-icons/fa6';
import { Alert } from '../common/Alert';
import { Button, Spinner } from '../common/Button';
import { ApiRequestError } from '../../services/apiClient';
import { chatService } from '../../services/chatService';
import type { ChatMessage } from '../../types';
import { formatDateTime } from '../../utils/format';

interface ChatPanelProps {
  orderId: string;
  /** The buyer and the farmer sit on opposite sides of the same thread. */
  myRole: 'buyer' | 'farmer';
}

export function ChatPanel({ orderId, myRole }: ChatPanelProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [problem, setProblem] = useState('');
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    chatService
      .forOrder(orderId)
      .then((data) => {
        if (cancelled) return;
        setThreadId(data.conversation.id);
        setMessages(data.messages);
        // Reading the thread clears this side's unread count on the server, so refresh the badge.
        window.dispatchEvent(new Event('halal:messages-changed'));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not open the messages', 'UNKNOWN'));
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!threadId) return;
    const text = body.trim();
    if (!text) return;

    setProblem('');
    setIsSending(true);
    try {
      const message = await chatService.send(threadId, text);
      setMessages((current) => [...(current ?? []), message]);
      setBody('');
      window.dispatchEvent(new Event('halal:messages-changed'));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That message did not send.');
    } finally {
      setIsSending(false);
    }
  }

  if (error) {
    return (
      <Alert tone="error" title="Messages are not open">
        {error.message}
      </Alert>
    );
  }

  if (!messages) {
    return (
      <div className="grid place-items-center py-8 text-brand-600">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-xs leading-relaxed text-ink-500 ring-1 ring-inset ring-stone-200">
          No message yet. Ask about weights, the collection time or how the animals are crated. Keep it here so an admin
          can read the whole conversation if a case is opened later.
        </p>
      ) : (
        <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => {
            const mine = message.senderRole === myRole;
            return (
              <li key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    mine ? 'bg-brand-600 text-white' : 'bg-stone-100 text-ink-800'
                  }`}
                >
                  {mine ? null : (
                    <p className="mb-0.5 text-[11px] font-semibold text-brand-800">
                      {message.senderName ?? (message.senderRole === 'buyer' ? 'Buyer' : 'Farmer')}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{message.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-brand-200' : 'text-ink-500'}`}>
                    {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
          <div ref={endRef} />
        </ul>
      )}

      {problem ? <Alert tone="error">{problem}</Alert> : null}

      <form onSubmit={handleSend} className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Write a message</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Ask the other side a question."
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-ink-900 shadow-sm transition placeholder:text-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
          />
        </label>
        <Button type="submit" isLoading={isSending} disabled={body.trim().length === 0}>
          <FaPaperPlane aria-hidden="true" className="size-3.5" />
          Send
        </Button>
      </form>
    </div>
  );
}
